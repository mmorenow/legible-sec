#!/usr/bin/env python
"""MinHash near-duplicate detection across ALL candidate pairs (GAMEPLAN §4.5).

Targets: CISA ICS boilerplate (same advisory template text), consultancy
boilerplate repeated across reports, and TOB↔OSTIF re-published audits.
Report-only: writes duplicate groups + keep/drop recommendation; deletes nothing.
Output: data/pairs/dedup_groups.json
"""

from __future__ import annotations

import json
import pathlib
import re
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
FILES = ["candidates_tob.jsonl", "candidates_tob_doclevel.jsonl",
         "candidates_cisa.jsonl", "candidates_wave2.jsonl", "candidates_ppr_v2.jsonl"]
N_PERM = 64
SHINGLE = 5
THRESH = 0.82  # est. Jaccard for near-dup


def shingles(text: str) -> set[int]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return {hash(" ".join(words[i:i + SHINGLE])) & 0x7FFFFFFFFFFFFFFF
            for i in range(max(1, len(words) - SHINGLE + 1))}


def main() -> None:
    pairs = []
    for fn in FILES:
        f = ROOT / "data/pairs" / fn
        if not f.exists():
            continue
        for line in f.read_text().splitlines():
            if line.strip():
                p = json.loads(line)
                pairs.append((p["pair_id"], p["source_org"],
                              p["executive_text"] + " " + p["technical_text"][:2000]))
    print(f"{len(pairs)} pairs loaded")

    rng = np.random.RandomState(7)
    a = rng.randint(1, 2**61 - 1, N_PERM, dtype=np.int64)
    b = rng.randint(0, 2**61 - 1, N_PERM, dtype=np.int64)
    M = (2**61 - 1)

    sigs = np.zeros((len(pairs), N_PERM), dtype=np.int64)
    for i, (_, _, text) in enumerate(pairs):
        sh = np.fromiter(shingles(text), dtype=np.int64)
        if len(sh) == 0:
            continue
        sigs[i] = ((a[None, :] * sh[:, None] + b[None, :]) % M).min(axis=0)

    # LSH banding: 16 bands × 4 rows
    from collections import defaultdict
    buckets = defaultdict(list)
    for i in range(len(pairs)):
        for band in range(16):
            key = (band, hash(sigs[i, band * 4:(band + 1) * 4].tobytes()))
            buckets[key].append(i)

    cand = set()
    for members in buckets.values():
        if 1 < len(members) <= 200:
            for x in range(len(members)):
                for y in range(x + 1, len(members)):
                    cand.add((members[x], members[y]))
    print(f"{len(cand)} candidate collisions")

    parent = list(range(len(pairs)))
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    dup_edges = 0
    for x, y in cand:
        sim = (sigs[x] == sigs[y]).mean()
        if sim >= THRESH:
            parent[find(x)] = find(y)
            dup_edges += 1

    groups = {}
    for i in range(len(pairs)):
        groups.setdefault(find(i), []).append(i)
    dup_groups = [g for g in groups.values() if len(g) > 1]

    out = []
    for g in sorted(dup_groups, key=len, reverse=True):
        members = [{"pair_id": pairs[i][0], "org": pairs[i][1]} for i in g]
        out.append({"size": len(g), "keep": members[0]["pair_id"], "members": members})
    json.dump(out, open(ROOT / "data/pairs/dedup_groups.json", "w"), indent=1)
    n_drop = sum(len(g) - 1 for g in dup_groups)
    from collections import Counter
    org_mix = Counter(tuple(sorted({pairs[i][1] for i in g})) for g in dup_groups)
    print(f"dup groups: {len(dup_groups)}, pairs to drop: {n_drop}")
    print("group org-composition (top):", org_mix.most_common(6))


if __name__ == "__main__":
    main()
