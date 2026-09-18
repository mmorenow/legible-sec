#!/usr/bin/env python3
"""Bake the precedent-engine demo (v3 site diagram 1) with REAL retrieval.

Runs the real retriever (src/legible/rag.py) with the TOB-GRADIO-3 SSRF finding as
the query and writes its true top neighbors, real similarity scores, orgs,
severities, and human executive sentences to presentation/web/src/content/
evidenceDemo.json. Never hand-writes neighbors or scores. Local, $0.

Run:  LEGIBLE_EMBED_DEVICE=cpu .venv/bin/python scripts/gen_evidence_demo.py
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from legible import rag  # noqa: E402

QUERY_ID = "2024-10-huggingface-gradio-securityreview#s11-f3"
CORE = ROOT / "data/pairs/core_1to1_curated.jsonl"
OUT = ROOT / "presentation/web/src/content/evidenceDemo.json"


def load_query() -> dict:
    for line in CORE.open():
        d = json.loads(line)
        if d.get("pair_id") == QUERY_ID:
            return d
    raise SystemExit(f"query pair {QUERY_ID} not found")


def short(s: str, n: int = 220) -> str:
    s = re.sub(r"\s+", " ", (s or "").strip())
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "..."


def main() -> None:
    q = load_query()
    print(f"query: {q['pair_id']}  ({q.get('source_org')}, {q.get('severity_original')})")

    # real retrieval: technical_leadership register, exclude test splits (default)
    hits = rag.retrieve(q["technical_text"], register="technical_leadership", k_final=10)
    neighbors = []
    for h in hits:
        if h.pair_id == QUERY_ID:
            continue  # never surface the query as its own neighbor
        if "#doc" in h.pair_id or h.pair_id.endswith("__doc"):
            continue  # doc-level pairs are not finding-level receipts (project's own distinction)
        neighbors.append({
            "pair_id": h.pair_id,
            "source_org": h.source_org,
            "severity_original": h.severity_original,
            "vuln_class": h.vuln_class,
            "executive_text": short(h.executive_text, 240),
            "technical_text": short(h.technical_text, 180),
            "source_url": h.source_url or None,
            "score": round(float(h.score), 3),
            "filter_used": h.filter_used,
        })
        if len(neighbors) >= 4:
            break

    demo = {
        "generated_by": "scripts/gen_evidence_demo.py",
        "query": {
            "pair_id": q["pair_id"],
            "source_org": q.get("source_org"),
            "severity_original": q.get("severity_original"),
            "finding_id": "TOB-GRADIO-3",
            "title": "SSRF in the path parameter of /queue/join",
            "technical_text": short(q["technical_text"], 260),
            "executive_text": short(q["executive_text"], 260),
            "vuln_class": q.get("vuln_class"),
        },
        "neighbors": neighbors,
        "mechanism": [
            {"k": "embed", "v": "Qwen3-Embedding, 1,024 dimensions"},
            {"k": "search", "v": "LanceDB, dense + keyword hybrid"},
            {"k": "pool", "v": "4,513 pairs, held-out items excluded"},
        ],
    }
    OUT.write_text(json.dumps(demo, indent=2, ensure_ascii=False))
    print(f"\nwrote {OUT}  ({len(neighbors)} real neighbors)")
    for n in neighbors:
        print(f"  {n['score']:.3f}  {n['source_org']:<12} {n['severity_original']:<9} {n['pair_id']}")


if __name__ == "__main__":
    main()
