#!/usr/bin/env python
"""Fetch OSTIF audit blog-post bodies (the lay-audience summary layer).

Post URLs come from data/corpus/downloads_ostif.json (recorded per PDF).
Saves cleaned text to data/corpus/ostif_blog/<slug>.txt. Resumable + polite.
"""

from __future__ import annotations

import json
import pathlib
import re
import time
import urllib.request
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data/corpus/ostif_blog"
UA = "legible-research/0.1 (academic dataset project)"


class PostText(HTMLParser):
    """Extract paragraph text from the WP post content region."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.chunks: list[str] = []
        self._skip = 0
        self._inp = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "nav", "footer", "header", "aside", "form"):
            self._skip += 1
        elif tag in ("p", "li", "h2", "h3") and not self._skip:
            self._inp = True

    def handle_endtag(self, tag):
        if tag in ("script", "style", "nav", "footer", "header", "aside", "form"):
            self._skip = max(0, self._skip - 1)
        elif tag in ("p", "li", "h2", "h3"):
            self._inp = False

    def handle_data(self, data):
        if self._inp and not self._skip and data.strip():
            self.chunks.append(re.sub(r"\s+", " ", data).strip())


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.load(open(ROOT / "data/corpus/downloads_ostif.json"))
    entries = manifest if isinstance(manifest, list) else manifest.get("files", list(manifest.values()))
    post_urls = {}
    for e in entries:
        if not isinstance(e, dict):
            continue
        post = e.get("blog_post_url") or e.get("post_url") or e.get("blog_url")
        fname = e.get("filename") or e.get("file")
        if post and fname:
            post_urls.setdefault(post, []).append(fname)

    ok = fail = skip = 0
    mapping = {}
    for url, pdfs in sorted(post_urls.items()):
        slug = re.sub(r"[^a-z0-9-]", "", url.rstrip("/").split("/")[-1].lower())[:80] or f"post{ok+fail}"
        dest = OUT / f"{slug}.txt"
        mapping[slug] = {"url": url, "pdfs": pdfs}
        if dest.exists():
            skip += 1
            continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                html_text = r.read().decode("utf-8", "replace")
            p = PostText()
            p.feed(html_text)
            body = "\n".join(p.chunks)
            # trim boilerplate tails (share widgets, related posts)
            body = re.split(r"(?i)(related posts|share this|leave a reply)", body)[0]
            dest.write_text(body)
            ok += 1
            time.sleep(0.6)
        except Exception as e:
            fail += 1
            print(f"FAIL {slug}: {str(e)[:80]}")
    json.dump(mapping, open(OUT / "_mapping.json", "w"), indent=1)
    print(f"blogs: {ok} fetched, {skip} cached, {fail} failed -> {OUT}")


if __name__ == "__main__":
    main()
