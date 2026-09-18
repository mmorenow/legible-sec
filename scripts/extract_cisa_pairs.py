#!/usr/bin/env python
"""Structural (no-LLM) pair extraction from CISA advisory HTML (GAMEPLAN §4.3 step 1).

CSA: {Summary | Executive Summary | Advisory at a Glance} ↔ Technical Details.
ICS old template: 1. EXECUTIVE SUMMARY (+ 2. RISK EVALUATION) ↔ 3. TECHNICAL DETAILS.
ICS new template ("Summary" first heading, 2025+) is SKIPPED for now — logged, and
useful later for the OOD-temporal split. Doc-level pairs, register=practitioner.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
from collections import Counter
from html.parser import HTMLParser

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))
from legible.schema import CandidatePair  # noqa: E402

MAJOR = re.compile(
    r"^(\d\.\s*)?(executive summary|summary|advisory at a glance|risk evaluation|"
    r"technical details|mitigations|background|introduction|vulnerabilit(y|ies) overview|"
    r"recommended practices|references|resources|disclaimer|revisions?|"
    r"contact information|acknowledge?ments|appendix.*|update history|tags)$", re.I)

EXEC_START = re.compile(r"^(\d\.\s*)?(executive summary|summary|advisory at a glance)$", re.I)
TECH_START = re.compile(r"^(\d\.\s*)?technical details$", re.I)
RISK_START = re.compile(r"^(\d\.\s*)?risk evaluation$", re.I)


class SectionParser(HTMLParser):
    """Collects (kind, text) events: kind='h' for h1-h4 headings, 'p' for body text."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.events: list[tuple[str, str]] = []
        self._stack: list[str] = []
        self._buf: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "nav", "footer", "header"):
            self._skip += 1
        elif tag in ("h1", "h2", "h3", "h4") and not self._skip:
            self._flush()
            self._stack.append(tag)
        elif tag in ("p", "li", "td", "th") and not self._skip and not self._stack:
            self._buf.append("")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "nav", "footer", "header"):
            self._skip = max(0, self._skip - 1)
        elif tag in ("h1", "h2", "h3", "h4") and self._stack:
            self.events.append(("h", " ".join(self._buf).strip()))
            self._buf = []
            self._stack.pop()
        elif tag in ("p", "li") and not self._skip and not self._stack:
            self._flush()

    def handle_data(self, data):
        if not self._skip and data.strip():
            self._buf.append(re.sub(r"\s+", " ", data))

    def _flush(self):
        text = " ".join(self._buf).strip()
        if text:
            self.events.append(("p", text))
        self._buf = []


def sections(html: str) -> list[tuple[str, str]]:
    """[(heading, body_text)] in document order; body = text until next MAJOR heading."""
    p = SectionParser()
    p.feed(html)
    out: list[tuple[str, list[str]]] = []
    current = None
    for kind, text in p.events:
        if kind == "h" and MAJOR.match(text.strip()):
            current = (text.strip(), [])
            out.append(current)
        elif kind == "p" and current is not None:
            current[1].append(text)
    return [(h, " ".join(body).strip()) for h, body in out]


def extract(html_path: pathlib.Path, series: str) -> CandidatePair | None:
    secs = sections(html_path.read_text(errors="replace"))
    exec_txt, risk_txt, tech_txt = "", "", ""
    for h, body in secs:
        if EXEC_START.match(h) and not exec_txt:
            exec_txt = body
        elif RISK_START.match(h) and not risk_txt:
            risk_txt = body
        elif TECH_START.match(h) and not tech_txt:
            tech_txt = body
    if series == "ics" and risk_txt:
        exec_txt = f"{exec_txt}\n\n{risk_txt}".strip()
    if len(exec_txt) < 150 or len(tech_txt) < 400:
        return None
    aid = html_path.stem
    return CandidatePair(
        pair_id=f"{aid}#doc",
        source_doc_id=f"cisa_{series}/{aid}",
        source_org="cisa",
        doc_type=f"cisa_{series}_advisory",
        technical_text=tech_txt[:12000],
        technical_context="Technical Details",
        executive_text=exec_txt[:6000],
        audience_observed="practitioner",
        alignment_method="same_section_1to1",
        alignment_type="1:1",
        exec_span_kind="doc_level",
        needs_llm_verify=False,
        notes="structural section pairing; ICS exec includes Risk Evaluation" if series == "ics" else
              "structural section pairing",
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/pairs/candidates_cisa.jsonl")
    args = ap.parse_args()
    out_path = pathlib.Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    stats = Counter()
    n = 0
    with out_path.open("w") as fh:
        for series, d in [("csa", "data/corpus/html/cisa_csa"), ("ics", "data/corpus/html/cisa_ics")]:
            for f in sorted(pathlib.Path(d).glob("*.html")):
                try:
                    pair = extract(f, series)
                except Exception as e:  # log-and-continue: one bad page must not stop the run
                    stats[f"{series}_error"] += 1
                    continue
                if pair is None:
                    stats[f"{series}_skipped"] += 1
                else:
                    fh.write(pair.to_jsonl() + "\n")
                    stats[f"{series}_paired"] += 1
                    n += 1
    print(f"total CISA pairs: {n} -> {out_path}")
    print(dict(stats))


if __name__ == "__main__":
    main()
