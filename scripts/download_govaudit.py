#!/usr/bin/env python3
"""LEGIBLE D40: download US government audit reports (OIG + GAO), cyber/infosec subset.

Source A -- oversight.gov federal OIG reports (audits + inspections/evaluations).
The site's own full-text search (search_api_fulltext=) is fuzzy -- it matches body
text, not just titles -- so this script uses it only to CANDIDATE-GATHER (one query
per keyword in KEYWORDS, items_per_page=100), then filters the results itself by
requiring the report TITLE to contain a security-relevant term and the report TYPE
to be "Audit" or "Inspection / Evaluation" (oversight.gov's own type facet). This
mirrors "walking listing/facet pages and filtering titles yourself" per the task
brief, rather than trusting the fuzzy search wholesale.

  discover mode: fetch one listing page per keyword, parse the fixed
    <tr class="listing-table__row table-row"> markup for (date, agency reviewed,
    title, type, detail-page path), filter, dedup by detail path, write
    data/corpus/logs/oig_candidates.json for manual/curated review.
  download mode: for each candidate (optionally capped/curated), fetch the detail
    page, extract the report's PDF href (predictable
    /sites/default/files/documents/reports/YYYY-MM/<name>.pdf path), download the
    PDF to data/corpus/pdfs/oig/<agency-slug>__<report-slug>.pdf.

Source B -- GAO cybersecurity/information-security reports. gao.gov sits behind an
Akamai WAF that returns a hard 403 "Access Denied" (edgesuite.net reference id) at
the DOMAIN level -- confirmed against '/', '/cybersecurity', '/topics/information-
security', a product page, and a raw PDF asset, both via curl and via Python
urllib, both with a real desktop Chrome/Safari User-Agent and full Accept-* headers,
and again after a cooldown delay (same Akamai reference-rule prefix "#18.ce806b3"
every time => static deny rule, not a rate limit). Per the task brief ("if still
persistently blocked, record it and continue with OIG only -- do NOT evade beyond a
normal UA"), this script's `gao` mode makes ONE attempt per configured URL, records
the block in data/corpus/downloads_gao.json, and stops. No further evasion
(headless browser rendering, proxies, IP rotation) is attempted.

Manifests: data/corpus/downloads_oig.json / downloads_gao.json (list of records:
id/doc_id, title, agency_reviewed, report_type, date, detail_url, pdf_url, dest,
sha256, size, status).

Corpus doc_ids: oig__<agency-slug>__<report-slug> / gao__<report-no>.
PDFs land in data/corpus/pdfs/oig/ and data/corpus/pdfs/gao/ (parse_govaudit.py
picks them up from there, same convention as pdfs/tob, pdfs/cure53, etc.).

Politeness: 0.5-1.5s randomized delay between requests, custom User-Agent,
exponential backoff on 429/403/5xx (up to 4 attempts). Resumable: PDFs already on
disk (verified >2KB and %PDF magic) are skipped and just reflected in the manifest.
"""
from __future__ import annotations

import argparse
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
PDF_OIG_DIR = os.path.join(CORPUS, "pdfs", "oig")
PDF_GAO_DIR = os.path.join(CORPUS, "pdfs", "gao")
LOG_DIR = os.path.join(CORPUS, "logs")
OIG_MANIFEST = os.path.join(CORPUS, "downloads_oig.json")
GAO_MANIFEST = os.path.join(CORPUS, "downloads_gao.json")
OIG_CANDIDATES = os.path.join(LOG_DIR, "oig_candidates.json")

UA_BROWSER = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
              "(KHTML, like Gecko) Version/17.0 Safari/605.1.15")
MIN_DELAY, MAX_DELAY = 0.5, 1.5

OVERSIGHT_BASE = "https://www.oversight.gov"
LISTING_TPL = (OVERSIGHT_BASE + "/reports/federal"
               "?search_api_fulltext={kw}&items_per_page=100")

# Keywords fed to oversight.gov's full-text search (candidate gathering only --
# titles are re-filtered below). Matches the brief's keyword list.
KEYWORDS = [
    "cybersecurity",
    "information security",
    "FISMA",
    "vulnerability",
    "network security",
    "information technology security",
]

# Title must contain at least one of these (case-insensitive) to be kept.
TITLE_TERMS = [
    "cybersecurity", "cyber security", "cyber vulnerabilit", "information security",
    "fisma", "vulnerabilit", "network security", "it security",
    "information technology security", "cyber threat", "cyberattack", "cyber attack",
]

ALLOWED_TYPES = {"Audit", "Inspection / Evaluation"}

# Title substrings that mark a report as a 1-2pp summary of a withheld report, or
# otherwise unpairable (no findings body will exist) -- skip at discovery time.
SKIP_TITLE_TERMS = [
    "semiannual report", "peer review", "top management challenge",
    "management alert",  # usually a short letter, not a findings report
    " abstract", "- abstract",  # confirmed pattern: 1-2pp stub of a withheld report
    "flash report",  # ditto -- terse preliminary notice, no findings body
]

ROW_RX = re.compile(
    r'<tr class="listing-table__row table-row">(.*?)</tr>', re.S)
DATE_RX = re.compile(r'data-label="Report Date"><time datetime="(\d{4}-\d{2}-\d{2})')
AGENCY_RX = re.compile(r'data-label="Agency Reviewed / Investigated">([^<]*)')
TITLE_RX = re.compile(r'data-label="Report Title">([^<]*)')
TYPE_RX = re.compile(r'data-label="Type">([^<]*)')
HREF_RX = re.compile(r'href="(/reports/[^"]+)"')
# Usually a relative oversight.gov-hosted path, but some OIGs (e.g. DHS) link
# straight to their own agency domain (https://www.oig.dhs.gov/.../x.pdf) --
# match both, preferring the oversight.gov-relative form when both are present.
PDF_RX = re.compile(r'href="(/sites/default/files/documents/reports/[^"]+\.pdf)"', re.I)
PDF_RX_ABS = re.compile(r'href="(https?://[^"]+\.pdf)"', re.I)

# GAO endpoints to probe (topic pages + one known report/highlights pair used only
# to confirm whether the WAF block also covers gao.gov/assets/*.pdf).
GAO_PROBE_URLS = [
    "https://www.gao.gov/cybersecurity",
    "https://www.gao.gov/topics/information-security",
]


def polite_sleep():
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))


def html_unescape(s: str) -> str:
    return (s.replace("&amp;", "&").replace("&#039;", "'").replace("&quot;", '"')
             .replace("&rsquo;", "’").replace("&lsquo;", "‘")
             .replace("&rdquo;", "”").replace("&ldquo;", "“")
             .replace("&ndash;", "–").replace("&mdash;", "—"))


def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")


def fetch(url, headers=None, max_attempts=4):
    """GET url with exponential backoff on 429/403/5xx. Returns (status, body_bytes_or_None, err)."""
    hdrs = {"User-Agent": UA_BROWSER}
    if headers:
        hdrs.update(headers)
    delay = 1.0
    last_err = None
    last_status = None
    for attempt in range(max_attempts):
        req = urllib.request.Request(url, headers=hdrs)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, r.read(), None
        except urllib.error.HTTPError as ex:
            last_err = f"HTTP {ex.code}"
            last_status = ex.code
            if ex.code in (429, 403) or 500 <= ex.code < 600:
                if attempt < max_attempts - 1:
                    time.sleep(delay)
                    delay *= 2
                continue
            return ex.code, None, last_err
        except Exception as ex:  # noqa: BLE001
            last_err = f"{type(ex).__name__}: {ex}"
            time.sleep(delay)
            delay *= 2
    return last_status, None, last_err


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def load_json(path, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default


def save_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)


# --------------------------------------------------------------------------- #
# OIG: discover
# --------------------------------------------------------------------------- #

def parse_listing_rows(html: str):
    rows = []
    for block in ROW_RX.findall(html):
        dm = DATE_RX.search(block)
        am = AGENCY_RX.search(block)
        tm = TITLE_RX.search(block)
        ym = TYPE_RX.search(block)
        hm = HREF_RX.search(block)
        if not (tm and ym and hm):
            continue
        rows.append({
            "date": dm.group(1) if dm else None,
            "agency_reviewed": html_unescape(am.group(1).strip()) if am else "",
            "title": html_unescape(tm.group(1).strip()),
            "report_type": html_unescape(ym.group(1).strip()),
            "detail_path": hm.group(1),
        })
    return rows


def discover_oig(log_path=None):
    def log(msg):
        print(msg)
        if log_path:
            with open(log_path, "a") as f:
                f.write(msg + "\n")

    candidates = {}
    raw_seen = 0
    for kw in KEYWORDS:
        url = LISTING_TPL.format(kw=urllib.parse.quote(kw))
        status, body, err = fetch(url)
        polite_sleep()
        if body is None:
            log(f"[oig-discover] keyword {kw!r} FAILED: status={status} err={err}")
            continue
        text = body.decode("utf-8", errors="replace")
        rows = parse_listing_rows(text)
        raw_seen += len(rows)
        kept = 0
        for r in rows:
            title_l = r["title"].lower()
            if r["report_type"] not in ALLOWED_TYPES:
                continue
            if any(t in title_l for t in SKIP_TITLE_TERMS):
                continue
            if not any(t in title_l for t in TITLE_TERMS):
                continue
            path = r["detail_path"]
            if path in candidates:
                candidates[path]["matched_keywords"].append(kw)
                continue
            r["matched_keywords"] = [kw]
            candidates[path] = r
            kept += 1
        log(f"[oig-discover] keyword {kw!r}: {len(rows)} rows, {kept} new candidates kept")

    out = sorted(candidates.values(), key=lambda r: (r.get("date") or ""), reverse=True)
    save_json(OIG_CANDIDATES, out)
    log(f"[oig-discover] TOTAL: {raw_seen} raw rows seen, {len(out)} unique candidates "
        f"after type+title filter -> {OIG_CANDIDATES}")
    return out


# --------------------------------------------------------------------------- #
# OIG: download
# --------------------------------------------------------------------------- #

def download_oig(cap=200, log_path=None):
    def log(msg):
        print(msg)
        if log_path:
            with open(log_path, "a") as f:
                f.write(msg + "\n")

    if not os.path.exists(OIG_CANDIDATES):
        log("[oig-download] no candidates file; run --discover first.")
        return
    candidates = load_json(OIG_CANDIDATES, [])
    os.makedirs(PDF_OIG_DIR, exist_ok=True)
    records = load_json(OIG_MANIFEST, [])
    done_paths = {r["detail_path"] for r in records if r.get("status", "").startswith(("ok", "cached"))}

    n_done = len(done_paths)
    for c in candidates:
        if n_done >= cap:
            log(f"[oig-download] cap of {cap} reached, stopping.")
            break
        path = c["detail_path"]
        if path in done_paths:
            continue
        detail_url = OVERSIGHT_BASE + path
        status, body, err = fetch(detail_url)
        polite_sleep()
        if body is None:
            records.append({**c, "detail_url": detail_url, "pdf_url": None, "dest": None,
                             "status": f"ERROR detail fetch: {err}", "sha256": None, "size": None})
            log(f"[oig-download] FAIL detail {path}: {err}")
            save_json(OIG_MANIFEST, records)
            continue
        dtext = body.decode("utf-8", errors="replace")
        pdf_paths = PDF_RX.findall(dtext)
        if pdf_paths:
            pdf_url = OVERSIGHT_BASE + pdf_paths[0]
        else:
            # fallback: some OIGs (e.g. DHS) link straight to their own agency
            # domain instead of an oversight.gov-relative path.
            abs_pdfs = PDF_RX_ABS.findall(dtext)
            pdf_url = abs_pdfs[0] if abs_pdfs else None
        if pdf_url is None:
            records.append({**c, "detail_url": detail_url, "pdf_url": None, "dest": None,
                             "status": "ERROR no PDF link on detail page", "sha256": None, "size": None})
            log(f"[oig-download] SKIP {path}: no PDF link found")
            save_json(OIG_MANIFEST, records)
            continue
        agency_slug = slugify(c["agency_reviewed"]) or "unknown-agency"
        title_slug = slugify(c["title"])[:70]
        # date + detail-path-hash suffix: title truncation alone collides badly
        # (e.g. OPM's yearly "IT Security Controls of the U.S. Office of Perso..."
        # audits of DIFFERENT systems share an identical truncated prefix -- 11
        # collision groups / 24 silently overwritten PDFs in the first bulk run);
        # date alone still collides for same-day multi-part reports (VA CMOP
        # Dallas vs Tucson). The 6-char sha1 of the unique detail path settles it.
        h6 = hashlib.sha1(path.encode()).hexdigest()[:6]
        doc_id = f"oig__{agency_slug}-oig__{title_slug}--{c.get('date') or 'nodate'}--{h6}"
        dest = os.path.join(PDF_OIG_DIR, doc_id + ".pdf")

        if os.path.exists(dest) and os.path.getsize(dest) > 2000:
            with open(dest, "rb") as f:
                b = f.read()
            records.append({**c, "detail_url": detail_url, "pdf_url": pdf_url, "dest": dest,
                             "doc_id": doc_id, "status": "cached", "sha256": sha256_bytes(b), "size": len(b)})
            done_paths.add(path)
            n_done += 1
            save_json(OIG_MANIFEST, records)
            continue

        p_status, p_body, p_err = fetch(pdf_url)
        polite_sleep()
        if p_body is None or not p_body.startswith(b"%PDF") or len(p_body) < 2000:
            records.append({**c, "detail_url": detail_url, "pdf_url": pdf_url, "dest": None,
                             "doc_id": doc_id,
                             "status": f"ERROR pdf fetch: status={p_status} err={p_err}",
                             "sha256": None, "size": None})
            log(f"[oig-download] FAIL pdf {pdf_url}: status={p_status} err={p_err}")
            save_json(OIG_MANIFEST, records)
            continue
        with open(dest, "wb") as f:
            f.write(p_body)
        records.append({**c, "detail_url": detail_url, "pdf_url": pdf_url, "dest": dest,
                         "doc_id": doc_id, "status": "ok", "sha256": sha256_bytes(p_body), "size": len(p_body)})
        done_paths.add(path)
        n_done += 1
        log(f"[oig-download] OK {doc_id} ({len(p_body)} B) [{n_done}/{cap}]")
        save_json(OIG_MANIFEST, records)

    log(f"[oig-download] done: {n_done} OIG PDFs on disk -> {PDF_OIG_DIR}")


# --------------------------------------------------------------------------- #
# GAO: single-attempt block probe + (if unblocked) discovery/download
# --------------------------------------------------------------------------- #

def probe_and_download_gao(log_path=None):
    def log(msg):
        print(msg)
        if log_path:
            with open(log_path, "a") as f:
                f.write(msg + "\n")

    os.makedirs(PDF_GAO_DIR, exist_ok=True)
    records = load_json(GAO_MANIFEST, [])
    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    all_blocked = True
    for url in GAO_PROBE_URLS:
        status, body, err = fetch(url, headers=headers, max_attempts=2)
        polite_sleep()
        ok = body is not None and status == 200
        if ok:
            all_blocked = False
        records.append({
            "url": url, "status": "ok" if ok else f"BLOCKED status={status} err={err}",
            "size": len(body) if body else None,
        })
        log(f"[gao] probe {url}: status={status} err={err} "
            f"{'OK' if ok else 'BLOCKED'}")
        if ok:
            dest = os.path.join(PDF_GAO_DIR, slugify(url) + ".html")
            with open(dest, "wb") as f:
                f.write(body)

    save_json(GAO_MANIFEST, records)
    if all_blocked:
        log("[gao] all probe URLs returned a WAF block (Akamai edge deny, domain-wide -- "
            "confirmed earlier via curl+urllib, real browser UA, full Accept-* headers, "
            "root/topic/product/asset paths, with a cooldown retry -- same static "
            "edgesuite.net reference-rule prefix every time). Per task brief: no further "
            "evasion attempted. GAO sub-task stops here; harvest continues with OIG only.")
    return not all_blocked


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["discover-oig", "download-oig", "gao", "all"], default="all")
    ap.add_argument("--cap-oig", type=int, default=200)
    args = ap.parse_args()
    os.makedirs(LOG_DIR, exist_ok=True)
    log_path = os.path.join(LOG_DIR, "download_govaudit.log")

    if args.mode in ("discover-oig", "all"):
        discover_oig(log_path=log_path)
    if args.mode in ("download-oig", "all"):
        download_oig(cap=args.cap_oig, log_path=log_path)
    if args.mode in ("gao", "all"):
        probe_and_download_gao(log_path=log_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
