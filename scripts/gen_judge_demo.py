"""LEGIBLE site, Phase 0: bake three REAL JudgeReports for the /#judge demo (DESIGN-PLAN.md §5.7).

Runs `legible.judge.run_deterministic` (zero-cost, no API calls) on three
(source, translation) pairs built from ONE real curated finding —
`2025-01-zetachain-solana-gateway-security-review#s7-f1`, a High-severity
Trail of Bits finding from `data/pairs/core_1to1_curated.jsonl` (register
technical_leadership, difficulty easy). Chosen because its source carries an
ID, a real severity band, a genuine precondition clause ("if an attacker
could perform this attack once per block"), and three decision-relevant
numbers (2,039,280 lamports reclaimed in testing / 0.4 seconds per block /
~216,000 USD per day) — enough for id_parity, severity_drift, caveat_parity
and numeric_parity to all have real teeth.

The SOURCE text below is a verbatim-sentence excerpt of the pair's
`technical_text` (figures, code blocks and line references stripped for
display, exactly the trim `src/content/data.ts` already does for
`examplePairs`); nothing is paraphrased or invented. A synthetic
`Severity: High. Finding ID: TOB-ZETASOLANA-1.` header line is prepended,
built directly from the pair's own `severity_original`/`pair_id` fields in
the same format Trail of Bits' own templates use elsewhere in the corpus
(see e.g. the PyPI f7 finding), since this particular extraction dropped the
literal header line.

Three cases, one shared source:
  faithful    — the pair's REAL executive_text (verified aligned, conf checked
                by the 3-pass verifier). All 6 checks pass; the omitted
                decision-relevant numbers/precondition are explicitly
                declared (as a real translation pipeline's `omitted_details`
                would), so nothing is silently dropped.
  softened    — hand-written: understates High as "moderate" and drops the
                once-per-block precondition clause, while still citing the
                ID and every number (isolates severity_drift + caveat_parity).
  embellished — hand-written: invents a version number (never in the source)
                and drops a real number without declaring it (isolates
                entity_check + numeric_parity).

Usage:
    ../../.venv/bin/python scripts/gen_judge_demo.py
Writes: presentation/web/src/content/judgeDemo.json
"""

from __future__ import annotations

import json
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src"))

from legible.judge import Flag, JudgeReport, run_deterministic  # noqa: E402

OUT_PATH = REPO_ROOT / "presentation" / "web" / "src" / "content" / "judgeDemo.json"

PAIR_ID = "2025-01-zetachain-solana-gateway-security-review#s7-f1"
SOURCE_ORG = "trailofbits"
SEVERITY_ORIGINAL = "High"
FINDING_TITLE = "Rent payer account can be drained"

# Verbatim sentences from the pair's technical_text (code/figure refs stripped),
# with a header line built from the pair's own severity_original + pair_id.
SOURCE_TEXT = (
    "Severity: High. Finding ID: TOB-ZETASOLANA-1. "
    "The associated token account that withdraw_spl_token creates is reimbursed "
    "with rent from a payer account, but the funds recipient can close that "
    "account and reclaim the rent, repeatedly, to siphon funds from ZetaChain. "
    "In our experiments, the rent claimed was 2,039,280 lamports, slightly less "
    "than 1 USD. If an attacker could perform this attack once per block, at "
    "0.4 seconds per block, the attacker would siphon about 216,000 USD per day."
)

CASES = [
    {
        "key": "faithful",
        "label": "faithful",
        "pair_id": PAIR_ID,
        "note": "the pair's real, verified executive_text",
        "translation_text": (
            "We identified one high-severity issue that could allow an attacker "
            "to drain the rent account (TOB-ZETASOLANA-1)."
        ),
        "omitted_details": [
            "the measured rent reclaimed in testing: 2,039,280 lamports (about 1 USD)",
            "the repeated once-per-block attack scenario: if an attacker could "
            "perform this attack once per block, the projected loss is about "
            "216,000 USD per day (0.4 seconds per block)",
        ],
        "severity_conveyed": None,
    },
    {
        "key": "softened",
        "label": "softened",
        "pair_id": PAIR_ID,
        "note": "hand-written: severity understated, precondition dropped",
        "translation_text": (
            "A moderate-severity flow issue (TOB-ZETASOLANA-1): testing reclaimed "
            "2,039,280 lamports; the rate works out to about 216,000 USD across "
            "24 hours, at a 0.4-second interval."
        ),
        "omitted_details": [],
        "severity_conveyed": None,
    },
    {
        "key": "embellished",
        "label": "embellished",
        "pair_id": PAIR_ID,
        "note": "hand-written: invented version number, dropped test figure",
        "translation_text": (
            "We identified a high-severity issue (TOB-ZETASOLANA-1) in bridge "
            "program v1.4.2: an attacker could repeat the withdrawal once per "
            "block to drain the rent-reimbursement account, siphoning roughly "
            "216,000 USD per day."
        ),
        "omitted_details": [],
        "severity_conveyed": None,
    },
]

FORMAT_KEY = "email"
AUDIENCE_KEY = "client_exec"


def flag_to_dict(f: Flag) -> dict:
    return {"check": f.check, "level": f.level, "message": f.message, "evidence": f.evidence}


def report_to_dict(r: JudgeReport) -> dict:
    return {"ok": r.ok, "passed": r.passed, "flags": [flag_to_dict(f) for f in r.flags]}


def main() -> None:
    out_cases = []
    for case in CASES:
        report = run_deterministic(
            source=SOURCE_TEXT,
            translation=case["translation_text"],
            omitted_details=case["omitted_details"],
            severity_conveyed=case["severity_conveyed"],
            format_key=FORMAT_KEY,
            audience_key=AUDIENCE_KEY,
        )
        out_cases.append(
            {
                "key": case["key"],
                "label": case["label"],
                "note": case["note"],
                "pair_id": case["pair_id"],
                "source_org": SOURCE_ORG,
                "severity_original": SEVERITY_ORIGINAL,
                "finding_title": FINDING_TITLE,
                "source_text": SOURCE_TEXT,
                "translation_text": case["translation_text"],
                "omitted_details": case["omitted_details"],
                "judge": report_to_dict(report),
            }
        )
        print(f"{case['key']:>12}: ok={report.ok}  passed={report.passed}  "
              f"fails={[f.check for f in report.flags if f.level == 'fail']}  "
              f"warns={[f.check for f in report.flags if f.level == 'warn']}")

    payload = {
        "generated_by": "scripts/gen_judge_demo.py",
        "checks": ["id_parity", "numeric_parity", "severity_drift", "entity_check", "caveat_parity", "format_lint"],
        "format_key": FORMAT_KEY,
        "audience_key": AUDIENCE_KEY,
        "cases": out_cases,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
