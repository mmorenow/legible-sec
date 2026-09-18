#!/usr/bin/env python3
"""LEGIBLE P1 Task E: light index of downloaded CISA advisory HTML.

Plain stdlib HTML parsing (html.parser) -- no LLM, no Docling. For every
advisory HTML file under data/corpus/html/cisa_{csa,ics}/, extracts:
  series, id, title (h1, falling back to <title> minus the " | CISA" suffix),
  date (release date, if present), ordered h2/h3 heading texts (first 12,
  pipe-joined), release year (from the date).
Writes data/corpus/cisa_index.csv, one row per advisory.
"""
import csv
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS = os.path.join(ROOT, "data", "corpus")
HTML_ROOT = os.path.join(CORPUS, "html")
OUT_CSV = os.path.join(CORPUS, "cisa_index.csv")

DATE_LABEL_RX = re.compile(
    r'c-field__label">(?:Release Date|Last Revised|Original [Rr]elease [Dd]ate)</div>'
    r'.*?<time[^>]*datetime="([^"]+)"', re.S
)
FIRST_TIME_RX = re.compile(r'<time[^>]*datetime="([^"]+)"')
TITLE_SUFFIX_RX = re.compile(r"\s*\|\s*CISA\s*$", re.IGNORECASE)

COLUMNS = ["series", "id", "title", "date", "release_year", "headings"]


class AdvisoryParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.in_h1 = False
        self.heading_tag = None
        self.title_parts = []
        self.h1_parts = []
        self.headings = []          # finished (tag, text)
        self._heading_buf = []

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self.in_title = True
        elif tag == "h1":
            self.in_h1 = True
        elif tag in ("h2", "h3"):
            self.heading_tag = tag
            self._heading_buf = []

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        elif tag == "h1":
            self.in_h1 = False
        elif tag in ("h2", "h3") and self.heading_tag == tag:
            text = re.sub(r"\s+", " ", "".join(self._heading_buf)).strip()
            if text:
                self.headings.append(text)
            self.heading_tag = None
            self._heading_buf = []

    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data)
        if self.in_h1:
            self.h1_parts.append(data)
        if self.heading_tag is not None:
            self._heading_buf.append(data)

    @property
    def title(self):
        h1 = re.sub(r"\s+", " ", "".join(self.h1_parts)).strip()
        if h1:
            return h1
        t = re.sub(r"\s+", " ", "".join(self.title_parts)).strip()
        return TITLE_SUFFIX_RX.sub("", t).strip()


def parse_advisory(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        html = f.read()
    p = AdvisoryParser()
    p.feed(html)
    m = DATE_LABEL_RX.search(html) or FIRST_TIME_RX.search(html)
    date = m.group(1) if m else ""
    year = date[:4] if date else ""
    return {
        "title": p.title,
        "date": date,
        "release_year": year,
        "headings": p.headings[:12],
    }


def index_series(series, dir_path, rows):
    if not os.path.isdir(dir_path):
        return 0
    n = 0
    for fn in sorted(os.listdir(dir_path)):
        if not fn.endswith(".html"):
            continue
        aid = fn[:-len(".html")]
        try:
            info = parse_advisory(os.path.join(dir_path, fn))
        except Exception as ex:  # noqa: BLE001
            rows.append({"series": series, "id": aid, "title": f"PARSE_ERROR: {ex}",
                         "date": "", "release_year": "", "headings": ""})
            continue
        rows.append({
            "series": series, "id": aid, "title": info["title"],
            "date": info["date"], "release_year": info["release_year"],
            "headings": " | ".join(info["headings"]),
        })
        n += 1
    return n


def main():
    rows = []
    n_csa = index_series("csa", os.path.join(HTML_ROOT, "cisa_csa"), rows)
    n_ics = index_series("ics", os.path.join(HTML_ROOT, "cisa_ics"), rows)

    with open(OUT_CSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    print(f"Indexed csa={n_csa} ics={n_ics} (total {len(rows)}) -> {OUT_CSV}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
