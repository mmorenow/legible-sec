"""Prototipo NLI local — Fase 3 ítem 3 (research/AUDITORIA).

Entailment a nivel de claim para atrapar lo que el regex y el coseno no ven:
IMPACTO INVENTADO y NEGACIÓN SEMÁNTICA. La pregunta que NLI responde y el coseno no:
¿la fuente SOSTIENE (entails) esta afirmación de la traducción? Si no, es potencial
invención.

Modelo: cross-encoder NLI clase DeBERTa (~180-440M, CPU/MPS de laptop). Se mide latencia
porque el argumento de privacidad local (1.4) depende de que esto corra dentro del
perímetro y rápido.
"""
from __future__ import annotations

import os

from .judge import Flag, _sentences, _ASSERT_ACTION

_MODEL_NAME = os.environ.get("LEGIBLE_NLI_MODEL", "cross-encoder/nli-deberta-v3-base")
_nli = None
# label order de cross-encoder/nli-deberta-v3-*: [contradiction, entailment, neutral]
_LABELS = ("contradiction", "entailment", "neutral")


def _get_nli():
    global _nli
    if _nli is None:
        from sentence_transformers import CrossEncoder
        dev = os.environ.get("LEGIBLE_EMBED_DEVICE") or None
        _nli = CrossEncoder(_MODEL_NAME, device=dev, max_length=512)
    return _nli


def _softmax(row):
    import numpy as np
    e = np.exp(row - np.max(row))
    return e / e.sum()


def nli_scores(premise: str, hypotheses: list[str]) -> list[dict]:
    """Para cada hipótesis: {contradiction, entailment, neutral} probabilidades."""
    if not hypotheses:
        return []
    m = _get_nli()
    logits = m.predict([(premise, h) for h in hypotheses])
    import numpy as np
    logits = np.asarray(logits)
    if logits.ndim == 1:
        logits = logits[None, :]
    return [dict(zip(_LABELS, _softmax(r))) for r in logits]


def check_unsupported_claims_nli(source: str, translation: str,
                                 entail_min: float = 0.50,
                                 contra_min: float = 0.50) -> list[Flag]:
    """Marca oraciones de la traducción que afirman un impacto NO sostenido por la fuente.

    - Solo mira oraciones que asertan una acción de impacto (usa el mismo _ASSERT_ACTION
      del judge, para no evaluar frases de relleno).
    - CONTRADICTION alta -> negation/status flip (fail).
    - entailment bajo (ni sostenido ni contradicho -> neutral) -> impacto potencialmente
      inventado (warn->fail según entail_min).
    """
    cand = [s for s in _sentences(translation) if _ASSERT_ACTION.search(s)]
    if not cand:
        return []
    scores = nli_scores(source, cand)
    flags = []
    for sent, sc in zip(cand, scores):
        if sc["contradiction"] >= contra_min:
            flags.append(Flag("nli_contradiction", "fail",
                              "translation claim contradicts the source",
                              [f"{sent}  (contradiction={sc['contradiction']:.2f})"]))
        elif sc["entailment"] < entail_min:
            flags.append(Flag("nli_unsupported", "fail",
                              "translation asserts an impact the source does not support (possible invention)",
                              [f"{sent}  (entailment={sc['entailment']:.2f})"]))
    return flags
