#!/usr/bin/env python
"""Recover finding units whose headers Docling dropped entirely (D39 step 3).

The LLM is a POINTER, never a writer: given the absorbed region and the missing
findings' numbers+titles (from the always-complete Summary-of-Findings table),
it returns the exact verbatim first line of each missing finding's body. We cut
mechanically, and a cut only happens if ALL validators pass (fail-closed):

  V1  the returned line is an EXACT substring line of the absorbed region
  V2  cuts are monotonic (finding 14's line appears before finding 15's)
  V3  figure-caption bounds: the cut for finding n must sit AFTER the last
      "Figure p.x" of the host finding p and BEFORE/AT the first "Figure n.x",
      when those captions exist
  V4  every resulting segment (host's trimmed body + each recovered body)
      keeps >= 200 chars

Output: data/corpus/recovered_units.jsonl (doc, number, title, text, validators)
plus a log of failures. Nothing in align.py changes; extract_pairs merges these
units at runtime via --recovered flag (added separately).
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import time
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))
from legible.align import extract_findings_tob, tob_finding_table, TOB_ID_RX, _slice_between  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data/corpus/recovered_units.jsonl"
LOG = ROOT / "data/corpus/recovered_units_log.jsonl"

PROMPT = """The text below is from a security report. It contains the body of finding \
#{host} ("{host_title}") but the bodies of these findings got merged into it because \
their headers were lost in PDF conversion:

{missing_list}

For EACH missing finding, identify the EXACT line where its body begins (the first \
line of text that belongs to it). Copy the line VERBATIM — every character exactly as \
it appears, do not paraphrase, do not trim.

TEXT:
{region}

Reply JSON only: {{"cuts": [{{"number": N, "first_line": "<exact verbatim line>"}}], \
"unsure": [<numbers you cannot locate>]}}"""


def load_key() -> str:
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("OPENAI_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("no key")


def call(model: str, prompt: str, key: str) -> dict:
    body = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}],
                       "response_format": {"type": "json_object"}}).encode()
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=body,
                                 headers={"Authorization": f"Bearer {key}",
                                          "Content-Type": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                out = json.load(r)
            m = re.search(r"\{.*\}", out["choices"][0]["message"]["content"], re.S)
            return json.loads(m.group(0)) if m else {}
        except Exception:
            if attempt == 3:
                return {}
            time.sleep(2 ** (attempt + 1))
    return {}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="gpt-5-mini")
    ap.add_argument("--budget-usd", type=float, default=1.5)
    ap.add_argument("--limit-docs", type=int, default=0)
    a = ap.parse_args()
    key = load_key()

    done_docs = set()
    if LOG.exists():
        done_docs = {json.loads(l)["doc"] for l in open(LOG)}

    spend_est = 0.0
    n_rec = n_fail = 0
    out_f, log_f = OUT.open("a"), LOG.open("a")
    docs = 0
    for f in sorted((ROOT / "data/corpus/out/md").glob("*.md")):
        if "__" in f.name or f.stem in done_docs:
            continue
        md = f.read_text()
        table = tob_finding_table(md)
        if not table:
            continue
        units = {u.number: u for u in extract_findings_tob(md)}
        missing = sorted(set(table) - set(units))
        if not missing:
            continue
        docs += 1
        if a.limit_docs and docs > a.limit_docs:
            break
        # group missing findings by host = nearest anchored unit below them
        anchored = sorted(units)
        for host in anchored:
            group = [n for n in missing
                     if host < n and (not any(host < x <= n for x in anchored))]
            group = [n for n in group if n - host <= 6]  # sanity: host absorbs neighbors
            if not group:
                continue
            region = units[host].text
            if len(region) < 400:
                continue
            missing_list = "\n".join(f"- Finding #{n}: \"{table[n][0]}\"" for n in group)
            res = call(a.model, PROMPT.format(host=host, host_title=units[host].title,
                                              missing_list=missing_list,
                                              region=region[:14000]), key)
            spend_est += 0.004
            cuts = {c.get("number"): c.get("first_line", "") for c in res.get("cuts", [])
                    if isinstance(c, dict)}
            region_lines = region.split("\n")
            # V1: exact line membership → line index
            idx = {}
            for n in group:
                line = cuts.get(n, "").strip()
                if not line:
                    continue
                for i, l in enumerate(region_lines):
                    if l.strip() == line:
                        idx[n] = i
                        break
            # V2: monotonic
            ordered = sorted(idx.items())
            positions = [i for _, i in ordered]
            if positions != sorted(positions):
                idx = {}
            # V3: figure bounds
            def first_fig(n):
                for i, l in enumerate(region_lines):
                    if re.search(rf"Figure {n}\.\d", l):
                        return i
                return None
            ok_idx = {}
            for n, i in idx.items():
                fn = first_fig(n)
                fh_all = [j for j, l in enumerate(region_lines)
                          if re.search(rf"Figure {host}\.\d", l)]
                lo = max(fh_all) if fh_all else -1
                if fn is not None and i > fn:
                    continue  # cut after the finding's own figure = wrong
                if i <= lo:
                    continue  # cut inside host's own figures = wrong
                ok_idx[n] = i
            # V4: segment lengths + emit
            bounds = sorted(ok_idx.items(), key=lambda t: t[1])
            for k, (n, i) in enumerate(bounds):
                end = bounds[k + 1][1] if k + 1 < len(bounds) else len(region_lines)
                seg = "\n".join(region_lines[i:end]).strip()
                host_trim = "\n".join(region_lines[:bounds[0][1]]).strip()
                if len(seg) < 200 or len(host_trim) < 200:
                    n_fail += 1
                    continue
                out_f.write(json.dumps({
                    "doc": f.stem, "number": n, "title": table[n][0],
                    "severity": table[n][1], "text": seg,
                    "host": host, "validators": "V1-V4 pass"}) + "\n")
                n_rec += 1
            log_f.write(json.dumps({"doc": f.stem, "host": host, "group": group,
                                    "recovered": sorted(ok_idx), "unsure": res.get("unsure", [])}) + "\n")
            if spend_est > a.budget_usd:
                print(f"BUDGET STOP ~${spend_est:.2f}")
                out_f.close(); log_f.close()
                return
    out_f.close(); log_f.close()
    print(f"recovered units: {n_rec} (+{n_fail} failed validators) est ~${spend_est:.2f}")


if __name__ == "__main__":
    main()
