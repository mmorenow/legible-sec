#!/usr/bin/env python3
"""LEGIBLE P3: 25-case regression suite for the deterministic fidelity judge.

Deliverable gate (GAMEPLAN §11 #3): ZERO false-authority failures — a clean
translation must never draw a `fail` flag, and every engineered mutation must
draw exactly the flag it targets. Run: `.venv/bin/python tests/test_judge.py`
"""

from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from legible.judge import run_deterministic  # noqa: E402

# ---- base material (realistic finding + faithful board-email translation) ----

SRC = (
    "The update service downloads packages over HTTP without validating "
    "signatures. CVE-2024-31337 has been assigned to this issue. A CVSS v3.1 "
    "base score of 8.1 has been calculated. The issue affects versions 2.4.0 "
    "through 2.7.3, and exploitation requires user interaction. We identified "
    "1,200 exposed instances; there is no evidence of exploitation in the "
    "wild. The test server at 10.2.3.4 was used to validate the behavior."
)
GOOD = (
    "A high-severity flaw in our software update process could let attackers "
    "substitute malicious updates, affecting roughly 1,200 internet-visible "
    "systems (CVE-2024-31337, scored 8.1). Exploitation requires user "
    "interaction, and there is no evidence of exploitation so far. We "
    "recommend approving the patch rollout this week."
)
GOOD_OMIT = ["internal test server 10.2.3.4", "affected version range 2.4.0 through 2.7.3"]

SRC_PLAIN = (
    "The service exposes verbose error messages that reveal internal stack "
    "traces to unauthenticated users. This is an information disclosure "
    "weakness of low severity."
)
GOOD_PLAIN = (
    "The system currently reveals internal technical details in its error "
    "messages, a low-severity information leak. It should be silenced in the "
    "next maintenance window."
)

CASES = []


def case(name, expect_fails, expect_warns=(), *, src=SRC, tr=GOOD, omit=None,
         sev=None, fmt=None, aud=None):
    CASES.append(dict(name=name, src=src, tr=tr, omit=omit or [], sev=sev,
                      fmt=fmt, aud=aud, expect_fails=set(expect_fails),
                      expect_warns=set(expect_warns)))


# ---- clean cases (1-8): must produce ZERO fail flags -------------------------
case("clean board email", [], ["entity_check"], omit=GOOD_OMIT, sev="high", fmt="email", aud="board")
case("clean, no declared omissions", [], ["entity_check"], sev="high")  # versions/IP dropped→warn only
case("clean plain finding", [], src=SRC_PLAIN, tr=GOOD_PLAIN, sev="low")
case("clean it_manager keeps tech detail", [], omit=GOOD_OMIT, sev="high", fmt=None, aud="it_manager",
     tr=GOOD + " Affected versions are 2.4.0 through 2.7.3.")
case("clean one-pager length ok", [], ["entity_check"], omit=GOOD_OMIT, sev="high", fmt="one_pager")
case("clean slide 3 bullets", [], ["entity_check"], omit=GOOD_OMIT, sev="high", fmt="slide",
     tr="- High-severity update flaw, 1,200 systems exposed (CVE-2024-31337, 8.1)\n"
        "- Exploitation requires user interaction; no evidence of exploitation\n"
        "- Approve patch rollout this week")
case("clean stronger severity allowed", [], ["entity_check"], omit=GOOD_OMIT, sev="critical",
     tr=GOOD.replace("high-severity", "critical"))
case("clean no signals at all", [], src="The report describes routine logging improvements.",
     tr="Routine logging improvements were reviewed.")

# ---- D1 id parity (9-11) -----------------------------------------------------
case("drop CVE undeclared", ["id_parity"], ["entity_check"],
     tr=GOOD.replace(" (CVE-2024-31337, scored 8.1)", " (scored 8.1)"), sev="high")
case("CVE declared omitted passes D1", [], ["entity_check"],
     tr=GOOD.replace(" (CVE-2024-31337, scored 8.1)", " (scored 8.1)"),
     omit=GOOD_OMIT + ["CVE-2024-31337"], sev="high")
case("consultancy ID dropped", ["id_parity"],
     src=SRC_PLAIN + " This is tracked as TOB-ACME-7.",
     tr=GOOD_PLAIN, sev="low")

# ---- D2 numeric parity (12-14) ----------------------------------------------
case("drop the 1,200 count", ["numeric_parity"], ["entity_check"],
     tr=GOOD.replace("roughly 1,200 internet-visible systems", "many internet-visible systems"),
     sev="high")
case("number declared omitted passes D2", [], ["entity_check"],
     tr=GOOD.replace("roughly 1,200 internet-visible systems", "many internet-visible systems"),
     omit=GOOD_OMIT + ["exact exposed-instance count 1,200"], sev="high")
case("drop the CVSS score", ["numeric_parity"], ["entity_check"],
     tr=GOOD.replace(", scored 8.1", ""), sev="high")

# ---- D3 severity drift (15-17) ----------------------------------------------
case("soften to low", ["severity_drift"], ["entity_check"],
     tr=GOOD.replace("high-severity flaw", "low-risk housekeeping item"), sev="high")
case("declared severity below source", ["severity_drift"], ["entity_check"],
     sev="low", omit=GOOD_OMIT)
case("severity vanishes entirely", [], ["severity_drift", "entity_check"],
     tr=GOOD.replace("high-severity ", ""), sev=None, omit=GOOD_OMIT)

# ---- D4 entities (18-19) -----------------------------------------------------
case("invented IP", ["entity_check"],
     tr=GOOD + " The attacker server 203.0.113.7 is already probing us.",
     omit=GOOD_OMIT, sev="high")
case("invented version", ["entity_check"],
     tr=GOOD.replace("substitute malicious updates", "substitute malicious updates in v9.9.9"),
     omit=GOOD_OMIT, sev="high")

# ---- D5 caveats (20-22) ------------------------------------------------------
case("drop 'requires user interaction'", ["caveat_parity"], ["entity_check"],
     tr=GOOD.replace("Exploitation requires user interaction, and there", "There"),
     omit=GOOD_OMIT, sev="high")
case("drop 'no evidence of exploitation'", ["caveat_parity"], ["entity_check"],
     tr=GOOD.replace(", and there is no evidence of exploitation so far", ""),
     omit=GOOD_OMIT, sev="high")
case("caveat declared omitted passes D5", [], ["entity_check"],
     tr=GOOD.replace(", and there is no evidence of exploitation so far", ""),
     omit=GOOD_OMIT + ["no evidence of exploitation observed to date"], sev="high")

# ---- D6 format lint (23-25) --------------------------------------------------
case("email over 150 words", ["format_lint"], ["entity_check"],
     tr=GOOD + " " + ("This additional sentence pads the email well beyond its contract. " * 16),
     omit=GOOD_OMIT, sev="high", fmt="email")
case("slide with 5 bullets", ["format_lint"], ["entity_check", "severity_drift"],
     tr="- one risk noted here\n- two\n- three\n- four\n- five bullets exceed the contract "
        "(CVE-2024-31337, 8.1, 1,200 systems; exploitation requires user interaction; "
        "no evidence of exploitation)",
     omit=GOOD_OMIT, sev="high", fmt="slide")
case("board jargon blacklist", [], ["format_lint", "entity_check"],
     tr=GOOD.replace("substitute malicious updates", "achieve RCE via SSRF and deserialization"),
     omit=GOOD_OMIT, sev="high", fmt=None, aud="board")


def main() -> int:
    failures = []
    for c in CASES:
        rep = run_deterministic(c["src"], c["tr"], c["omit"], c["sev"], c["fmt"], c["aud"])
        got_fails = {f.check for f in rep.flags if f.level == "fail"}
        got_warns = {f.check for f in rep.flags if f.level == "warn"}
        problems = []
        if got_fails != c["expect_fails"]:
            problems.append(f"fails: expected {sorted(c['expect_fails'])}, got {sorted(got_fails)}")
        unexpected_warns = got_warns - c["expect_warns"] - c["expect_fails"]
        if unexpected_warns:
            problems.append(f"unexpected warns: {sorted(unexpected_warns)}")
        if problems:
            failures.append((c["name"], problems, rep))

    print(f"{len(CASES)} cases · {len(CASES) - len(failures)} passed · {len(failures)} failed")
    for name, problems, rep in failures:
        print(f"\nFAIL: {name}")
        for p in problems:
            print(f"  {p}")
        for f in rep.flags:
            print(f"    [{f.level}] {f.check}: {f.message} | {f.evidence[:3]}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
