#!/usr/bin/env python3
"""LEGIBLE P1 Task D: validate + section stats for the parsed TOB corpus.

Reads every doc in data/corpus/out/{md,json}/ that came from the TOB PDF
corpus (data/corpus/downloads_tob.json), runs it through
src.legible.validation.validate(firm="trailofbits"), and computes a fixed set
of mechanical section-structure stats (finding counts, exec-summary slice
size, finding-ID density, doc-level-only heuristic). Writes one row per report
to data/corpus/tob_report_stats.csv and a flat list of validation-failing
filenames to data/corpus/quarantine.txt.

No judgment / thresholding beyond what's already encoded in
src.legible.validation (untouched) and the mechanical regexes specified in the
P1 task brief.
"""
import csv
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from src.legible.validation import validate  # noqa: E402

CORPUS = os.path.join(ROOT, "data", "corpus")
MD_DIR = os.path.join(CORPUS, "out", "md")
JSON_DIR = os.path.join(CORPUS, "out", "json")
DOWNLOADS_JSON = os.path.join(CORPUS, "downloads_tob.json")
PARSE_LOG_JSON = os.path.join(CORPUS, "parse_log.json")
STATS_CSV = os.path.join(CORPUS, "tob_report_stats.csv")
QUARANTINE_TXT = os.path.join(CORPUS, "quarantine.txt")

CAL_TIMES_JSON = os.path.join(ROOT, "data", "calibration", "out", "times.json")
WORDS_FILE = "/usr/share/dict/words"

YEAR_RX = re.compile(r"^(\d{4})-")
HEADING_LINE_RX = re.compile(r"^(#{1,6})\s+(.*\S)\s*$", re.MULTILINE)
EXEC_HEADING_RX = re.compile(r"(?:^|\s)executive\s+summary\s*$", re.IGNORECASE)
STOP_PHRASES = [
    "finding severities", "project goals", "summary of findings",
    "system architecture", "methodology",
]
OBSERVATIONS_RX = re.compile(r"Observations and Impact", re.IGNORECASE)
TOB_ID_RX = re.compile(r"TOB-[A-Z0-9]+-\d+")
FINDINGS_NUMBERED_RX = re.compile(r"^#+\s*(\d+)\.\s", re.MULTILINE)
SUMMARY_TABLE_ROW_RX = re.compile(r"^\|\s*\d+\s*\|", re.MULTILINE)

STATS_COLUMNS = [
    "filename", "year", "n_pages", "docling_seconds",
    "chars_per_page_ok", "dict_ratio_ok", "mojibake_ok", "exec_section_ok",
    "findings_section_ok", "tables_ok", "severity_ok",
    "dict_ratio", "validation_warns", "validation_passed",
    "n_findings_numbered", "n_summary_table_rows", "exec_chars",
    "has_observations_section", "n_exec_ids", "doc_level_only_candidate",
    "audience_observed",
]


def stem(filename):
    return os.path.splitext(filename)[0]


def load_words():
    words = set()
    if os.path.exists(WORDS_FILE):
        with open(WORDS_FILE, encoding="utf-8", errors="ignore") as f:
            for line in f:
                w = line.strip().lower()
                if w:
                    words.add(w)
    return words


def load_json_maybe(path):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}


def table_stats_from_doc(d):
    stats = []
    for t in d.get("tables", []):
        data = t.get("data", {}) or {}
        num_rows = data.get("num_rows", 0) or 0
        num_cols = data.get("num_cols", 0) or 0
        cells = data.get("table_cells", []) or []
        if cells:
            empty = sum(1 for c in cells if not (c.get("text") or "").strip())
            empty_cell_frac = empty / len(cells)
        else:
            empty_cell_frac = 1.0
        stats.append({"num_rows": num_rows, "num_cols": num_cols,
                      "empty_cell_frac": empty_cell_frac})
    return stats


def exec_slice(md):
    """Return (exec_chars, slice_text) for the span from the Executive Summary
    heading to the next stop-list heading (or EOF if none found)."""
    headings = list(HEADING_LINE_RX.finditer(md))
    exec_idx = None
    for i, m in enumerate(headings):
        if EXEC_HEADING_RX.search(m.group(2)):
            exec_idx = i
            break
    if exec_idx is None:
        return 0, ""
    start = headings[exec_idx].end()
    end = len(md)
    for m in headings[exec_idx + 1:]:
        text_lower = m.group(2).lower()
        if any(p in text_lower for p in STOP_PHRASES):
            end = m.start()
            break
    slice_text = md[start:end]
    return len(slice_text), slice_text


def main():
    with open(DOWNLOADS_JSON) as f:
        entries = json.load(f)
    parse_log = load_json_maybe(PARSE_LOG_JSON)
    cal_times = load_json_maybe(CAL_TIMES_JSON)
    words = load_words()
    print(f"Loaded {len(words)} dictionary words.")

    rows = []
    quarantined = []
    n_ok = n_missing = 0

    for e in entries:
        name = e["filename"]
        s = stem(name)
        md_path = os.path.join(MD_DIR, s + ".md")
        json_path = os.path.join(JSON_DIR, s + ".json")

        year_m = YEAR_RX.match(s)
        year = year_m.group(1) if year_m else ""

        row = {c: "" for c in STATS_COLUMNS}
        row["filename"] = name
        row["year"] = year
        row["audience_observed"] = "technical_leadership"

        if not (os.path.exists(md_path) and os.path.exists(json_path)):
            n_missing += 1
            quarantined.append(name)
            row["validation_passed"] = False
            rows.append(row)
            continue

        with open(md_path) as f:
            md = f.read()
        d = load_json_maybe(json_path)

        n_pages = len(d.get("pages", {}) or {})
        row["n_pages"] = n_pages

        log_entry = parse_log.get(name)
        secs = None
        if isinstance(log_entry, dict):
            secs = log_entry.get("seconds")
        if secs is None:
            t = cal_times.get(name)
            if isinstance(t, (int, float)):
                secs = t
        row["docling_seconds"] = secs if secs is not None else ""

        table_stats = table_stats_from_doc(d)
        result = validate(md, n_pages or 1, table_stats, words, firm="trailofbits")
        for check_name, val in result.checks.items():
            if check_name in row:
                row[check_name] = val
        row["dict_ratio"] = round(result.stats.get("dict_ratio", 0.0), 4)
        row["validation_warns"] = " | ".join(result.warns)
        row["validation_passed"] = result.passed

        n_findings_numbered = len(set(m.group(1) for m in FINDINGS_NUMBERED_RX.finditer(md)))
        row["n_findings_numbered"] = n_findings_numbered

        n_summary_table_rows = len(SUMMARY_TABLE_ROW_RX.findall(md))
        row["n_summary_table_rows"] = n_summary_table_rows

        chars, slice_text = exec_slice(md)
        row["exec_chars"] = chars

        has_obs = bool(OBSERVATIONS_RX.search(md))
        row["has_observations_section"] = has_obs

        n_exec_ids = len(set(TOB_ID_RX.findall(slice_text)))
        row["n_exec_ids"] = n_exec_ids

        row["doc_level_only_candidate"] = (
            (not has_obs) and chars < 1500 and n_exec_ids == 0
        )

        if not result.passed:
            quarantined.append(name)
        n_ok += 1
        rows.append(row)

    with open(STATS_CSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=STATS_COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    with open(QUARANTINE_TXT, "w") as f:
        f.write("\n".join(quarantined) + ("\n" if quarantined else ""))

    print(f"Stats written for {n_ok} doc(s), {n_missing} missing outputs -> {STATS_CSV}")
    print(f"Quarantined {len(quarantined)} doc(s) -> {QUARANTINE_TXT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
