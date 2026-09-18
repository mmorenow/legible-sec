"""Judge v2 — quick wins de la Fase 3 (research/AUDITORIA §3, Fase 3).

Arregla lo que la Fase 1 midió como roto en la capa determinista:
  - D5 caveat_parity: coseno de embeddings (Qwen3, ya cargado) en vez de token-overlap
    → mata los ~58% de falsos positivos sobre paráfrasis fieles y sube recall en
    caveat parafraseado.
  - D3 severity_drift BIDIRECCIONAL: atrapa inflar la severidad (antes 0%), no solo bajarla.
  - (opcional) NLI local para impacto inventado / negación semántica — en judge_nli.py,
    con medición de latencia, porque en esta Mac la inferencia CPU/MPS es cara.

Reusa las piezas de judge.py; solo reemplaza dos checks y re-ensambla run_deterministic_v2.
"""
from __future__ import annotations

import numpy as np

from .judge import (
    Flag, JudgeReport,
    check_id_parity, check_numeric_parity, check_entities,
    check_claim_inflation, check_status_drift, check_negation_flip, check_format,
    check_severity_drift, _severity_signal, BAND_BY_NAME,
    _sentences, _marker_clause, CAVEAT_MARKERS,
)

# ------------------------------------------------------------------ D5 embed
_model = None


def _get_model():
    global _model
    if _model is None:
        from .rag import get_model
        _model = get_model()
    return _model


def check_caveats_embed(source: str, translation: str, omitted=None,
                        threshold: float = 0.55) -> list[Flag]:
    """Como check_caveats pero con similitud coseno de embeddings a nivel de cláusula.

    Un caveat de la fuente se considera CONSERVADO si alguna oración de la traducción
    (o de omitted) tiene coseno >= threshold con la cláusula-caveat. Semántico, no léxico:
    una buena paráfrasis ("el atacante ya tendría que estar dentro") matchea la condición
    ("requires a valid session token") aunque no comparta tokens.
    """
    omitted = omitted or []
    src_clauses = []
    for sent in _sentences(source):
        low = sent.lower()
        marker = next((m for m in CAVEAT_MARKERS if m in low), None)
        if marker:
            src_clauses.append(_marker_clause(sent, marker))
    if not src_clauses:
        return []
    tr_sents = _sentences(translation) + list(omitted)
    if not tr_sents:
        return [Flag("caveat_parity", "fail",
                     "caveat/condition in the source has no counterpart in the translation",
                     src_clauses)]
    m = _get_model()
    src_emb = m.encode(src_clauses, normalize_embeddings=True)
    tr_emb = m.encode(tr_sents, normalize_embeddings=True)
    sims = np.asarray(src_emb) @ np.asarray(tr_emb).T  # (n_src, n_tr) cosine
    flags = []
    for i, clause in enumerate(src_clauses):
        if float(sims[i].max()) < threshold:
            flags.append(Flag("caveat_parity", "fail",
                              "caveat/condition in the source has no semantic counterpart in the translation",
                              [clause]))
    return flags


# ------------------------------------------------------------------ D3 bidir
def check_severity_drift_bidir(source: str, translation: str,
                               severity_conveyed: str | None) -> list[Flag]:
    """D3 en AMBAS direcciones: bajar (ya cubierto) e INFLAR (nuevo).

    El pitch fundacional dice que inflar es tan dañino como suavizar (pánico
    injustificado). La v1 solo vigilaba tr < src.
    """
    flags = list(check_severity_drift(source, translation, severity_conveyed))  # downward + None-warn
    src = _severity_signal(source)
    if src is None:
        return flags
    tr = _severity_signal(translation)
    if tr is not None and tr[0] > src[0]:
        flags.append(Flag("severity_drift", "fail",
                          "translation's strongest severity signal is ABOVE the source's (inflation)",
                          [f"source: {src[1][0]}", f"translation: {tr[1][0]}"]))
    if severity_conveyed:
        claimed = BAND_BY_NAME.get(severity_conveyed.lower())
        if claimed is not None and claimed > src[0]:
            flags.append(Flag("severity_drift", "fail",
                              "declared severity_conveyed is ABOVE the source's band (inflation)",
                              [f"declared: {severity_conveyed}", f"source signal: {src[1][0]}"]))
    return flags


# ------------------------------------------------------------------ run v2
def run_deterministic_v2(
    source: str,
    translation: str,
    omitted_details=None,
    severity_conveyed: str | None = None,
    format_key: str | None = None,
    audience_key: str | None = None,
    caveat_threshold: float = 0.55,
) -> JudgeReport:
    omitted = omitted_details or []
    all_flags: list[Flag] = []
    ran = {}
    for name, flags in [
        ("id_parity", check_id_parity(source, translation, omitted)),
        ("numeric_parity", check_numeric_parity(source, translation, omitted)),
        ("severity_drift", check_severity_drift_bidir(source, translation, severity_conveyed)),
        ("entity_check", check_entities(source, translation, omitted)),
        ("caveat_parity", check_caveats_embed(source, translation, omitted, caveat_threshold)),
        ("claim_inflation", check_claim_inflation(source, translation)),
        ("status_drift", check_status_drift(source, translation)),
        ("negation_flip", check_negation_flip(source, translation)),
        ("format_lint", check_format(translation, format_key, audience_key)),
    ]:
        ran[name] = True
        all_flags.extend(flags)
    flagged = {f.check for f in all_flags}
    passed = [c for c in ran if c not in flagged]
    return JudgeReport(flags=all_flags, passed=passed)
