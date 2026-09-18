#!/usr/bin/env python3
"""LEGIBLE wave-2 Task C: validation + stats for cure53 + ostif + ppr.

Reads every entry in data/corpus/parse_log_wave2.json (written by
scripts/parse_wave2.py), runs src.legible.validation.validate() on its md/json
output (firm="cure53" for cure53 docs, "generic" for ostif/ppr per task
brief), and computes the same mechanical section-structure signals as
scripts/corpus_stats.py (generic exec/findings heading hits, header counts).

Writes:
  data/corpus/wave2_stats.csv      one row per doc (converted or not)
  data/corpus/quarantine_wave2.txt filenames failing validation or missing outputs
"""
import csv
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from src.legible.validation import validate, GENERIC_EXEC_RX, GENERIC_FINDINGS_RX  # noqa: E402

CORPUS = os.path.join(ROOT, "data", "corpus")
MD_DIR = os.path.join(CORPUS, "out", "md")
JSON_DIR = os.path.join(CORPUS, "out", "json")
PARSE_LOG_JSON = os.path.join(CORPUS, "parse_log_wave2.json")
STATS_CSV = os.path.join(CORPUS, "wave2_stats.csv")
QUARANTINE_TXT = os.path.join(CORPUS, "quarantine_wave2.txt")

WORDS_FILE = "/usr/share/dict/words"
HEADING_LINE_RX = re.compile(r"^(#{1,6})\s+(.*\S)\s*$", re.MULTILINE)

STATS_COLUMNS = [
    "source_group", "firm", "filename", "out_stem", "n_pages",
    "docling_seconds", "ocr_used",
    "chars_per_page_ok", "dict_ratio_ok", "mojibake_ok", "exec_section_ok",
    "findings_section_ok", "tables_ok", "severity_ok",
    "dict_ratio", "n_section_headers",
    "generic_exec_heading_hit", "generic_findings_heading_hit",
    "validation_warns", "validation_passed", "error",
]


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


def main():
    parse_log = load_json_maybe(PARSE_LOG_JSON)
    words = load_words()
    print(f"Loaded {len(words)} dictionary words.")
    print(f"{len(parse_log)} entries in {PARSE_LOG_JSON}")

    rows = []
    quarantined = []

    for out_stem, entry in sorted(parse_log.items()):
        source_group = entry.get("source_group", "")
        firm = entry.get("firm", "")
        filename = entry.get("src_filename", "")
        ocr_used = entry.get("ocr_used", False)

        row = {c: "" for c in STATS_COLUMNS}
        row["source_group"] = source_group
        row["firm"] = firm
        row["filename"] = filename
        row["out_stem"] = out_stem
        row["ocr_used"] = ocr_used

        if "error" in entry:
            row["error"] = entry["error"]
            row["validation_passed"] = False
            quarantined.append(out_stem)
            rows.append(row)
            continue

        row["docling_seconds"] = entry.get("seconds", "")

        md_path = os.path.join(MD_DIR, out_stem + ".md")
        json_path = os.path.join(JSON_DIR, out_stem + ".json")
        if not (os.path.exists(md_path) and os.path.exists(json_path)):
            row["error"] = "missing_output"
            row["validation_passed"] = False
            quarantined.append(out_stem)
            rows.append(row)
            continue

        with open(md_path) as f:
            md = f.read()
        d = load_json_maybe(json_path)

        n_pages = len(d.get("pages", {}) or {})
        row["n_pages"] = n_pages

        table_stats = table_stats_from_doc(d)
        firm_key = "cure53" if source_group == "cure53" else "generic"
        result = validate(md, n_pages or 1, table_stats, words, firm=firm_key)
        for check_name, val in result.checks.items():
            if check_name in row:
                row[check_name] = val
        row["dict_ratio"] = round(result.stats.get("dict_ratio", 0.0), 4)
        row["validation_warns"] = " | ".join(result.warns)
        row["validation_passed"] = result.passed

        headers = [m.group(2) for m in HEADING_LINE_RX.finditer(md)]
        row["n_section_headers"] = len(headers)
        row["generic_exec_heading_hit"] = bool(re.search(GENERIC_EXEC_RX, md, re.I | re.M))
        row["generic_findings_heading_hit"] = bool(re.search(GENERIC_FINDINGS_RX, md, re.I | re.M))

        if not result.passed:
            quarantined.append(out_stem)
        rows.append(row)

    with open(STATS_CSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=STATS_COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    with open(QUARANTINE_TXT, "w") as f:
        f.write("\n".join(quarantined) + ("\n" if quarantined else ""))

    print(f"Stats written for {len(rows)} doc(s) -> {STATS_CSV}")
    print(f"Quarantined {len(quarantined)} doc(s) -> {QUARANTINE_TXT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
