#!/usr/bin/env python
"""LEGIBLE D41: parse + extract candidate pairs from FTC/SEC enforcement docs.

Two phases, both resumable:

**Phase 1 (parse):** Docling-convert each PDF in data/corpus/downloads_legal.json
(status="ok") into data/corpus/out/{md,json,headers}/<doc_id>.{md,json,headers.txt}
-- same conversion options as scripts/parse_corpus.py (OCR off, TableFormer
ACCURATE), since FTC/SEC complaints and orders are text-based, not scans. If
Docling raises or the resulting markdown has too little text (<500 chars,
signalling a scanned/odd PDF), falls back to `pdftotext -layout`. A doc that
fails both is appended to data/corpus/quarantine_legal.txt and skipped.

**Phase 2 (extract):** these documents are numbered-paragraph legal filings
(complaints) or heading-organized orders -- not fixed-heading templates like
CISA advisories, so extraction works off two structural signals instead:

1. **Doc-level pair** (one per case, alignment_method="same_section_1to1",
   needs_llm_verify=False): the "Summary of the Case" / "Nature of the Case"
   heading section if present, else all "Count"/"Violation(s)" section
   paragraphs concatenated (these ARE the plain-register allegation summary
   in every complaint template observed) <-> every other body paragraph
   (boilerplate jurisdiction/parties paragraphs under the outer "COMPLAINT"
   preamble heading and Exhibit reproductions are excluded).

2. **Paragraph-level pairs** (alignment_method="thematic", needs_llm_verify=
   True always, per spec): FTC Part-3 administrative complaints and federal
   district-court complaints both follow one very reliable convention --
   plain-register legal paragraphs (Count/Violations sections, or any
   paragraph making a legal-failure assertion) formally cross-reference the
   technical paragraphs supporting them, e.g. "As alleged in Paragraphs 13 to
   29..." / "as set forth in Paragraph 9...". This is a citation anchor,
   structurally the same idea as TOB's ID-anchored tier-0 pairs. Where no
   such citation exists (more likely in SEC orders, which are less rigidly
   numbered), falls back to same-section thematic adjacency: a legal-register
   paragraph pairs with the technical-register paragraph(s) sharing its
   subheading.

   Paragraph classification is keyword-based: TECH_MARKERS (password,
   encryption, S3, AWS, GitHub, MFA, firewall, plain text, patch,
   segmentation, access key, credential, phishing, ...) vs LEGAL_MARKERS
   (reasonable security/measures, failed to provide/implement/maintain,
   unfair act, deceptive, misrepresent, in violation of, disclosure
   controls, ...).

Output: data/pairs/candidates_legal.jsonl (append/resume by pair_id).
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))
from legible.schema import CandidatePair  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
CORPUS = ROOT / "data" / "corpus"
PDF_DIR = CORPUS / "pdfs" / "legal"
MD_DIR = CORPUS / "out" / "md"
JSON_DIR = CORPUS / "out" / "json"
HEADERS_DIR = CORPUS / "out" / "headers"
MANIFEST_JSON = CORPUS / "downloads_legal.json"
QUARANTINE_TXT = CORPUS / "quarantine_legal.txt"
OUT_JSONL = ROOT / "data" / "pairs" / "candidates_legal.jsonl"

MIN_CHARS_OK = 500       # below this, treat Docling output as failed -> pdftotext fallback
MIN_TECH_LEN = 150       # minimum technical_text length to keep a paragraph-level pair
MIN_EXEC_LEN = 40        # minimum executive_text length to keep a paragraph-level pair
MAX_CITE_SPAN = 20       # citations spanning more paragraphs than this are boilerplate
                         # "incorporate all prior paragraphs" clauses, not targeted -- skipped
TECH_CAP = 12000
EXEC_CAP = 6000

# ---------------------------------------------------------------------------
# Phase 1: parse
# ---------------------------------------------------------------------------


def build_converter(ocr: bool = False):
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode
    from docling.document_converter import DocumentConverter, PdfFormatOption

    opts = PdfPipelineOptions()
    opts.do_table_structure = True
    opts.table_structure_options.mode = TableFormerMode.ACCURATE
    if ocr:
        from docling.datamodel.pipeline_options import OcrMacOptions
        opts.do_ocr = True
        # force_full_page_ocr: without this, Docling only OCRs pages it thinks
        # lack an extractable text layer -- a broken-font-CMap PDF (see
        # looks_garbled) HAS a text layer, just a garbled one, so Docling
        # would otherwise skip straight past OCR and reuse the same garbage.
        opts.ocr_options = OcrMacOptions(force_full_page_ocr=True)
    else:
        opts.do_ocr = False
    return DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)})


STOPWORD_RX = re.compile(r"\b(the|and|of|to|in|is|that|for|was|has)\b", re.I)


def looks_garbled(text: str) -> bool:
    """True if text doesn't read as English -- catches PDFs with a broken/
    custom font ToUnicode CMap (visually correct when rendered, but the text
    layer decodes to substituted characters, e.g. FTC's 2020 Zoom complaint:
    'UNITED STATES OF AMERICA' extracts as '81,7('67$7(6 2) $0(5,&$'). Both
    Docling's text-layer extraction and pdftotext read the same broken
    layer, so this can't be fixed by switching tools -- only by rendering
    pages to images and OCR'ing the visual glyphs."""
    sample = text[:3000]
    words = re.findall(r"[A-Za-z]{2,}", sample)
    if len(words) < 20:
        return True
    return len(STOPWORD_RX.findall(sample)) < 3


def pdftotext_fallback(pdf_path: pathlib.Path) -> str | None:
    try:
        out = subprocess.run(
            ["pdftotext", "-layout", str(pdf_path), "-"],
            capture_output=True, text=True, timeout=120,
        )
        if out.returncode == 0 and len(out.stdout.strip()) >= MIN_CHARS_OK and not looks_garbled(out.stdout):
            return out.stdout
    except Exception:  # noqa: BLE001
        pass
    return None


def parse_all(entries: list[dict]) -> None:
    for d in (MD_DIR, JSON_DIR, HEADERS_DIR):
        d.mkdir(parents=True, exist_ok=True)
    quarantined = set()
    if QUARANTINE_TXT.exists():
        quarantined = set(QUARANTINE_TXT.read_text().split())

    converter = None
    ocr_converter = None
    for e in entries:
        doc_id = e["doc_id"]
        if e.get("status") != "ok":
            continue
        md_path = MD_DIR / f"{doc_id}.md"
        if md_path.exists() or doc_id in quarantined:
            continue
        pdf_path = PDF_DIR / f"{doc_id}.pdf"
        if not pdf_path.exists():
            print(f"[parse] {doc_id}: PDF missing on disk, skip")
            continue

        md_text, source = None, "docling"
        doc_dict = None
        try:
            if converter is None:
                converter = build_converter()
            result = converter.convert(str(pdf_path))
            doc = result.document
            candidate_md = doc.export_to_markdown()
            if len(candidate_md.strip()) >= MIN_CHARS_OK and not looks_garbled(candidate_md):
                md_text, doc_dict = candidate_md, doc.export_to_dict()
            elif len(candidate_md.strip()) < MIN_CHARS_OK:
                print(f"[parse] {doc_id}: Docling output too short ({len(candidate_md.strip())} chars)")
            else:
                print(f"[parse] {doc_id}: Docling output looks garbled (broken font encoding), trying OCR")
        except Exception as ex:  # noqa: BLE001
            print(f"[parse] {doc_id}: Docling raised {type(ex).__name__}: {ex}")

        if md_text is None:
            try:
                if ocr_converter is None:
                    print("Loading Docling OCR converter (OcrMacOptions)...")
                    ocr_converter = build_converter(ocr=True)
                result = ocr_converter.convert(str(pdf_path))
                doc = result.document
                candidate_md = doc.export_to_markdown()
                if len(candidate_md.strip()) >= MIN_CHARS_OK and not looks_garbled(candidate_md):
                    md_text, source, doc_dict = candidate_md, "docling_ocr", doc.export_to_dict()
                else:
                    print(f"[parse] {doc_id}: OCR pass also too short/garbled, trying pdftotext")
            except Exception as ex:  # noqa: BLE001
                print(f"[parse] {doc_id}: Docling OCR raised {type(ex).__name__}: {ex}; trying pdftotext")

        if md_text is not None and doc_dict is not None:
            (JSON_DIR / f"{doc_id}.json").write_text(json.dumps(doc_dict))
            headers = [
                (t.get("text") or "").replace("\n", " ").strip()
                for t in doc_dict.get("texts", [])
                if str(t.get("label", "")).lower() == "section_header"
            ]
            (HEADERS_DIR / f"{doc_id}.headers.txt").write_text("\n".join(headers))

        if md_text is None:
            fb = pdftotext_fallback(pdf_path)
            if fb is not None:
                md_text, source = fb, "pdftotext"
            else:
                print(f"[parse] {doc_id}: QUARANTINED (Docling, Docling-OCR, and pdftotext all failed/too short/garbled)")
                with open(QUARANTINE_TXT, "a") as f:
                    f.write(doc_id + "\n")
                continue

        md_path.write_text(md_text)
        print(f"[parse] {doc_id}: OK via {source} ({len(md_text)} chars)")


# ---------------------------------------------------------------------------
# Phase 2: paragraph model
# ---------------------------------------------------------------------------

HEADING_MD_RX = re.compile(r"^(#{1,4})\s+(.*)$")
NUMPARA_RX = re.compile(r"^(\d+)\.\s+(.*)$")
# pdftotext fallback has no markdown headings; treat short, unindented,
# non-numbered, no-trailing-period lines in Title/ALL-CAPS case as headings.
PLAIN_HEADING_RX = re.compile(r"^(?!\d+\.)([A-Z][A-Za-z0-9 ,'\-&*]{2,70})$")

# Two-stage: find a whole citation clause anchored on "Paragraph(s)", then
# pull every number/range token out of it -- handles "Paragraph 9", "Paragraphs
# 16-23", "Paragraphs 13 to 29", and lists like "Paragraphs 24 and 26" /
# "Paragraphs 11, 13 and 15" that a single-range regex would truncate after
# the first number.
_NUM_TOKEN = r"\d+(?:\.[a-zA-Z])?(?:\s*(?:-|–|through|to)\s*\d+(?:\.[a-zA-Z])?)?"
CITE_CLAUSE_RX = re.compile(
    rf"\bParagraphs?\s+({_NUM_TOKEN}(?:\s*(?:,|and)\s*{_NUM_TOKEN})*)", re.I,
)
CITE_TOKEN_RX = re.compile(r"(\d+)(?:\.[a-zA-Z])?(?:\s*(?:-|–|through|to)\s*(\d+)(?:\.[a-zA-Z])?)?")

# A citing paragraph whose own text is dominated by concrete technical detail
# (many TECH_MARKERS hits, no offsetting LEGAL_MARKERS hit) is itself a
# factual/narrative paragraph that happens to shorthand-reference another
# paragraph by number -- not a plain-register allegation. Don't use it as the
# executive_text side of a citation-anchor pair.
TECH_DOMINANCE_MIN = 3


def format_para_nums(nums: list[int]) -> str:
    """Run-length encode a sorted list of paragraph numbers: [13,14,...,29] ->
    'P13-P29'; [13,32] -> 'P13,P32' (NOT 'P13-P32', which would misleadingly
    imply every paragraph in between was cited)."""
    if not nums:
        return ""
    runs = []
    start = prev = nums[0]
    for n in nums[1:]:
        if n == prev + 1:
            prev = n
            continue
        runs.append((start, prev))
        start = prev = n
    runs.append((start, prev))
    return ",".join(f"P{a}" if a == b else f"P{a}-P{b}" for a, b in runs)

TECH_MARKERS = re.compile(
    r"\b(password|encrypt\w*|hash(?:ed|es|ing)?|amazon s3|(?<![a-z])s3(?:[ -]?bucket)?s?|aws|github|"
    r"multi[- ]?factor|mfa|single sign[- ]?on|\bsso\b|firewall|plain[- ]?text|patch(?:ed|es|ing)?|"
    r"segment(?:ation|ed)?|access key|api key|access token|credentials?|phish\w*|malware|exploit\w*|"
    r"vulnerab\w*|ransomware|exfiltrat\w*|(?<!web )server\w*|database\w*|network\w*|\bvpn\b|\btls\b|\bssl\b|"
    r"penetration test\w*|log(?:ging|s|ged)?|ip address(?:es)?|endpoint\w*|root credential\w*|"
    r"misconfigur\w*|unpatched|backdoor\w*|brute[- ]?force|sql injection|cross-site|\brdp\b|"
    r"administrat\w* (?:privileges?|access)|cloud storage|threat actor\w*|intrusion\w*|breach(?:ed|es)?|"
    r"cryptograph\w*|source code|repositor(?:y|ies)|hacker\w*|malicious actor\w*|dark web|"
    r"disclosure controls?|internal (?:accounting )?controls?|orion|sunburst|active directory|"
    r"vishing|social engineering|two[- ]factor|firmware|CVE-\d)",
    re.I,
)

LEGAL_MARKERS = re.compile(
    r"\b(reasonable (?:security|measures?|safeguards?|steps?|access controls?)|"
    r"appropriate (?:safeguards?|measures?)|failed to (?:provide|implement|maintain|employ|use|develop|"
    r"adopt|adequately|require|ensure|disclose)|unfair (?:act|or practice)|deceptive act\w*|"
    r"misrepresent\w*|materially (?:false|misleading|inaccurate)|constitutes?|in violation of|"
    r"violat(?:ed|es|ion)s? of|cease and desist|negligently|knew or should have known|"
    r"omit(?:ted)? to state|false or misleading|unlawful\w*|deceived|deceptive or unfair)\b",
    re.I,
)


def load_markdown_paragraphs(text: str, is_markdown: bool) -> list[dict]:
    """Return ordered [{num, section, text, order}] paragraph blocks.

    Segmentation is anchored on strictly-increasing numbered paragraphs
    (the "1.", "2.", "3." ... convention common to both FTC administrative
    and federal-court complaints). Lines that look like a numbered item but
    don't continue the sequence (sub-list artifacts, e.g. Docling's rendering
    of nested lettered/roman-numeral sub-items as "4. ii)") are folded into
    the current paragraph's text instead of starting a new one.

    A forward jump of up to MAX_PARA_GAP is tolerated (not just exactly
    +1): some paragraphs lose their leading "N." when Docling renders them
    as a plain bullet instead of a numbered one, and OCR'd pages (see
    looks_garbled) occasionally misread a digit (e.g. "8." -> "4.", which
    then looks like a stray sub-item and is correctly dropped since 4 is not
    > the running last_num). Without tolerance a single lost/misread number
    would permanently desync the whole rest of the document from its real
    paragraph numbers; with it, only the one fumbled paragraph's content
    gets folded into its neighbor instead of cleanly isolated.
    """
    MAX_PARA_GAP = 6
    lines = text.split("\n")
    paragraphs: list[dict] = []
    current_section = ""
    cur_num = None
    cur_lines: list[str] = []
    last_num = 0
    order = 0

    def flush():
        nonlocal cur_lines
        if cur_lines:
            joined = " ".join(l.strip() for l in cur_lines if l.strip())
            joined = re.sub(r"\s+", " ", joined).strip()
            if joined:
                paragraphs.append({"num": cur_num, "section": current_section, "text": joined, "order": order})
        cur_lines = []

    for raw_line in lines:
        line = raw_line.rstrip()
        hm = HEADING_MD_RX.match(line) if is_markdown else None
        if hm is None and not is_markdown and line.strip() and not line.strip().endswith((".", ",", ";", ":")):
            phm = PLAIN_HEADING_RX.match(line.strip())
            if phm and len(line.strip().split()) <= 10 and not NUMPARA_RX.match(line.strip()):
                hm = phm  # reuse as heading match with group(1) semantics differing; handled below
                heading_text = phm.group(1)
            else:
                hm = None
        else:
            heading_text = hm.group(2).strip() if hm else None

        if hm is not None:
            flush()
            current_section = heading_text if heading_text is not None else line.strip()
            cur_num = None
            order += 1
            continue

        nm = NUMPARA_RX.match(line.strip())
        if nm:
            n = int(nm.group(1))
            if last_num < n <= last_num + MAX_PARA_GAP:
                flush()
                last_num = n
                cur_num = n
                order += 1
                cur_lines = [nm.group(2)]
                continue
        if line.strip():
            cur_lines.append(line)
    flush()
    return paragraphs


BOILERPLATE_SECTIONS = {"complaint", "order", ""}


def classify(text: str) -> tuple[int, int]:
    return len(TECH_MARKERS.findall(text)), len(LEGAL_MARKERS.findall(text))


def is_exhibit_or_boilerplate(section: str) -> bool:
    s = section.strip().lower()
    return s in BOILERPLATE_SECTIONS or s.startswith("exhibit") or "united states of america" in s


def is_count_section(section: str) -> bool:
    s = section.strip().lower()
    return bool(re.match(r"^(count\b|violations?\b|summary\b|nature of the case\b)", s))


# ---------------------------------------------------------------------------
# Phase 2: pair construction
# ---------------------------------------------------------------------------


def make_doc_level_pair(doc_id, source_org, doc_type, case_name, url, notes, paragraphs) -> CandidatePair | None:
    summary_paras = [p for p in paragraphs if re.match(r"^(summary of the case|nature of the case)$",
                                                         p["section"].strip(), re.I)]
    count_paras = [p for p in paragraphs if is_count_section(p["section"])]
    exec_paras = summary_paras if summary_paras else count_paras
    if not exec_paras:
        return None
    exec_text = " ".join(p["text"] for p in exec_paras)

    exec_order = {p["order"] for p in exec_paras}
    tech_paras = [
        p for p in paragraphs
        if p["order"] not in exec_order
        and not is_exhibit_or_boilerplate(p["section"])
        and not is_count_section(p["section"])
    ]
    if not tech_paras:
        return None
    tech_text = " ".join(p["text"] for p in tech_paras)
    if len(exec_text) < MIN_EXEC_LEN or len(tech_text) < 400:
        return None

    return CandidatePair(
        pair_id=f"{doc_id}#doc",
        source_doc_id=f"legal/{doc_id}",
        source_org=source_org,
        doc_type=doc_type,
        technical_text=tech_text[:TECH_CAP],
        technical_context="detailed factual allegations",
        executive_text=exec_text[:EXEC_CAP],
        audience_observed="regulatory",
        alignment_method="same_section_1to1",
        alignment_type="1:1",
        exec_span_kind="doc_level",
        needs_llm_verify=False,
        notes=(f"doc-level structural pair ({'Summary of the Case' if summary_paras else 'Count/Violations sections'} "
               f"<-> factual body); case: {case_name}; license: public-domain-us-gov; source_url: {url}; "
               f"{notes}"),
    )


def make_paragraph_pairs(doc_id, source_org, doc_type, case_name, url, notes, paragraphs) -> list[CandidatePair]:
    by_num = {p["num"]: p for p in paragraphs if p["num"] is not None}
    pairs: list[CandidatePair] = []
    seen_legal_orders: set[int] = set()

    # --- citation-anchor pass ---
    for p in paragraphs:
        if p["num"] is None:
            continue
        tech_hits, legal_hits = classify(p["text"])
        if tech_hits >= TECH_DOMINANCE_MIN and tech_hits > legal_hits:
            continue  # citing paragraph reads as technical narrative, not plain allegation
        clauses = list(CITE_CLAUSE_RX.finditer(p["text"]))
        if not clauses:
            continue
        target_nums: set[int] = set()
        for clause in clauses:
            for tok in CITE_TOKEN_RX.finditer(clause.group(1)):
                start = int(tok.group(1))
                end = int(tok.group(2)) if tok.group(2) else start
                if start > p["num"] or end > p["num"]:
                    continue  # only backward references
                if end - start + 1 > MAX_CITE_SPAN:
                    continue
                target_nums.update(range(start, end + 1))
        target_nums.discard(p["num"])
        cited_paras = sorted((n, by_num[n]) for n in target_nums if n in by_num)
        if not cited_paras:
            continue
        tech_text = " ".join(tp["text"] for _, tp in cited_paras)
        if len(tech_text) < MIN_TECH_LEN or len(p["text"]) < MIN_EXEC_LEN:
            continue
        nums = [n for n, _ in cited_paras]
        cite_label = format_para_nums(nums)
        pairs.append(CandidatePair(
            pair_id=f"{doc_id}#p{p['num']}",
            source_doc_id=f"legal/{doc_id}",
            source_org=source_org,
            doc_type=doc_type,
            technical_text=tech_text[:TECH_CAP],
            technical_context="; ".join(sorted({tp["section"] for _, tp in cited_paras})) or "factual allegations",
            executive_text=p["text"][:EXEC_CAP],
            audience_observed="regulatory",
            alignment_method="thematic",
            alignment_type="1:1" if len(nums) == 1 else "1:N",
            cited_ids=[cite_label],
            finding_numbers=nums,
            exec_span_kind="prose",
            needs_llm_verify=True,
            notes=(f"paragraph-level pair via explicit citation (Paragraph {p['num']} cites {cite_label}); "
                   f"section: {p['section']}; case: {case_name}; license: public-domain-us-gov; "
                   f"source_url: {url}; {notes}"),
        ))
        seen_legal_orders.add(p["order"])

    # --- same-section thematic-adjacency fallback (paragraphs with no citation match) ---
    by_section: dict[str, list[dict]] = {}
    for p in paragraphs:
        by_section.setdefault(p["section"], []).append(p)

    for section, paras in by_section.items():
        if is_exhibit_or_boilerplate(section):
            continue
        legal_in_section = []
        tech_in_section = []
        for p in paras:
            if p["order"] in seen_legal_orders:
                continue
            tech_hits, legal_hits = classify(p["text"])
            if legal_hits > 0 and legal_hits >= tech_hits:
                legal_in_section.append(p)
            elif tech_hits > 0:
                tech_in_section.append(p)
        if not legal_in_section or not tech_in_section:
            continue
        tech_text = " ".join(tp["text"] for tp in tech_in_section)
        for lp in legal_in_section:
            if len(lp["text"]) < MIN_EXEC_LEN or len(tech_text) < MIN_TECH_LEN:
                continue
            key_suffix = lp["num"] if lp["num"] is not None else lp["order"]
            nums = [tp["num"] for tp in tech_in_section if tp["num"] is not None]
            pairs.append(CandidatePair(
                pair_id=f"{doc_id}#adj{key_suffix}",
                source_doc_id=f"legal/{doc_id}",
                source_org=source_org,
                doc_type=doc_type,
                technical_text=tech_text[:TECH_CAP],
                technical_context=section,
                executive_text=lp["text"][:EXEC_CAP],
                audience_observed="regulatory",
                alignment_method="thematic",
                alignment_type="1:1" if len(tech_in_section) == 1 else "1:N",
                finding_numbers=nums,
                exec_span_kind="prose",
                needs_llm_verify=True,
                notes=(f"paragraph-level pair via same-section thematic adjacency (heading: '{section}'); "
                       f"case: {case_name}; license: public-domain-us-gov; source_url: {url}; {notes}"),
            ))
    return pairs


def extract_all(entries: list[dict]) -> None:
    existing_ids = set()
    if OUT_JSONL.exists():
        with open(OUT_JSONL) as f:
            for line in f:
                line = line.strip()
                if line:
                    existing_ids.add(json.loads(line)["pair_id"])

    n_doc, n_para, n_skipped_no_md = 0, 0, 0
    with open(OUT_JSONL, "a") as out:
        for e in entries:
            doc_id = e["doc_id"]
            if e.get("status") != "ok":
                continue
            md_path = MD_DIR / f"{doc_id}.md"
            if not md_path.exists():
                n_skipped_no_md += 1
                continue
            text = md_path.read_text()
            is_markdown = "\n## " in text or text.startswith("## ")
            paragraphs = load_markdown_paragraphs(text, is_markdown)
            if not paragraphs:
                print(f"[extract] {doc_id}: no paragraphs parsed, skip")
                continue

            case_name = e.get("case_name", doc_id)
            url = e.get("url", "")
            notes = e.get("notes", "")
            source_org = e["source_org"]
            doc_type = e["doc_type"]

            dp = make_doc_level_pair(doc_id, source_org, doc_type, case_name, url, notes, paragraphs)
            if dp and dp.pair_id not in existing_ids:
                out.write(dp.to_jsonl() + "\n")
                existing_ids.add(dp.pair_id)
                n_doc += 1

            for pp in make_paragraph_pairs(doc_id, source_org, doc_type, case_name, url, notes, paragraphs):
                if pp.pair_id not in existing_ids:
                    out.write(pp.to_jsonl() + "\n")
                    existing_ids.add(pp.pair_id)
                    n_para += 1
            print(f"[extract] {doc_id}: doc-level={'yes' if dp else 'no'}, paragraph pairs so far cumulative={n_para}")

    print(f"\nDone. doc-level pairs added={n_doc}, paragraph-level pairs added={n_para}, "
          f"docs skipped (no parsed md)={n_skipped_no_md} -> {OUT_JSONL}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--parse-only", action="store_true")
    ap.add_argument("--extract-only", action="store_true")
    ap.add_argument("--doc", action="append", default=None, help="restrict to these doc_id(s), for the sample gate")
    args = ap.parse_args()

    if not MANIFEST_JSON.exists():
        print(f"Missing {MANIFEST_JSON}; run scripts/download_legal.py first.")
        return 1
    entries = json.loads(MANIFEST_JSON.read_text())
    if args.doc:
        entries = [e for e in entries if e["doc_id"] in args.doc]

    if not args.extract_only:
        parse_all(entries)
    if not args.parse_only:
        extract_all(entries)
    return 0


if __name__ == "__main__":
    sys.exit(main())
