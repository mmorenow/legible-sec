#!/usr/bin/env python3
"""LEGIBLE D40 Task: parse OIG (+ GAO, if unblocked) PDFs with Docling.

Same conversion options/OCR-triage pattern as scripts/parse_wave2.py
(do_table_structure=True, TableFormer ACCURATE; per-doc pypdfium2 triage --
OCR via OcrMacOptions enabled only if >30% of pages have <200 extracted text
chars).

Sources:
  data/corpus/pdfs/oig/<doc_id>.pdf -> data/corpus/out/{md,json,headers}/<doc_id>.{md,json,headers.txt}
  data/corpus/pdfs/gao/<doc_id>.pdf -> same (doc_id already includes the oig__/gao__ prefix
  set by download_govaudit.py, so no re-prefixing here).

Resumable: a doc whose md+json already exist is skipped. Wall-clock budgeted
via --budget-seconds; re-run to continue. A doc that crashes Docling (both
OCR and non-OCR converters) is retried at most twice total, then logged in
data/corpus/parse_log_govaudit.json under an "error" key and skipped.
Docs that repeatedly fail, or whose extracted text is too thin to be usable,
are also written to data/corpus/quarantine_govaudit.txt with a reason.

NOTE (2026-07-08): a concurrent session briefly replaced this file with a
simpler minimal variant and ran it over the same corpus; outputs are
compatible (same md/json/headers layout, same converter options minus OCR
triage). This restored version is the harvest-agent original.
"""
import argparse
import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS = os.path.join(ROOT, "data", "corpus")
MD_DIR = os.path.join(CORPUS, "out", "md")
JSON_DIR = os.path.join(CORPUS, "out", "json")
HEADERS_DIR = os.path.join(CORPUS, "out", "headers")
PARSE_LOG_JSON = os.path.join(CORPUS, "parse_log_govaudit.json")
QUARANTINE_TXT = os.path.join(CORPUS, "quarantine_govaudit.txt")

SOURCES = [
    ("oig", os.path.join(CORPUS, "pdfs", "oig")),
    ("gao", os.path.join(CORPUS, "pdfs", "gao")),
]

OCR_PAGE_CHAR_THRESHOLD = 200
OCR_PAGE_FRACTION_THRESHOLD = 0.30
MIN_MD_CHARS = 2000  # a "parsed" doc whose markdown is thinner than this is quarantined


def stem(filename):
    return os.path.splitext(filename)[0]


def load_log():
    if os.path.exists(PARSE_LOG_JSON):
        with open(PARSE_LOG_JSON) as f:
            return json.load(f)
    return {}


def save_log(log):
    with open(PARSE_LOG_JSON, "w") as f:
        json.dump(log, f, indent=2)


def quarantine(doc_id, reason):
    with open(QUARANTINE_TXT, "a") as f:
        f.write(f"{doc_id}\t{reason}\n")


def triage_needs_ocr(pdf_path):
    import pypdfium2 as pdfium
    pdf = pdfium.PdfDocument(pdf_path)
    try:
        n_pages = len(pdf)
        if n_pages == 0:
            return False, 0, 0.0
        thin = 0
        for i in range(n_pages):
            page = pdf[i]
            tp = page.get_textpage()
            try:
                n_chars = len(tp.get_text_range())
            finally:
                tp.close()
                page.close()
            if n_chars < OCR_PAGE_CHAR_THRESHOLD:
                thin += 1
        frac = thin / n_pages
        return frac > OCR_PAGE_FRACTION_THRESHOLD, n_pages, frac
    finally:
        pdf.close()


def build_converter(ocr=False):
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import (
        PdfPipelineOptions, TableFormerMode, OcrMacOptions,
    )
    from docling.document_converter import DocumentConverter, PdfFormatOption

    opts = PdfPipelineOptions()
    opts.do_table_structure = True
    opts.table_structure_options.mode = TableFormerMode.ACCURATE
    if ocr:
        opts.do_ocr = True
        opts.ocr_options = OcrMacOptions()
    else:
        opts.do_ocr = False
    return DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
    )


def convert_one(converter, pdf_path, md_path, json_path, headers_path):
    t0 = time.time()
    result = converter.convert(pdf_path)
    doc = result.document
    md = doc.export_to_markdown()
    d = doc.export_to_dict()
    with open(md_path, "w") as f:
        f.write(md)
    with open(json_path, "w") as f:
        json.dump(d, f)
    headers = [
        (t.get("text") or "").replace("\n", " ").strip()
        for t in d.get("texts", [])
        if str(t.get("label", "")).lower() == "section_header"
    ]
    with open(headers_path, "w") as f:
        f.write("\n".join(headers))
    return time.time() - t0, len(md)


def gather_todo(log):
    todo = []
    n_skip = 0
    for source_group, pdf_dir in SOURCES:
        if not os.path.isdir(pdf_dir):
            continue
        for name in sorted(os.listdir(pdf_dir)):
            if not name.lower().endswith(".pdf"):
                continue
            doc_id = stem(name)  # already oig__... / gao__... from download_govaudit.py
            md_path = os.path.join(MD_DIR, doc_id + ".md")
            json_path = os.path.join(JSON_DIR, doc_id + ".json")
            if os.path.exists(md_path) and os.path.exists(json_path):
                n_skip += 1
                continue
            pdf_path = os.path.join(pdf_dir, name)
            todo.append((source_group, name, pdf_path, doc_id))
    return todo, n_skip


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget-seconds", type=int, default=600)
    args = ap.parse_args()

    for d in (MD_DIR, JSON_DIR, HEADERS_DIR):
        os.makedirs(d, exist_ok=True)

    log = load_log()
    todo, n_skip = gather_todo(log)
    print(f"{n_skip} doc(s) already converted (skipped). {len(todo)} doc(s) still to convert.")
    if not todo:
        print("All govaudit docs already converted.")
        return 0

    print("Loading Docling models (non-OCR converter)...")
    converter_plain = build_converter(ocr=False)
    converter_ocr = None

    start = time.time()
    n_ok = n_fail = n_ocr = n_quarantined = 0
    for source_group, name, pdf_path, doc_id in todo:
        if time.time() - start > args.budget_seconds:
            print(f"Budget {args.budget_seconds}s reached; stopping. Re-run to continue.")
            break

        md_path = os.path.join(MD_DIR, doc_id + ".md")
        json_path = os.path.join(JSON_DIR, doc_id + ".json")
        headers_path = os.path.join(HEADERS_DIR, doc_id + ".headers.txt")
        if os.path.exists(md_path) and os.path.exists(json_path):
            continue  # another (concurrent) parser got to it since gather_todo

        needs_ocr = False
        triage_err = None
        try:
            needs_ocr, n_pages, frac_thin = triage_needs_ocr(pdf_path)
        except Exception as ex:  # noqa: BLE001
            triage_err = f"{type(ex).__name__}: {ex}"
            n_pages, frac_thin = None, None

        if needs_ocr and converter_ocr is None:
            print("Loading Docling OCR converter (OcrMacOptions)...")
            converter_ocr = build_converter(ocr=True)

        converter = converter_ocr if needs_ocr else converter_plain

        secs = md_len = None
        err = None
        for attempt in range(3):
            try:
                secs, md_len = convert_one(converter, pdf_path, md_path, json_path, headers_path)
                err = None
                break
            except Exception as ex:  # noqa: BLE001
                err = f"{type(ex).__name__}: {ex}"
                print(f"  attempt {attempt + 1} failed for {doc_id}: {err}")

        entry = {
            "source_group": source_group, "src_filename": name,
            "ocr_used": bool(needs_ocr), "triage_error": triage_err,
        }
        if n_pages is not None:
            entry["triage_n_pages"] = n_pages
            entry["triage_frac_thin_pages"] = round(frac_thin, 3)

        if err is None:
            entry["seconds"] = round(secs, 2)
            entry["md_chars"] = md_len
            if md_len < MIN_MD_CHARS:
                quarantine(doc_id, f"md too thin ({md_len} chars) -- likely scanned/redacted/withheld-stub")
                n_quarantined += 1
                print(f"THIN {doc_id}  {md_len} chars -> quarantined")
            else:
                n_ok += 1
                if needs_ocr:
                    n_ocr += 1
                print(f"OK   {doc_id}  {secs:.1f}s  {md_len} chars{'  [OCR]' if needs_ocr else ''}")
        else:
            entry["error"] = err
            quarantine(doc_id, f"docling error: {err}")
            n_fail += 1
            n_quarantined += 1
            print(f"FAIL {doc_id}  {err}")

        log[doc_id] = entry
        save_log(log)

    print(f"\nBatch done: {n_ok} ok ({n_ocr} with OCR), {n_fail} docling failures, "
          f"{n_quarantined} quarantined this run.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
