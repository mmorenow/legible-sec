#!/usr/bin/env python3
"""Collapse the 1:N expansion bug.

The 2026-07-07 decision approved group pairs as:

    sentence <-> member-findings-TOGETHER

One pair, holding the executive sentence and every finding it covers. The build
produced those grouped pairs correctly (531 of them, suffixed `-GROUP`) but kept
the per-finding rows alongside them, so a sentence covering 12 findings became
13 pairs instead of 1. It added where the decision said replace.

Measured on 2026-07-23: 1,596 rows (30% of the dataset) are individual pairs whose
executive text is already represented by a GROUP pair from the same document.
They carry no information the GROUP pair does not.

This script removes exactly those rows. It never touches a pair whose executive
text is unique, and never touches a GROUP pair. Dry run by default.

    python scripts/collapse_group_duplicates.py                 # report only
    python scripts/collapse_group_duplicates.py --write         # writes v0.4
"""
from __future__ import annotations

import argparse
import collections
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(path: pathlib.Path) -> list[dict]:
    return [json.loads(line) for line in path.open()]


def find_redundant(rows: list[dict]) -> tuple[list[int], dict]:
    """Indices of individual rows whose exec text is covered by a GROUP pair
    from the same source document."""
    group_exec: dict[str, set[str]] = collections.defaultdict(set)
    for r in rows:
        if "GROUP" in r.get("pair_id", ""):
            group_exec[r.get("source_doc_id", "")].add((r.get("executive_text") or "").strip())

    drop, by_method, by_split = [], collections.Counter(), collections.Counter()
    for i, r in enumerate(rows):
        if "GROUP" in r.get("pair_id", ""):
            continue
        exec_text = (r.get("executive_text") or "").strip()
        if exec_text and exec_text in group_exec.get(r.get("source_doc_id", ""), ()):
            drop.append(i)
            by_method[r.get("alignment_method")] += 1
            by_split[r.get("split")] += 1
    return drop, {"by_method": by_method, "by_split": by_split, "groups": sum(len(v) for v in group_exec.values())}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="data/dataset/legible-pairs-v0.3.jsonl")
    ap.add_argument("--out", default="data/dataset/legible-pairs-v0.4.jsonl")
    ap.add_argument("--write", action="store_true", help="actually write the output")
    args = ap.parse_args()

    src = ROOT / args.dataset
    if not src.exists():
        print(f"not found: {src}", file=sys.stderr)
        return 1

    rows = load(src)
    drop, stats = find_redundant(rows)
    keep = [r for i, r in enumerate(rows) if i not in set(drop)]

    print(f"dataset            {len(rows):>6}")
    print(f"redundant rows     {len(drop):>6}  ({100*len(drop)/len(rows):.0f}%)")
    print(f"after collapse     {len(keep):>6}")
    print()
    print("dropped by method:")
    for k, v in stats["by_method"].most_common():
        print(f"  {k:24} {v:>5}")
    print("\ndropped by split:")
    for k, v in stats["by_split"].most_common():
        print(f"  {k:24} {v:>5}")

    # what the collapse does to the duplication rate, the number that matters
    def dup_rate(rs):
        c = collections.Counter((r.get("executive_text") or "").strip() for r in rs)
        return sum(v for v in c.values() if v > 1) / len(rs)

    print(f"\nduplicated executive text:  {dup_rate(rows):.0%} before  ->  {dup_rate(keep):.0%} after")

    # a training-set safety check: the SFT mix must not lose examples
    ft = ROOT / "data/finetune/train_v03.jsonl"
    if ft.exists():
        train_ids = {json.loads(l)["pair_id"] for l in ft.open()}
        kept_ids = {r["pair_id"] for r in keep}
        lost = train_ids - kept_ids
        print(f"\nSFT training examples affected: {len(lost)} of {len(train_ids)}")
        if lost:
            print("  (these were trained on and would no longer exist in the dataset)")
            for pid in list(lost)[:5]:
                print(f"    {pid}")

    if not args.write:
        print("\nDRY RUN. Nothing written. Pass --write to produce the output file.")
        return 0

    out = ROOT / args.out
    with out.open("w") as f:
        for r in keep:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"\nwrote {out.relative_to(ROOT)}  ({len(keep)} pairs)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
