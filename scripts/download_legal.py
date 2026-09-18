#!/usr/bin/env python3
"""LEGIBLE D41: download FTC/SEC cybersecurity enforcement complaints/orders.

Fixed target list (~15-25 docs, curated for substantive technical narrative --
see research/09-enrichment.md sec 3a): FTC data-security complaints (Drizly,
Chegg, CafePress, SkyMed, Zoom, Ring, Blackbaud, Marriott, Equifax, GoDaddy,
Global Tel*Link) + SEC cyber-disclosure complaints/orders (SolarWinds,
Pearson, First American, R.R. Donnelley, and the Oct-2024 SolarWinds-
downstream orders: Unisys, Avaya, Check Point, Mimecast).

Downloads each PDF to data/corpus/pdfs/legal/<doc_id>.pdf where doc_id is
ftc__<case-slug> / sec__<case-slug> (matches the corpus doc_id convention).

Manifest: data/corpus/downloads_legal.json -- one record per doc: doc_id,
source_org, doc_type, case_name, url, sha256, size, status, notes.

Politeness: 0.5-1.5s randomized delay between requests. User-Agent:
legible-research/0.1 (academic dataset project) -- ftc.gov accepts a plain
browser-style UA, but sec.gov's Akamai bot-detection blocks browser-spoofed
UAs on non-browser TLS fingerprints and instead wants a self-identifying UA
(consistent with SEC's documented fair-access guidance); this UA works for
both hosts (confirmed live). Exponential backoff on 429/403/5xx (up to 6
attempts, since sec.gov's per-minute rate threshold is stricter than
ftc.gov's and needs longer cooldowns than the CISA downloader's 4-attempt
default).

Resumable: a dest file already on disk (non-empty, %PDF magic) is skipped
and just reflected in the manifest. If a host persistently blocks (all
attempts exhausted), the doc is recorded with status="blocked" and the run
continues -- no evasion (rotating UAs/proxies, headless browser, etc.).
"""
import hashlib
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS = os.path.join(ROOT, "data", "corpus")
PDF_DIR = os.path.join(CORPUS, "pdfs", "legal")
MANIFEST_JSON = os.path.join(CORPUS, "downloads_legal.json")
LOG_PATH = os.path.join(CORPUS, "logs", "legal_download.log")

# SEC fair-access policy requires a declared contact in the UA (www.sec.gov/os/webmaster-faq)
USER_AGENT = "legible-research/0.1 (academic dataset project; marcelomorenoscholar@gmail.com)"
MIN_DELAY = 0.5
MAX_DELAY = 1.5
MAX_ATTEMPTS = 6

# (doc_id, source_org, doc_type, case_name, url, notes)
TARGETS = [
    # --- FTC data-security complaints ---
    ("ftc__drizly", "ftc", "ftc_complaint", "Drizly, LLC (In the Matter of)",
     "https://www.ftc.gov/system/files/ftc_gov/pdf/202-3185-Drizly-Complaint.pdf",
     "FTC Part 3 administrative complaint, File No. 202 3185 (2022/2023)"),
    ("ftc__chegg", "ftc", "ftc_complaint", "Chegg, Inc. (In the Matter of)",
     "https://www.ftc.gov/system/files/ftc_gov/pdf/2023151-Chegg-Complaint.pdf",
     "FTC Part 3 administrative complaint, File No. 2023151, data-security matter (2022) -- distinct from the unrelated 2025 cancellation-practices case"),
    ("ftc__cafepress", "ftc", "ftc_complaint", "CafePress / Residual Pumpkin Entity, LLC",
     "https://www.ftc.gov/system/files/ftc_gov/pdf/1923209CafePressComplaint.pdf",
     "Federal district court complaint, File No. 1923209 (2022)"),
    ("ftc__skymed", "ftc", "ftc_complaint", "SkyMed International, Inc. (In the Matter of)",
     "https://www.ftc.gov/system/files/documents/cases/c-4732_skymed_final_complaint.pdf",
     "FTC Part 3 administrative complaint, File No. 1923140 (2021)"),
    ("ftc__zoom", "ftc", "ftc_complaint", "Zoom Video Communications, Inc. (In the Matter of)",
     "https://www.ftc.gov/system/files/documents/cases/1923167zoomcomplaint.pdf",
     "FTC Part 3 administrative complaint, File No. 1923167 (2020)"),
    ("ftc__ring", "ftc", "ftc_complaint", "Ring LLC",
     "https://www.ftc.gov/system/files/ftc_gov/pdf/complaint_ring.pdf",
     "Federal district court complaint, File No. 2023113 (2023)"),
    ("ftc__blackbaud", "ftc", "ftc_complaint", "Blackbaud, Inc. (In the Matter of)",
     "https://www.ftc.gov/system/files/ftc_gov/pdf/Blackbaud-Complaint.pdf",
     "FTC Part 3 administrative complaint, File No. 2023181 (2024)"),
    ("ftc__marriott", "ftc", "ftc_complaint", "Marriott International, Inc. and Starwood Hotels & Resorts Worldwide, LLC (In the Matter of)",
     "https://www.ftc.gov/system/files/ftc_gov/pdf/1923022marriottcomplaint.pdf",
     "FTC Part 3 administrative complaint, File No. 1923022 (2024)"),
    ("ftc__equifax", "ftc", "ftc_complaint", "Equifax, Inc.",
     "https://www.ftc.gov/system/files/documents/cases/172_3203_equifax_complaint_7-22-19.pdf",
     "Federal district court complaint for permanent injunction, File No. 1723203 (2019)"),
    ("ftc__godaddy", "ftc", "ftc_complaint", "GoDaddy Inc., et al. (In the Matter of)",
     "https://www.ftc.gov/system/files/ftc_gov/pdf/2023133_godaddy_complaint.pdf",
     "FTC Part 3 administrative complaint, File No. 2023133 (2023/2025)"),
    ("ftc__globaltellink", "ftc", "ftc_complaint", "Global Tel*Link Corporation (In the Matter of)",
     "https://www.ftc.gov/system/files/ftc_gov/pdf/Complaint-GlobalTelLinkCorp.pdf",
     "FTC Part 3 administrative complaint, File No. 2123012 (2023)"),
    # --- SEC cyber-disclosure complaints/orders ---
    ("sec__solarwinds", "sec", "sec_complaint", "SEC v. SolarWinds Corp. and Timothy G. Brown",
     "https://www.sec.gov/files/litigation/complaints/2023/comp-pr2023-227.pdf",
     "Case largely dismissed 2024-25 (SDNY dismissed most claims Jul-2024; SEC and remaining defendants stipulated to dismissal with prejudice per LR-26423, Nov-2025) -- flagged for provenance, included per D41"),
    ("sec__pearson", "sec", "sec_admin_order", "Pearson plc (In the Matter of)",
     "https://www.sec.gov/files/litigation/admin/2021/33-10963.pdf",
     "SEC administrative cease-and-desist order, Release No. 33-10963 (Aug 2021)"),
    ("sec__first-american", "sec", "sec_admin_order", "First American Financial Corporation (In the Matter of)",
     "https://www.sec.gov/files/litigation/admin/2021/34-92176.pdf",
     "SEC administrative cease-and-desist order, Release No. 34-92176 (Jun 2021)"),
    ("sec__rr-donnelley", "sec", "sec_admin_order", "R.R. Donnelley & Sons Co. (In the Matter of)",
     "https://www.sec.gov/files/litigation/admin/2024/34-100365.pdf",
     "SEC administrative cease-and-desist order, Release No. 34-100365 (Jun 2024)"),
    ("sec__unisys", "sec", "sec_admin_order", "Unisys Corp. (In the Matter of)",
     "https://www.sec.gov/files/litigation/admin/2024/33-11323.pdf",
     "SolarWinds-downstream order, Release No. 33-11323 (Oct 2024)"),
    ("sec__avaya", "sec", "sec_admin_order", "Avaya Holdings Corp. (In the Matter of)",
     "https://www.sec.gov/files/litigation/admin/2024/33-11320.pdf",
     "SolarWinds-downstream order, Release No. 33-11320 (Oct 2024)"),
    ("sec__check-point", "sec", "sec_admin_order", "Check Point Software Technologies Ltd (In the Matter of)",
     "https://www.sec.gov/files/litigation/admin/2024/33-11321.pdf",
     "SolarWinds-downstream order, Release No. 33-11321 (Oct 2024)"),
    ("sec__mimecast", "sec", "sec_admin_order", "Mimecast Limited (In the Matter of)",
     "https://www.sec.gov/files/litigation/admin/2024/33-11322.pdf",
     "SolarWinds-downstream order, Release No. 33-11322 (Oct 2024)"),
]


def log(msg):
    print(msg)
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    with open(LOG_PATH, "a") as f:
        f.write(msg + "\n")


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def polite_sleep():
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))


def fetch(url, max_attempts=MAX_ATTEMPTS):
    """GET url with exponential backoff on 429/403/5xx. Returns (status, body_bytes_or_None, err)."""
    delay = 2.0
    last_err = None
    for attempt in range(max_attempts):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, r.read(), None
        except urllib.error.HTTPError as ex:
            last_err = f"HTTP {ex.code}"
            if ex.code in (429, 403) or 500 <= ex.code < 600:
                log(f"  attempt {attempt + 1}/{max_attempts}: {last_err}, backing off {delay:.0f}s")
                time.sleep(delay)
                delay *= 2
                continue
            return ex.code, None, last_err
        except Exception as ex:  # noqa: BLE001
            last_err = f"{type(ex).__name__}: {ex}"
            log(f"  attempt {attempt + 1}/{max_attempts}: {last_err}, backing off {delay:.0f}s")
            time.sleep(delay)
            delay *= 2
    return None, None, last_err


def load_manifest():
    if os.path.exists(MANIFEST_JSON):
        with open(MANIFEST_JSON) as f:
            return {e["doc_id"]: e for e in json.load(f)}
    return {}


def save_manifest(entries_by_id):
    ordered = [entries_by_id[t[0]] for t in TARGETS if t[0] in entries_by_id]
    with open(MANIFEST_JSON, "w") as f:
        json.dump(ordered, f, indent=2)


def already_ok(dest):
    if not os.path.exists(dest) or os.path.getsize(dest) < 10 * 1024:
        return False
    with open(dest, "rb") as f:
        return f.read(5) == b"%PDF-"


def main():
    os.makedirs(PDF_DIR, exist_ok=True)
    manifest = load_manifest()

    n_ok, n_skip, n_blocked = 0, 0, 0
    for doc_id, source_org, doc_type, case_name, url, notes in TARGETS:
        dest = os.path.join(PDF_DIR, f"{doc_id}.pdf")
        if already_ok(dest):
            log(f"SKIP (already on disk): {doc_id}")
            manifest[doc_id] = {
                "doc_id": doc_id, "source_org": source_org, "doc_type": doc_type,
                "case_name": case_name, "url": url,
                "sha256": sha256_of(dest), "size": os.path.getsize(dest),
                "status": "ok", "notes": notes,
            }
            n_skip += 1
            continue

        log(f"GET {doc_id}: {url}")
        status, body, err = fetch(url)
        if status == 200 and body and body[:5] == b"%PDF-":
            with open(dest, "wb") as f:
                f.write(body)
            manifest[doc_id] = {
                "doc_id": doc_id, "source_org": source_org, "doc_type": doc_type,
                "case_name": case_name, "url": url,
                "sha256": sha256_of(dest), "size": len(body),
                "status": "ok", "notes": notes,
            }
            log(f"  OK ({len(body)} bytes)")
            n_ok += 1
        else:
            reason = err or f"HTTP {status}, non-PDF or empty body"
            manifest[doc_id] = {
                "doc_id": doc_id, "source_org": source_org, "doc_type": doc_type,
                "case_name": case_name, "url": url,
                "sha256": None, "size": 0,
                "status": "blocked", "notes": f"{notes}; DOWNLOAD FAILED: {reason}",
            }
            log(f"  BLOCKED: {reason}")
            n_blocked += 1
        save_manifest(manifest)
        polite_sleep()

    log(f"\nDone. ok={n_ok} skipped={n_skip} blocked={n_blocked} total={len(TARGETS)}")
    save_manifest(manifest)


if __name__ == "__main__":
    sys.exit(main())
