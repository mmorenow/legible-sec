"""LEGIBLE F3 — the fidelity reviewer ("Grammarly de fidelidad").

Reverses the translator: given the source finding(s) and a DRAFT translation
(the user's, a colleague's, or another LLM's), annotate the draft sentence by
sentence — green (supported) / amber (imprecise or unsupported) / red
(fabricated, inflated, or contradicted) — each with the reason and the source
span it violates.

Architecture (robust, layered — mirrors the modern faithfulness stack:
typed deterministic checks + NLI atomic-claim support + LLM judge):
  L0  typed deterministic checks   → judge.run_deterministic (numbers, IDs,
      severity, entities, caveats, claim-inflation, status-drift, negation)
  L1  NLI support (SummaC/FENICE-style) → is each draft sentence entailed by the
      source? contradiction = red, unsupported = amber. Lazy cross-encoder,
      graceful if the model isn't present (L0 still runs).
  L2  LLM judge (cloud, optional)   → the hard qualitative calls. Not wired here.

Alignment: for a single finding, every sentence is checked against it. For a
set of findings (report-level), each sentence is aligned to its best-matching
finding by lexical overlap (embeddings when the index is available).
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field

from .judge import (
    Flag, _sentences, _token_overlap,
    check_id_parity, check_numeric_parity, check_severity_drift, check_entities,
    check_caveats, check_claim_inflation, check_status_drift, check_negation_flip,
)

# NLI labels a cross-encoder returns, mapped to our verdicts
NLI_MODEL = os.environ.get("LEGIBLE_NLI_MODEL", "cross-encoder/nli-deberta-v3-base")
_nli = None


def get_nli():
    global _nli
    if _nli is None:
        from sentence_transformers import CrossEncoder
        device = os.environ.get("LEGIBLE_EMBED_DEVICE") or None
        _nli = CrossEncoder(NLI_MODEL, device=device)
    return _nli


LEVEL_ORDER = {"green": 0, "amber": 1, "red": 2}
# which deterministic checks are red (dangerous) vs amber (imprecise)
_RED_CHECKS = {"claim_inflation", "status_drift", "negation_flip", "severity_drift",
               "id_parity", "numeric_parity", "entity_check"}
# a sentence that makes no factual claim (pure framing) shouldn't be forced through NLI
_CLAIMLESS = re.compile(r"^\s*(?:we\s+recommend|it\s+is\s+recommended|please|the\s+following|"
                        r"in\s+summary|overall|as\s+a\s+next\s+step)\b", re.I)


@dataclass
class Annotation:
    sentence: str
    level: str                      # green | amber | red
    reasons: list[str] = field(default_factory=list)   # human-readable
    types: list[str] = field(default_factory=list)     # check ids / nli
    source_ref: str = ""            # the finding it was aligned to (id or snippet)
    evidence: list[str] = field(default_factory=list)


@dataclass
class ReviewReport:
    annotations: list[Annotation]                      # per-sentence (assertion-level)
    coverage_flags: list[Flag] = field(default_factory=list)  # whole-draft (coverage-level)

    @property
    def worst(self) -> str:
        levels = [a.level for a in self.annotations]
        if any(f.level == "fail" for f in self.coverage_flags):
            levels.append("red")
        elif any(f.level == "warn" for f in self.coverage_flags):
            levels.append("amber")
        return max(levels, key=lambda l: LEVEL_ORDER[l], default="green")

    def summary(self) -> dict:
        from collections import Counter
        c = Counter(a.level for a in self.annotations)
        return {"green": c.get("green", 0), "amber": c.get("amber", 0), "red": c.get("red", 0),
                "coverage_issues": len(self.coverage_flags), "worst": self.worst}


def _align(sentence: str, findings: list[tuple[str, str]]) -> tuple[str, str]:
    """Return (ref, source_text) of the finding this sentence best matches."""
    if len(findings) == 1:
        return findings[0]
    best, best_score = findings[0], -1.0
    for ref, ftext in findings:
        s = _token_overlap(sentence, ftext)
        if s > best_score:
            best, best_score = (ref, ftext), s
    return best


def _nli_verdict(premise: str, hypothesis: str) -> tuple[str, float] | None:
    """Return (label, prob) where label ∈ {contradiction, entailment, neutral}."""
    try:
        ce = get_nli()
        import numpy as np
        scores = ce.predict([(premise, hypothesis)])
        row = scores[0] if hasattr(scores[0], "__len__") else scores
        labels = ["contradiction", "entailment", "neutral"]  # deberta-nli label order
        arr = list(row) if hasattr(row, "__len__") else [row]
        if len(arr) != 3:
            return None
        i = int(np.argmax(arr))
        # softmax for a calibrated confidence
        e = np.exp(arr - np.max(arr)); p = e / e.sum()
        return labels[i], float(p[i])
    except Exception:
        return None


def review_sentence(sentence: str, source: str, source_ref: str = "",
                    use_nli: bool = True) -> Annotation:
    ann = Annotation(sentence=sentence, level="green", source_ref=source_ref)

    # L0 — ASSERTION checks only (what THIS sentence claims vs the source).
    # Coverage checks (numbers/IDs/caveats dropped) run once at draft level, NOT
    # per-sentence — else every sentence over-fires on facts other sentences carry.
    # RED = clear fabrication/flip (exploitation claimed, negation flipped).
    # AMBER = borderline (dropped hedge): stating a real impact confidently is often
    # fine; the lost CONDITION is caught separately by caveat_parity. Let NLI/judge
    # escalate a dropped hedge to red only on an actual contradiction.
    _AMBER_ASSERT = {"claim_inflation"}
    for f in (check_claim_inflation(source, sentence)
              + check_status_drift(source, sentence)
              + check_negation_flip(source, sentence)):
        lvl = "amber" if f.check in _AMBER_ASSERT else ("red" if f.level == "fail" else "amber")
        ann.level = _max_level(ann.level, lvl)
        ann.types.append(f.check)
        ann.reasons.append(f.message)
        ann.evidence.extend(f.evidence)

    # L1 — NLI support (only for sentences that actually make a claim)
    if use_nli and not _CLAIMLESS.match(sentence) and len(sentence.split()) >= 4:
        v = _nli_verdict(source, sentence)
        if v:
            label, prob = v
            if label == "contradiction" and prob >= 0.55:
                ann.level = _max_level(ann.level, "red")
                ann.types.append("nli_contradiction")
                ann.reasons.append(f"the source contradicts this statement (NLI {prob:.2f})")
            elif label == "neutral" and prob >= 0.60 and ann.level == "green":
                # entailed-by-nothing: unsupported claim → amber (not red; could be fair context)
                ann.level = "amber"
                ann.types.append("nli_unsupported")
                ann.reasons.append(f"this statement is not supported by the source finding (NLI {prob:.2f})")
    return ann


def _max_level(a: str, b: str) -> str:
    return a if LEVEL_ORDER[a] >= LEVEL_ORDER[b] else b


def review(findings, draft: str, use_nli: bool = True) -> ReviewReport:
    """Review a draft translation against its source finding(s).

    findings: a str (single finding) or a list of (ref, text) tuples (report-level).
    draft:    the translation to audit.
    """
    if isinstance(findings, str):
        flist = [("finding", findings)]
    else:
        flist = [(r, t) if isinstance(t, str) else (str(r), str(t)) for r, t in findings]

    # --- draft-level COVERAGE pass (whole draft vs whole finding[s]) ---
    # Anti-fabrication, NOT anti-motion: DROPPING a number/caveat/ID is honest
    # abstraction → amber ("confirm intent"), never red. Only a severity DOWNGRADE
    # or an INVENTED entity is a real coverage violation → stays fail/red.
    full_source = "\n\n".join(t for _, t in flist)
    coverage: list[Flag] = []
    for f in (check_id_parity(full_source, draft, [])
              + check_numeric_parity(full_source, draft, [])
              + check_severity_drift(full_source, draft, None)
              + check_entities(full_source, draft, [])
              + check_caveats(full_source, draft, [])):
        # downgrade "dropped X" fails to warn; keep severity-downgrade + invention as fail
        if f.check in ("numeric_parity", "caveat_parity", "id_parity"):
            f.level = "warn"
        elif f.check == "entity_check" and "invent" not in f.message.lower() and "not in the source" not in f.message.lower():
            f.level = "warn"
        coverage.append(f)

    # --- per-sentence ASSERTION pass ---
    anns = []
    for sent in _sentences(draft):
        if not sent.strip():
            continue
        ref, src = _align(sent, flist)
        anns.append(review_sentence(sent, src, source_ref=ref, use_nli=use_nli))
    return ReviewReport(annotations=anns, coverage_flags=coverage)


# ------------------------------------------------------------- pretty print ---

_ANSI = {"green": "\033[42m\033[30m", "amber": "\033[43m\033[30m", "red": "\033[41m\033[97m", "0": "\033[0m"}


def render_terminal(rep: ReviewReport) -> str:
    lines = []
    for a in rep.annotations:
        tag = {"green": "OK ", "amber": "~? ", "red": "!! "}[a.level]
        lines.append(f"{_ANSI[a.level]} {tag}{_ANSI['0']} {a.sentence}")
        if a.reasons:
            lines.append(f"      └ {'; '.join(a.reasons)}")
    if rep.coverage_flags:
        lines.append("\n  COBERTURA (borrador completo vs finding):")
        for f in rep.coverage_flags:
            mark = "!!" if f.level == "fail" else "~?"
            lines.append(f"    {mark} {f.check}: {f.message} | {f.evidence}")
    s = rep.summary()
    lines.append(f"\n  {s['green']} verde · {s['amber']} ámbar · {s['red']} rojo · "
                 f"{s['coverage_issues']} de cobertura → veredicto: {s['worst']}")
    return "\n".join(lines)
