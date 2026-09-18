#!/usr/bin/env python
"""Run tier-0 ID-anchored pair extraction over a directory of converted md files.

Usage:
  .venv/bin/python scripts/extract_pairs.py [--md-dir data/calibration/out/md] \
      [--out data/pairs/candidates_calibration.jsonl]

Pairs Cure53 summary-reports with their full report when both exist
(summary-report_X.md ↔ pentest-report_X.md).
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))
from legible.align import FindingUnit, extract_candidates_cure53, extract_candidates_tob  # noqa: E402


def load_recovered() -> dict[str, list[FindingUnit]]:
    f = pathlib.Path(__file__).resolve().parents[1] / "data/corpus/recovered_units.jsonl"
    out: dict[str, list[FindingUnit]] = {}
    if f.exists():
        for line in f.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                out.setdefault(r["doc"], []).append(
                    FindingUnit(r["number"], r["title"], r["text"], r.get("severity", "")))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--md-dir", default="data/calibration/out/md")
    ap.add_argument("--out", default="data/pairs/candidates_calibration.jsonl")
    ap.add_argument("--firm", choices=["auto", "tob", "cure53"], default="auto",
                    help="'tob' = all files are TOB; 'cure53' = wave-2 cure53__* files")
    args = ap.parse_args()

    md_dir = pathlib.Path(args.md_dir)
    out_path = pathlib.Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    files = sorted(md_dir.glob("*.md"))
    if args.firm == "tob":
        tob = [f for f in files if "__" not in f.name]
    elif args.firm == "cure53":
        tob = []
        files = [f for f in files if f.name.startswith("cure53__")]
    else:
        tob = [f for f in files if "securityreview" in f.name or "security-review" in f.name
               or f.name in ("CloudEvents.md", "88mph.md")]
    cure_full = {}
    cure_sum = {}
    for f in (files if args.firm != "tob" else []):
        stem = f.name.replace("cure53__", "")
        if stem.startswith(("pentest-report_", "audit-report_", "review-report_")):
            cure_full[stem.split("_", 1)[1]] = f
        elif stem.startswith("summary-report_"):
            cure_sum[stem.split("_", 1)[1]] = f

    recovered = load_recovered()
    all_pairs = []
    per_doc = Counter()
    for f in tob:
        pairs = extract_candidates_tob(f.read_text(), f"tob/{f.stem}",
                                       extra_units=recovered.get(f.stem))
        per_doc[f.stem] = len(pairs)
        all_pairs.extend(pairs)
    for key, full in cure_full.items():
        summary = cure_sum.get(key)
        pairs = extract_candidates_cure53(
            full.read_text(), f"cure53/{full.stem}",
            summary_md=summary.read_text() if summary else None)
        per_doc[full.stem] = len(pairs)
        all_pairs.extend(pairs)

    with out_path.open("w") as fh:
        for p in all_pairs:
            fh.write(p.to_jsonl() + "\n")

    print(f"total candidate pairs: {len(all_pairs)} -> {out_path}")
    print(f"docs with >=1 pair: {sum(1 for v in per_doc.values() if v)}/{len(per_doc)}")
    for doc, n in per_doc.most_common():
        distinct = len({fn for p in all_pairs if p.source_doc_id.endswith(doc)
                        for fn in (p.finding_numbers or p.cited_ids)})
        print(f"  {doc[:60]:<62} pairs={n:<3} distinct_findings={distinct}")


if __name__ == "__main__":
    main()
