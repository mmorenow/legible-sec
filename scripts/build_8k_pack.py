#!/usr/bin/env python3
"""LEGIBLE D36-am: build the `incident-comms` mini pack.

SEC 8-K Item 1.05 cybersecurity disclosures, paired CROSS-DOCUMENT
(event-anchored, not same-doc structural like CISA/TOB) with a technical
writeup of the SAME incident (vendor security blog, congressional testimony,
CISA advisory, etc.).

Pipeline (three subcommands, all resumable):

  1. `search`    -- query EDGAR full-text search for 8-K filings that carry
                    an "Item 1.05" (Material Cybersecurity Incidents) item
                    code, across ALL pages of results. Writes the raw hit
                    list to data/corpus/downloads_sec8k_search.json.

  2. `download`  -- for each unique (issuer, accession) filing, resolve the
                    primary document's Archives URL and download the raw
                    HTML to data/corpus/html/sec8k/<ticker-or-cik>__<date>.htm.
                    Extracts the Item 1.05 passage verbatim (regex: from the
                    "Item 1.05" heading to the next "Item X.XX" heading or
                    "SIGNATURE(S)"). Writes data/corpus/downloads_sec8k.json.

  3. `build`     -- reads the extracted Item 1.05 passages + a hand-curated
                    partner-doc table (PARTNER_DOCS below, populated from
                    WebSearch/WebFetch research -- this is the part that
                    cannot be mechanized: finding the *technical* writeup
                    for the SAME incident is a judgment call) and emits
                    data/pairs/candidates_8k.jsonl in the CISA candidate
                    schema plus the D36-am-specific fields.

SEC fair-access compliance: declared User-Agent
`legible-sec-research/0.1 (academic dataset research)`, <=2 req/s (we sleep
0.6s between requests => ~1.67 req/s), exponential backoff on 429/403/5xx,
no evasion of blocks. $0 spend: no paid APIs anywhere in this script.
"""
import argparse
import html
import json
import os
import re
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS = os.path.join(ROOT, "data", "corpus")
HTML_DIR = os.path.join(CORPUS, "html", "sec8k")
PAIRS_DIR = os.path.join(ROOT, "data", "pairs")

SEARCH_MANIFEST = os.path.join(CORPUS, "downloads_sec8k_search.json")
DOWNLOAD_MANIFEST = os.path.join(CORPUS, "downloads_sec8k.json")
CANDIDATES_OUT = os.path.join(PAIRS_DIR, "candidates_8k.jsonl")


# NOTE on UA (see build_8k_pack REPORT "problems" section for detail): the
# task-specified literal string "legible-sec-research/0.1 (academic dataset
# research)" was tried FIRST and got HTTP 403 "Your Request Originates from
# an Undeclared Automated Tool" from www.sec.gov's WAF (confirmed via curl).
# SEC's documented fair-access policy (sec.gov/os/webmaster-faq#developers)
# requires the UA to carry an identifiable contact, format "Sample Company
# Name AdminContact@sample.com" -- a bare descriptive string does not
# qualify. Appending a real contact email (the project owner's, from
# CLAUDE.md) is the compliant fix, confirmed to return HTTP 200. This is
# honest declaration, not evasion: it makes the traffic MORE identifiable,
# per SEC's own ask, not less.
USER_AGENT = "legible-sec-research/0.1 (academic dataset research; marcelomorenoscholar@gmail.com)"
DELAY = 0.6  # seconds between requests => ~1.67 req/s, under the 2 req/s ceiling

EFTS_URL = "https://efts.sec.gov/LATEST/search-index?q=%22Item+1.05%22&forms=8-K"
ITEM105_HEADING_RX = re.compile(
    r"item\s*1\.05\b.{0,40}?material\s+cybersecurity\s+incidents?", re.I | re.S
)
NEXT_ITEM_RX = re.compile(r"\bitem\s*\d+\.\d{2}\b", re.I)
SIGNATURE_RX = re.compile(r"\bsignatures?\b", re.I)


def polite_sleep():
    time.sleep(DELAY)


def fetch(url, max_attempts=5, extra_headers=None):
    """GET url with exponential backoff on 429/403/5xx. Returns (status, body_bytes_or_None, err)."""
    delay = 1.0
    last_err = None
    headers = {"User-Agent": USER_AGENT}
    if extra_headers:
        headers.update(extra_headers)
    for _ in range(max_attempts):
        req = urllib.request.Request(url, headers=headers)
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


# ---------------------------------------------------------------------------
# Step 1: search
# ---------------------------------------------------------------------------

def cmd_search(args):
    """Query EDGAR full-text search for 8-K filings tagged Item 1.05.

    Note on the API: `size` defaults large enough that a single request at
    from=0 returns the full hit set for this query (confirmed empirically:
    total=88 raw hits, all 88 returned in one page). We still paginate
    defensively in case the result set grows past what a single page
    returns, stopping when a page comes back empty.
    """
    all_hits = []
    frm = 0
    while True:
        url = f"{EFTS_URL}&from={frm}"
        status, body, err = fetch(url)
        polite_sleep()
        if body is None:
            print(f"[search] FAILED at from={frm}: status={status} err={err}")
            break
        data = json.loads(body)
        hits = data["hits"]["hits"]
        total = data["hits"]["total"]["value"]
        if not hits:
            break
        all_hits.extend(hits)
        print(f"[search] from={frm}: got {len(hits)} hits (total advertised={total})")
        if len(all_hits) >= total or len(hits) < 10:
            break
        frm += len(hits)

    # De-dup by _id (accession:filename) and filter to hits whose `items`
    # array genuinely contains "1.05" (the q= phrase match alone is not
    # sufficient -- some hits match the phrase in body text without the
    # item code being 1.05, e.g. discussing another company's incident).
    seen = set()
    records = []
    for h in all_hits:
        if h["_id"] in seen:
            continue
        seen.add(h["_id"])
        s = h["_source"]
        items = s.get("items", [])
        if "1.05" not in items:
            continue
        accession, filename = h["_id"].split(":", 1)
        cik = s["ciks"][0]
        name_raw = s["display_names"][0]
        m = re.search(r"\(([A-Z0-9/.\- ]+)\)\s*\(CIK", name_raw)
        ticker = m.group(1).split(",")[0].strip() if m else None
        issuer = re.sub(r"\s*\(.*", "", name_raw).strip()
        records.append({
            "id": h["_id"],
            "cik": cik,
            "accession": accession,
            "filename": filename,
            "issuer": issuer,
            "ticker": ticker,
            "form": s["form"],
            "file_date": s["file_date"],
            "items": items,
        })
    records.sort(key=lambda r: r["file_date"])
    with open(SEARCH_MANIFEST, "w") as f:
        json.dump(records, f, indent=2)
    n_issuers = len({r["cik"] for r in records})
    print(f"[search] {len(records)} filings with Item 1.05 across {n_issuers} unique issuers "
          f"-> {SEARCH_MANIFEST}")


# ---------------------------------------------------------------------------
# Step 2: download + extract
# ---------------------------------------------------------------------------

def archives_url(cik, accession, filename):
    cik_int = str(int(cik))
    acc_nodash = accession.replace("-", "")
    return f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{acc_nodash}/{filename}"


def slug(issuer, ticker):
    base = ticker if ticker else issuer
    base = re.sub(r"[^A-Za-z0-9]+", "-", base).strip("-").lower()
    return base or "unknown"


def html_to_text(html_bytes):
    text = html_bytes.decode("utf-8", errors="replace")
    # strip script/style
    text = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", text)
    # convert common block tags to newlines before stripping tags
    text = re.sub(r"(?i)<(p|div|br|tr|td|li|h\d)[^>]*>", "\n", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    # decode ALL HTML/numeric entities in one pass (named + numeric, e.g.
    # &nbsp; &#160; &#8201; thin-space -- EDGAR filings use a mix and any
    # miss here breaks the "Item 1.05" heading regex downstream)
    text = html.unescape(text)
    # normalize the zoo of unicode space characters entities decode to
    # (nbsp U+00A0, thin space U+2009, etc.) down to a plain space
    text = re.sub(r"[  -​  ]", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def extract_item105(text):
    """Extract the Item 1.05 passage verbatim: from the Item 1.05 heading
    to the next Item X.XX heading or the SIGNATURE(S) block, whichever
    comes first."""
    m = ITEM105_HEADING_RX.search(text)
    if not m:
        # fallback: bare "Item 1.05" without the full caption on one line
        m2 = re.search(r"item\s*1\.05\b", text, re.I)
        if not m2:
            return None
        start = m2.start()
    else:
        start = m.start()
    # search for the next item heading strictly after this one
    rest = text[start + 10:]
    end_candidates = []
    nm = NEXT_ITEM_RX.search(rest)
    if nm:
        end_candidates.append(start + 10 + nm.start())
    sm = SIGNATURE_RX.search(rest)
    if sm:
        end_candidates.append(start + 10 + sm.start())
    end = min(end_candidates) if end_candidates else len(text)
    passage = text[start:end].strip()
    return passage


def cmd_download(args):
    if not os.path.exists(SEARCH_MANIFEST):
        print("[download] no search manifest; run `search` first.")
        return
    with open(SEARCH_MANIFEST) as f:
        records = json.load(f)
    os.makedirs(HTML_DIR, exist_ok=True)
    out = []
    if os.path.exists(DOWNLOAD_MANIFEST):
        with open(DOWNLOAD_MANIFEST) as f:
            out = json.load(f)
    done_ids = {r["id"] for r in out if r.get("status") == "ok"}

    for rec in records:
        if rec["id"] in done_ids:
            continue
        url = archives_url(rec["cik"], rec["accession"], rec["filename"])
        s = slug(rec["issuer"], rec["ticker"])
        dest_name = f"{s}__{rec['file_date']}__{rec['form'].replace('/', '')}.htm"
        dest = os.path.join(HTML_DIR, dest_name)
        if os.path.exists(dest) and os.path.getsize(dest) > 200:
            body = open(dest, "rb").read()
        else:
            status, body, err = fetch(url)
            polite_sleep()
            if body is None:
                print(f"[download] FAIL {rec['issuer']} {rec['file_date']}: {err}")
                out.append({**rec, "url": url, "dest": None, "status": f"ERROR {err}",
                            "item105_text": None})
                with open(DOWNLOAD_MANIFEST, "w") as f:
                    json.dump(out, f, indent=2)
                continue
            with open(dest, "wb") as f:
                f.write(body)
        text = html_to_text(body)
        passage = extract_item105(text)
        status = "ok" if passage else "ok_no_item105_match"
        print(f"[download] {status} {rec['issuer']} {rec['file_date']} "
              f"({len(passage) if passage else 0} chars)")
        out.append({**rec, "url": url, "dest": os.path.relpath(dest, ROOT),
                    "status": status, "item105_text": passage})
        with open(DOWNLOAD_MANIFEST, "w") as f:
            json.dump(out, f, indent=2)

    n_ok = sum(1 for r in out if r["status"].startswith("ok"))
    n_text = sum(1 for r in out if r.get("item105_text"))
    print(f"[download] done: {n_ok}/{len(out)} downloaded, {n_text} with extracted Item 1.05 text")


# ---------------------------------------------------------------------------
# Step 3: build candidates
# ---------------------------------------------------------------------------
# Hand-curated technical-partner table. Populated via WebSearch/WebFetch
# research (the part that cannot be mechanized -- see build_8k_pack REPORT
# for the full survivor/non-survivor list and reasoning per issuer).
#
# Each entry: issuer slug (must match the slug the `download` step produced
# for that issuer's 8-K, i.e. slug(issuer, ticker)) -> list of partner pairs.
# A partner pair is:
#   partner_url          -- source URL of the technical writeup
#   partner_license_basis-- short license/provenance tag for the partner doc
#   partner_text          -- VERBATIM technical passage (copied from the
#                             fetched page/PDF, trimmed to the technically
#                             substantive portion)
#   notes                 -- free text on both sides' basis + partner URL
PARTNER_DOCS = {
    # populated by scripts/_8k_partner_docs.json (see build step loader)
}


def load_partner_docs():
    side_path = os.path.join(ROOT, "scripts", "_8k_partner_docs.json")
    if os.path.exists(side_path):
        with open(side_path) as f:
            return json.load(f)
    return PARTNER_DOCS


def cmd_build(args):
    if not os.path.exists(DOWNLOAD_MANIFEST):
        print("[build] no download manifest; run `download` first.")
        return
    with open(DOWNLOAD_MANIFEST) as f:
        filings = json.load(f)
    partners = load_partner_docs()

    by_slug = {}
    for rec in filings:
        if not rec.get("item105_text"):
            continue
        s = slug(rec["issuer"], rec["ticker"])
        by_slug.setdefault(s, []).append(rec)

    pairs = []
    n_issuers_with_partner = 0
    for s, partner_list in partners.items():
        filing_recs = by_slug.get(s)
        if not filing_recs:
            print(f"[build] WARN: no downloaded Item 1.05 text for issuer slug '{s}'")
            continue
        # prefer the ORIGINAL 8-K (not an amendment) as the primary exec text;
        # fall back to the first filing found (by file_date order already).
        primary = next((r for r in filing_recs if r["form"] == "8-K"), filing_recs[0])
        n_issuers_with_partner += 1
        for i, p in enumerate(partner_list):
            alignment_type = "1:1" if len(partner_list) == 1 else "1:N"
            pair_id = f"sec8k__{s}__{i}"
            pairs.append({
                "pair_id": pair_id,
                "source_doc_id": f"sec8k/{s}__{primary['file_date']}",
                "source_org": s,
                "doc_type": "sec_8k_item105",
                "technical_text": p["partner_text"],
                "technical_context": p.get("partner_context", "technical partner document"),
                "executive_text": primary["item105_text"],
                "audience_observed": "investor",
                "alignment_method": "event_anchor",
                "alignment_type": alignment_type,
                "cited_ids": [],
                "finding_numbers": [],
                "severity_original": "",
                "exec_span_kind": "doc_level",
                "needs_llm_verify": True,
                "license": p["license"],
                "notes": (
                    f"8-K basis: edgar-public-filing ({primary['url']}). "
                    f"Partner basis: {p['partner_license_basis']} ({p['partner_url']}). "
                    f"{p.get('notes', '')}"
                ).strip(),
            })

    os.makedirs(PAIRS_DIR, exist_ok=True)
    with open(CANDIDATES_OUT, "w") as f:
        for pair in pairs:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")
    print(f"[build] {len(pairs)} pairs across {n_issuers_with_partner} issuers -> {CANDIDATES_OUT}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("search")
    sub.add_parser("download")
    sub.add_parser("build")
    args = ap.parse_args()
    os.makedirs(HTML_DIR, exist_ok=True)
    {"search": cmd_search, "download": cmd_download, "build": cmd_build}[args.cmd](args)


if __name__ == "__main__":
    main()
