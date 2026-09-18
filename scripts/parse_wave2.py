#!/usr/bin/env python3
"""LEGIBLE wave-2 Task B: parse cure53 + ostif + ppr PDFs with Docling.

Same conversion options as scripts/parse_corpus.py (do_table_structure=True,
TableFormer ACCURATE, OCR off by default), EXCEPT: per-doc pypdfium2 triage
first -- if >30% of pages have <200 extracted text chars, OCR is enabled for
that doc (OcrMacOptions -- native macOS Vision framework, no extra deps) and
the doc is flagged ocr_used=true in the log.

Sources (each PDF dir already uses/needs a distinct output-name prefix):
  data/corpus/pdfs/cure53/<name>.pdf  -> cure53__<name>.{md,json,headers.txt}
  data/corpus/pdfs/ostif/<name>.pdf   -> ostif__<name>.{md,json,headers.txt}
  data/corpus/pdfs/ppr/<firm>__<name>.pdf -> ppr__<firm>__<name>.{md,json,headers.txt}

The 5 cure53 + 5 ppr calibration PDFs already live in data/corpus/pdfs/{cure53,ppr}/
(copied there by download_cure53.py / download_ppr.py) and are parsed here like
any other doc -- this deliberately reparses them so the wave-2 outputs carry
the cure53__/ppr__ prefix (their unprefixed data/calibration/out/ copies are
left untouched).

Resumable: a doc whose md+json already exist under its prefixed name is
skipped. Run in wall-clock budgeted batches (--budget-seconds) under
caffeinate until every doc is done. A doc that crashes Docling (both OCR and
non-OCR converters) is retried at most twice total, then logged in
data/corpus/parse_log_wave2.json under an "error" key and skipped.
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
PARSE_LOG_JSON = os.path.join(CORPUS, "parse_log_wave2.json")

SOURCES = [
    # (source_group, pdf_dir, prefix_fn(stem) -> (out_stem, firm))
    ("cure53", os.path.join(CORPUS, "pdfs", "cure53")),
    ("ostif", os.path.join(CORPUS, "pdfs", "ostif")),
    ("ppr", os.path.join(CORPUS, "pdfs", "ppr")),
]

OCR_PAGE_CHAR_THRESHOLD = 200
OCR_PAGE_FRACTION_THRESHOLD = 0.30


def stem(filename):
    return os.path.splitext(filename)[0]


def out_stem_and_firm(source_group, pdf_filename):
    s = stem(pdf_filename)
    if source_group == "cure53":
        return f"cure53__{s}", "Cure53"
    if source_group == "ostif":
        return f"ostif__{s}", "OSTIF"
    if source_group == "ppr":
        firm = s.split("__", 1)[0] if "__" in s else "unknown"
        return f"ppr__{s}", firm
    raise ValueError(source_group)


def load_log():
    if os.path.exists(PARSE_LOG_JSON):
        with open(PARSE_LOG_JSON) as f:
            return json.load(f)
    return {}


def save_log(log):
    with open(PARSE_LOG_JSON, "w") as f:
        json.dump(log, f, indent=2)


def triage_needs_ocr(pdf_path):
    """Return (needs_ocr, n_pages, frac_thin_pages)."""
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
    return time.time() - t0


def gather_todo(log):
    todo = []
    n_skip = 0
    for source_group, pdf_dir in SOURCES:
        if not os.path.isdir(pdf_dir):
            print(f"WARNING: missing dir {pdf_dir}, skipping source {source_group}")
            continue
        for name in sorted(os.listdir(pdf_dir)):
            if not name.lower().endswith(".pdf"):
                continue
            out_stem, firm = out_stem_and_firm(source_group, name)
            md_path = os.path.join(MD_DIR, out_stem + ".md")
            json_path = os.path.join(JSON_DIR, out_stem + ".json")
            if os.path.exists(md_path) and os.path.exists(json_path):
                n_skip += 1
                continue
            pdf_path = os.path.join(pdf_dir, name)
            todo.append((source_group, firm, name, pdf_path, out_stem))
    return todo, n_skip


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget-seconds", type=int, default=300)
    args = ap.parse_args()

    for d in (MD_DIR, JSON_DIR, HEADERS_DIR):
        os.makedirs(d, exist_ok=True)

    log = load_log()
    todo, n_skip = gather_todo(log)
    print(f"{n_skip} doc(s) already converted (skipped). {len(todo)} doc(s) still to convert.")
    if not todo:
        print("All wave-2 docs already converted.")
        return 0

    print("Loading Docling models (non-OCR converter)...")
    converter_plain = build_converter(ocr=False)
    converter_ocr = None  # lazy-built on first OCR need

    start = time.time()
    n_ok = n_fail = n_ocr = 0
    for source_group, firm, name, pdf_path, out_stem in todo:
        if time.time() - start > args.budget_seconds:
            print(f"Budget {args.budget_seconds}s reached; stopping. Re-run to continue.")
            break

        md_path = os.path.join(MD_DIR, out_stem + ".md")
        json_path = os.path.join(JSON_DIR, out_stem + ".json")
        headers_path = os.path.join(HEADERS_DIR, out_stem + ".headers.txt")

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

        secs = None
        err = None
        for attempt in range(3):  # initial + up to 2 retries
            try:
                secs = convert_one(converter, pdf_path, md_path, json_path, headers_path)
                err = None
                break
            except Exception as ex:  # noqa: BLE001
                err = f"{type(ex).__name__}: {ex}"
                print(f"  attempt {attempt + 1} failed for {out_stem}: {err}")

        entry = {
            "source_group": source_group, "firm": firm, "src_filename": name,
            "ocr_used": bool(needs_ocr), "triage_error": triage_err,
        }
        if n_pages is not None:
            entry["triage_n_pages"] = n_pages
            entry["triage_frac_thin_pages"] = round(frac_thin, 3)

        if err is None:
            entry["seconds"] = round(secs, 2)
            n_ok += 1
            if needs_ocr:
                n_ocr += 1
            print(f"OK   {out_stem}  {secs:.1f}s{'  [OCR]' if needs_ocr else ''}")
        else:
            entry["error"] = err
            n_fail += 1
            print(f"FAIL {out_stem}  {err}")

        log[out_stem] = entry
        save_log(log)

    print(f"\nBatch done: {n_ok} ok ({n_ocr} with OCR), {n_fail} failed this run.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
