#!/usr/bin/env python3
"""Bake the browsable library index for the website out of the v0.4 pairs.

The site needs to answer one question offline, in the tab, with no backend:
"paste a finding, show me the real pairs from the corpus that look like it".
That means a static JSON in public/ and a client-side matcher. This script
builds the JSON.

Two filters decide what is even allowed into that file, and both are hard:

  1. LICENCE. Only cc-by-sa-4.0, public-domain-us-gov and cc-by-4.0 permit
     redistribution. research-quotation-noncommercial, us-gov-contracted-verify
     and edgar-public-filing do not, so those pairs never leave the private
     dataset, no matter how good they are.
  2. PII. pii_scrubbed must be True. A record still carrying unscrubbed
     personal data cannot be baked into a page a browser will fetch.

What lands in public/ is published in every sense that matters, so the output
is gitignored: publication of the dataset is a separate, deliberate decision
(D58 and the owner's 2026-07-12 call), not a side effect of a build step.

Usage:
    python scripts/gen_library_index.py
    python scripts/gen_library_index.py --dataset data/dataset/legible-pairs-v0.4.jsonl
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import gzip
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]

DEFAULT_DATASET = "data/dataset/legible-pairs-v0.4.jsonl"
DEFAULT_OUT = "presentation/web/public/library-index.json"
BUILD_TAG = "v0.4"

# The only licences under which a pair may be redistributed. Everything else is
# quoted under research fair use or is unverified, and stays private.
REDISTRIBUTABLE = ("cc-by-sa-4.0", "public-domain-us-gov", "cc-by-4.0")

WITHHELD_REASON = (
    "Withheld because the licence does not permit redistribution "
    "(research-quotation-noncommercial, us-gov-contracted-verify, "
    "edgar-public-filing) or because pii_scrubbed is false. Withheld pairs "
    "exist in the dataset and are counted here, but their text is not in this "
    "file."
)

# Display truncation. The index is a finding aid, not the dataset: enough text
# to recognise a pair, never enough to be a redistribution of it.
TECH_CHARS = 400
EXEC_CHARS = 300
TRUNC_MARK = "…"

# Short keys, same reason as scripts/build_pair_browser.py: the long field names
# would cost more than the values they label, and this payload crosses a network.
PAIR_KEYS = {
    "pair_id": "i",
    "technical_text": "t",
    "executive_text": "e",
    "source_org": "o",
    "source_org_type": "ot",
    "severity_original": "s",
    "vuln_class": "vc",
    "cve_ids": "cv",
    "cwe_ids": "cw",
    "report_year": "y",
    "license": "l",
    "source_url": "u",
}

# A token is a lowercase word that STARTS WITH A LETTER: bare numbers are left
# to the judge's numeric extractor, which understands currency, percentages and
# version strings, and would only be mangled by a word tokeniser.
# presentation/web/src/lib/librarySearch.ts carries the same expression. If you
# change it here, change it there: a mismatch silently loses recall.
TOKEN_RX = re.compile(r"[a-z][a-z0-9]{2,}")

# Shipped inside the JSON so the client cannot drift from the baked postings.
STOPWORDS = sorted(
    """
    the and for that with this from are was were has have not but you your our
    its can will they their there which when what how all any been being than
    then them these those such only also into out over under more most other
    some each per via would could should may might must does did done because
    while about after before between during within upon both same very just
    them itself herein hereby thereof therefore however whether either neither
    """.split()
)


def truncate(text: str, limit: int) -> tuple[str, bool]:
    """Cut to `limit` characters at a word boundary, marking the cut.

    The marker is appended, so the string is deliberately NOT verbatim once
    truncated; the boolean is the machine-readable half of the same fact, and
    the UI is expected to link out to the full record rather than treat this
    as the finding.
    """
    text = (text or "").strip()
    if len(text) <= limit:
        return text, False
    cut = text[:limit]
    space = cut.rfind(" ")
    # Only honour the word boundary if it does not eat most of the excerpt: a
    # 400-character block of a stack trace can contain no spaces at all.
    if space > limit * 0.6:
        cut = cut[:space]
    return cut.rstrip() + TRUNC_MARK, True


def clean_str(value) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def clean_year(value) -> int | None:
    # 0 appears in the dataset as "year unknown", and is not a year.
    try:
        y = int(value)
    except (TypeError, ValueError):
        return None
    return y if 1990 <= y <= 2100 else None


def tokenize(text: str, stop: set[str]) -> list[str]:
    return [t for t in TOKEN_RX.findall(text.lower()) if t not in stop]


def build(rows: list[dict], stop: set[str]) -> tuple[list[dict], dict, list[int]]:
    """Pack the kept rows and build the inverted index over their FULL text.

    The postings are built over the whole finding, not over the truncated
    excerpt that ships. That is the point of precomputing them: the client gets
    recall it could never reach from the 400 characters it can see.
    """
    pairs: list[dict] = []
    postings: dict[str, list[int]] = collections.defaultdict(list)
    doc_len: list[int] = []

    for idx, d in enumerate(rows):
        tech, tech_cut = truncate(d.get("technical_text") or "", TECH_CHARS)
        exec_, exec_cut = truncate(d.get("executive_text") or "", EXEC_CHARS)

        pairs.append(
            {
                PAIR_KEYS["pair_id"]: d.get("pair_id") or "",
                PAIR_KEYS["technical_text"]: tech,
                PAIR_KEYS["executive_text"]: exec_,
                "tt": tech_cut,
                "et": exec_cut,
                PAIR_KEYS["source_org"]: clean_str(d.get("source_org")) or "",
                PAIR_KEYS["source_org_type"]: clean_str(d.get("source_org_type")) or "",
                PAIR_KEYS["severity_original"]: clean_str(d.get("severity_original")),
                PAIR_KEYS["vuln_class"]: clean_str(d.get("vuln_class")) or "",
                PAIR_KEYS["cve_ids"]: [c.upper() for c in (d.get("cve_ids") or []) if c],
                PAIR_KEYS["cwe_ids"]: [c.upper() for c in (d.get("cwe_ids") or []) if c],
                PAIR_KEYS["report_year"]: clean_year(d.get("report_year")),
                PAIR_KEYS["license"]: clean_str(d.get("license")) or "",
                PAIR_KEYS["source_url"]: clean_str(d.get("source_url")),
            }
        )

        terms = set(
            tokenize(
                f"{d.get('technical_text') or ''} {d.get('technical_context') or ''} "
                f"{d.get('executive_text') or ''}",
                stop,
            )
        )
        doc_len.append(len(terms))
        for t in terms:
            postings[t].append(idx)

    # Delta-encode each posting list. Document ids are ascending by construction,
    # and the gaps are small numbers that gzip far better than the absolutes:
    # measured on this corpus it is ~100 KB gzipped cheaper, for four lines of
    # decoding on the client.
    encoded: dict[str, list[int]] = {}
    for term, docs in postings.items():
        prev = 0
        deltas = []
        for doc in docs:
            deltas.append(doc - prev)
            prev = doc
        encoded[term] = deltas

    return pairs, encoded, doc_len


def serialize(payload: dict) -> str:
    """JSON-encode, then neutralise every character that can escape a markup
    context.

    THIS IS NOT OPTIONAL, and it is not paranoia about this particular file.
    The corpus is security reports: findings quote real exploit payloads as
    prose, and 32 pairs across 9 firms carry a literal "</script>" inside the
    finding text. The first build of scripts/build_pair_browser.py popped an
    alert box the moment it opened, because the browser ended the data block at
    the finding's own closing tag and ran the rest of the finding as code.

    This file is fetched as JSON rather than inlined, so it is one refactor away
    from that same hole rather than in it. Escaping costs nothing and closes the
    hole permanently: inside a JSON string \\u003c decodes back to "<", so the
    reader gets the finding verbatim and no parser anywhere gets a tag. The
    payloads are never removed. They are part of the finding, and the dataset's
    whole claim is that the text is what was published.
    """
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    text = text.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")

    assert "</script" not in text.lower(), "script breakout survived escaping"
    assert "<" not in text and ">" not in text and "&" not in text, "raw markup character survived escaping"
    assert json.loads(text) == payload, "escaping changed the data it was supposed to preserve"
    return text


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dataset", default=DEFAULT_DATASET)
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()

    ds = ROOT / args.dataset
    if not ds.exists():
        print(f"dataset not found: {ds}", file=sys.stderr)
        return 1

    stop = set(STOPWORDS)
    allowed = set(REDISTRIBUTABLE)

    total = 0
    kept_rows: list[dict] = []
    licence_hist: collections.Counter = collections.Counter()
    kept_licence_hist: collections.Counter = collections.Counter()
    withheld = collections.Counter()

    for line in ds.open(encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        d = json.loads(line)
        total += 1
        lic = d.get("license") or "(none)"
        licence_hist[lic] += 1

        bad_licence = lic not in allowed
        bad_pii = d.get("pii_scrubbed") is not True
        if bad_licence and bad_pii:
            withheld["licence not redistributable AND pii_scrubbed false"] += 1
            continue
        if bad_licence:
            withheld["licence not redistributable"] += 1
            continue
        if bad_pii:
            withheld["pii_scrubbed false"] += 1
            continue

        kept_rows.append(d)
        kept_licence_hist[lic] += 1

    pairs, postings, doc_len = build(kept_rows, stop)

    payload = {
        "meta": {
            "pairs": len(pairs),
            "withheld": total - len(pairs),
            "total": total,
            "licenses": dict(kept_licence_hist.most_common()),
            "withheldReason": WITHHELD_REASON,
            "buildTag": BUILD_TAG,
            "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
            "sourceFile": ds.name,
        },
        "pairs": pairs,
        # Inverted index over the full findings, delta-encoded. `dl` is the
        # unique-term count per document, which the client needs for length
        # normalisation: without it a 15,000-character finding outranks a
        # precise one simply by containing more words.
        "postings": postings,
        "dl": doc_len,
        "stop": sorted(stop),
    }

    text = serialize(payload)
    raw = text.encode("utf-8")
    out = ROOT / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    gz = len(gzip.compress(raw, 9))

    avg_dl = sum(doc_len) / len(doc_len) if doc_len else 0
    print(f"read      {total:,} rows from {ds.relative_to(ROOT)}")
    print(f"kept      {len(pairs):,} rows")
    print(f"withheld  {total - len(pairs):,} rows")
    for reason, n in withheld.most_common():
        print(f"            {n:>6,}  {reason}")
    print("\nlicence histogram (whole dataset, * = redistributable and indexed)")
    for lic, n in licence_hist.most_common():
        mark = "*" if lic in allowed else " "
        print(f"  {mark} {lic:<34} {n:>6,}  indexed {kept_licence_hist.get(lic, 0):>6,}")
    print(f"\nvocabulary  {len(postings):,} terms  ({sum(len(v) for v in postings.values()):,} postings)")
    print(f"doc length  {avg_dl:.1f} unique terms on average")
    print(f"\nwrote {out.relative_to(ROOT)}")
    print(f"  raw       {len(raw) / 1e6:.2f} MB")
    print(f"  gzipped   {gz / 1e6:.2f} MB  (target < 1.00 MB)")
    if gz > 1_000_000:
        print("  OVER TARGET: drop the postings block and let the client tokenise.", file=sys.stderr)
    print("\nnot committed: public/ is publication, and publication is a separate decision.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
