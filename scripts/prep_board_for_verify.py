#!/usr/bin/env python3
"""Prep the harvested Board pairs for verify_dual.py.

Merges every data/pairs/harvest/board_*.jsonl, dedups by content, and maps to
the verifier schema (adds pair_id, renames board_text -> executive_text).
Then run:  .venv/bin/python scripts/verify_dual.py \
    --pairs data/pairs/harvest/board_all_for_verify.jsonl \
    --out data/pairs/harvest/board_verified.jsonl --budget-usd 3
"""
import hashlib, json, pathlib

ROOT = pathlib.Path("/Users/marcelomoreno/Downloads/legible-sec")
HARV = ROOT / "data/pairs/harvest"
OUT = HARV / "board_all_for_verify.jsonl"

seen, n, dup, bad = set(), 0, 0, 0
with OUT.open("w") as fh:
    for f in sorted(HARV.glob("board_*.jsonl")):
        for line in f.read_text().splitlines():
            if not line.strip():
                continue
            r = json.loads(line)
            tech, board = r.get("technical_text", ""), r.get("board_text", "")
            if not tech or not board:
                bad += 1; continue
            pid = f"{r.get('source','?')}-{hashlib.md5((tech[:120] + board[:120]).encode()).hexdigest()[:10]}"
            if pid in seen:
                dup += 1; continue
            seen.add(pid)
            fh.write(json.dumps({**r, "pair_id": pid, "executive_text": board}, ensure_ascii=False) + "\n")
            n += 1
print(f"wrote {n} unique board pairs -> {OUT}  (deduped {dup}, skipped {bad} malformed)")
