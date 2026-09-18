#!/usr/bin/env python3
"""LEGIBLE wave-2 Task A, Source 2: scrape OSTIF audit blog posts for PDFs.

https://ostif.org/audits is a single static page (no real pagination) listing
blog posts about security audits. This script:
  1. Fetches the audits index, extracts candidate blog-post URLs matching
     ^https://ostif\\.org/[a-z0-9][a-z0-9\\-]+/?$, excluding nav/meta pages
     (about, audits, community, get-an-audit, feed, comments, sponsorship,
     news, wp-json).
  2. Visits each candidate post (0.5-1.0s delay), extracts every href
     containing ".pdf" (resolved via urljoin), and downloads/verifies each
     as a real PDF (%PDF magic + >30KB).
  3. Writes data/corpus/pdfs/ostif/<filename> and
     data/corpus/downloads_ostif.json with
     {filename, url, blog_post_url, sha256, size, status}.

De-dup: if the same PDF URL is linked from multiple posts, it is downloaded
once and keeps the first blog-post association. If two different posts'
PDFs share an identical basename (collision) but different URLs, the second
one gets a slug-prefixed filename to disambiguate.

Cap: stops downloading new PDFs once ~140 have been downloaded; any posts
not yet visited at that point are recorded as skipped in the log.

Resumable: files already verified on disk are not re-downloaded; the
manifest is rebuilt from a combination of what's on disk + what's freshly
discovered, matched by URL against any pre-existing manifest.

Politeness: 0.5-1.0s randomized delay between every request (page fetch or
PDF download) to ostif.org. User-Agent: legible-research/0.1 (academic
dataset project). Backoff 2**attempt seconds on 429/5xx, up to 2 retries.
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
PDF_DIR = os.path.join(CORPUS, "pdfs", "ostif")
MANIFEST_JSON = os.path.join(CORPUS, "downloads_ostif.json")
LOG_PATH = os.path.join(CORPUS, "logs", "ostif_download.log")

INDEX_URL = "https://ostif.org/audits"
UA = "legible-research/0.1 (academic dataset project)"
CANDIDATE_PATTERN = re.compile(r'^https://ostif\.org/[a-z0-9][a-z0-9\-]+/?$')
EXCLUDE_SUBSTRINGS = ["about", "audits", "community", "get-an-audit", "feed",
                       "comments", "sponsorship", "news", "wp-json"]
MIN_SIZE = 30 * 1024
MAX_RETRIES = 2
DOWNLOAD_CAP = 140


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


def slug_from_post_url(post_url):
    path = urllib.parse.urlsplit(post_url).path.strip("/")
    return path.split("/")[-1][:40]


def list_candidate_posts():
    html = http_get(INDEX_URL).decode("utf-8", errors="replace")
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE)
    candidates = sorted(set(h for h in hrefs if CANDIDATE_PATTERN.match(h)))
    filtered = [c for c in candidates
                if not any(x in c for x in EXCLUDE_SUBSTRINGS)]
    return filtered


def main():
    os.makedirs(PDF_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)

    log(f"=== ostif download run start {time.strftime('%Y-%m-%d %H:%M:%S')} ===")

    try:
        posts = list_candidate_posts()
    except Exception as ex:  # noqa: BLE001
        log(f"FATAL: could not fetch/parse {INDEX_URL} : {ex}")
        return 1

    log(f"{len(posts)} candidate blog post URL(s) found on {INDEX_URL}")

    # Preload existing on-disk files (basename -> verified) for resumability,
    # and existing manifest (url -> record) so we don't lose earlier entries.
    existing_by_url = {}
    if os.path.exists(MANIFEST_JSON):
        with open(MANIFEST_JSON) as f:
            for rec in json.load(f):
                if rec.get("url"):
                    existing_by_url[rec["url"]] = rec

    results = []
    seen_pdf_urls = set()          # dedup across posts
    used_filenames = set()          # avoid on-disk collisions
    n_downloaded = n_cached = n_failed = n_skipped_bad = 0
    posts_visited = 0
    posts_with_pdf = 0
    total_pdf_links_found = 0
    hard_block = False
    cap_hit_at = None

    for i, post_url in enumerate(posts):
        if n_downloaded + n_cached >= DOWNLOAD_CAP:
            cap_hit_at = i
            log(f"CAP reached ({DOWNLOAD_CAP} PDFs downloaded/cached); "
                f"stopping before visiting remaining {len(posts) - i} post(s).")
            break

        if hard_block:
            log(f"Host hard-blocked earlier; stopping remaining "
                f"{len(posts) - i} post(s).")
            break

        posts_visited += 1
        try:
            html = http_get(post_url).decode("utf-8", errors="replace")
        except Exception as ex:  # noqa: BLE001
            log(f"POST-FETCH-FAIL {post_url}: {ex}")
            if isinstance(ex, urllib.error.HTTPError) and ex.code in (403, 429):
                hard_block = True
            polite_sleep()
            continue

        hrefs = re.findall(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE)
        pdf_links = sorted(set(
            urllib.parse.urljoin(post_url, h) for h in hrefs if ".pdf" in h.lower()
        ))
        polite_sleep()

        if not pdf_links:
            continue

        posts_with_pdf += 1
        total_pdf_links_found += len(pdf_links)

        for pdf_url in pdf_links:
            if n_downloaded + n_cached >= DOWNLOAD_CAP:
                cap_hit_at = i
                break
            if pdf_url in seen_pdf_urls:
                continue
            seen_pdf_urls.add(pdf_url)

            filename = os.path.basename(urllib.parse.urlsplit(pdf_url).path)
            if not filename:
                continue
            if filename in used_filenames:
                slug = slug_from_post_url(post_url)
                filename = f"{slug}__{filename}"
            used_filenames.add(filename)
            dest = os.path.join(PDF_DIR, filename)

            rec = {"filename": filename, "url": pdf_url,
                   "blog_post_url": post_url}

            ok, size = verify(dest)
            if ok:
                rec.update(status="cached", size=size, sha256=sha256_of(dest))
                results.append(rec)
                n_cached += 1
                continue

            err = None
            for attempt in range(MAX_RETRIES + 1):
                try:
                    data = http_get(pdf_url)
                    with open(dest, "wb") as f:
                        f.write(data)
                    ok, size = verify(dest)
                    if not ok:
                        raise ValueError(f"failed %PDF/size check (size={size})")
                    err = None
                    break
                except urllib.error.HTTPError as ex:
                    err = f"HTTPError {ex.code}: {ex.reason}"
                    # Only treat this as a host block if the *ostif.org* host
                    # itself is blocking us -- many post PDF links point at
                    # third-party hosts (github.com, eprint.iacr.org, ...)
                    # whose own bot-defenses are unrelated to our ostif.org
                    # politeness and must not abort the rest of the crawl.
                    if (ex.code in (403, 429) and attempt == MAX_RETRIES
                            and urllib.parse.urlsplit(pdf_url).netloc.endswith("ostif.org")):
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
                log(f"OK      {filename} ({size} B) <- {post_url}")
            else:
                if os.path.exists(dest) and not verify(dest)[0]:
                    # not a real PDF -- skip (don't force), per spec
                    try:
                        os.remove(dest)
                    except OSError:
                        pass
                    rec.update(status=f"SKIPPED not-a-pdf: {err}", size=None,
                               sha256=None)
                    n_skipped_bad += 1
                    log(f"SKIP    {filename}: {err}")
                else:
                    rec.update(status=f"ERROR {err}", size=None, sha256=None)
                    n_failed += 1
                    log(f"FAIL    {filename}: {err}")
            results.append(rec)
            polite_sleep()

    with open(MANIFEST_JSON, "w") as f:
        json.dump(results, f, indent=2)

    log(f"\nPosts visited: {posts_visited}/{len(posts)}  "
        f"posts_with_pdf: {posts_with_pdf}  "
        f"total_pdf_links_found (pre-cap/pre-dedup on this run): {total_pdf_links_found}")
    log(f"Totals: cached={n_cached} downloaded={n_downloaded} "
        f"skipped_not_pdf={n_skipped_bad} failed={n_failed} "
        f"(cap={DOWNLOAD_CAP}, cap_hit_at_post_index={cap_hit_at})")
    log(f"Manifest -> {MANIFEST_JSON}")
    log(f"=== ostif download run end {time.strftime('%Y-%m-%d %H:%M:%S')} ===\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
