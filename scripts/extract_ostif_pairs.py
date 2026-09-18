#!/usr/bin/env python
"""OSTIF blog↔report doc-level pairs — the corpus's only natural `public` register.

Exec side  = the OSTIF blog post body (lay-audience summary of the audit).
Tech side  = the audited report's findings section (generic-profile slice),
             falling back to the report body head.
Appends to data/pairs/candidates_wave2.jsonl (skips pair_ids already present).
"""

from __future__ import annotations

import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))
from legible.schema import CandidatePair  # noqa: E402
from legible.validation import GENERIC_FINDINGS_RX  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
MD = ROOT / "data/corpus/out/md"


def clean_blog(t: str) -> str:
    lines = t.split("\n")
    # drop the category-nav header: everything before the first substantive line
    for i, l in enumerate(lines):
        if len(l) > 120 or (len(l) > 60 and not l.endswith((":", "/"))):
            return "\n".join(lines[i:]).strip()
    return t.strip()


def tech_slice(md_text: str) -> tuple[str, str]:
    lines = md_text.split("\n")
    start = None
    for i, l in enumerate(lines):
        if re.match(GENERIC_FINDINGS_RX, l, re.I):
            start = i
            break
    if start is not None:
        return "\n".join(lines[start:])[:12000], "findings_section"
    return md_text[:10000], "report_head"


def main() -> None:
    mapping = json.load(open(ROOT / "data/corpus/ostif_blog/_mapping.json"))
    out = ROOT / "data/pairs/candidates_wave2.jsonl"
    done = set()
    if out.exists():
        done = {json.loads(l)["pair_id"] for l in open(out)}
    n = skipped = 0
    with out.open("a") as fh:
        for slug, info in sorted(mapping.items()):
            blog_f = ROOT / f"data/corpus/ostif_blog/{slug}.txt"
            if not blog_f.exists():
                continue
            blog = clean_blog(blog_f.read_text())
            if len(blog) < 400:
                skipped += 1
                continue
            for pdf in info["pdfs"]:
                stem = pathlib.Path(pdf).stem
                md_f = MD / f"ostif__{stem}.md"
                if not md_f.exists():
                    skipped += 1
                    continue
                pid = f"ostif__{slug}__{stem[:40]}#doc"
                if pid in done:
                    continue
                tech, how = tech_slice(md_f.read_text())
                if len(tech) < 800:
                    skipped += 1
                    continue
                fh.write(CandidatePair(
                    pair_id=pid,
                    source_doc_id=f"ostif/{stem}",
                    source_org="ostif",
                    doc_type="security_audit",
                    technical_text=tech,
                    technical_context=f"audit report ({how})",
                    executive_text=blog[:8000],
                    audience_observed="public",
                    alignment_method="doc_level_structural",
                    alignment_type="1:N",
                    exec_span_kind="doc_level",
                    needs_llm_verify=True,  # blog↔report linkage worth one cheap check
                    notes=f"OSTIF blog ({info['url']}) ↔ audited report; tech side = {how}",
                ).to_jsonl() + "\n")
                n += 1
    print(f"OSTIF pairs: {n} added, {skipped} skipped -> {out}")


if __name__ == "__main__":
    main()
