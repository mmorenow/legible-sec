#!/usr/bin/env python
"""P2b — thematic (no-ID) pair extraction for TOB (GAMEPLAN §4.3 step 3).

Stage 1 (--shortlist, local, free): from each report's "Observations and Impact"
prose, take sentences WITHOUT finding IDs; embed them + the report's finding
units (Qwen3-Embedding-0.6B); cosine top-5 candidates per sentence.
Stage 2 (--adjudicate, API): LLM picks which candidate(s) the sentence actually
discusses, or none. Emits CandidatePairs with alignment_method="embed+llm".

Resumable at both stages.
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
from legible.align import TOB_ID_RX, _slice_between, extract_findings_tob, split_sentences  # noqa: E402
from legible.schema import CandidatePair  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
MD = ROOT / "data/corpus/out/md"
SHORTLIST = ROOT / "data/pairs/thematic_shortlist.jsonl"
OUT = ROOT / "data/pairs/candidates_tob_thematic.jsonl"

ADJ_PROMPT = """A security report's executive summary contains this sentence:

SENTENCE: {sent}

Below are candidate technical findings from the SAME report. Which finding(s), if any, \
is the sentence genuinely discussing or summarizing? A thematic match counts (different \
vocabulary is fine) — but generic statements about the codebase/process that don't \
reference any specific finding's content match NONE.

{cands}

Reply JSON only: {{"matches": [<candidate numbers, may be empty>], "confidence": 0.0-1.0, \
"reason": "<short>"}}"""


def stage_shortlist() -> None:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    model = SentenceTransformer("Qwen/Qwen3-Embedding-0.6B")
    done = set()
    if SHORTLIST.exists():
        done = {json.loads(l)["span_id"] for l in open(SHORTLIST)}
    n = 0
    with SHORTLIST.open("a") as fh:
        for f in sorted(MD.glob("*.md")):
            if "__" in f.name:
                continue
            md = f.read_text()
            lines = md.split("\n")
            span = _slice_between(lines, r"^Observations and Impact$",
                                  r"^(Recommendations|Finding Severities|Project Goals|Summary of Findings)")
            if span is None:
                continue
            text = re.sub(r"<!--.*?-->", "\n\n", "\n".join(lines[span[0] + 1 : span[1]]))
            sents = [s for para in re.split(r"\n\s*\n", text) for s in split_sentences(para)
                     if not TOB_ID_RX.search(s) and len(s) > 80]
            if not sents:
                continue
            findings = extract_findings_tob(md)
            if len(findings) < 2:
                continue
            span_ids = [f"{f.stem}#th{i}" for i in range(len(sents))]
            if all(sid in done for sid in span_ids):
                continue
            f_texts = [f"{u.title}. {u.text[:400]}" for u in findings]
            emb_s = model.encode(sents, normalize_embeddings=True)
            emb_f = model.encode(f_texts, normalize_embeddings=True)
            sims = emb_s @ emb_f.T
            for i, sent in enumerate(sents):
                if span_ids[i] in done:
                    continue
                top = np.argsort(-sims[i])[:5]
                fh.write(json.dumps({
                    "span_id": span_ids[i], "doc": f.stem, "sentence": sent,
                    "candidates": [{"number": findings[j].number,
                                    "title": findings[j].title,
                                    "severity": findings[j].severity,
                                    "snippet": findings[j].text[:600],
                                    "cosine": round(float(sims[i][j]), 3)} for j in top],
                }) + "\n")
                n += 1
    print(f"shortlist: {n} new spans -> {SHORTLIST}")


def load_key() -> str:
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("OPENAI_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("no OPENAI_API_KEY in .env")


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
            usage = out.get("usage", {})
            m = re.search(r"\{.*\}", out["choices"][0]["message"]["content"], re.S)
            res = json.loads(m.group(0)) if m else {}
            res["_in"], res["_out"] = usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)
            return res
        except Exception as e:
            if attempt == 3:
                return {"matches": None, "reason": f"api_error {str(e)[:120]}", "_in": 0, "_out": 0}
            time.sleep(2 ** (attempt + 1))
    return {"matches": None, "_in": 0, "_out": 0}


def stage_adjudicate(model: str, budget: float) -> None:
    key = load_key()
    spans = [json.loads(l) for l in open(SHORTLIST)]
    done = set()
    if OUT.exists():
        done = {json.loads(l)["pair_id"].rsplit("-f", 1)[0] for l in open(OUT)}
    log_f = ROOT / "data/pairs/thematic_adjudication_log.jsonl"
    logged = {json.loads(l)["span_id"] for l in open(log_f)} if log_f.exists() else set()
    spend = 0.0
    n_pairs = 0
    with OUT.open("a") as fh, log_f.open("a") as lg:
        for s in spans:
            if s["span_id"] in logged or s["span_id"] in done:
                continue
            cands = "\n".join(
                f"[{c['number']}] {c['title']} (severity: {c['severity'] or 'n/a'})\n    {c['snippet'][:400]}"
                for c in s["candidates"])
            res = call(model, ADJ_PROMPT.format(sent=s["sentence"], cands=cands), key)
            spend += res.pop("_in", 0) * 0.25 / 1e6 + res.pop("_out", 0) * 2.0 / 1e6
            lg.write(json.dumps({"span_id": s["span_id"], **res}) + "\n")
            matches = res.get("matches") or []
            by_num = {c["number"]: c for c in s["candidates"]}
            for m in matches:
                c = by_num.get(m)
                if c is None:
                    continue
                fh.write(CandidatePair(
                    pair_id=f"{s['span_id']}-f{m}",
                    source_doc_id=f"tob/{s['doc']}",
                    source_org="trailofbits",
                    doc_type="security_review",
                    technical_text=f"{c['title']}\n\n{c['snippet']}",
                    technical_context=c["title"],
                    executive_text=s["sentence"],
                    audience_observed="technical_leadership",
                    alignment_method="embed+llm",
                    alignment_type="1:1" if len(matches) == 1 else "1:N",
                    finding_numbers=[m],
                    severity_original=c["severity"],
                    needs_llm_verify=False,  # adjudication IS the LLM judgment
                    notes=f"cosine={c['cosine']}; adj_conf={res.get('confidence')}; {model}",
                ).to_jsonl() + "\n")
                n_pairs += 1
            if spend > budget:
                print(f"BUDGET STOP ${spend:.2f}")
                break
    print(f"adjudication: +{n_pairs} pairs, est ${spend:.2f} -> {OUT}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--shortlist", action="store_true")
    ap.add_argument("--adjudicate", action="store_true")
    ap.add_argument("--model", default="gpt-5-mini")
    ap.add_argument("--budget-usd", type=float, default=6.0)
    a = ap.parse_args()
    if a.shortlist:
        stage_shortlist()
    if a.adjudicate:
        stage_adjudicate(a.model, a.budget_usd)
