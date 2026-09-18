#!/usr/bin/env python3
"""LEGIBLE P1 Task B: download CISA advisory HTML (CSA series + ICS series).

CSA series: paginate
  https://www.cisa.gov/news-events/cybersecurity-advisories?f[0]=advisory_type:94&page=N
extracting hrefs matching /news-events/cybersecurity-advisories/<id>, until an
empty page is hit. Download each advisory page's HTML to
data/corpus/html/cisa_csa/<id>.html.

ICS series: paginate https://www.cisa.gov/news-events/ics-advisories?page=N the
same way (site lists most-recent-first already), stopping once 1000 advisories
have been downloaded to data/corpus/html/cisa_ics/.

Manifest: data/corpus/downloads_cisa_<series>.json, one record per advisory:
id, url, sha256, status, http_status (listing pages recorded separately).

Politeness: 0.5-1s delay between requests, custom User-Agent, exponential
backoff on 429/403/5xx (up to 4 attempts). If blocked persistently on a
sub-task, stop that sub-task, record the error pattern, and continue with the
rest -- do not evade blocking.

Resumable: already-downloaded + non-empty advisory HTML files are skipped;
listing pages already fetched (recorded in the page-cache) are not re-fetched.
"""
import argparse
import hashlib
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS = os.path.join(ROOT, "data", "corpus")
HTML_ROOT = os.path.join(CORPUS, "html")
LOG_DIR = os.path.join(CORPUS, "logs")

USER_AGENT = "legible-research/0.1 (academic dataset project)"
MIN_DELAY = 0.5
MAX_DELAY = 1.0

CSA_LISTING = "https://www.cisa.gov/news-events/cybersecurity-advisories?f%5B0%5D=advisory_type%3A94&page={page}"
CSA_HREF_RX = re.compile(r'href="(/news-events/cybersecurity-advisories/(aa\d\d-[a-z0-9\-]+))"', re.I)
CSA_DETAIL = "https://www.cisa.gov{path}"

ICS_LISTING = "https://www.cisa.gov/news-events/ics-advisories?page={page}"
ICS_HREF_RX = re.compile(r'href="(/news-events/ics-advisories/(icsa-[a-z0-9\-]+))"', re.I)
ICS_DETAIL = "https://www.cisa.gov{path}"

ICS_CAP = 1000


def polite_sleep():
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))


def fetch(url, max_attempts=5):
    """GET url with exponential backoff on 429/403/5xx. Returns (status, body_bytes_or_None, err)."""
    delay = 1.0
    last_err = None
    for attempt in range(max_attempts):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, r.read(), None
        except urllib.error.HTTPError as ex:
            last_err = f"HTTP {ex.code}"
            if ex.code in (429, 403) or 500 <= ex.code < 600:
                time.sleep(delay)
                delay *= 2
                continue
            return ex.code, None, last_err
        except Exception as ex:  # noqa: BLE001
            last_err = f"{type(ex).__name__}: {ex}"
            time.sleep(delay)
            delay *= 2
    return None, None, last_err


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def load_manifest(path):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return []


def save_manifest(path, records):
    with open(path, "w") as f:
        json.dump(records, f, indent=2)


def download_series(series_name, listing_tpl, href_rx, out_dir, manifest_path,
                     cap=None, log_path=None, budget_seconds=None, start_page=0):
    os.makedirs(out_dir, exist_ok=True)
    records = load_manifest(manifest_path)
    seen_ids = {r["id"] for r in records if r.get("status", "").startswith(("ok", "cached"))}
    log_lines = []

    def log(msg):
        print(msg)
        log_lines.append(msg)

    t_start = time.time()
    page = start_page
    blocked_streak = 0
    total_downloaded = len(seen_ids)
    listing_block_error = None
    budget_hit = False

    while True:
        if cap is not None and total_downloaded >= cap:
            log(f"[{series_name}] cap of {cap} reached, stopping pagination.")
            break
        if budget_seconds is not None and time.time() - t_start > budget_seconds:
            log(f"[{series_name}] budget {budget_seconds}s reached at page {page}; "
                f"stopping. Re-run the same command to resume (already-downloaded "
                f"advisories are skipped).")
            budget_hit = True
            break

        url = listing_tpl.format(page=page)
        status, body, err = fetch(url)
        polite_sleep()
        if body is None:
            blocked_streak += 1
            log(f"[{series_name}] listing page {page} FAILED: status={status} err={err}")
            if blocked_streak >= 3:
                listing_block_error = f"listing blocked at page {page}: status={status} err={err}"
                log(f"[{series_name}] blocked_streak={blocked_streak}, stopping this sub-task.")
                break
            page += 1
            continue
        blocked_streak = 0
        text = body.decode("utf-8", errors="replace")
        matches = href_rx.findall(text)
        ids_this_page = []
        for path, aid in matches:
            aid = aid.lower()
            if aid not in ids_this_page:
                ids_this_page.append(aid)
        if not ids_this_page:
            log(f"[{series_name}] listing page {page} empty, end of listing.")
            break

        for aid in ids_this_page:
            if cap is not None and total_downloaded >= cap:
                break
            if budget_seconds is not None and time.time() - t_start > budget_seconds:
                budget_hit = True
                break
            full_path = next(p for p, a in matches if a.lower() == aid)
            detail_url = "https://www.cisa.gov" + full_path
            dest = os.path.join(out_dir, aid + ".html")
            if os.path.exists(dest) and os.path.getsize(dest) > 500:
                if aid not in seen_ids:
                    with open(dest, "rb") as f:
                        b = f.read()
                    records.append({"id": aid, "url": detail_url,
                                     "status": "cached", "sha256": sha256_bytes(b),
                                     "size": len(b)})
                    seen_ids.add(aid)
                    total_downloaded += 1
                continue
            d_status, d_body, d_err = fetch(detail_url)
            polite_sleep()
            if d_body is None:
                records.append({"id": aid, "url": detail_url, "status": f"ERROR {d_err}",
                                 "sha256": None, "size": None})
                log(f"[{series_name}] FAIL {aid}: {d_err}")
                continue
            with open(dest, "wb") as f:
                f.write(d_body)
            records.append({"id": aid, "url": detail_url, "status": "ok",
                             "sha256": sha256_bytes(d_body), "size": len(d_body)})
            seen_ids.add(aid)
            total_downloaded += 1
            log(f"[{series_name}] OK {aid} ({len(d_body)} B) [{total_downloaded}"
                + (f"/{cap}]" if cap else "]"))
            save_manifest(manifest_path, records)

        if budget_hit:
            break
        page += 1

    if listing_block_error:
        records.append({"id": None, "url": listing_tpl.format(page=page),
                         "status": f"BLOCKED {listing_block_error}", "sha256": None, "size": None})

    save_manifest(manifest_path, records)
    if log_path:
        with open(log_path, "a") as f:
            f.write("\n".join(log_lines) + "\n")
    n_ok = sum(1 for r in records if r.get("status", "").startswith(("ok", "cached")))
    log(f"[{series_name}] done: {n_ok} advisories downloaded -> {out_dir}")
    return n_ok, listing_block_error


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--series", choices=["csa", "ics", "both"], default="both")
    ap.add_argument("--budget-seconds", type=int, default=None,
                     help="stop each sub-task after this many wall-clock seconds; rerun to resume")
    args = ap.parse_args()
    os.makedirs(LOG_DIR, exist_ok=True)

    if args.series in ("csa", "both"):
        download_series(
            "csa", CSA_LISTING, CSA_HREF_RX,
            os.path.join(HTML_ROOT, "cisa_csa"),
            os.path.join(CORPUS, "downloads_cisa_csa.json"),
            cap=None,
            log_path=os.path.join(LOG_DIR, "download_cisa_csa.log"),
            budget_seconds=args.budget_seconds,
        )
    if args.series in ("ics", "both"):
        download_series(
            "ics", ICS_LISTING, ICS_HREF_RX,
            os.path.join(HTML_ROOT, "cisa_ics"),
            os.path.join(CORPUS, "downloads_cisa_ics.json"),
            cap=ICS_CAP,
            log_path=os.path.join(LOG_DIR, "download_cisa_ics.log"),
            budget_seconds=args.budget_seconds,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
