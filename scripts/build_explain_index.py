"""Build the EXPLANATIONS semantic index (Explain mode) — separate from the
pairs index. The retrieval key here is the CONCEPT (SSRF, hashing, ...): a user
names a concept and we return real published analogies / definitions /
explanations for it. Schema and store mirror legible.rag (Qwen3-Embedding-0.6B,
LanceDB with BM25 FTS), but the table is "explanations" and we embed
concept + text so the concept dominates recall.

Run (owner):
    LEGIBLE_EMBED_DEVICE=cpu .venv/bin/python scripts/build_explain_index.py
"""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from legible.rag import DB_PATH, get_model  # noqa: E402

TABLE = "explanations"
DATASET = ROOT / "data/dataset/explain_library_v0.3.jsonl"
MAX_CHARS = 4000


def main() -> int:
    import lancedb

    rows = []
    with open(DATASET) as f:
        for line in f:
            d = json.loads(line)
            concept = (d.get("concept") or "").strip()
            text = (d.get("text") or "").strip()
            if not concept or not text:
                continue
            rows.append(
                {
                    "expl_id": d["expl_id"],
                    "concept": concept,
                    "text": text[:MAX_CHARS],
                    "kind": d.get("kind") or "",
                    "source": d.get("source") or "",
                    "source_url": d.get("source_url") or "",
                    "license": d.get("license") or "",
                }
            )

    model = get_model()
    # concept-weighted embedding: the retrieval key is the concept, the text
    # gives it substance. Query at serve time is a raw concept/finding phrase.
    texts = [f"{r['concept']} :: {r['text']}" for r in rows]
    embs = model.encode(texts, batch_size=8, normalize_embeddings=True, show_progress_bar=True)
    for r, e in zip(rows, embs):
        r["vector"] = e.tolist()

    db = lancedb.connect(str(DB_PATH))
    if TABLE in db.table_names():
        db.drop_table(TABLE)
    tbl = db.create_table(TABLE, rows)
    tbl.create_fts_index("concept", replace=True)
    print(f"explanations index: {len(rows)} rows -> table '{TABLE}' in {DB_PATH}")
    return len(rows)


if __name__ == "__main__":
    main()
