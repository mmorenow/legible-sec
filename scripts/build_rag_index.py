#!/usr/bin/env python3
"""LEGIBLE P3: build the LanceDB retrieval index over the dataset.

Embeds `technical_text` of every pair with Qwen3-Embedding-0.6B (local,
1024-dim, normalized), writes the LanceDB table + BM25 FTS index.
Re-run whenever the dataset changes (v0.2 will just point --dataset at the
new build). ~5-15 min on CPU/MPS for ~4k pairs.

Usage: .venv/bin/python scripts/build_rag_index.py [--dataset PATH]
"""

from __future__ import annotations

import argparse
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from legible.rag import DB_PATH, TABLE, build_index  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="data/dataset/index_pairs_v0.3.jsonl")
    ap.add_argument("--db", default=str(DB_PATH))
    ap.add_argument("--table", default=TABLE)
    ap.add_argument("--batch-size", type=int, default=32)  # gentle on a 16GB machine
    args = ap.parse_args()

    t0 = time.time()
    n = build_index(args.dataset, args.db, args.table, batch_size=args.batch_size)
    print(f"indexed {n} pairs into {args.db}/{args.table} in {time.time()-t0:.0f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
