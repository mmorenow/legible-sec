"""LEGIBLE P3: RAG core — ingest, retrieve, assemble (research/04 §§2-4).

Design (all logged decisions, do not re-litigate):
- Embeddings: Qwen/Qwen3-Embedding-0.6B local via sentence-transformers,
  1024-dim MRL slice, normalized (research/04 §1).
- Store: LanceDB embedded table with native BM25 FTS + metadata columns (§2).
- Retrieval: hybrid (dense+BM25) with an audience prefilter fallback ladder
  (register+format → register → none), k=20 → dedup by source doc → top 3-5
  exemplars (§3).
- Prompt: cached stable system prefix ⊕ <example> XML exemplars (most similar
  LAST) ⊕ user <finding> (§4). Evidence panel renders natural pairs only (D31).

The index embeds `technical_text` only: the query at runtime is a raw
technical finding; we retrieve similar findings and return their paired
executive translations as style exemplars.
"""

from __future__ import annotations

import json
import os
import pathlib
from dataclasses import dataclass
from typing import Iterable

EMBED_MODEL = "Qwen/Qwen3-Embedding-0.6B"
EMBED_DIM = 1024
DB_PATH = pathlib.Path("data/rag/lancedb")
TABLE = "pairs"  # rebuilt per dataset version; see scripts/build_rag_index.py

# Best-of-breed retrieval = strong bi-encoder recall + cross-encoder rerank precision.
# Reranker scores only the top-k candidates (cheap), so it fits the 16GB local budget
# and lifts top-1/2 quality far above raw hybrid. Default = bge-reranker-v2-m3 (robust,
# SOTA open cross-encoder). Cloud/heavier option: Qwen/Qwen3-Reranker-4B (set via env).
RERANK_MODEL = os.environ.get("LEGIBLE_RERANK_MODEL", "BAAI/bge-reranker-v2-m3")
_reranker = None


def get_reranker():
    global _reranker
    if _reranker is None:
        from sentence_transformers import CrossEncoder
        device = os.environ.get("LEGIBLE_EMBED_DEVICE") or None
        _reranker = CrossEncoder(RERANK_MODEL, device=device, max_length=1024)
    return _reranker

# Qwen3-Embedding is instruction-aware: queries get a task instruction,
# documents do not (model card usage).
QUERY_INSTRUCT = (
    "Instruct: Given a technical security finding, retrieve similar technical "
    "security findings\nQuery: "
)

_model = None


def get_model():
    global _model
    if _model is None:
        import os

        from sentence_transformers import SentenceTransformer

        # LEGIBLE_EMBED_DEVICE=cpu is the safe path on a loaded 16GB machine
        # (MPS OOMs when Docling/agents hold the shared pool).
        device = os.environ.get("LEGIBLE_EMBED_DEVICE") or None
        _model = SentenceTransformer(EMBED_MODEL, truncate_dim=EMBED_DIM, device=device)
        # cap sequence length: findings are trimmed to ~4k chars ≈ <1k tokens
        _model.max_seq_length = 1024
    return _model


# ---------------------------------------------------------------- ingest ----

def iter_dataset(path: str | pathlib.Path) -> Iterable[dict]:
    with open(path) as f:
        for line in f:
            yield json.loads(line)


def build_index(
    dataset_path: str | pathlib.Path = "data/dataset/legible-pairs-v0.1.jsonl",
    db_path: str | pathlib.Path = DB_PATH,
    table_name: str = TABLE,
    batch_size: int = 64,
    max_chars: int = 4000,
) -> int:
    """Embed all dataset pairs and (re)build the LanceDB table. Returns row count."""
    import lancedb

    rows = []
    for d in iter_dataset(dataset_path):
        tech = (d.get("technical_text") or "").strip()
        execu = (d.get("executive_text") or "").strip()
        if not tech or not execu:
            continue
        rows.append(
            {
                "pair_id": d["pair_id"],
                "technical_text": tech[:max_chars],
                "executive_text": execu[:max_chars],
                "audience_observed": d.get("audience_observed") or "",
                "format_label": d.get("format_label") or "",
                "severity_original": d.get("severity_original") or "",
                "vuln_class": d.get("vuln_class") or "",
                "source_org": d.get("source_org") or "",
                "source_doc_id": d.get("source_doc_id") or "",
                "source_url": d.get("source_url") or "",
                "alignment_method": d.get("alignment_method") or "",
                "alignment_label": d.get("alignment_label") or "",
                "split": d.get("split") or "",
                "license": d.get("license") or "",
            }
        )

    model = get_model()
    texts = [r["technical_text"] for r in rows]
    embs = model.encode(
        texts,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=True,
    )
    for r, e in zip(rows, embs):
        r["vector"] = e.tolist()

    db = lancedb.connect(str(db_path))
    if table_name in db.table_names():
        db.drop_table(table_name)
    tbl = db.create_table(table_name, rows)
    # native BM25 full-text index on the finding text (hybrid search leg)
    tbl.create_fts_index("technical_text", replace=True)
    return len(rows)


# -------------------------------------------------------------- retrieve ----

@dataclass
class Exemplar:
    pair_id: str
    technical_text: str
    executive_text: str
    audience_observed: str
    severity_original: str
    vuln_class: str
    source_org: str
    source_doc_id: str
    source_url: str
    score: float
    filter_used: str  # which rung of the fallback ladder produced it


def _open_table(db_path: str | pathlib.Path = DB_PATH, table_name: str = TABLE):
    import lancedb

    return lancedb.connect(str(db_path)).open_table(table_name)


def retrieve(
    finding: str,
    register: str | None = None,
    k_candidates: int = 50,
    k_final: int = 4,
    exclude_splits: tuple[str, ...] = ("test", "test_ood_firm", "test_ood_temporal", "test_ood_style"),
    tbl=None,
    rerank: bool = True,
) -> list[Exemplar]:
    """Hybrid retrieval with the fallback ladder + per-source dedup.

    `register` is the dataset register best matching the requested audience
    (AudienceSpec.retrieval_register). Test splits are excluded from the
    evidence pool by default: never leak benchmark items into the product path.
    """
    tbl = tbl or _open_table()
    model = get_model()
    qvec = model.encode([QUERY_INSTRUCT + finding], normalize_embeddings=True)[0]

    split_pred = " AND ".join(f"split != '{s}'" for s in exclude_splits)
    ladder: list[tuple[str, str | None]] = []
    if register:
        ladder.append((f"register={register}", f"audience_observed = '{register}' AND {split_pred}"))
    ladder.append(("none", split_pred))

    seen: set[str] = set()
    out: list[Exemplar] = []
    for rung_name, predicate in ladder:
        q = tbl.search(query_type="hybrid").vector(qvec.tolist()).text(finding)
        if predicate:
            q = q.where(predicate, prefilter=True)
        try:
            hits = q.limit(k_candidates).to_list()
        except Exception:
            # FTS can reject exotic query strings; fall back to dense-only
            q = tbl.search(qvec.tolist())
            if predicate:
                q = q.where(predicate, prefilter=True)
            hits = q.limit(k_candidates).to_list()

        for h in hits:
            doc = h.get("source_doc_id") or h.get("pair_id")
            if doc in seen:
                continue  # diversity: one exemplar per source report
            seen.add(doc)
            out.append(
                Exemplar(
                    pair_id=h["pair_id"],
                    technical_text=h["technical_text"],
                    executive_text=h["executive_text"],
                    audience_observed=h["audience_observed"],
                    severity_original=h["severity_original"],
                    vuln_class=h["vuln_class"],
                    source_org=h["source_org"],
                    source_doc_id=h["source_doc_id"],
                    source_url=h["source_url"],
                    score=float(h.get("_relevance_score") or h.get("_distance") or 0.0),
                    filter_used=rung_name,
                )
            )
        # collect the whole candidate pool (deduped) before the precision stage;
        # only stop climbing the ladder once we have enough to rerank from
        if len(out) >= k_candidates:
            break

    # --- precision stage: cross-encoder rerank the pool → best k_final ---
    # The CPU cross-encoder over ~50 candidates dominates latency on a laptop;
    # LEGIBLE_RERANK=0 skips it for interactive local serving (hybrid order is
    # still solid for the evidence panel). Default keeps rerank on (eval/offline).
    _rerank = rerank and os.environ.get("LEGIBLE_RERANK", "1") != "0"
    if _rerank and len(out) > k_final:
        try:
            ce = get_reranker()
            scores = ce.predict([(finding, e.technical_text) for e in out])
            for e, s in zip(out, scores):
                e.score = float(s)
            out.sort(key=lambda e: e.score, reverse=True)
        except Exception:
            pass  # reranker unavailable → keep hybrid order (graceful)
    return out[:k_final]


# -------------------------------------------------------------- assemble ----

PLAYBOOK_RULES = [
    # v0 seed rules; P3 playbook mining replaces these with corpus-validated ones
    "Lead with the business impact, not the mechanism.",
    "Never soften severity: keep the report's own rating and any active-exploitation status.",
    "Keep every number, count, deadline, and identifier — or say explicitly that it was omitted.",
    "Translate jargon; never delete the fact behind it.",
    "Preserve conditions and caveats ('requires authenticated access', 'no evidence of exploitation').",
    "End with one clear recommended action and its owner.",
]


_PLAYBOOK_PATH = pathlib.Path(__file__).with_name("playbook.md")


def load_playbook() -> str:
    """The operative playbook injected verbatim into the system prompt.

    Reads the versioned, corpus-distilled src/legible/playbook.md (GAMEPLAN §5).
    Falls back to the v0 seed PLAYBOOK_RULES if the file is missing.
    """
    try:
        return _PLAYBOOK_PATH.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return "\n".join(f"  {i+1}. {r}" for i, r in enumerate(PLAYBOOK_RULES))


def system_prompt(audience_key: str, format_key: str) -> str:
    from .audiences import AUDIENCES, FORMATS

    aud = AUDIENCES[audience_key]
    fmt = FORMATS[format_key]
    cares = "\n".join(f"  - {c}" for c in aud.cares_about)
    skip = "\n".join(f"  - {c}" for c in aud.does_not_need)
    rules = load_playbook()
    return (
        "You are a senior security consultant who translates technical findings "
        f"into business language for the {aud.label}. You never change the severity, "
        "drop caveats, alter numbers, or invent facts.\n\n"
        f"THIS READER CARES ABOUT:\n{cares}\n"
        f"THIS READER DOES NOT NEED:\n{skip}\n\n"
        f"FORMAT CONTRACT: {fmt.instructions}\n\n"
        f"PLAYBOOK:\n{rules}\n\n"
        "Respond with JSON matching the provided schema: translation, "
        "severity_conveyed, preserved_facts, omitted_details, confidence."
    )


def exemplar_block(exemplars: list[Exemplar]) -> str:
    """Most-similar LAST (recency position carries the most weight)."""
    blocks = []
    for ex in reversed(exemplars):
        blocks.append(
            f'<example source="{ex.source_org}" severity="{ex.severity_original}">\n'
            f"<technical_finding>\n{ex.technical_text}\n</technical_finding>\n"
            f"<executive_translation>\n{ex.executive_text}\n</executive_translation>\n"
            "</example>"
        )
    return "\n\n".join(blocks)


def user_prompt(finding: str) -> str:
    return f"<finding>\n{finding}\n</finding>\n\nTranslate this finding for the audience and format above."


OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "translation": {"type": "string"},
        "severity_conveyed": {"type": "string", "enum": ["critical", "high", "medium", "low", "info"]},
        "preserved_facts": {"type": "array", "items": {"type": "string"}},
        "omitted_details": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": ["translation", "severity_conveyed", "preserved_facts", "omitted_details", "confidence"],
    "additionalProperties": False,
}
