"""Extraction validation harness — thresholds calibrated on the 30-doc P0 set (2026-07-07).

Calibration evidence: data/calibration/calibration-report.md.
Key deviations from the research/02 sketch, driven by observed data:
  - dict_ratio: hard-fail 0.55 / warn 0.68 (was 0.70). Two clean code-heavy docs
    (istio-ztunnel 0.634, X41 BIND9 0.633) sit below 0.70; garbled CID extractions
    crater far lower, so 0.55 separates garbage from code-heavy prose.
  - headers_ok: per-firm alias profiles replace the three generic regexes.
    Naive regexes located exec+findings sections in 24/30 docs; profiles reach 30/30.
  - tables_ok: table *presence* is a per-firm expectation. Cure53's house style is
    prose-only (0 tables on all 5 calibration docs is normal); a TOB report with
    0 tables would signal a parse failure.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# --- Per-firm profiles (heading aliases, register, structural expectations) ---

# Optional leading section numbering: "1 ", "4.1 ", "2.3.1 "
_NUM = r"^#{1,6}\s*(?:\d+(?:\.\d+)*\.?\s+)?"

GENERIC_EXEC_RX = _NUM + r".*(executive\s+(summary|report)|management\s+summary)"
GENERIC_FINDINGS_RX = _NUM + r".*((detailed\s+)?findings?|findings\s+summary|vulnerability\s+summary|identified\s+(vulnerabilit|issues)|results)"
GENERIC_STRUCTURE_RX = _NUM + r".*(scope|methodology|introduction|conclusion|recommendations|appendix)"


@dataclass
class FirmProfile:
    name: str
    # Registers per D30 (GAMEPLAN §4.4): practitioner | technical_leadership | management | public
    audience_observed: str
    exec_rx: str = GENERIC_EXEC_RX
    findings_rx: str = GENERIC_FINDINGS_RX
    expect_tables: bool = True
    # Finding-ID pattern for tier-0 structural alignment (None → embed+LLM only)
    finding_id_rx: str | None = None
    notes: str = ""


FIRM_PROFILES: dict[str, FirmProfile] = {
    "trailofbits": FirmProfile(
        name="Trail of Bits",
        audience_observed="technical_leadership",
        exec_rx=_NUM + r".*executive\s+summary",
        # 2023+: Detailed/Summary of Findings · ~2021 template: Vulnerability Summary
        # · 2022-era variants: Notable Findings, Findings Summary (P1 corpus scan)
        findings_rx=_NUM + r".*(detailed\s+findings|(summary\s+of|notable)\s+findings"
                    r"|findings\s+summary|vulnerability\s+summary|findings?\b)",
        finding_id_rx=r"TOB-[A-Z0-9]+-\d+",
        notes=(
            "2024+ template: 'Observations and Impact' prose cites finding IDs inline "
            "(tier-0 alignment). Pre-2024/undated: exec summary is engagement logistics; "
            "expect doc-level pairs only. Finding #1's title header is sometimes missed "
            "by the layout model — segment findings on ID/severity anchors, not headers alone."
        ),
    ),
    "cure53": FirmProfile(
        name="Cure53",
        audience_observed="technical_leadership",  # standalone Summary-Reports: management
        exec_rx=_NUM + r".*(management\s+summary|introduction|conclusions?)",
        findings_rx=_NUM + r".*(identified\s+vulnerabilit|miscellaneous\s+issues)",
        expect_tables=False,  # prose-only house style; 0 tables is normal
        finding_id_rx=r"[A-Z]{2,4}-\d{2}-\d{3}",
        notes=(
            "Full reports carry exec prose in Introduction + Conclusions (no 'summary' "
            "heading). Standalone summary-report_*.pdf = management register, doc-level "
            "gold pairs; finding one-liners cite IDs + severity + FIXED status."
        ),
    ),
    "ncc": FirmProfile(
        name="NCC Group",
        audience_observed="technical_leadership",
        exec_rx=_NUM + r".*executive\s+summary",
        findings_rx=_NUM + r".*(key\s+findings|findings?)",
    ),
    "bishopfox": FirmProfile(
        name="Bishop Fox",
        audience_observed="technical_leadership",
        exec_rx=_NUM + r".*executive\s+report",  # all-caps EXECUTIVE REPORT in the wild
        findings_rx=_NUM + r".*(identified\s+issues|summary\s+of\s+findings)",
    ),
    "doyensec": FirmProfile(
        name="Doyensec",
        audience_observed="technical_leadership",
        findings_rx=_NUM + r".*(project\s+findings|findings\s+recap)",
    ),
    "x41": FirmProfile(
        name="X41 D-Sec",
        audience_observed="technical_leadership",
        findings_rx=_NUM + r".*(results|findings)",
        finding_id_rx=r"[A-Z]{3}-[A-Z]{2}-\d{2}-\d{2}",
    ),
    "ros": FirmProfile(
        name="Radically Open Security",
        audience_observed="technical_leadership",
        notes="Numbered headings ('1 Executive Summary', '4.1 Findings').",
    ),
    "cisa": FirmProfile(
        name="CISA",
        audience_observed="practitioner",
        exec_rx=_NUM + r".*(executive\s+summary|summary|advisory\s+at\s+a\s+glance)",
        findings_rx=_NUM + r".*(technical\s+details|mitigations)",
        expect_tables=False,
    ),
    "ostif_blog": FirmProfile(
        name="OSTIF blog summaries",
        audience_observed="public",
        expect_tables=False,
    ),
    "generic": FirmProfile(name="(unknown firm)", audience_observed="technical_leadership"),
}


# --- Validation checks (run per document after every conversion tier) ---

THRESHOLDS = {
    "chars_per_page": (400, 8000),   # observed 1075–2836; band unchanged, generous
    "dict_ratio_fail": 0.55,         # observed clean min 0.633 (code-heavy)
    "dict_ratio_warn": 0.68,         # 0.68–0.70: code-heavy but clean — review, don't re-parse
    "mojibake_max": 0.001,           # observed 0.0 on all 30
    "table_min_dims": (2, 2),        # degenerate-table check, unchanged
    "table_empty_frac_max": 0.6,
}

_SEV_RX = re.compile(r"(?i)\b(critical|high|medium|low|informational)\b")
_MOJIBAKE_RX = re.compile(r"\(cid:\d+\)")


@dataclass
class ValidationResult:
    checks: dict[str, bool] = field(default_factory=dict)
    warns: list[str] = field(default_factory=list)
    stats: dict[str, float] = field(default_factory=dict)

    @property
    def passed(self) -> bool:
        return all(self.checks.values())


def validate(md: str, n_pages: int, table_stats: list[dict], words: set[str],
             firm: str = "generic") -> ValidationResult:
    """table_stats: [{'num_cols': int, 'num_rows': int, 'empty_cell_frac': float}, ...]"""
    profile = FIRM_PROFILES.get(firm, FIRM_PROFILES["generic"])
    r = ValidationResult()
    plain = re.sub(r"[#|*`\-]", " ", md)
    tokens = re.findall(r"[A-Za-z]{2,}", plain)

    lo, hi = THRESHOLDS["chars_per_page"]
    cpp = len(plain) / max(n_pages, 1)
    r.stats["chars_per_page"] = cpp
    r.checks["chars_per_page_ok"] = lo <= cpp <= hi

    dict_ratio = sum(t.lower() in words for t in tokens) / max(len(tokens), 1)
    r.stats["dict_ratio"] = dict_ratio
    r.checks["dict_ratio_ok"] = dict_ratio >= THRESHOLDS["dict_ratio_fail"]
    if THRESHOLDS["dict_ratio_fail"] <= dict_ratio < THRESHOLDS["dict_ratio_warn"]:
        r.warns.append(f"dict_ratio {dict_ratio:.3f} in warn band (code-heavy doc?)")

    mojibake = (md.count("�") + len(_MOJIBAKE_RX.findall(md))) / max(len(md), 1)
    r.stats["mojibake"] = mojibake
    r.checks["mojibake_ok"] = mojibake < THRESHOLDS["mojibake_max"]

    r.checks["exec_section_ok"] = bool(re.search(profile.exec_rx, md, re.I | re.M))
    r.checks["findings_section_ok"] = bool(re.search(profile.findings_rx, md, re.I | re.M))
    if not r.checks["exec_section_ok"] and re.search(GENERIC_STRUCTURE_RX, md, re.I | re.M):
        r.warns.append("exec heading missed but generic structure present — check firm profile")

    # Single-row "tables" are usually styled title boxes (TOB finding headers
    # render as 1-row tables ~30% of the time — P0/P1 finding); only multi-row
    # tables are data tables, and one bad table must not fail a whole doc.
    min_c, min_r = THRESHOLDS["table_min_dims"]
    data_tables = [t for t in table_stats if t["num_rows"] >= min_r]
    degenerate = [t for t in data_tables
                  if t["num_cols"] < min_c
                  or t["empty_cell_frac"] >= THRESHOLDS["table_empty_frac_max"]]
    r.checks["tables_ok"] = (not data_tables) or (len(degenerate) / len(data_tables) <= 0.5)
    if profile.expect_tables and not table_stats:
        r.checks["tables_ok"] = False
        r.warns.append(f"0 tables but {profile.name} reports normally contain tables")
    elif degenerate:
        r.warns.append(f"{len(degenerate)}/{len(data_tables)} data tables degenerate")

    r.checks["severity_ok"] = bool(_SEV_RX.search(md))
    return r
