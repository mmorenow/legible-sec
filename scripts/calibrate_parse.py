#!/usr/bin/env python3
"""LEGIBLE P0 calibration: triage + Docling conversion + raw-stats manifest.

Pipeline per PDF:
  1. Triage with pypdfium2   -> page count, text-layer chars, chars/page.
  2. Convert with Docling    -> markdown (out/md) + lossless JSON (out/json),
                                do_table_structure=True, TableFormer ACCURATE,
                                OCR off. Wall-clock seconds recorded.
  3. Raw stats               -> data/calibration/manifest.csv (one row / PDF)
                                + out/headers/<name>.headers.txt (full ordered
                                section-header list).

Resumable: a doc whose md+json already exist is not re-converted. Run in
batches with --budget-seconds so no single invocation runs too long; loop the
command until every doc is converted. A doc that crashes Docling is retried at
most twice, then logged in the manifest `error` column and skipped.

This script performs NO judgment / thresholding / pair-counting -- raw stats
only, per the P0 spec.
"""
import argparse
import csv
import json
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAL = os.path.join(ROOT, "data", "calibration")
PDF_DIR = os.path.join(CAL, "pdfs")
MD_DIR = os.path.join(CAL, "out", "md")
JSON_DIR = os.path.join(CAL, "out", "json")
HEADERS_DIR = os.path.join(CAL, "out", "headers")
DOWNLOADS_JSON = os.path.join(CAL, "downloads.json")
TIMES_JSON = os.path.join(CAL, "out", "times.json")
MANIFEST_CSV = os.path.join(CAL, "manifest.csv")

EXEC_RE = re.compile(r"(?i)(executive|management)\s+summary")
FIND_RE = re.compile(r"(?i)(detailed\s+)?(findings|vulnerabilit|identified)")
HEADING_RE = re.compile(r"^#{1,6}\s+(.*\S)\s*$", re.MULTILINE)

MANIFEST_COLUMNS = [
    "source_group", "firm", "filename", "url", "sha256", "file_size_bytes",
    "n_pages", "triage_chars_per_page", "docling_seconds", "md_chars",
    "n_section_headers", "section_header_texts_sample",
    "has_exec_summary_heading", "has_findings_heading", "n_tables", "error",
]


def stem(filename):
    return os.path.splitext(filename)[0]


def load_downloads():
    with open(DOWNLOADS_JSON) as f:
        return json.load(f)


def load_times():
    if os.path.exists(TIMES_JSON):
        with open(TIMES_JSON) as f:
            return json.load(f)
    return {}


def save_times(times):
    with open(TIMES_JSON, "w") as f:
        json.dump(times, f, indent=2)


def triage(pdf_path):
    """Return (n_pages, total_text_chars) using pypdfium2 text layer."""
    import pypdfium2 as pdfium
    pdf = pdfium.PdfDocument(pdf_path)
    try:
        n_pages = len(pdf)
        total = 0
        for i in range(n_pages):
            page = pdf[i]
            tp = page.get_textpage()
            try:
                total += len(tp.get_text_range())
            finally:
                tp.close()
                page.close()
        return n_pages, total
    finally:
        pdf.close()


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


def convert_one(converter, pdf_path, md_path, json_path):
    """Convert a single PDF, writing md + json. Returns wall-clock seconds."""
    t0 = time.time()
    result = converter.convert(pdf_path)
    doc = result.document
    md = doc.export_to_markdown()
    d = doc.export_to_dict()
    with open(md_path, "w") as f:
        f.write(md)
    with open(json_path, "w") as f:
        json.dump(d, f)
    return time.time() - t0


def convert_all(entries, budget_seconds):
    """Convert docs missing outputs, honoring a wall-clock budget. Resumable."""
    times = load_times()
    todo = []
    for e in entries:
        name = e["filename"]
        md_path = os.path.join(MD_DIR, stem(name) + ".md")
        json_path = os.path.join(JSON_DIR, stem(name) + ".json")
        if os.path.exists(md_path) and os.path.exists(json_path):
            continue
        todo.append((e, md_path, json_path))

    if not todo:
        print("All docs already converted.")
        return

    print(f"{len(todo)} doc(s) still to convert. Loading Docling models...")
    converter = build_converter()
    start = time.time()
    for e, md_path, json_path in todo:
        if time.time() - start > budget_seconds:
            print(f"Budget {budget_seconds}s reached; stopping. Re-run to continue.")
            break
        name = e["filename"]
        pdf_path = os.path.join(PDF_DIR, e["subdir"], name)
        secs = None
        err = None
        for attempt in range(3):  # initial + up to 2 retries
            try:
                secs = convert_one(converter, pdf_path, md_path, json_path)
                err = None
                break
            except Exception as ex:  # noqa: BLE001
                err = f"{type(ex).__name__}: {ex}"
                print(f"  attempt {attempt+1} failed for {name}: {err}")
        if err is None:
            times[name] = round(secs, 2)
            save_times(times)
            print(f"OK   {name}  {secs:.1f}s")
        else:
            times[name] = {"error": err}
            save_times(times)
            print(f"FAIL {name}  {err}")


def stats_for_doc(json_path, md_path):
    """Compute raw stats from a converted doc's JSON + markdown."""
    with open(json_path) as f:
        d = json.load(f)
    headers = []
    for t in d.get("texts", []):
        label = str(t.get("label", "")).lower()
        if label == "section_header":
            headers.append((t.get("text") or "").replace("\n", " ").strip())
    n_tables = len(d.get("tables", []))

    md = open(md_path).read()
    md_chars = len(md)
    md_headings = [m.group(1).strip() for m in HEADING_RE.finditer(md)]
    has_exec = any(EXEC_RE.search(h) for h in md_headings)
    has_find = any(FIND_RE.search(h) for h in md_headings)
    return {
        "headers": headers,
        "n_section_headers": len(headers),
        "n_tables": n_tables,
        "md_chars": md_chars,
        "has_exec_summary_heading": has_exec,
        "has_findings_heading": has_find,
    }


def write_manifest(entries):
    times = load_times()
    rows = []
    for e in entries:
        name = e["filename"]
        md_path = os.path.join(MD_DIR, stem(name) + ".md")
        json_path = os.path.join(JSON_DIR, stem(name) + ".json")

        n_pages = ""
        chars_per_page = ""
        pdf_path = os.path.join(PDF_DIR, e["subdir"], name)
        try:
            np_, total = triage(pdf_path)
            n_pages = np_
            chars_per_page = round(total / np_, 1) if np_ else 0
        except Exception as ex:  # noqa: BLE001
            chars_per_page = ""
            triage_err = f"triage:{type(ex).__name__}"
        else:
            triage_err = ""

        row = {
            "source_group": e["source_group"], "firm": e["firm"],
            "filename": name, "url": e["url"], "sha256": e.get("sha256", ""),
            "file_size_bytes": e.get("file_size_bytes", ""),
            "n_pages": n_pages, "triage_chars_per_page": chars_per_page,
            "docling_seconds": "", "md_chars": "", "n_section_headers": "",
            "section_header_texts_sample": "", "has_exec_summary_heading": "",
            "has_findings_heading": "", "n_tables": "", "error": "",
        }

        t = times.get(name)
        conv_err = ""
        if isinstance(t, dict) and "error" in t:
            conv_err = t["error"]
        elif isinstance(t, (int, float)):
            row["docling_seconds"] = t

        if os.path.exists(md_path) and os.path.exists(json_path):
            try:
                s = stats_for_doc(json_path, md_path)
                row["md_chars"] = s["md_chars"]
                row["n_section_headers"] = s["n_section_headers"]
                row["section_header_texts_sample"] = " | ".join(s["headers"][:15])
                row["has_exec_summary_heading"] = s["has_exec_summary_heading"]
                row["has_findings_heading"] = s["has_findings_heading"]
                row["n_tables"] = s["n_tables"]
                # dump full ordered header list
                hp = os.path.join(HEADERS_DIR, stem(name) + ".headers.txt")
                with open(hp, "w") as f:
                    f.write("\n".join(s["headers"]))
            except Exception as ex:  # noqa: BLE001
                conv_err = conv_err or f"stats:{type(ex).__name__}: {ex}"
        elif not conv_err:
            conv_err = "not_converted"

        row["error"] = "; ".join(x for x in (triage_err, conv_err) if x)
        rows.append(row)

    with open(MANIFEST_CSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=MANIFEST_COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow(r)
    done = sum(1 for r in rows if r["md_chars"] != "")
    print(f"Manifest written: {done}/{len(rows)} converted. -> {MANIFEST_CSV}")
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget-seconds", type=int, default=420,
                    help="stop starting new conversions after this wall time")
    ap.add_argument("--manifest-only", action="store_true",
                    help="skip conversion, just (re)build the manifest")
    args = ap.parse_args()

    for d in (MD_DIR, JSON_DIR, HEADERS_DIR):
        os.makedirs(d, exist_ok=True)

    entries = load_downloads()
    if not args.manifest_only:
        convert_all(entries, args.budget_seconds)
    write_manifest(entries)
    return 0


if __name__ == "__main__":
    sys.exit(main())
