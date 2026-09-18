"""Tier-0 alignment: ID-anchored candidate-pair extraction (GAMEPLAN §4.3 step 0).

The ID regex PROPOSES candidates; an LLM verification pass confirms them later.
Exec claim spans that cite no ID are NOT handled here — they go to the
embed+LLM path. Calibrated against the P0 set: bron (14 findings cited in exec),
pypi-warehouse (10), obsidian-3 (6 DYL IDs across summary + conclusions).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .schema import CandidatePair

# --- shared helpers ---------------------------------------------------------

_HEADING_RX = re.compile(r"^#{1,6}\s*(.+?)\s*$")
_SENT_SPLIT_RX = re.compile(
    r"(?<!\b[A-Z])(?<!\bDr)(?<!\be\.g)(?<!\bi\.e)(?<!\bvs)\.\s+(?=[A-Z(])"
)
SEVERITIES = ("critical", "high", "medium", "low", "informational", "info", "undetermined")


def _slice_between(lines: list[str], start_rx: str, end_rx: str) -> tuple[int, int] | None:
    start = end = None
    for i, l in enumerate(lines):
        m = _HEADING_RX.match(l)
        if not m:
            continue
        if start is None and re.search(start_rx, m.group(1), re.I):
            start = i
        elif start is not None and re.search(end_rx, m.group(1), re.I):
            end = i
            break
    if start is None:
        return None
    return start, end if end is not None else len(lines)


def split_sentences(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    return [s.strip() for s in _SENT_SPLIT_RX.split(text) if len(s.strip()) > 20]


# --- Trail of Bits ----------------------------------------------------------

TOB_ID_RX = re.compile(r"TOB-[A-Z0-9]+-(\d+)")
_ANAPHORA_RX = re.compile(r"^(This|These|That|Those|Such|It|They|Both)\b", re.I)
_TOB_EXEC_END_RX = (
    r"Finding Severities|Project Goals|Summary of Findings|System Architecture|Methodology"
)
_TOB_NUMBERED_FINDING_RX = re.compile(r"^#{1,6}\s*(\d+)\.\s+(.+?)\s*$")
# Summary-of-findings table rows: | 2 | Title ... | Severity | ...
_TOB_TABLE_ROW_RX = re.compile(r"^\|\s*(\d+)\s*\|([^|]+)\|([^|]+)\|", re.M)


@dataclass
class FindingUnit:
    number: int
    title: str
    text: str = ""
    severity: str = ""


def tob_finding_table(md: str) -> dict[int, tuple[str, str]]:
    """number -> (title, severity) from the Summary of Findings table(s).
    Severity may sit in column 3 or 4 depending on the table variant."""
    out: dict[int, tuple[str, str]] = {}
    for line in md.split("\n"):
        m = re.match(r"^\|\s*(\d{1,2})\s*\|(.+)\|\s*$", line)
        if not m:
            continue
        n = int(m.group(1))
        cells = [c.strip() for c in m.group(2).split("|")]
        if not cells or len(cells[0]) < 8:  # title cell must be substantive
            continue
        sev = next((c for c in cells[1:4] if c.lower() in SEVERITIES), "")
        if n not in out:
            out[n] = (cells[0], sev)
        elif sev and not out[n][1]:
            out[n] = (out[n][0], sev)
    return out


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


# Finding-title line, heading OR plain text — Docling's layout model misses
# ~30% of numbered finding headers (P0 calibration), leaving them as body text.
_TOB_FINDING_LINE_RX = re.compile(r"^(?:#{1,6}\s*)?(\d{1,2})\.\s+(\S.*?)\s*$")
# ...and some finding-header boxes become TABLES: | 13. Title | 13. Title |
_TOB_FINDING_TABLEHDR_RX = re.compile(r"^\|\s*(\d{1,2})\.\s+([^|]+?)\s*\|")
# ...and ~40% of header boxes are dropped ENTIRELY (rendered as images). The
# property box survives as a table and carries the explicit ID — the strongest
# anchor: "| Severity: High | ... Finding ID: TOB-BREW-14 |"
_TOB_PROPBOX_RX = re.compile(r"Finding ID:\s*TOB-[A-Z0-9]+-(\d{1,2})\b")


def extract_findings_tob(md: str) -> list[FindingUnit]:
    """Segment Detailed Findings against the Summary of Findings table (which is
    always complete) rather than trusting headers. A split point is a line
    matching `N. Title` where N is in the table, strictly increasing, and the
    inline title fuzzy-matches the table title (guards against numbered lists
    inside finding bodies)."""
    lines = md.split("\n")
    span = _slice_between(lines, r"^Detailed Findings$", r"^(Summary of (Fix|Code)|Appendi|About Trail)")
    if span is None:
        return []
    body = lines[span[0] + 1 : span[1]]
    table = tob_finding_table(md)

    def title_matches(inline: str, n: int) -> bool:
        if n not in table:
            return False
        a, b = _norm(inline)[:24], _norm(table[n][0])[:24]
        if not a or not b:
            return False
        return a[:12] == b[:12] or a in b or b in a

    splits: list[tuple[int, int, str]] = []  # (line_idx, number, inline_title)
    last_n = 0
    for i, l in enumerate(body):
        stripped = l.strip()
        m = _TOB_FINDING_LINE_RX.match(stripped) or _TOB_FINDING_TABLEHDR_RX.match(stripped)
        if not m:
            continue
        n = int(m.group(1))
        if n <= last_n or n not in table:
            continue
        if stripped.startswith("#") or title_matches(m.group(2), n):
            splits.append((i, n, m.group(2)))
            last_n = n

    # Recovery pass: property-box anchors for numbers the three patterns missed.
    # The box sits just under the (dropped) title; back up ≤2 lines if the line
    # above fuzzy-matches the table title, so the unit starts at its title text.
    have = {n for _, n, _ in splits}
    for i, l in enumerate(body):
        m = _TOB_PROPBOX_RX.search(l)
        if not m:
            continue
        n = int(m.group(1))
        if n in have or n not in table:
            continue
        start = i
        for back in (1, 2):
            if i - back >= 0 and title_matches(body[i - back].strip("|# "), n):
                start = i - back
                break
        splits.append((start, n, table[n][0]))
        have.add(n)
    splits.sort(key=lambda t: t[0])
    # drop out-of-order collisions introduced by recovery (same start line, etc.)
    cleaned, seen_n = [], set()
    for s in splits:
        if s[1] not in seen_n:
            cleaned.append(s)
            seen_n.add(s[1])
    splits = cleaned

    units: list[FindingUnit] = []
    for k, (i, n, inline_title) in enumerate(splits):
        end = splits[k + 1][0] if k + 1 < len(splits) else len(body)
        title, sev = table.get(n, (inline_title, ""))
        units.append(FindingUnit(
            number=n, title=inline_title or title, severity=sev,
            text="\n".join(body[i + 1 : end]).strip()))
    # finding 1 fallback: content before the first split belongs to finding 1
    if splits and splits[0][1] >= 2 and 1 in table and splits[0][0] > 3:
        text = "\n".join(body[: splits[0][0]]).strip()
        if len(text) > 200:
            title, sev = table[1]
            units.insert(0, FindingUnit(number=1, title=title, severity=sev, text=text))
    return units


def extract_candidates_tob(md: str, doc_id: str,
                           extra_units: list[FindingUnit] | None = None) -> list[CandidatePair]:
    lines = md.split("\n")
    span = _slice_between(lines, r"^Executive Summary$", _TOB_EXEC_END_RX)
    if span is None:
        return []
    exec_text = "\n".join(lines[span[0] : span[1]])
    exec_text = re.sub(r"<!--.*?-->", "\n\n", exec_text)          # image markers = hard breaks
    exec_text = re.sub(r"^#{1,6}.*$", "\n", exec_text, flags=re.M)  # headings = hard breaks
    findings = {f.number: f for f in extract_findings_tob(md)}
    for u in extra_units or []:  # LLM-pointer-recovered absorbed units (D39)
        findings.setdefault(u.number, u)
    pairs: list[CandidatePair] = []
    # keep paragraph structure so anaphoric spans can expand to their antecedent
    paras = [split_sentences(p) for p in re.split(r"\n\s*\n", exec_text)]
    flat: list[tuple[int, int, str]] = [(pi, ki, s) for pi, p in enumerate(paras)
                                        for ki, s in enumerate(p)]
    sentences = [s for _, _, s in flat]
    for si, sent in enumerate(sentences):
        ids = TOB_ID_RX.findall(sent)
        if not ids:
            continue
        nums = sorted({int(n) for n in ids})
        # anaphora expansion (D39b): "This issue is caused by..." needs its
        # antecedent — prepend up to 2 contiguous same-paragraph sentences,
        # stopping at the first non-anaphoric opener. Verbatim + contiguous.
        pi, ki, _ = flat[si]
        span_sents = [sent]
        while (ki > 0 and len(span_sents) <= 2
               and _ANAPHORA_RX.match(span_sents[0].strip())):
            ki -= 1
            span_sents.insert(0, paras[pi][ki])
        sent = ""
        for piece in span_sents:
            sent += piece if not sent else (" " if sent.rstrip().endswith((".", "!", "?", ":")) else ". ") + piece
        for n in nums:
            f = findings.get(n)
            if f is None:
                continue
            pairs.append(CandidatePair(
                pair_id=f"{doc_id.split('/')[-1]}#s{si}-f{n}",
                source_doc_id=doc_id,
                source_org="trailofbits",
                doc_type="security_review",
                technical_text=f"{f.title}\n\n{f.text}"[:6000],
                technical_context=f.title,
                executive_text=sent,
                audience_observed="technical_leadership",
                alignment_method="id_anchor",
                alignment_type="1:1" if len(nums) == 1 else "1:N",
                cited_ids=[f"#{n}"],
                finding_numbers=[n],
                severity_original=f.severity,
            ))
    return pairs


# --- Cure53 -----------------------------------------------------------------

CURE53_ID_RX = re.compile(r"\b([A-Z]{2,4}-\d{2}-\d{3})\b")
_CURE53_FINDING_HDR_RX = re.compile(
    r"^#{1,6}\s*([A-Z]{2,4}-\d{2}-\d{3})\s+(.+?)\s*\(\s*(\w+)\s*\)\s*$"
)


def extract_findings_cure53(md: str) -> dict[str, FindingUnit]:
    units: dict[str, FindingUnit] = {}
    lines = md.split("\n")
    current_id, title, sev, buf = None, "", "", []

    def flush() -> None:
        nonlocal current_id, buf
        if current_id:
            units[current_id] = FindingUnit(0, title, "\n".join(buf).strip(), sev)
        current_id, buf = None, []

    for l in lines:
        m = _CURE53_FINDING_HDR_RX.match(l)
        if m:
            flush()
            current_id, title, sev = m.group(1), m.group(2), m.group(3)
        elif _HEADING_RX.match(l) and current_id and re.search(
            r"(Conclusions?|Miscellaneous Issues|Identified Vulnerabilities)", l, re.I
        ):
            flush()
        elif current_id is not None:
            buf.append(l)
    flush()
    return units


def extract_candidates_cure53(full_md: str, doc_id: str,
                              summary_md: str | None = None) -> list[CandidatePair]:
    """Exec side = standalone summary-report prose (register: management) if given,
    else the full report's Conclusions section (register: technical_leadership)."""
    findings = extract_findings_cure53(full_md)
    pairs: list[CandidatePair] = []

    def harvest(text: str, register: str, kind_prefix: str) -> None:
        for si, raw in enumerate(text.split("\n")):
            line = raw.strip()
            is_bullet = line.startswith(("-", "·"))
            chunks = [line] if is_bullet else split_sentences(line) or []
            for ci, chunk in enumerate(chunks):
                ids = CURE53_ID_RX.findall(chunk)
                if not ids:
                    continue
                for fid in sorted(set(ids)):
                    f = findings.get(fid)
                    if f is None:
                        continue
                    pairs.append(CandidatePair(
                        pair_id=f"{doc_id.split('/')[-1]}#{kind_prefix}{si}.{ci}-{fid}",
                        source_doc_id=doc_id,
                        source_org="cure53",
                        doc_type="pentest_report",
                        technical_text=f"{fid} {f.title}\n\n{f.text}"[:6000],
                        technical_context=f"{fid} {f.title}",
                        executive_text=chunk,
                        audience_observed=register,
                        alignment_method="id_anchor",
                        alignment_type="1:1" if len(set(ids)) == 1 else "1:N",
                        cited_ids=sorted(set(ids)),
                        severity_original=f.severity,
                        exec_span_kind="bullet_list" if is_bullet else "prose",
                    ))

    if summary_md:
        harvest(summary_md, "management", "sum")
    lines = full_md.split("\n")
    span = _slice_between(lines, r"^Conclusions?$", r"$^")  # to EOF
    if span:
        harvest("\n".join(lines[span[0] + 1 : span[1]]), "technical_leadership", "conc")
    return pairs
