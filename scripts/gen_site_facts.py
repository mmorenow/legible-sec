#!/usr/bin/env python3
"""Generate the site's single source of numeric truth from the dataset.

Reads the frozen pairs JSONL and writes a typed TypeScript module that the
Next.js site imports. Every number the site shows about the dataset comes from
this file, so no two pages can quote figures that disagree.

The output is machine-generated. Edit this script, never the .ts file.

Usage:
    python3 scripts/gen_site_facts.py
    python3 scripts/gen_site_facts.py --input <jsonl> --output <ts>

Stdlib only, on purpose: this has to run on any machine that can run the
dataset build, with no environment to set up.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import sys
from collections import Counter
from typing import Any, Dict, Iterable, List, Tuple

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_INPUT = os.path.join(REPO_ROOT, "data", "dataset", "legible-pairs-v0.4.jsonl")
DEFAULT_OUTPUT = os.path.join(
    REPO_ROOT, "presentation", "web", "src", "content", "facts.generated.ts"
)

# Rows carry 0 or null when the source document never stated a year. Anything
# below this is a sentinel, not a date.
YEAR_FLOOR = 1990

# The only value normalization we apply. The corpus records the same severity
# band under two spellings because different firms write it differently.
SEVERITY_ALIASES = {"Info": "Informational"}

# Empty severity is 2,357 rows, the largest single bucket. It gets a name and
# stays visible: a chart that quietly drops it would misrepresent the dataset.
NOT_STATED = "not stated"

TOP_ORGS_LIMIT = 10


def load_records(path: str) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as handle:
        for lineno, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise SystemExit(f"{path}:{lineno}: invalid JSON ({exc})") from exc
    if not records:
        raise SystemExit(f"{path}: no records found")
    return records


def dataset_version(path: str) -> str:
    """Derive "v0.4" from a filename like legible-pairs-v0.4.jsonl."""
    match = re.search(r"v\d+(?:\.\d+)*", os.path.basename(path))
    return match.group(0) if match else "unknown"


def distribution(
    records: Iterable[Dict[str, Any]],
    field: str,
    *,
    aliases: Dict[str, str] | None = None,
    empty_key: str | None = None,
) -> List[Tuple[str, int]]:
    """Count one field across every record, so the total always reconciles.

    Every record contributes exactly one key. Blank values map to empty_key when
    one is given, and otherwise to the literal empty string, which keeps the
    counts summing to the number of pairs no matter what the data holds.
    """
    counts: Counter = Counter()
    for record in records:
        value = record.get(field)
        value = "" if value is None else str(value).strip()
        if aliases:
            value = aliases.get(value, value)
        if value == "" and empty_key is not None:
            value = empty_key
        counts[value] += 1
    return sort_rows(counts)


def sort_rows(counts: Counter) -> List[Tuple[str, int]]:
    """Descending by count, then by key, so reruns produce identical output."""
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))


def ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def emit_rows(name: str, rows: List[Tuple[str, int]]) -> str:
    body = "\n".join(
        f"  {{ key: {ts_string(key)}, n: {count} }}," for key, count in rows
    )
    return f"export const {name}: FactRow[] = [\n{body}\n];\n"


def build_module(records: List[Dict[str, Any]], input_path: str) -> str:
    total = len(records)

    documents = len({r.get("source_doc_id") for r in records})
    organizations = len({r.get("source_org") for r in records})
    fields = len(records[0])

    years = [
        r.get("report_year")
        for r in records
        if isinstance(r.get("report_year"), int) and r.get("report_year") > YEAR_FLOOR
    ]
    year_min = min(years) if years else 0
    year_max = max(years) if years else 0
    year_known = len(years)

    severity = distribution(
        records, "severity_original", aliases=SEVERITY_ALIASES, empty_key=NOT_STATED
    )
    vuln_class = distribution(records, "vuln_class")
    registers = distribution(records, "audience_observed")
    licenses = distribution(records, "license")
    splits = distribution(records, "split")
    alignment_methods = distribution(records, "alignment_method")
    org_types = distribution(records, "source_org_type")
    doc_types = distribution(records, "doc_type")

    all_orgs = distribution(records, "source_org")
    top_orgs = all_orgs[:TOP_ORGS_LIMIT]
    other_orgs = total - sum(count for _, count in top_orgs)

    with_source_url = sum(1 for r in records if str(r.get("source_url") or "").strip())
    with_cve = sum(1 for r in records if r.get("cve_ids"))
    human_verified = sum(1 for r in records if r.get("human_verified") is True)
    pii_true = sum(1 for r in records if r.get("pii_scrubbed") is True)
    pii_false = total - pii_true

    source_file = os.path.basename(input_path)
    script_name = "scripts/" + os.path.basename(os.path.abspath(__file__))
    generated_at = datetime.date.today().isoformat()

    parts: List[str] = []
    parts.append(
        f"""// MACHINE-GENERATED FILE. DO NOT EDIT BY HAND.
//
// Produced by `{script_name}` from the frozen dataset. Any hand edit will be
// overwritten on the next dataset build, and worse, it would let the site quote
// a number the data does not support. To change anything here, change the
// dataset or the script and regenerate:
//
//     python3 {script_name}
//
// Import these facts through `facts.ts`, which re-exports them and asserts that
// the distributions reconcile to the stated total.

export type FactRow = {{ key: string; n: number }};

export const DATASET_VERSION = {ts_string(dataset_version(input_path))};
export const SOURCE_FILE = {ts_string(source_file)};
export const GENERATED_AT = {ts_string(generated_at)};

// Headline counts.
export const PAIRS = {total};
export const DOCUMENTS = {documents};
export const ORGANIZATIONS = {organizations};
export const FIELDS = {fields};

// Report year is recorded on roughly half the corpus, so the site needs the
// coverage count alongside the range. YEAR_KNOWN counts rows with a plausible
// year (> {YEAR_FLOOR}); the rest are null or a zero sentinel.
export const YEAR_MIN = {year_min};
export const YEAR_MAX = {year_max};
export const YEAR_KNOWN = {year_known};
"""
    )

    parts.append(
        f"""
// Distributions. Each row set covers every pair exactly once, so each sums to
// PAIRS. Sorted descending by n.
//
// Severity carries one normalization: the corpus spells the same band both
// "Info" and "Informational", and they are merged. Pairs whose source document
// never stated a severity appear under {ts_string(NOT_STATED)} rather than being
// dropped, because they are the largest bucket in the dataset.
"""
    )
    parts.append(emit_rows("SEVERITY", severity))
    parts.append("\n" + emit_rows("VULN_CLASS", vuln_class))
    parts.append("\n" + emit_rows("REGISTERS", registers))
    parts.append("\n" + emit_rows("LICENSES", licenses))
    parts.append("\n" + emit_rows("SPLITS", splits))
    parts.append("\n" + emit_rows("ALIGNMENT_METHODS", alignment_methods))
    parts.append("\n" + emit_rows("ORG_TYPES", org_types))
    parts.append("\n" + emit_rows("DOC_TYPES", doc_types))

    parts.append(
        f"""
// The {TOP_ORGS_LIMIT} largest contributors, plus the tail count for an
// "and N more" line. TOP_ORGS + OTHER_ORGS sums to PAIRS.
"""
    )
    parts.append(emit_rows("TOP_ORGS", top_orgs))
    parts.append(f"export const OTHER_ORGS = {other_orgs};\n")

    parts.append(
        f"""
// Quality and provenance counters. These are per-pair counts, not percentages;
// formatting is the site's job.
export const WITH_SOURCE_URL = {with_source_url};
export const WITH_CVE = {with_cve};
export const HUMAN_VERIFIED = {human_verified};
export const PII_SCRUBBED_TRUE = {pii_true};
export const PII_SCRUBBED_FALSE = {pii_false};
"""
    )

    return "".join(parts)


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--input", default=DEFAULT_INPUT, help="pairs JSONL to read")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="TypeScript file to write")
    args = parser.parse_args(argv)

    records = load_records(args.input)
    module = build_module(records, args.input)

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as handle:
        handle.write(module)

    print(f"wrote {args.output} from {len(records)} pairs in {args.input}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
