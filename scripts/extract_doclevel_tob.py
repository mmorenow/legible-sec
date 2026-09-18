#!/usr/bin/env python
"""Doc-level TOB pairs: whole Executive Summary ↔ the report's findings list.

One pair per report (GAMEPLAN §4.1: "1 document-level pair + finding-level pairs").
The technical side is the serialized Summary-of-Findings list — the thing the
exec summary actually translates/covers. Structural, no LLM needed.
Skips logistics-only execs (exec < 400 chars) and reports with no findings table.
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))
from legible.align import _slice_between, tob_finding_table  # noqa: E402
from legible.schema import CandidatePair  # noqa: E402

EXEC_END = r"Finding Severities|Project Goals|Summary of Findings|System Architecture|Methodology"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--md-dir", default="data/corpus/out/md")
    ap.add_argument("--out", default="data/pairs/candidates_tob_doclevel.jsonl")
    args = ap.parse_args()
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    n = skipped_exec = skipped_table = 0
    with out.open("w") as fh:
        for f in sorted(pathlib.Path(args.md_dir).glob("*.md")):
            if "__" in f.name:  # wave-2 files (cure53__/ostif__/ppr__) are not TOB
                continue
            md = f.read_text()
            lines = md.split("\n")
            span = _slice_between(lines, r"^Executive Summary$", EXEC_END)
            if span is None:
                skipped_exec += 1
                continue
            exec_text = "\n".join(lines[span[0] + 1 : span[1]])
            exec_text = re.sub(r"<!--.*?-->", "", exec_text)
            exec_text = re.sub(r"^#{1,6}\s*", "", exec_text, flags=re.M).strip()
            if len(exec_text) < 400:
                skipped_exec += 1
                continue
            table = tob_finding_table(md)
            if not table:
                skipped_table += 1
                continue
            findings_list = "\n".join(
                f"{k}. {t}" + (f" — {s}" if s else "")
                for k, (t, s) in sorted(table.items()))
            fh.write(CandidatePair(
                pair_id=f"{f.stem}#doc",
                source_doc_id=f"tob/{f.stem}",
                source_org="trailofbits",
                doc_type="security_review",
                technical_text=f"Report findings ({len(table)} total):\n{findings_list}"[:12000],
                technical_context="Summary of Findings",
                executive_text=exec_text[:8000],
                audience_observed="technical_leadership",
                alignment_method="doc_level_structural",
                alignment_type="1:N",
                exec_span_kind="doc_level",
                needs_llm_verify=False,
                notes="exec summary ↔ serialized findings list; report-level pair",
            ).to_jsonl() + "\n")
            n += 1
    print(f"doc-level pairs: {n} -> {out} (skipped: {skipped_exec} thin/absent exec, {skipped_table} no findings table)")


if __name__ == "__main__":
    main()
