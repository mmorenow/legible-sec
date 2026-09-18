#!/usr/bin/env python
"""LEGIBLE D40: structural (no-LLM) pair extraction from OIG/GAO gov-audit reports.

OIG: {Results in Brief | Executive Summary | (fallback) What We/The Audit/
Inspection Found} <-> {Results and Recommendations | numbered/lettered
Findings | Results of Audit/Inspection/Evaluation}. Same section-slicing
approach as scripts/extract_cisa_pairs.py, but on Docling markdown headings
(all "## "-level in this corpus, per calibration) via legible.align's existing
_slice_between/split_sentences helpers instead of an HTML parser.

GAO: if any GAO PDFs exist under data/corpus/pdfs/gao/ (i.e. the WAF block in
download_govaudit.py's `gao` mode was NOT hit), the same OIG heading regexes
also cover GAO's "Why GAO Did This Study"/"What GAO Found" highlights style
closely enough to reuse -- see GAO_* regex aliases below. As of this harvest
GAO was domain-blocked at download time, so this path is untested (0 GAO
PDFs); the code is left in so a future unblocked run needs no changes here.

Emits two candidate kinds per report into data/pairs/candidates_gov_audit.jsonl:
  (a) ONE doc-level pair (exec section <-> findings section, verbatim,
      needs_llm_verify=False -- purely structural, GAMEPLAN precedent CISA/TOB).
  (b) 0+ finding-level "claim" pairs: an exec sentence carrying a number
      (quantified claim) matched by significant-keyword overlap against one
      body finding. needs_llm_verify=True always (heuristic overlap, not an
      LLM judgment) -- $0 rule (no embeddings, no API calls).

A report that lacks either a detectable exec section OR a detectable findings
section is skipped and logged with a reason (this is how withheld-report
"highlights-only" stubs like DOE-OIG-26-36 and off-template memos like the
DoW lessons-learned summary are naturally excluded, per the task brief's
"skip withheld-report summaries" rule -- no title-based heuristic needed).

License tagging: license="public-domain-us-gov" by default; flipped to
"us-gov-contracted-verify" if the report text names a contracted CPA/audit
firm (Williams Adley, KPMG, CliftonLarsonAllen, Kearney, Cotton & Company,
RMA Associates, Sikich, or the generic "independent public accounting firm" /
"independent certified public accounting" phrasing) per the task brief.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
from collections import Counter
from dataclasses import asdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))
from legible.align import _slice_between, split_sentences  # noqa: E402
from legible.schema import CandidatePair  # noqa: E402


def to_jsonl_with_license(pair: CandidatePair, license_tag: str) -> str:
    """CandidatePair.to_jsonl() (dataclasses.asdict) has no `license` field --
    the task brief asks for one anyway (per-document, not per-org like
    build_dataset.py's LICENSE table), so build the dict by hand instead of
    mutating the dataclass. Field order matches CandidatePair + license last,
    matching the "add nothing, omit nothing except where noted" brief rule."""
    d = asdict(pair)
    d["license"] = license_tag
    return json.dumps(d, ensure_ascii=False)

# --- exec (Results-in-Brief / Executive Summary) section -------------------

EXEC_START_PRIMARY = (
    r"^([ivx]{1,4}\.{0,3}\s*)?(results in brief|report in brief|executive summary|"
    r"report highlights|briefly\W*|highlights|summary of (audit |evaluation )?results)\s*$"
)
EXEC_START_FALLBACK = (
    r"^(what we found|what the audit found|what the inspection found|"
    r"what oig found|what did we find\??|what gao found)\s*$"
)
EXEC_STOP = (
    r"^(table of contents|contents|abbreviations( and acronyms)?|"
    r"introduction|background|i\.{0,3}\s*background|i\.{0,3}\s*introduction|"
    r"why gao did this study|what gao recommends|transmittal letter)\s*$"
)
# A stop heading counts only once the exec block has accumulated this many
# raw chars -- otherwise a mini "Background" sub-heading sitting immediately
# under a "Highlights" wrapper (seen in USPS-style reports: Highlights ->
# Background -> What We Did -> What We Found -> ...) would truncate the exec
# span to near-nothing. Confirmed both failure modes exist in this corpus:
# an early trap heading (USPS) and reports with NO stop heading at all
# (Treasury/GPO/USAID rely on a *later*, legitimate bare Introduction/
# Background) -- so bare forms stay in EXEC_STOP, guarded by this minimum.
EXEC_STOP_MIN_CHARS = 300

# --- technical / findings section -------------------------------------------

FINDINGS_START = (
    r"^([ivx]{1,4}\.{0,3}\s*)?(findings( and recommendations| summary)?|"
    r"audit findings and recommendations|results and recommendations|"
    r"results of (inspection|audit|evaluation)|audit results|"
    r"inspection results|conditions?|results|details of findings?|"
    r"evaluation results|review results|fisma (audit )?(results|findings))\s*$"
)
FINDINGS_STOP = (
    r"^([ivx]{1,4}\.{0,3}\s*)?(appendix|appendices)\b|"
    r"^notice to non-governmental|^report fraud|^to report fraud|"
    r"^comments and suggestions|^objective,?\s*scope\b|"
    r"^scope and methodology$|^abbreviations|^exhibit\b"
)

# --- sub-finding boundary patterns (tried in order; first with >=2 hits wins) --

FINDING_HEADER_RX = re.compile(r"^finding\s+(\d+)\s*:?\s*(.+)$", re.I)
NUMBERED_HEADER_RX = re.compile(r"^(\d{1,2})\.\s+([A-Z].{4,})$")
LETTERED_HEADER_RX = re.compile(r"^([A-G])\.\s+([A-Z][A-Z0-9 ,&/'\-]{4,})$")

_HEADING_RX = re.compile(r"^#{1,6}\s*(.+?)\s*$")

CONTRACTED_FIRMS = [
    "williams adley", "kpmg", "clifton larson allen", "cliftonlarsonallen",
    "kearney", "cotton & company", "cotton and company", "rma associates",
    "sikich", "independent public accounting firm",
    "independent certified public accounting",
]

GENERIC_FINDING_TITLES = {
    "conclusion", "recommendations", "recommendation", "background",
    "next steps", "summary", "introduction", "overview",
}

CLAIM_CONTEXT_RX = re.compile(
    r"recommend|finding|deficienc|vulnerabilit|control|weakness|risk|percent|violat|"
    r"noncompliant|misconfigur|patch|remediat", re.I)


def has_quantified_claim(sent: str) -> bool:
    """A meaningful number, not a stray Docling footnote-reference digit (this
    corpus scatters single-digit footnote markers mid-sentence, e.g. '... FISMA
    (2014). 1 The inspection focused...' -- the '1' is a footnote, not a claim)."""
    for m in re.finditer(r"\b\d{1,4}\b", sent):
        num = m.group(0)
        if len(num) >= 2:  # two+ digit numbers (10, 9384, ...) are real quantities
            return True
        window = sent[max(0, m.start() - 30): m.end() + 30]
        if CLAIM_CONTEXT_RX.search(window):  # single digit needs claim-y context
            return True
    return False


STOPWORDS = set("""
a an the of to and in on for with as by at from is was were are be been being
that this these those it its their his her our your we they he she you i
not no but or if then than so such which who whom whose what when where how
will would can could should shall must may might do does did done have has
had into over under about between within without also more most other some
any all each per report reports audit audits oig report's department
""".split())


def slug(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")


def significant_words(s: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", s.lower())
            if len(w) >= 4 and w not in STOPWORDS}


def strip_headings(text: str) -> str:
    text = re.sub(r"<!--.*?-->", " ", text)
    text = re.sub(r"^#{1,6}\s*.*$", " ", text, flags=re.M)
    return re.sub(r"\s+", " ", text).strip()


def detect_license(cover_text: str) -> str:
    """Scan the COVER/TRANSMITTAL front matter only (text before the exec
    heading) for a contracted-firm name. Scanning the whole document
    over-triggers: e.g. VA reports' "Appendix A: Background" boilerplate
    explains that VA's *separate, annual* FISMA audit is CPA-contracted even
    when THIS specific report was OIG-staff-authored -- confirmed via a false
    positive on a VA Saginaw inspection during calibration of this script."""
    low = cover_text.lower()
    for firm in CONTRACTED_FIRMS:
        if firm in low:
            return "us-gov-contracted-verify"
    return "public-domain-us-gov"


def find_exec_span(lines: list[str], start_rx: str, stop_rx: str) -> tuple[int, int] | None:
    """Like legible.align._slice_between, but (a) a stop-heading match only
    counts once >=EXEC_STOP_MIN_CHARS of body text has accumulated since the
    start heading (skips early "trap" sub-headings), (b) the FINDINGS_START
    family always terminates the exec block (the exec ends where findings
    begin, whatever the agency calls them), and (c) ALL start-heading matches
    are tried in order until one yields a real body -- the first match is
    often just the table-of-contents ENTRY for the section (AmeriCorps-style
    ToC rendered as headings gave 0-char exec spans)."""
    starts: list[int] = []
    for i, l in enumerate(lines):
        hm = _HEADING_RX.match(l)
        if hm and re.search(start_rx, hm.group(1).strip(), re.I):
            starts.append(i)
    if not starts:
        return None

    combined_stop = f"(?:{stop_rx})|(?:{FINDINGS_START})"
    best: tuple[int, int] | None = None
    for start in starts:
        stops = []
        for i in range(start + 1, len(lines)):
            hm = _HEADING_RX.match(lines[i])
            if hm and re.search(combined_stop, hm.group(1).strip(), re.I):
                stops.append(i)
        if not stops:
            span = (start, len(lines))
        else:
            span = None
            for s in stops:
                if len("\n".join(lines[start:s])) >= EXEC_STOP_MIN_CHARS:
                    span = (start, s)
                    break
            if span is None:
                span = (start, stops[0])
        body_len = len("\n".join(lines[span[0]: span[1]]))
        if 200 <= body_len <= 9000:
            return span  # first start with a plausible body wins
        if best is None:
            best = span
    return best


def find_findings(lines: list[str], start: int, end: int):
    """Try Finding-N, then N., then A. boundary patterns inside [start, end).
    Returns list of (title, body_text); empty if no pattern found >=2 hits
    (a single finding-shaped heading is more likely a false positive)."""
    for rx in (FINDING_HEADER_RX, NUMBERED_HEADER_RX, LETTERED_HEADER_RX):
        hits = []
        for i in range(start, end):
            hm = _HEADING_RX.match(lines[i])
            if not hm:
                continue
            m = rx.match(hm.group(1).strip())
            if m:
                hits.append((i, m.group(2).strip()))
        if len(hits) >= 2:
            out = []
            for k, (i, title) in enumerate(hits):
                nxt = hits[k + 1][0] if k + 1 < len(hits) else end
                body = strip_headings("\n".join(lines[i + 1: nxt]))
                if len(body) > 80:
                    out.append((title, body))
            return out
    return []


CLASSIFICATION_BANNER_RX = re.compile(
    r"\b(TOP SECRET|SECRET//NOFORN|SECRET\s*//|CONFIDENTIAL//|"
    r"//NOFORN|//FEDCON|//REL TO)\b")


def extract_doc(md_path: pathlib.Path, meta: dict) -> tuple[tuple[CandidatePair, str] | None, list[tuple[CandidatePair, str]], str]:
    md = md_path.read_text(errors="replace")
    lines = md.split("\n")

    # Safety exclusion (per research/09-enrichment.md 2c: "DoD OIG: anomaly of
    # banner CUI/FEDCON in public document -- verify per-document before
    # using"). Confirmed hit during this harvest: a DAF Section-1650 audit PDF
    # carries a page-header "SECRET//NOFORN" banner artifact and CUI-redacted
    # counts inline (numbers stripped, leaving malformed sentences). Whether
    # or not the body text is *actually* sensitive, a doc-level pair built
    # from a page displaying that banner has no place in an openly-licensed
    # public dataset -- skip outright rather than risk it via a regex miss.
    if CLASSIFICATION_BANNER_RX.search(md[:3000]):
        return None, [], "classification banner detected in document (SECRET/CONFIDENTIAL/NOFORN/FEDCON) -- excluded per D40 caution"

    exec_span = find_exec_span(lines, EXEC_START_PRIMARY, EXEC_STOP)
    if exec_span is None:
        exec_span = find_exec_span(lines, EXEC_START_FALLBACK, EXEC_STOP)
    if exec_span is None:
        return None, [], "no exec section (no Results-in-Brief/Executive Summary/What-We-Found heading)"
    exec_text = strip_headings("\n".join(lines[exec_span[0]: exec_span[1]]))
    if len(exec_text) < 200:
        return None, [], f"exec section too short ({len(exec_text)} chars)"
    if len(exec_text) > 9000:
        # find_exec_span already skips early "trap" sub-headings (a mini
        # Background right under a Highlights wrapper) via EXEC_STOP_MIN_CHARS
        # -- if it STILL comes back this long, there's genuinely no stop
        # heading in the document and it ran to end-of-document. Better to
        # skip than ship a bloated exec_text with findings prose bled into it.
        return None, [], f"exec section suspiciously long ({len(exec_text)} chars) -- likely no stop heading found, skipping rather than risking findings text bleeding into executive_text"

    tech_span = _slice_between(lines, FINDINGS_START, FINDINGS_STOP)
    if tech_span is None:
        # fallback: some reports (e.g. a DOI/USDA-style single-finding
        # inspection) skip the wrapping "Results"/"Findings" section heading
        # and go straight from Background into "Finding 1: <title>" -- anchor
        # directly on that if present.
        tech_span = _slice_between(lines, r"^finding\s+\d+\s*:", FINDINGS_STOP)
    positional = False
    if tech_span is None:
        # Positional fallback (the D37 lesson, round 2): DOJ/DOE/USAID-style
        # reports carry findings under descriptive sentence-headings ("USAID
        # Did Not Perform Risk Assessments...") or under banners Docling
        # drops, so no named findings heading exists. Take the body AFTER the
        # exec block, skipping an immediate Background/Introduction section,
        # up to the first FINDINGS_STOP heading (or EOF); accept only if
        # substantial (1500+ chars).
        start = exec_span[1]
        intro_rx = re.compile(r"^(i\.{0,3}\s*)?(background|introduction)\s*$", re.I)
        stop_rx = re.compile(FINDINGS_STOP, re.I)
        awaiting_intro_end = False
        stop = len(lines)
        for i in range(exec_span[1], len(lines)):
            hm = _HEADING_RX.match(lines[i])
            if not hm:
                continue
            title = hm.group(1).strip()
            if stop_rx.match(title):
                stop = i
                break
            if intro_rx.match(title) and i - exec_span[1] < 40 and not awaiting_intro_end:
                awaiting_intro_end = True
                continue
            if awaiting_intro_end:
                start = i  # first heading AFTER the intro block → findings begin
                awaiting_intro_end = False
        tech_span = (start, stop)
        positional = True
    tech_text_full = strip_headings("\n".join(lines[tech_span[0]: tech_span[1]]))
    if len(tech_text_full) < (1500 if positional else 400):
        return None, [], (
            f"findings body too short ({len(tech_text_full)} chars, positional fallback)"
            if positional else f"findings section too short ({len(tech_text_full)} chars)"
        )

    license_tag = detect_license("\n".join(lines[: exec_span[0]]))
    doc_type = meta["doc_type"]
    source_org = meta["source_org"]
    doc_id = meta["doc_id"]

    doc_pair = CandidatePair(
        pair_id=f"{doc_id}#doc",
        source_doc_id=doc_id,
        source_org=source_org,
        doc_type=doc_type,
        technical_text=tech_text_full[:12000],
        technical_context="Results and Recommendations / Findings",
        executive_text=exec_text[:8000],
        audience_observed="management",
        alignment_method="same_section_1to1",
        alignment_type="1:1",
        exec_span_kind="doc_level",
        # positional-fallback pairs (no named findings heading; body sliced
        # after the exec block) are a weaker structural claim -- technical side
        # may include Objective/Scope/Methodology or Management Comments prose.
        # Hard rule: ambiguous pairing => needs_llm_verify=True.
        needs_llm_verify=bool(positional),
        notes=("structural section pairing, POSITIONAL fallback (no named findings "
               "heading; body after exec block) -- verify before core use")
              if positional else
              "structural section pairing (OIG Results-in-Brief/Executive Summary <-> Findings)",
        )

    # --- finding-level thematic ("claim") candidates ---
    findings = [(t, b) for t, b in find_findings(lines, tech_span[0] + 1, tech_span[1])
                if t.strip().lower().rstrip(":.") not in GENERIC_FINDING_TITLES]
    claim_pairs: list[tuple[CandidatePair, str]] = []
    if findings:
        finding_words = [(title, body, significant_words(title) | significant_words(body[:500]))
                          for title, body in findings]
        for sent in split_sentences(exec_text):
            if not has_quantified_claim(sent) or len(sent) < 40:
                continue
            sw = significant_words(sent)
            if len(sw) < 3:
                continue
            best_i, best_score = -1, 0
            for i, (_, _, fw) in enumerate(finding_words):
                score = len(sw & fw)
                if score > best_score:
                    best_i, best_score = i, score
            if best_score >= 3:
                title, body, _ = finding_words[best_i]
                fid = f"{doc_id}#f{best_i+1}"
                cp = CandidatePair(
                    pair_id=fid,
                    source_doc_id=doc_id,
                    source_org=source_org,
                    doc_type=doc_type,
                    technical_text=(f"{title}\n\n{body}")[:6000],
                    technical_context=title,
                    executive_text=sent,
                    audience_observed="management",
                    alignment_method="thematic",
                    alignment_type="1:1",
                    exec_span_kind="claim",
                    needs_llm_verify=True,
                    notes=f"keyword-overlap heuristic score={best_score} (no embeddings/API; $0 rule)",
                )
                claim_pairs.append((cp, license_tag))

    return (doc_pair, license_tag), claim_pairs, "ok"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--md-dir", default="data/corpus/out/md")
    ap.add_argument("--downloads-oig", default="data/corpus/downloads_oig.json")
    ap.add_argument("--out", default="data/pairs/candidates_gov_audit.jsonl")
    args = ap.parse_args()

    import json
    dl = json.loads(pathlib.Path(args.downloads_oig).read_text()) if pathlib.Path(args.downloads_oig).exists() else []
    meta_by_docid = {}
    for r in dl:
        if r.get("status") not in ("ok", "cached") or not r.get("doc_id"):
            continue
        doc_id = r["doc_id"]
        agency_slug = doc_id.split("__")[1] if "__" in doc_id else "unknown-oig"
        source_org = agency_slug
        doc_type = "oig_audit" if r.get("report_type") == "Audit" else "oig_inspection"
        meta_by_docid[doc_id] = {"doc_id": doc_id, "source_org": source_org, "doc_type": doc_type,
                                  "title": r.get("title"), "agency_reviewed": r.get("agency_reviewed")}

    out_path = pathlib.Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    stats = Counter()
    skip_log = []
    n_doc = n_claim = 0
    with out_path.open("w") as fh:
        for f in sorted(pathlib.Path(args.md_dir).glob("oig__*.md")) + sorted(pathlib.Path(args.md_dir).glob("gao__*.md")):
            doc_id = f.stem
            meta = meta_by_docid.get(doc_id)
            if meta is None:
                stats["no_manifest_meta"] += 1
                continue
            doc_result, claim_pairs, reason = extract_doc(f, meta)
            if doc_result is None:
                stats["skipped"] += 1
                skip_log.append(f"{doc_id}\t{reason}")
                continue
            doc_pair, license_tag = doc_result
            fh.write(to_jsonl_with_license(doc_pair, license_tag) + "\n")
            n_doc += 1
            stats["doc_pairs"] += 1
            stats[f"license_{license_tag}"] += 1
            for cp, cp_license in claim_pairs:
                fh.write(to_jsonl_with_license(cp, cp_license) + "\n")
                n_claim += 1
            stats["claim_pairs"] += len(claim_pairs)
            stats["reports_with_claims"] += 1 if claim_pairs else 0

    skip_path = out_path.parent / "gov_audit_skipped.txt"
    skip_path.write_text("\n".join(skip_log) + ("\n" if skip_log else ""))

    n_reports = n_doc + stats["skipped"]
    yield_rate = n_doc / n_reports if n_reports else 0.0
    print(f"gov-audit pairs: {n_doc} doc-level + {n_claim} claim-level -> {out_path}")
    print(dict(stats))
    print(f"yield: {n_doc}/{n_reports} reports produced a usable doc-level pair "
          f"({yield_rate:.2f}); skip reasons -> {skip_path}")


if __name__ == "__main__":
    main()
