#!/usr/bin/env python
"""ppr long-tail doc-level pairs: generic exec-section ↔ findings-section slices.

Wave-2 v1: only reports where BOTH sections are locatable with the generic
profiles (per-firm refinement is a later pass). CPTC reports flagged student.
Appends to data/pairs/candidates_wave2.jsonl.
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
STOP_RX = re.compile(r"^#{1,6}\s*(?:\d+(?:\.\d+)*\.?\s+)?.*(scope|methodology|introduction|table of contents|appendix|findings|results|technical)", re.I)


def slice_sections(md_text: str) -> tuple[str, str]:
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


def main() -> None:
    out = ROOT / "data/pairs/candidates_wave2.jsonl"
    done = {json.loads(l)["pair_id"] for l in open(out)} if out.exists() else set()
    n = skipped = 0
    with out.open("a") as fh:
        for f in sorted(MD.glob("ppr__*.md")):
            parts = f.stem.split("__")
            firm = parts[1] if len(parts) >= 3 else "unknown"
            pid = f"{f.stem[:80]}#doc"
            if pid in done:
                continue
            exec_txt, find_txt = slice_sections(f.read_text())
            if len(exec_txt) < 400 or len(find_txt) < 800:
                skipped += 1
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
                notes=("student-grade (CPTC); " if student else "") + "generic-profile doc-level slice",
            ).to_jsonl() + "\n")
            n += 1
    print(f"ppr pairs: {n} added, {skipped} skipped (sections not locatable/thin)")


if __name__ == "__main__":
    main()
