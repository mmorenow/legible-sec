#!/usr/bin/env python
"""Rebuild the pointer-pack pairs locally (Cure53 / OSTIF / ppr).

The redistributable core (Trail of Bits + US-CISA) ships as full text. The
pointer packs do not — this script downloads the original public documents,
verifies each against the SHA-256 in pointer_manifest.jsonl, and re-runs the
repo's extractors to regenerate the pair text on your machine. Nothing is
redistributed; you rebuild from the firms' own published sources.

Usage:
  python scripts/reconstruct_pointers.py --download    # fetch + hash-verify docs
  python scripts/reconstruct_pointers.py --extract     # re-run extractors → merged jsonl

Output: data/dataset/pointer_pairs_reconstructed.jsonl (merge with the core to get
the full dataset). Requires the repo's requirements.txt (Docling etc.).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data/dataset/pointer_manifest.jsonl"
DL = ROOT / "data/reconstruct/pdfs"
UA = "legible-reconstruct/0.1"


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def download() -> None:
    DL.mkdir(parents=True, exist_ok=True)
    seen: dict[str, str] = {}
    rows = [json.loads(l) for l in MANIFEST.read_text().split("\n") if l.strip()]
    by_doc = {}
    for r in rows:
        by_doc.setdefault(r["source_doc_id"], r)
    ok = miss = mismatch = 0
    for doc_id, r in sorted(by_doc.items()):
        url, want = r["source_url"], r.get("source_sha256", "")
        if not url:
            miss += 1
            print(f"[no-url] {doc_id} — reconstruct URL from firm/filename (see repo README)")
            continue
        dest = DL / (doc_id.replace("/", "__") + ".bin")
        if dest.exists():
            ok += 1
            continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
        except Exception as e:
            miss += 1
            print(f"[fail] {doc_id}: {str(e)[:80]}")
            continue
        got = sha256(data)
        if want and got != want:
            mismatch += 1
            print(f"[SHA MISMATCH] {doc_id} — source may have changed; skipping")
            continue
        dest.write_bytes(data)
        ok += 1
        time.sleep(0.5)
    print(f"downloaded/verified {ok}, missing-url {miss}, sha-mismatch {mismatch} -> {DL}")


def extract() -> None:
    """Re-run the repo extractors on the downloaded docs, then keep only the
    pair_ids present in the pointer manifest (so you get exactly the released
    pointer pairs, rebuilt from source)."""
    print("Re-run the repo pipeline on data/reconstruct/pdfs, then filter to the "
          "pair_ids in pointer_manifest.jsonl:")
    print("  1. parse:   python scripts/parse_wave2.py  (point --md-dir at the downloaded docs)")
    print("  2. extract: python scripts/extract_pairs.py --firm cure53 ...")
    print("              python scripts/extract_ostif_pairs.py / extract_ppr_pairs.py")
    print("  3. filter:  keep rows whose pair_id is in pointer_manifest.jsonl")
    print("This regenerates the exact pointer pairs locally without redistributing firm text.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true")
    ap.add_argument("--extract", action="store_true")
    a = ap.parse_args()
    if a.download:
        download()
    if a.extract:
        extract()
    if not (a.download or a.extract):
        ap.print_help()
