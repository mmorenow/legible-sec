#!/usr/bin/env python3
"""LEGIBLE D42: download vetted incident-postmortem HTML pages.

Reads the target list from data/corpus/postmortem_targets.json (verdict=="accept"
rows only) and downloads each URL's HTML to
data/corpus/html/postmortem/<company>__<slug>.html.

Manifest: data/corpus/downloads_postmortem.json, one record per target:
company, slug, url, sha256, status, http_status, bytes.

Politeness: 0.5-1.5s delay between requests, custom User-Agent, exponential
backoff on 429/403/5xx (up to 4 attempts). If a host blocks persistently,
log it and move on -- do not evade blocking (robots-respectful).

Resumable: already-downloaded + non-empty HTML files are skipped.

Usage:
    .venv/bin/python scripts/download_postmortems.py
    .venv/bin/python scripts/download_postmortems.py --only cloudflare circleci
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import random
import re
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGETS = ROOT / "data/corpus/postmortem_targets.json"
HTML_DIR = ROOT / "data/corpus/html/postmortem"
MANIFEST = ROOT / "data/corpus/downloads_postmortem.json"

USER_AGENT = "legible-research/0.1 (academic dataset project; contact: research use only)"
MIN_DELAY = 0.5
MAX_DELAY = 1.5


def polite_sleep() -> None:
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))


def slugify(company: str, slug: str) -> str:
    base = f"{company}__{slug}"
    return re.sub(r"[^a-z0-9_.-]", "-", base.lower())[:120]


def fetch(url: str, max_attempts: int = 4) -> tuple[int | None, bytes | None, str | None]:
    """GET url with exponential backoff on 429/403/5xx. Returns (status, body, err)."""
    delay = 1.5
    last_err = None
    for _ in range(max_attempts):
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
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


def load_manifest() -> dict:
    if MANIFEST.exists():
        return {r["key"]: r for r in json.load(open(MANIFEST))}
    return {}


def save_manifest(records: dict) -> None:
    with open(MANIFEST, "w") as f:
        json.dump(list(records.values()), f, indent=2)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", default=None, help="restrict to these company slugs")
    args = ap.parse_args()

    HTML_DIR.mkdir(parents=True, exist_ok=True)
    targets = json.load(open(TARGETS))["targets"]
    accepted = [t for t in targets if t["verdict"] == "accept" and t.get("url")]
    if args.only:
        accepted = [t for t in accepted if t["company"] in args.only]

    manifest = load_manifest()
    ok = skip = fail = 0
    for t in accepted:
        key = slugify(t["company"], t["slug"])
        dest = HTML_DIR / f"{key}.html"
        if dest.exists() and dest.stat().st_size > 500:
            skip += 1
            continue
        status, body, err = fetch(t["url"])
        polite_sleep()
        if body is None or len(body) < 500:
            fail += 1
            manifest[key] = {
                "key": key, "company": t["company"], "slug": t["slug"], "url": t["url"],
                "status": "failed", "http_status": status, "error": err, "bytes": 0,
            }
            print(f"FAIL {key}: status={status} err={err}")
            save_manifest(manifest)
            continue
        dest.write_bytes(body)
        sha = hashlib.sha256(body).hexdigest()
        manifest[key] = {
            "key": key, "company": t["company"], "slug": t["slug"], "url": t["url"],
            "status": "ok", "http_status": status, "sha256": sha, "bytes": len(body),
        }
        ok += 1
        print(f"OK   {key}: {len(body)} bytes")
        save_manifest(manifest)

    print(f"\npostmortem downloads: {ok} ok, {skip} cached, {fail} failed "
          f"(of {len(accepted)} accepted targets) -> {HTML_DIR}")
    if fail:
        failed = [k for k, v in manifest.items() if v.get("status") == "failed"]
        print("failed keys:", ", ".join(failed))


if __name__ == "__main__":
    main()
