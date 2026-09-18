#!/usr/bin/env python3
"""LEGIBLE P1 Task C: parse all TOB PDFs with Docling.

Adapts scripts/calibrate_parse.py's conversion pipeline (do_table_structure=True,
TableFormer ACCURATE, OCR off) to the full data/corpus/pdfs/tob/ corpus.
Outputs -> data/corpus/out/{md,json,headers}/. The 20 PDFs shared with the P0
calibration set are not re-parsed -- their existing calibration outputs are
copied over verbatim.

Resumable: a doc whose md+json already exist is skipped. Run in wall-clock
budgeted batches (--budget-seconds) under caffeinate until every doc is done.
A doc that crashes Docling is retried at most twice, then logged in
data/corpus/parse_log.json under an "error" key and skipped.

Does NOT touch CISA HTML -- HTML needs no PDF parsing.
"""
import argparse
import json
import os
import re
import shutil
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS = os.path.join(ROOT, "data", "corpus")
PDF_DIR = os.path.join(CORPUS, "pdfs", "tob")
MD_DIR = os.path.join(CORPUS, "out", "md")
JSON_DIR = os.path.join(CORPUS, "out", "json")
HEADERS_DIR = os.path.join(CORPUS, "out", "headers")
DOWNLOADS_JSON = os.path.join(CORPUS, "downloads_tob.json")
PARSE_LOG_JSON = os.path.join(CORPUS, "parse_log.json")

CAL = os.path.join(ROOT, "data", "calibration")
CAL_DOWNLOADS_JSON = os.path.join(CAL, "downloads.json")
CAL_MD_DIR = os.path.join(CAL, "out", "md")
CAL_JSON_DIR = os.path.join(CAL, "out", "json")
CAL_HEADERS_DIR = os.path.join(CAL, "out", "headers")


def stem(filename):
    return os.path.splitext(filename)[0]


def load_entries():
    with open(DOWNLOADS_JSON) as f:
        return json.load(f)


def calibration_tob_stems():
    if not os.path.exists(CAL_DOWNLOADS_JSON):
        return set()
    with open(CAL_DOWNLOADS_JSON) as f:
        cal = json.load(f)
    return {stem(e["filename"]) for e in cal if e.get("source_group") == "tob"}


def load_log():
    if os.path.exists(PARSE_LOG_JSON):
        with open(PARSE_LOG_JSON) as f:
            return json.load(f)
    return {}


def save_log(log):
    with open(PARSE_LOG_JSON, "w") as f:
        json.dump(log, f, indent=2)


def build_converter():
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import (
        PdfPipelineOptions, TableFormerMode,
    )
    from docling.document_converter import DocumentConverter, PdfFormatOption

    opts = PdfPipelineOptions()
    opts.do_ocr = False
    opts.do_table_structure = True
    opts.table_structure_options.mode = TableFormerMode.ACCURATE
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


def copy_calibration_outputs(name):
    """Copy md/json/headers for a calibration-shared filename. Returns True if copied."""
    s = stem(name)
    src_md = os.path.join(CAL_MD_DIR, s + ".md")
    src_json = os.path.join(CAL_JSON_DIR, s + ".json")
    src_headers = os.path.join(CAL_HEADERS_DIR, s + ".headers.txt")
    dst_md = os.path.join(MD_DIR, s + ".md")
    dst_json = os.path.join(JSON_DIR, s + ".json")
    dst_headers = os.path.join(HEADERS_DIR, s + ".headers.txt")
    if not (os.path.exists(src_md) and os.path.exists(src_json)):
        return False
    shutil.copyfile(src_md, dst_md)
    shutil.copyfile(src_json, dst_json)
    if os.path.exists(src_headers):
        shutil.copyfile(src_headers, dst_headers)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget-seconds", type=int, default=350)
    args = ap.parse_args()

    for d in (MD_DIR, JSON_DIR, HEADERS_DIR):
        os.makedirs(d, exist_ok=True)

    entries = load_entries()
    cal_stems = calibration_tob_stems()
    log = load_log()

    todo = []
    n_copied = 0
    for e in entries:
        name = e["filename"]
        s = stem(name)
        md_path = os.path.join(MD_DIR, s + ".md")
        json_path = os.path.join(JSON_DIR, s + ".json")
        if os.path.exists(md_path) and os.path.exists(json_path):
            continue
        if s in cal_stems and copy_calibration_outputs(name):
            log[name] = {"seconds": None, "source": "calibration_copy"}
            n_copied += 1
            continue
        todo.append((e, md_path, json_path))

    save_log(log)
    print(f"{n_copied} doc(s) copied from calibration outputs.")
    if not todo:
        print("All docs already converted.")
        return 0

    print(f"{len(todo)} doc(s) still to convert. Loading Docling models...")
    converter = build_converter()
    start = time.time()
    n_ok = n_fail = 0
    for e, md_path, json_path in todo:
        if time.time() - start > args.budget_seconds:
            print(f"Budget {args.budget_seconds}s reached; stopping. Re-run to continue.")
            break
        name = e["filename"]
        pdf_path = os.path.join(PDF_DIR, name)
        s = stem(name)
        headers_path = os.path.join(HEADERS_DIR, s + ".headers.txt")
        secs = None
        err = None
        for attempt in range(3):  # initial + up to 2 retries
            try:
                secs = convert_one(converter, pdf_path, md_path, json_path, headers_path)
                err = None
                break
            except Exception as ex:  # noqa: BLE001
                err = f"{type(ex).__name__}: {ex}"
                print(f"  attempt {attempt+1} failed for {name}: {err}")
        if err is None:
            log[name] = {"seconds": round(secs, 2), "source": "parsed"}
            n_ok += 1
            print(f"OK   {name}  {secs:.1f}s")
        else:
            log[name] = {"error": err, "source": "parsed"}
            n_fail += 1
            print(f"FAIL {name}  {err}")
        save_log(log)

    print(f"\nBatch done: {n_ok} ok, {n_fail} failed this run.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
