#!/usr/bin/env python3
"""LEGIBLE wave-2 Task A: cross-source sha256 dedup check.

Loads the 4 corpus download manifests (tob, cure53, ostif, ppr), and reports
every sha256 that appears more than once across the combined set -- whether
the duplicate is within a single source or across sources. Writes
data/corpus/dedup_sha256.txt as a plain-text report (no files are deleted;
this is report-only).
"""
import json
import os
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS = os.path.join(ROOT, "data", "corpus")
OUT_PATH = os.path.join(CORPUS, "dedup_sha256.txt")

MANIFESTS = [
    ("tob", os.path.join(CORPUS, "downloads_tob.json")),
    ("cure53", os.path.join(CORPUS, "downloads_cure53.json")),
    ("ostif", os.path.join(CORPUS, "downloads_ostif.json")),
    ("ppr", os.path.join(CORPUS, "downloads_ppr.json")),
]


def main():
    by_sha = defaultdict(list)  # sha256 -> list of (source, filename)
    counts = {}

    for source, path in MANIFESTS:
        if not os.path.exists(path):
            print(f"WARNING: manifest not found, skipping: {path}")
            counts[source] = 0
            continue
        with open(path) as f:
            records = json.load(f)
        counts[source] = len(records)
        for rec in records:
            sha = rec.get("sha256")
            if not sha:
                continue  # failed/skipped downloads have no sha256
            filename = rec.get("dest_filename") or rec.get("filename")
            by_sha[sha].append((source, filename))

    dup_groups = {sha: entries for sha, entries in by_sha.items()
                  if len(entries) > 1}

    lines = []
    lines.append("Cross-source sha256 dedup report")
    lines.append("=" * 40)
    lines.append(f"Manifests loaded: {', '.join(f'{s}={n}' for s, n in counts.items())}")
    lines.append(f"Total unique sha256 with a value: {len(by_sha)}")
    lines.append(f"Duplicate sha256 groups found: {len(dup_groups)}")
    lines.append("")

    if not dup_groups:
        lines.append("No duplicate sha256 values found across data/corpus/downloads_"
                      "{tob,cure53,ostif,ppr}.json. Every downloaded/copied PDF with a "
                      "computed sha256 is unique across all 4 manifests.")
    else:
        for sha, entries in sorted(dup_groups.items()):
            lines.append(f"sha256={sha}  ({len(entries)} occurrences)")
            for source, filename in entries:
                lines.append(f"    - {source}: {filename}")
            lines.append("")

    with open(OUT_PATH, "w") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Duplicate groups: {len(dup_groups)}")
    print(f"Report -> {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
