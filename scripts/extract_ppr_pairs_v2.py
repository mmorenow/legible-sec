#!/usr/bin/env python
"""ppr long-tail doc-level pairs, pass 2: per-firm heading-alias profiles.

extract_ppr_pairs.py (v1) located exec/findings sections with two firm-agnostic
regexes and skipped ~140/291 ppr reports whose firms use different heading
vocabulary (e.g. Hackmanit's "Weaknesses" instead of "Findings", NCC Group's
"Synopsis" instead of "Executive Summary") or whose exec chapter has a nested
subsection (ROS's "1.1 Introduction") that the v1 stop-word scan mistook for
the end of the section.

v2 tries data/corpus/ppr_firm_profiles.json's per-firm (exec_rx, findings_rx)
FIRST; if a firm has no profile, or the profile regex doesn't hit, falls back
to the same generic regexes v1 uses. Boundary logic differs from v1 in one
respect: whenever a findings heading is located, the exec section is cut
there (findings-anchor takes priority over the old stop-word scan), which is
both more precise for firms with rich exec chapters (Consensys, Hacken-style)
and fixes the v1 nested-subsection bug (ROS, IncludeSecurity, CPTC) without
needing a second stop-word list.

Only emits pairs for docs v1 skipped (recomputes the skip set fresh; does not
duplicate pair_ids already in candidates_wave2.jsonl). Writes to
data/pairs/candidates_ppr_v2.jsonl (never candidates_wave2.jsonl).
"""

from __future__ import annotations

import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))
from legible.schema import CandidatePair  # noqa: E402
from legible.validation import GENERIC_EXEC_RX, GENERIC_FINDINGS_RX  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
MD = ROOT / "data/corpus/out/md"
PROFILES_PATH = ROOT / "data/corpus/ppr_firm_profiles.json"
WAVE2 = ROOT / "data/pairs/candidates_wave2.jsonl"
OUT = ROOT / "data/pairs/candidates_ppr_v2.jsonl"

# Same v1 stop-word scan, used only as a last-resort fallback when no
# findings heading can be located at all (firm profile AND generic both miss).
STOP_RX = re.compile(
    r"^#{1,6}\s*(?:\d+(?:\.\d+)*\.?\s+)?.*(scope|methodology|introduction|table of contents|appendix|findings|results|technical)",
    re.I,
)


def slice_sections_v1(md_text: str) -> tuple[str, str]:
    """Verbatim reproduction of extract_ppr_pairs.py's slice_sections, used to
    recompute the exact v1 skip set (docs where this yields thin sections)."""
    lines = md_text.split("\n")
    exec_start = find_start = None
    for i, l in enumerate(lines):
        if exec_start is None and re.match(GENERIC_EXEC_RX, l, re.I):
            exec_start = i
        elif find_start is None and re.match(GENERIC_FINDINGS_RX, l, re.I):
            find_start = i
    exec_txt = ""
    if exec_start is not None:
        end = len(lines)
        for j in range(exec_start + 1, len(lines)):
            if STOP_RX.match(lines[j]):
                end = j
                break
        exec_txt = re.sub(r"^#{1,6}\s*", "", "\n".join(lines[exec_start:end]), flags=re.M).strip()
    find_txt = "\n".join(lines[find_start:])[:12000] if find_start is not None else ""
    return exec_txt, find_txt


def _first_match(lines: list[str], rx: str) -> int | None:
    for i, l in enumerate(lines):
        if re.match(rx, l, re.I):
            return i
    return None


def slice_sections_v2(md_text: str, exec_rx: str, findings_rx: str) -> tuple[str, str]:
    """Firm-profile slicer: try the firm's (exec_rx, findings_rx) first, fall
    back to the generic regexes per-section if the firm regex doesn't hit
    anywhere in the doc. The exec section is cut at the findings heading
    whenever one is found after it (more accurate than a stop-word scan once
    the findings heading is firm-known); only falls back to the v1 stop-word
    scan when no findings heading is locatable at all.
    """
    lines = md_text.split("\n")

    exec_start = _first_match(lines, exec_rx)
    if exec_start is None:
        exec_start = _first_match(lines, GENERIC_EXEC_RX)

    find_start = _first_match(lines, findings_rx)
    if find_start is None:
        find_start = _first_match(lines, GENERIC_FINDINGS_RX)

    exec_txt = ""
    if exec_start is not None:
        if find_start is not None and find_start > exec_start:
            end = find_start
        else:
            end = len(lines)
            for j in range(exec_start + 1, len(lines)):
                if STOP_RX.match(lines[j]):
                    end = j
                    break
        exec_txt = re.sub(r"^#{1,6}\s*", "", "\n".join(lines[exec_start:end]), flags=re.M).strip()

    find_txt = "\n".join(lines[find_start:])[:12000] if find_start is not None else ""
    return exec_txt, find_txt


def main() -> None:
    profiles = json.loads(PROFILES_PATH.read_text())

    done_wave2 = {json.loads(l)["pair_id"] for l in open(WAVE2)} if WAVE2.exists() else set()
    done_v2 = {json.loads(l)["pair_id"] for l in open(OUT)} if OUT.exists() else set()

    n = skipped_still = firms_used = 0
    seen_firms = set()
    with OUT.open("a") as fh:
        for f in sorted(MD.glob("ppr__*.md")):
            parts = f.stem.split("__")
            firm = parts[1] if len(parts) >= 3 else "unknown"
            pid = f"{f.stem[:80]}#doc"

            text = f.read_text()

            # Recompute the v1 skip set fresh: only touch docs v1 would skip.
            v1_exec, v1_find = slice_sections_v1(text)
            v1_would_skip = len(v1_exec) < 400 or len(v1_find) < 800
            if not v1_would_skip:
                continue  # v1 already handles this doc (or would, once run)
            if pid in done_wave2 or pid in done_v2:
                continue  # already a pair on disk somewhere; don't duplicate

            profile = profiles.get(firm)
            if profile is None:
                skipped_still += 1
                continue

            exec_txt, find_txt = slice_sections_v2(text, profile["exec_rx"], profile["findings_rx"])
            if len(exec_txt) < 400 or len(find_txt) < 800:
                skipped_still += 1
                continue

            student = firm.upper() == "CPTC"
            fh.write(CandidatePair(
                pair_id=pid,
                source_doc_id=f"ppr/{f.stem}",
                source_org=firm,
                doc_type="pentest_report",
                technical_text=find_txt,
                technical_context="findings section",
                executive_text=exec_txt[:8000],
                audience_observed="technical_leadership",
                alignment_method="doc_level_structural",
                alignment_type="1:N",
                exec_span_kind="doc_level",
                needs_llm_verify=True,
                notes=("student-grade (CPTC); " if student else "") + "firm-profile doc-level slice",
            ).to_jsonl() + "\n")
            n += 1
            seen_firms.add(firm)

    print(f"ppr v2 pairs: {n} added across {len(seen_firms)} firms, {skipped_still} still skipped")


if __name__ == "__main__":
    main()
