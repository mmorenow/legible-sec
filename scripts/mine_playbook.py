#!/usr/bin/env python3
"""LEGIBLE P3: mine playbook rule candidates from the dataset, with evidence.

For each candidate rule, measures ADHERENCE: on pairs where the rule is
applicable, how often does the professional translation follow it? Rules
clearing ~70% adherence graduate into the playbook (GAMEPLAN §11 #4).

Pure local stats — no LLM. Finding-level aligned pairs only (doc-level pairs
summarize many findings and would blur per-finding measurements).

Usage: .venv/bin/python scripts/mine_playbook.py [--dataset PATH] [--out PATH]
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import statistics
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from legible.judge import (  # noqa: E402
    CAVEAT_MARKERS,
    _extract_ids,
    _extract_numbers,
    _id_spans,
    _marker_clause,
    _sentences,
    _severity_signal,
    _token_overlap,
)

IMPACT_WORDS = re.compile(
    r"\b(attacker|adversary|could allow|could lead|enables?|risk|exposes?|"
    r"compromise|impact|steal|exfiltrat|takeover|unauthorized)\b", re.I)
MECHANISM_FIRST = re.compile(
    r"^(the|a|an)\s+[\w.-]+\s+(function|method|endpoint|parameter|header|class|module|file)\b", re.I)
ACTION_WORDS = re.compile(
    r"\b(recommend|should|must|advis|remediat|patch|update|upgrade|fix|mitigat|apply)\b", re.I)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="data/dataset/legible-pairs-v0.1.jsonl")
    ap.add_argument("--out", default="research/10-playbook-mining.md")
    args = ap.parse_args()

    rows = []
    with open(args.dataset) as f:
        for line in f:
            d = json.loads(line)
            if d.get("alignment_label") == "aligned" and d.get("exec_span_kind") != "doc_level":
                rows.append(d)
    print(f"finding-level aligned pairs: {len(rows)}")

    # rule accumulators: name -> [applicable, followed, example]
    R: dict[str, list] = {}

    def tally(name: str, applicable: bool, followed: bool, example: str | None = None):
        r = R.setdefault(name, [0, 0, None])
        if applicable:
            r[0] += 1
            if followed:
                r[1] += 1
                if example and r[2] is None:
                    r[2] = example[:220]

    comp_ratios = []
    for d in rows:
        t, e = d["technical_text"], d["executive_text"]
        comp_ratios.append(len(e.split()) / max(1, len(t.split())))

        # R1 compression: exec ≤ 40% of the technical length
        tally("compress_to_<=40%", True, len(e.split()) <= 0.4 * len(t.split()), e)

        # R2 numbers survive: if source has numbers, ≥1 appears in the exec
        nums = _extract_numbers(t, _id_spans(t))
        if nums:
            tally("keep_at_least_one_number", True, any(n in e for n in nums), e)

        # R3 IDs cited: if source has a tracked ID, the exec cites one
        ids = _extract_ids(t)
        if ids:
            tally("cite_the_finding_id", True, bool(_extract_ids(e) & ids), e)

        # R4 severity never softened (lexical bands)
        st, se = _severity_signal(t), _severity_signal(e)
        if st is not None and se is not None:
            tally("never_soften_severity", True, se[0] >= st[0], e)

        # R5 caveats preserved (clause-level counterpart)
        for sent in _sentences(t):
            low = sent.lower()
            m = next((mk for mk in CAVEAT_MARKERS if mk in low), None)
            if m:
                clause = _marker_clause(sent, m)
                ok = max((_token_overlap(clause, s) for s in _sentences(e)), default=0.0) >= 0.35
                tally("preserve_caveats", True, ok, e)
                break  # one caveat sample per pair keeps pairs comparable

        # R6 lead with impact: first exec sentence names actor/impact/risk
        first = _sentences(e)[0] if _sentences(e) else ""
        tally("lead_with_impact", True, bool(IMPACT_WORDS.search(first)), first)

        # R7 don't open with the mechanism ("The X function/method/endpoint…")
        tally("dont_open_with_mechanism", True, not MECHANISM_FIRST.match(first), first)

        # R8 end with an action when the exec is multi-sentence
        sents = _sentences(e)
        if len(sents) >= 2:
            tally("close_with_action", True, bool(ACTION_WORDS.search(sents[-1])), sents[-1])

    lines = [
        "# 10 — Playbook mining (v0, statistical pass over finding-level aligned pairs)",
        "",
        f"Pairs analyzed: **{len(rows)}** · median compression: exec = "
        f"**{statistics.median(comp_ratios):.0%}** of the technical word count",
        "",
        "| Candidate rule | Applicable pairs | Adherence | Verdict (≥70% graduates) |",
        "|---|---|---|---|",
    ]
    for name, (app, fol, ex) in sorted(R.items(), key=lambda kv: -(kv[1][1] / max(1, kv[1][0]))):
        pct = fol / max(1, app)
        verdict = "✅ playbook" if pct >= 0.7 else ("🟡 borderline" if pct >= 0.5 else "❌ not a real norm")
        lines.append(f"| {name} | {app} | {pct:.0%} | {verdict} |")
    lines += [
        "",
        "Notes: adherence = share of applicable pairs where professional translators",
        "actually follow the rule; rules below 70% are how consultants DON'T write,",
        "which is itself playbook evidence (framed as anti-rules or dropped).",
        "LLM-assisted qualitative pass (P3) refines wording + adds examples per rule.",
    ]
    pathlib.Path(args.out).write_text("\n".join(lines))
    print(f"wrote {args.out}")
    for name, (app, fol, _) in R.items():
        print(f"  {name:28} {fol}/{app} = {fol/max(1,app):.0%}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
