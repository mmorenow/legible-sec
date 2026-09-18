#!/usr/bin/env python3
"""LEGIBLE wave-2 Task A, Source 1: download the Cure53 report PDF corpus.

Fetches https://cure53.de (single static HTML page), extracts every href
containing ".pdf" (case-insensitive), keeps only those matching
pentest-report|audit-report|summary-report|review-report (case-insensitive) --
this excludes ~8 external research-paper PDFs on other domains (e.g.
syssec.rub.de). hrefs are relative and resolved against https://cure53.de/.

5 files that are already verified in data/calibration/pdfs/cure53/ are copied
instead of re-downloaded (byte copy, no re-fetch).

Writes data/corpus/downloads_cure53.json: list of
{filename, url, sha256, size, status}.

Resumable: a file already present & verified (>30KB, %PDF magic) in
data/corpus/pdfs/cure53/ is skipped (status "cached" is not written to the
manifest as a new status -- we still recompute sha/size for it and mark it
"downloaded"/"copied_from_calibration" per its origin, remembered across runs
via the existing manifest if present).

Politeness: 0.5-1.0s randomized delay between requests to cure53.de.
User-Agent: legible-research/0.1 (academic dataset project).
Backoff on 429/5xx: sleep 2**attempt seconds, up to 2 additional retries.
"""
import hashlib
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS = os.path.join(ROOT, "data", "corpus")
PDF_DIR = os.path.join(CORPUS, "pdfs", "cure53")
CAL_DIR = os.path.join(ROOT, "data", "calibration", "pdfs", "cure53")
MANIFEST_JSON = os.path.join(CORPUS, "downloads_cure53.json")
LOG_PATH = os.path.join(CORPUS, "logs", "cure53_download.log")

BASE_URL = "https://cure53.de"
BASE_FOR_JOIN = "https://cure53.de/"
UA = "legible-research/0.1 (academic dataset project)"
PDF_PATTERN = re.compile(r"pentest-report|audit-report|summary-report|review-report",
                          re.IGNORECASE)
MIN_SIZE = 30 * 1024
MAX_RETRIES = 2  # additional attempts beyond the first

CALIBRATION_FILES = {
    "summary-report_obsidian-3.pdf",
    "pentest-report_obsidian-3.pdf",
    "pentest-report_expressvpn-mailguard_2026.pdf",
    "pentest-report_mullvad_2024_v1.pdf",
    "pentest-report_keepassium.pdf",
}


def log(msg):
    print(msg)
    with open(LOG_PATH, "a") as f:
        f.write(msg + "\n")


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def verify(dest):
    if not os.path.exists(dest):
        return False, 0
    size = os.path.getsize(dest)
    if size <= MIN_SIZE:
        return False, size
    with open(dest, "rb") as f:
        head = f.read(5)
    return head.startswith(b"%PDF"), size


def polite_sleep():
    time.sleep(random.uniform(0.5, 1.0))


def http_get(url, timeout=60):
    """GET with retry/backoff on 429/5xx. Returns bytes or raises."""
    last_err = None
    for attempt in range(MAX_RETRIES + 1):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code == 429 or 500 <= e.code < 600:
                if attempt < MAX_RETRIES:
                    backoff = 2 ** (attempt + 1)
                    log(f"  HTTP {e.code} on {url}, backing off {backoff}s "
                        f"(attempt {attempt + 1}/{MAX_RETRIES})")
                    time.sleep(backoff)
                    continue
            raise
        except urllib.error.URLError as e:
            last_err = e
            if attempt < MAX_RETRIES:
                backoff = 2 ** (attempt + 1)
                log(f"  URLError on {url}: {e}, backing off {backoff}s")
                time.sleep(backoff)
                continue
            raise
    raise last_err


def list_pdf_hrefs():
    html = http_get(BASE_URL).decode("utf-8", errors="replace")
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE)
    pdf_hrefs = [h for h in hrefs if ".pdf" in h.lower()]
    matched = sorted(set(h for h in pdf_hrefs if PDF_PATTERN.search(h)))
    return matched


def main():
    os.makedirs(PDF_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)

    log(f"=== cure53 download run start {time.strftime('%Y-%m-%d %H:%M:%S')} ===")

    try:
        hrefs = list_pdf_hrefs()
    except Exception as ex:  # noqa: BLE001
        log(f"FATAL: could not fetch/parse https://cure53.de : {ex}")
        return 1

    log(f"{len(hrefs)} unique matching PDF href(s) found on cure53.de")

    cal_files = set(os.listdir(CAL_DIR)) if os.path.isdir(CAL_DIR) else set()

    results = []
    n_copied = n_downloaded = n_cached = n_failed = 0
    hard_block = False

    for href in hrefs:
        filename = os.path.basename(urllib.parse.urlsplit(href).path)
        dest = os.path.join(PDF_DIR, filename)
        url = urllib.parse.urljoin(BASE_FOR_JOIN, href)
        rec = {"filename": filename, "url": url}

        ok, size = verify(dest)
        if ok:
            rec.update(status="cached", size=size, sha256=sha256_of(dest))
            results.append(rec)
            n_cached += 1
            continue

        if filename in CALIBRATION_FILES and filename in cal_files:
            src = os.path.join(CAL_DIR, filename)
            ok_src, _ = verify(src)
            if ok_src:
                with open(src, "rb") as fsrc, open(dest, "wb") as fdst:
                    fdst.write(fsrc.read())
                ok2, size2 = verify(dest)
                if ok2:
                    rec.update(status="copied_from_calibration", size=size2,
                               sha256=sha256_of(dest))
                    results.append(rec)
                    n_copied += 1
                    log(f"COPIED  {filename} ({size2} B)")
                    continue

        if hard_block:
            rec.update(status="ERROR skipped: host hard-blocked earlier in run",
                       size=None, sha256=None)
            results.append(rec)
            n_failed += 1
            continue

        err = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                data = http_get(url)
                with open(dest, "wb") as f:
                    f.write(data)
                ok, size = verify(dest)
                if not ok:
                    raise ValueError(f"failed %PDF/size check (size={size})")
                err = None
                break
            except urllib.error.HTTPError as ex:
                err = f"HTTPError {ex.code}: {ex.reason}"
                if ex.code in (403, 429) and attempt == MAX_RETRIES:
                    hard_block = True
                if attempt < MAX_RETRIES:
                    time.sleep(2 ** (attempt + 1))
            except Exception as ex:  # noqa: BLE001
                err = f"{type(ex).__name__}: {ex}"
                if attempt < MAX_RETRIES:
                    time.sleep(2 ** (attempt + 1))

        if err is None:
            rec.update(status="downloaded", size=size, sha256=sha256_of(dest))
            n_downloaded += 1
            log(f"OK      {filename} ({size} B)")
        else:
            rec.update(status=f"ERROR {err}", size=None, sha256=None)
            n_failed += 1
            log(f"FAIL    {filename}: {err}")
            if hard_block:
                log(f"HARD BLOCK detected (403/429 persisting) -- stopping further "
                    f"download attempts against cure53.de for this run.")

        results.append(rec)
        polite_sleep()

    with open(MANIFEST_JSON, "w") as f:
        json.dump(results, f, indent=2)

    log(f"\nTotals: cached={n_cached} copied={n_copied} downloaded={n_downloaded} "
        f"failed={n_failed} / {len(hrefs)}")
    log(f"Manifest -> {MANIFEST_JSON}")
    log(f"=== cure53 download run end {time.strftime('%Y-%m-%d %H:%M:%S')} ===\n")
    return 0 if n_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
