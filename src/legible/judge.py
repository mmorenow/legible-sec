"""LEGIBLE: the deterministic fidelity judge. Layer L0 of the rubric.

Contract: ZERO FALSE AUTHORITY. A check may only FAIL by showing the exact
matched strings as evidence. A PASS is a NON-DETECTION: it says that no check
matched, not that the property holds. Nothing in this file can establish that a
translation is faithful; it can only report what it caught. Anything this layer
cannot decide is left to the layers above it, which the rubric names L1
(entailment), L2 (judgement) and H (human), and which are not wired in.

Checks (run_deterministic runs all nine):
  id_parity        - CVE/CWE/GHSA/ICSA/consultancy IDs survive or are declared omitted
  numeric_parity   - numbers/percent/CVSS/dollar figures survive or are declared
  severity_drift   - lexical severity band of translation not below source
  entity_check     - IPs/domains/versions/ports: inventions and undeclared omissions
  caveat_parity    - hedges/conditions in source have a counterpart or declaration
  claim_inflation  - the translation does not assert more than the source supports
  status_drift     - fixed/unfixed and exploited/unexploited state is not flipped
  negation_flip    - a negated statement does not survive as an affirmed one
  format_lint      - format contract limits + audience jargon blacklist

  This list said D1-D6 until 2026-08-31, three checks after that stopped being
  true. The site copied the docstring rather than the code and told visitors the
  judge ran six checks. The browser port in presentation/web/src/lib/judge.ts
  runs the same list without format_lint, which needs an audience key it does
  not have: eight there, nine here.

  A pass is a NON-DETECTION, not a verification: it says no check matched, not
  that the property holds.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class Flag:
    check: str
    level: str  # "fail" | "warn"
    message: str
    evidence: list[str] = field(default_factory=list)


@dataclass
class JudgeReport:
    flags: list[Flag]
    passed: list[str]  # checks that ran and found nothing

    @property
    def ok(self) -> bool:
        return not any(f.level == "fail" for f in self.flags)


# ------------------------------------------------------------------ D1 ------

ID_PATTERNS = [
    re.compile(r"\bCVE-\d{4}-\d{4,7}\b", re.I),
    re.compile(r"\bCWE-\d{1,4}\b", re.I),
    re.compile(r"\bGHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}\b", re.I),
    re.compile(r"\bICSA-\d{2}-\d{3}-\d{2}\b", re.I),
    re.compile(r"\b(?:TOB|DYL|PBL|NCC|KL|OSTIF)-[A-Z0-9]{2,12}-\d{1,4}\b"),
]


def _extract_ids(text: str) -> set[str]:
    out: set[str] = set()
    for rx in ID_PATTERNS:
        out.update(m.group(0).upper() for m in rx.finditer(text))
    return out


def check_id_parity(source: str, translation: str, omitted: list[str]) -> list[Flag]:
    src_ids = _extract_ids(source)
    if not src_ids:
        return []
    covered = _extract_ids(translation) | _extract_ids(" ".join(omitted))
    missing = sorted(src_ids - covered)
    if missing:
        return [Flag("id_parity", "fail",
                     "identifier(s) in the source neither kept nor declared omitted",
                     missing)]
    return []


# ------------------------------------------------------------------ D2 ------

NUM_RX = re.compile(
    r"(?<![\w.-])(\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?|\$?\d+\.\d+|\$\d+|\d+(?:\.\d+)?\s?%|\d{4,6}|\b\d+\b)"
)
# numbers inside IDs/versions are handled by D1/D4; exclude their spans
_YEAR_RX = re.compile(r"\b(19|20)\d{2}\b")


def _extract_numbers(text: str, ignore_spans: list[tuple[int, int]] | None = None) -> set[str]:
    ignore = ignore_spans or []
    out: set[str] = set()
    for m in NUM_RX.finditer(text):
        if any(a <= m.start() < b for a, b in ignore):
            continue
        tok = m.group(0)
        norm = tok.replace(",", "").replace(" ", "").lstrip("$").rstrip("%")
        # skip bare years and trivial small counts (1,2) that read as prose
        if _YEAR_RX.fullmatch(tok) or norm in {"1", "2"}:
            continue
        out.add(norm)
    return out


def _id_spans(text: str) -> list[tuple[int, int]]:
    spans = []
    for rx in ID_PATTERNS + [VERSION_RX, IP_RX]:
        spans.extend(m.span() for m in rx.finditer(text))
    return spans


def check_numeric_parity(source: str, translation: str, omitted: list[str]) -> list[Flag]:
    src = _extract_numbers(source, _id_spans(source))
    if not src:
        return []
    kept = _extract_numbers(translation, _id_spans(translation))
    declared = _extract_numbers(" ".join(omitted), [])
    # also accept raw-substring presence (e.g. "9.8" inside "9.8/10")
    missing = sorted(
        n for n in src
        if n not in kept and n not in declared
        and n not in translation and n not in " ".join(omitted)
    )
    if missing:
        return [Flag("numeric_parity", "fail",
                     "number(s) in the source neither kept nor declared omitted",
                     missing)]
    return []


# ------------------------------------------------------------------ D3 ------

SEVERITY_BANDS: list[tuple[re.Pattern, int, str]] = [
    (re.compile(r"\bcritical\b", re.I), 4, "critical"),
    (re.compile(r"\bhigh(?:[-\s]severity| risk| impact)?\b", re.I), 3, "high"),
    (re.compile(r"\b(?:actively exploited|exploit\w*\s+in the wild|exploitation observed)\b", re.I), 4, "actively-exploited"),
    (re.compile(r"\bmedium\b|\bmoderate\b", re.I), 2, "medium"),
    (re.compile(r"\blow(?:[-\s]severity| risk)?\b", re.I), 1, "low"),
    (re.compile(r"\binformational\b|\binfo\b", re.I), 0, "info"),
]
CVSS_RX = re.compile(r"\bCVSS(?:\s*v?\d(?:\.\d)?)?\s*(?:base\s*)?(?:score\s*)?(?:of\s*)?[:\s]\s*(\d{1,2}(?:\.\d)?)", re.I)
BAND_BY_NAME = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}

# Negation guard: an exploitation/severity marker inside a negated clause must
# NOT count as a signal ("no evidence of exploitation in the wild"). False
# authority here is exactly what the regression suite exists to catch.
NEGATORS = re.compile(
    r"\b(?:no evidence|no indication|no sign|not been|have not|has not|was not|"
    r"were not|without any|not observed|not aware|not exploit)\b", re.I
)


def _negated(text: str, start: int) -> bool:
    sent_start = max(text.rfind(".", 0, start), text.rfind("\n", 0, start)) + 1
    return bool(NEGATORS.search(text[sent_start:start]))


def _severity_signal(text: str) -> tuple[int, list[str]] | None:
    best: tuple[int, list[str]] | None = None
    for rx, band, _name in SEVERITY_BANDS:
        for m in rx.finditer(text):
            if _negated(text, m.start()):
                continue
            if best is None or band > best[0]:
                best = (band, [m.group(0)])
            break
    for m in CVSS_RX.finditer(text):
        score = float(m.group(1))
        band = 4 if score >= 9.0 else 3 if score >= 7.0 else 2 if score >= 4.0 else 1
        if best is None or band > best[0]:
            best = (band, [m.group(0)])
    return best


def check_severity_drift(source: str, translation: str, severity_conveyed: str | None) -> list[Flag]:
    src = _severity_signal(source)
    if src is None:
        return []
    flags: list[Flag] = []
    tr = _severity_signal(translation)
    if tr is not None and tr[0] < src[0]:
        flags.append(Flag("severity_drift", "fail",
                          "translation's strongest severity signal is below the source's",
                          [f"source: {src[1][0]}", f"translation: {tr[1][0]}"]))
    elif tr is None:
        flags.append(Flag("severity_drift", "warn",
                          "source carries a severity signal but the translation names none",
                          [f"source: {src[1][0]}"]))
    if severity_conveyed:
        claimed = BAND_BY_NAME.get(severity_conveyed.lower())
        if claimed is not None and claimed < src[0]:
            flags.append(Flag("severity_drift", "fail",
                              "declared severity_conveyed is below the source's band",
                              [f"declared: {severity_conveyed}", f"source signal: {src[1][0]}"]))
    return flags


# ------------------------------------------------------------------ D4 ------

IP_RX = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
VERSION_RX = re.compile(r"\bv?\d+\.\d+(?:\.\d+){1,3}\b")
DOMAIN_RX = re.compile(r"\b[a-z0-9][a-z0-9-]{1,62}(?:\.[a-z0-9][a-z0-9-]{1,62})+\.(?:com|net|org|io|gov|edu|dev|co|us|uk|de|cloud)\b", re.I)
PORT_RX = re.compile(r"\bport\s+(\d{2,5})\b", re.I)


def _tech_entities(text: str) -> set[str]:
    out: set[str] = set()
    for rx in (IP_RX, VERSION_RX, DOMAIN_RX):
        out.update(m.group(0).lower() for m in rx.finditer(text))
    out.update(f"port {m.group(1)}" for m in PORT_RX.finditer(text))
    return out


def check_entities(source: str, translation: str, omitted: list[str]) -> list[Flag]:
    src = _tech_entities(source)
    tr = _tech_entities(translation)
    flags: list[Flag] = []
    invented = sorted(tr - src)
    if invented:
        flags.append(Flag("entity_check", "fail",
                          "technical entity in the translation does not appear in the source (possible invention)",
                          invented))
    # omissions of technical entities are usually FINE for exec audiences —
    # warn only, and only if undeclared; L4 arbitrates justification.
    declared = _tech_entities(" ".join(omitted))
    dropped = sorted(src - tr - declared)
    if dropped:
        flags.append(Flag("entity_check", "warn",
                          "technical entity dropped without declaration (may be justified for this audience)",
                          dropped))
    return flags


# ------------------------------------------------------------------ D5 ------

CAVEAT_MARKERS = [
    "requires authenticat", "requires local access", "requires physical access",
    "requires user interaction", "only if", "only when", "in certain configurations",
    "under certain conditions", "no evidence of exploitation", "no evidence that",
    "not exploitable", "did not observe", "we did not find", "theoretical",
    "difficult to exploit", "mitigated by", "already patched", "requires admin",
    "requires elevated", "low likelihood", "unlikely to", "provided that",
    "as long as", "if an attacker", "would require",
]
_WORD_RX = re.compile(r"[a-z0-9']+")


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", text) if s.strip()]


def _token_overlap(a: str, b: str) -> float:
    ta = set(_WORD_RX.findall(a.lower()))
    tb = set(_WORD_RX.findall(b.lower()))
    if not ta or not tb:
        return 0.0
    stop = {"the", "a", "an", "of", "to", "and", "in", "is", "that", "this", "for", "on", "be", "by", "it", "as", "with"}
    ta -= stop
    tb -= stop
    if not ta:
        return 0.0
    return len(ta & tb) / len(ta)


def _marker_clause(sentence: str, marker: str) -> str:
    """The sub-clause (comma/semicolon/' and ' split) containing the marker —
    comparing at clause level avoids penalizing caveats that share a sentence
    with unrelated detail (e.g. version ranges)."""
    for clause in re.split(r"[,;]| and ", sentence):
        if marker in clause.lower():
            return clause.strip()
    return sentence


def check_caveats(source: str, translation: str, omitted: list[str], threshold: float = 0.35) -> list[Flag]:
    flags: list[Flag] = []
    tr_sents = _sentences(translation) + omitted
    for sent in _sentences(source):
        low = sent.lower()
        marker = next((m for m in CAVEAT_MARKERS if m in low), None)
        if marker is None:
            continue
        clause = _marker_clause(sent, marker)
        best = max((_token_overlap(clause, t) for t in tr_sents), default=0.0)
        if best < threshold:
            flags.append(Flag("caveat_parity", "fail",
                              "caveat/condition in the source has no counterpart in the translation and was not declared omitted",
                              [clause]))
    return flags


# ------------------------------------------------------------------ D6 ------

def check_format(translation: str, format_key: str | None, audience_key: str | None) -> list[Flag]:
    from .audiences import AUDIENCES, FORMATS

    flags: list[Flag] = []
    words = len(translation.split())
    if format_key and format_key in FORMATS:
        fmt = FORMATS[format_key]
        if fmt.max_words and words > fmt.max_words:
            flags.append(Flag("format_lint", "fail",
                              f"{words} words exceeds the {fmt.label} limit of {fmt.max_words}",
                              [f"{words} words"]))
        if fmt.bullet_limit:
            bullets = [l for l in translation.splitlines() if l.strip().startswith(("-", "•", "*"))]
            if bullets and len(bullets) != fmt.bullet_limit:
                flags.append(Flag("format_lint", "fail",
                                  f"{len(bullets)} bullets; contract requires exactly {fmt.bullet_limit}",
                                  [f"{len(bullets)} bullets"]))
            for b in bullets:
                bw = len(b.lstrip("-•* ").split())
                if fmt.words_per_bullet and bw > fmt.words_per_bullet:
                    flags.append(Flag("format_lint", "fail",
                                      f"bullet exceeds {fmt.words_per_bullet} words",
                                      [b.strip()]))
    if audience_key and audience_key in AUDIENCES:
        aud = AUDIENCES[audience_key]
        low = translation.lower()
        hits = sorted({term for term in aud.jargon_blacklist if term in low})
        if hits:
            flags.append(Flag("format_lint", "warn",
                              f"unexplained technical jargon for the {aud.label} audience",
                              hits))
    return flags


# ------------------------------------------------------------------ run -----

# ---------------------------------------------------------------- D7-D9 ------
# Pragmatic checks (research 2026-07-13): the highest-stakes real-world fidelity
# failures aren't wrong numbers — they're claim-strength inflation, status drift,
# and negation flips. All comparative (source vs translation) with matched evidence.

# actions a security finding predicates; inflation = source hedges it, translation asserts it
_ACTION = (r"allow\w*|enabl\w*|permit\w*|grant\w*|expos\w*|leak\w*|caus\w*|"
           r"lead\w*|result\w*|access\w*|read\w*|writ\w*|execut\w*|compromis\w*|"
           r"bypass\w*|escalat\w*|steal|stole|stolen|disclos\w*|overwrit\w*|"
           r"drain\w*|delet\w*|modif\w*|tamper\w*|impersonat\w*|spoof\w*|forg\w*|"
           r"hijack\w*|poison\w*|inject\w*|deface\w*|encrypt\w*|exfiltrat\w*|"
           r"takeover|take\s+over|elevat\w*|manipulat\w*|corrupt\w*|redirect\w*")
_HEDGE = re.compile(
    r"\b(?:could|may|might|can|would|potential\w*|possibl\w*|if\s+exploited|"
    r"under\s+certain|in\s+theory|theoretically|is\s+able\s+to|be\s+able\s+to)\b", re.I)
_ASSERT_ACTION = re.compile(rf"\b(?:{_ACTION})\b", re.I)


def _hedged_before(text: str, pos: int, window: int = 60) -> bool:
    return bool(_HEDGE.search(text[max(0, pos - window):pos]))


def check_claim_inflation(source: str, translation: str) -> list[Flag]:
    """Source hedges an action ('could allow'); translation asserts it bare ('allows').

    Conservative: only fires when the translation carries NO hedge at all yet states
    an impact action that the source hedged. This avoids compound-noun false positives
    ('access-control') and correctly passes any translation that keeps its own hedge.
    """
    src_hedged = bool(_HEDGE.search(source)) and bool(_ASSERT_ACTION.search(source))
    if not src_hedged:
        return []
    if _HEDGE.search(translation):
        return []  # translation hedges too → not inflated
    m = _ASSERT_ACTION.search(translation)
    if not m:
        return []
    clause = translation[max(0, m.start() - 24):m.end() + 16]
    return [Flag("claim_inflation", "fail",
                 "source hedges the impact but the translation asserts it as fact",
                 [f"source hedge: {_HEDGE.search(source).group(0)}",
                  f"translation: …{clause.strip()}…"])]


# exploitation/remediation status signals
_STATUS = {
    "exploited_actual": re.compile(r"\b(?:was|were|has been|have been|is being|are being)\s+exploit\w*|attackers?\s+(?:accessed|stole|exfiltrat\w*|compromis\w*|drained|encrypted)|breach\s+occurred|\b\w+\s+(?:was|were|have been|has been)\s+(?:stolen|exfiltrat\w*|breached|compromised|encrypted|leaked)|(?:already|successfully)\s+(?:stolen|exploited|breached|compromised|accessed)", re.I),
    "exploited_potential": re.compile(r"\b(?:could|may|might|can)\s+(?:be\s+)?exploit\w*|an?\s+attacker\s+could|potential\w*\s+(?:for\s+)?exploit\w*|if\s+exploited", re.I),
    "remediated": re.compile(r"\b(?:has been|was|is|are|were)\s+(?:fixed|patched|remediat\w*|resolved|addressed|mitigat\w*)|no longer\s+vulnerable", re.I),
    "active": re.compile(r"\b(?:is|are|remains?|still)\s+vulnerable|unpatched|unremediat\w*|not\s+(?:yet\s+)?(?:fixed|patched|remediat\w*)", re.I),
}


def _status(text: str, key: str) -> str | None:
    m = _STATUS[key].search(text)
    return m.group(0) if m and not _negated(text, m.start()) else None


def check_status_drift(source: str, translation: str) -> list[Flag]:
    """Exploitation/remediation status flips: potential→actual, fixed→active, etc."""
    flags: list[Flag] = []
    # exploitation: source potential-only, translation claims it actually happened
    if _status(translation, "exploited_actual") and not _status(source, "exploited_actual"):
        if _status(source, "exploited_potential") or _ASSERT_ACTION.search(source):
            flags.append(Flag("status_drift", "fail",
                              "translation implies exploitation occurred; source only describes the potential",
                              [f"translation: {_status(translation, 'exploited_actual')}"]))
    # remediation: source says fixed, translation says still vulnerable (or vice versa)
    if _status(source, "remediated") and _status(translation, "active"):
        flags.append(Flag("status_drift", "fail",
                          "source states the issue was remediated; translation implies it is still active",
                          [f"source: {_status(source, 'remediated')}", f"translation: {_status(translation, 'active')}"]))
    if _status(source, "active") and _status(translation, "remediated"):
        flags.append(Flag("status_drift", "warn",
                          "translation implies remediation the source does not state",
                          [f"translation: {_status(translation, 'remediated')}"]))
    return flags


def check_negation_flip(source: str, translation: str) -> list[Flag]:
    """Source negates a claim the translation asserts positively (or vice versa)."""
    flags: list[Flag] = []
    # source negates exploitation but translation asserts it
    src_neg_exploit = bool(re.search(r"\bno\s+(?:evidence|indication|sign)\s+of\s+(?:exploit\w*|compromis\w*|access|breach)", source, re.I))
    if src_neg_exploit and _status(translation, "exploited_actual"):
        flags.append(Flag("negation_flip", "fail",
                          "source explicitly reports no evidence of exploitation; translation asserts it occurred",
                          [f"translation: {_status(translation, 'exploited_actual')}"]))
    return flags


def run_deterministic(
    source: str,
    translation: str,
    omitted_details: list[str] | None = None,
    severity_conveyed: str | None = None,
    format_key: str | None = None,
    audience_key: str | None = None,
) -> JudgeReport:
    omitted = omitted_details or []
    all_flags: list[Flag] = []
    ran: dict[str, bool] = {}

    for name, flags in [
        ("id_parity", check_id_parity(source, translation, omitted)),
        ("numeric_parity", check_numeric_parity(source, translation, omitted)),
        ("severity_drift", check_severity_drift(source, translation, severity_conveyed)),
        ("entity_check", check_entities(source, translation, omitted)),
        ("caveat_parity", check_caveats(source, translation, omitted)),
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
