#!/usr/bin/env python
"""Join download manifests → populate source_url + source_sha256 on every record.

Enables the provenance manifest and the pointer-pack reconstruction (offsets +
SHA-256 + URL for pointer-only sources). Rewrites the dataset in place and emits
data/dataset/pointer_manifest.jsonl for the reconstruction script.
"""

from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
# dataset files were renamed legible-* at v0.2 (2026-07-12 cleanup)
DS = ROOT / "data/dataset/legible-pairs-v0.2.jsonl"


def load(p):
    f = ROOT / p
    if not f.exists():
        return []
    d = json.loads(f.read_text())
    return d if isinstance(d, list) else list(d.values())


def main() -> None:
    # build stem/id -> (url, sha256)
    url_by_key: dict[str, tuple[str, str]] = {}
    for e in load("data/corpus/downloads_tob.json"):
        stem = e["filename"].replace(".pdf", "")
        url_by_key[f"tob/{stem}"] = (e.get("url", ""), e.get("sha256", ""))
    for series in ("csa", "ics"):
        for e in load(f"data/corpus/downloads_cisa_{series}.json"):
            url_by_key[f"cisa_{series}/{e['id']}"] = (e.get("url", ""), e.get("sha256", ""))
    for e in load("data/corpus/downloads_cure53.json"):
        stem = e["filename"].replace(".pdf", "")
        url_by_key[f"cure53/cure53__{stem}"] = (e.get("url", ""), e.get("sha256", ""))
    for e in load("data/corpus/downloads_ostif.json"):
        stem = pathlib.Path(e["filename"]).stem
        url_by_key[f"ostif/{stem}"] = (e.get("blog_post_url") or e.get("url", ""), e.get("sha256", ""))
    for e in load("data/corpus/downloads_ppr.json"):
        dest = e.get("dest_filename", "").replace(".pdf", "")
        url = e.get("url", "")
        url_by_key[f"ppr/{dest}"] = ("" if url in ("None", None) else url, e.get("sha256", ""))

    recs = [json.loads(l) for l in DS.read_text().split("\n") if l.strip()]
    hit = 0
    pointers = []
    for r in recs:
        key = r["source_doc_id"]
        # normalize cisa key (records use cisa_csa/ cisa_ics/)
        url, sha = url_by_key.get(key, ("", ""))
        if not url:
            # try stem match for cure53/ppr variants
            for k, v in url_by_key.items():
                if key.split("/")[-1] in k:
                    url, sha = v
                    break
        if url:
            hit += 1
        r["source_url"] = url
        r["source_sha256"] = sha
        if r["license"] == "research-quotation-noncommercial":
            pointers.append({"pair_id": r["pair_id"], "source_doc_id": key,
                             "source_org": r["source_org"], "source_url": url,
                             "source_sha256": sha})

    with DS.open("w") as fh:
        for r in recs:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    with (ROOT / "data/dataset/pointer_manifest.jsonl").open("w") as fh:
        for p in pointers:
            fh.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"source_url populated on {hit}/{len(recs)} records; {len(pointers)} pointer records -> pointer_manifest.jsonl")


if __name__ == "__main__":
    main()
