#!/usr/bin/env python3
"""LEGIBLE wave-2 Task A, Source 3: download public-pentesting-reports PDFs.

Lists every PDF in juliocesarfort/public-pentesting-reports (default branch
master) via the git trees API (untruncated), excludes any path whose
top-level directory is exactly "TrailOfBits" or "Cure53" (already covered by
other sources / calibration), and downloads the rest from
raw.githubusercontent.com to data/corpus/pdfs/ppr/<firm>__<filename>.pdf.

Also copies the 5 PPR calibration PDFs from data/calibration/pdfs/ppr/ into
the same destination dir under the firm__filename convention (byte copy, no
re-fetch).

Writes data/corpus/downloads_ppr.json: list of
{firm, filename, dest_filename, url, sha256, size, status}.

Resumable: a dest file already verified on disk (>30KB, %PDF magic) is
skipped and just reflected in the manifest.

Politeness: 0.5-1.0s randomized delay between downloads (even though this is
raw.githubusercontent.com, per task brief). User-Agent: legible-research/0.1
(academic dataset project). Backoff 2**attempt seconds on 429/5xx, up to 2
retries.
"""
import hashlib
import json
import os
import random
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS = os.path.join(ROOT, "data", "corpus")
PDF_DIR = os.path.join(CORPUS, "pdfs", "ppr")
CAL_DIR = os.path.join(ROOT, "data", "calibration", "pdfs", "ppr")
CAL_DOWNLOADS_JSON = os.path.join(ROOT, "data", "calibration", "downloads.json")
MANIFEST_JSON = os.path.join(CORPUS, "downloads_ppr.json")
TREE_CACHE = os.path.join(CORPUS, "logs", "ppr_tree.json")
LOG_PATH = os.path.join(CORPUS, "logs", "ppr_download.log")

REPO = "juliocesarfort/public-pentesting-reports"
RAW_BASE = f"https://raw.githubusercontent.com/{REPO}/master/"
UA = "legible-research/0.1 (academic dataset project)"
EXCLUDED_TOP_DIRS = {"TrailOfBits", "Cure53"}
MIN_SIZE = 30 * 1024
MAX_RETRIES = 2


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


def http_get(url, timeout=120):
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


def get_tree(refresh=False):
    if not refresh and os.path.exists(TREE_CACHE):
        with open(TREE_CACHE) as f:
            return json.load(f)
    out = subprocess.run(
        ["gh", "api", f"repos/{REPO}/git/trees/master?recursive=1"],
        capture_output=True, text=True, check=True,
    )
    d = json.loads(out.stdout)
    if d.get("truncated"):
        log("WARNING: tree listing truncated by GitHub API!")
    os.makedirs(os.path.dirname(TREE_CACHE), exist_ok=True)
    with open(TREE_CACHE, "w") as f:
        json.dump(d, f)
    return d


def list_pdf_paths():
    d = get_tree()
    tree = d["tree"]
    paths = [t["path"] for t in tree if t["path"].lower().endswith(".pdf")]
    filtered = [p for p in paths if p.split("/")[0] not in EXCLUDED_TOP_DIRS]
    return sorted(filtered)


# firm/filename pairs for the 5 PPR calibration PDFs (per task brief, cross-
# checked against data/calibration/downloads.json entries with
# source_group == "ppr").
CALIBRATION_ENTRIES = [
    ("NCCGroup", "NCC-Group-Public-Report-VPN-by-Google-One-v1.0.pdf"),
    ("Bishop Fox", "C Plus Plus Alliance - Boost JSON Security Assessment 2020 - Assessment Report - 20210317.pdf"),
    ("Doyensec", "Doyensec_Apollo_Report_Q22022_v4_AfterRetest.pdf"),
    ("RadicallyOpenSecurity", "2017-Pentest-Ushahidi_crowdsource_mapping_tool-v1.0.pdf"),
    ("X41 D-Sec", "X41-ISC-BIND9-Code-Audit-Public-Report-2024-02-13.pdf"),
]


def verify_calibration_entries():
    """Cross-check CALIBRATION_ENTRIES against data/calibration/downloads.json."""
    if not os.path.exists(CAL_DOWNLOADS_JSON):
        log("WARNING: calibration downloads.json not found, cannot cross-check.")
        return
    with open(CAL_DOWNLOADS_JSON) as f:
        cal = json.load(f)
    ppr_entries = {(e["firm"], e["filename"]) for e in cal
                   if e.get("source_group") == "ppr"}
    for pair in CALIBRATION_ENTRIES:
        if pair not in ppr_entries:
            log(f"WARNING: calibration pair {pair} not found in "
                f"data/calibration/downloads.json ppr entries!")


def main():
    os.makedirs(PDF_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)

    log(f"=== ppr download run start {time.strftime('%Y-%m-%d %H:%M:%S')} ===")

    verify_calibration_entries()

    try:
        paths = list_pdf_paths()
    except Exception as ex:  # noqa: BLE001
        log(f"FATAL: could not fetch/parse repo tree: {ex}")
        return 1

    log(f"{len(paths)} PDF path(s) found in {REPO} (excluding "
        f"{sorted(EXCLUDED_TOP_DIRS)} top-level dirs); expect ~291.")

    results = []
    n_downloaded = n_copied = n_cached = n_failed = 0
    hard_block = False

    # --- calibration copies first ---
    for firm, filename in CALIBRATION_ENTRIES:
        dest_filename = f"{firm}__{filename}.pdf" if not filename.lower().endswith(".pdf") \
            else f"{firm}__{filename}"
        dest = os.path.join(PDF_DIR, dest_filename)
        src = os.path.join(CAL_DIR, filename)
        rec = {"firm": firm, "filename": filename, "dest_filename": dest_filename,
               "url": None}

        ok, size = verify(dest)
        if ok:
            rec.update(status="cached", size=size, sha256=sha256_of(dest))
            results.append(rec)
            n_cached += 1
            continue

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
                log(f"COPIED  {dest_filename} ({size2} B)")
                continue
        rec.update(status=f"ERROR calibration source missing/invalid: {src}",
                   size=None, sha256=None)
        results.append(rec)
        n_failed += 1
        log(f"FAIL    {dest_filename}: calibration source missing/invalid")

    # --- bulk repo downloads ---
    for i, path in enumerate(paths):
        firm = path.split("/")[0]
        filename = path.split("/")[-1]
        dest_filename = f"{firm}__{filename}"
        dest = os.path.join(PDF_DIR, dest_filename)
        url = RAW_BASE + urllib.parse.quote(path)
        rec = {"firm": firm, "filename": filename, "dest_filename": dest_filename,
               "url": url}

        ok, size = verify(dest)
        if ok:
            rec.update(status="cached", size=size, sha256=sha256_of(dest))
            results.append(rec)
            n_cached += 1
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
            if (i + 1) % 25 == 0:
                log(f"...{i + 1}/{len(paths)} processed")
        else:
            rec.update(status=f"ERROR {err}", size=None, sha256=None)
            n_failed += 1
            log(f"FAIL    {dest_filename}: {err}")
            if hard_block:
                log("HARD BLOCK detected -- stopping further raw.githubusercontent.com "
                    "download attempts for this run.")

        results.append(rec)
        polite_sleep()

    with open(MANIFEST_JSON, "w") as f:
        json.dump(results, f, indent=2)

    log(f"\nTotals: cached={n_cached} copied={n_copied} downloaded={n_downloaded} "
        f"failed={n_failed} / {len(paths) + len(CALIBRATION_ENTRIES)}")
    log(f"Manifest -> {MANIFEST_JSON}")
    log(f"=== ppr download run end {time.strftime('%Y-%m-%d %H:%M:%S')} ===\n")
    return 0 if n_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
