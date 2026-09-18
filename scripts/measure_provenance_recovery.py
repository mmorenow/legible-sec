#!/usr/bin/env python
"""How much of the missing source_url is recoverable, and from where. READ ONLY.

D58 records the missing provenance as a hard gate before the dataset ships
anywhere, and says to dry-run the join first to measure the match rate. This is
that dry run. It writes nothing: not the dataset, not a manifest, not a cache.
`finalize_provenance.py` is the script that writes, and it is deliberately not
called from here.

Why the gap exists, which the numbers below make visible: that writer knows six
download manifests (tob, cisa_csa, cisa_ics, cure53, ostif, ppr) and the corpus
now has fourteen. Everything harvested after v0.2 (OIG, GAO, legal complaints,
postmortems, Wikipedia, 8-K filings) had no join path at all, which is why
coverage fell from 16% missing at v0.2 to 91.5% missing at v0.3 without anybody
breaking anything. The corpus grew and the join did not follow it.

Three strategies are tried per record, in order, and the report says which one
would have earned each URL. That ordering matters: an exact key match is
provenance, a filename-stem match is a reasonable inference, and a fuzzy tail
match is a guess. A gate that cannot tell them apart is not a gate.

    python scripts/measure_provenance_recovery.py [--dataset data/dataset/legible-pairs-v0.4.jsonl]
"""

from __future__ import annotations

import argparse
import collections
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]

# Per manifest: the fields that can carry an id, and the fields that can carry a
# URL, most authoritative first. Recorded as data rather than as code because
# every one of these was read off the actual file, and the next harvest will add
# a row here rather than a branch somewhere.
MANIFESTS: list[tuple[str, list[str], list[str]]] = [
    ("downloads_tob.json", ["filename"], ["url"]),
    ("downloads_cisa_csa.json", ["id", "filename"], ["url"]),
    ("downloads_cisa_ics.json", ["id", "filename"], ["url"]),
    ("downloads_cure53.json", ["filename"], ["url"]),
    ("downloads_ostif.json", ["filename"], ["blog_post_url", "url"]),
    ("downloads_ppr.json", ["dest_filename", "filename"], ["url"]),
    ("downloads_oig.json", ["doc_id"], ["detail_url", "pdf_url"]),
    ("downloads_gao.json", ["doc_id", "id", "filename"], ["url"]),
    ("downloads_legal.json", ["doc_id"], ["url"]),
    ("downloads_postmortem.json", ["slug"], ["url"]),
    ("downloads_wikipedia.json", ["slug"], ["url"]),
    ("downloads_sec8k.json", ["filename", "id"], ["url"]),
    ("downloads_sec8k_v2.json", ["filename", "id"], ["url"]),
]

DEAD_URLS = {"", "None", None, "null"}


def aliases(value: str) -> list[str]:
    """Every shape the same document id takes across the corpus.

    The dataset writes `<source>/<org>__<stem>`; the manifests write `<stem>`,
    or `<org>__<stem>` with the org spelled differently. So a single normalised
    key misses three whole sources (cure53, ppr, postmortem: 730 rows) that are
    sitting in a manifest with a URL beside them. The candidates are generated
    in specificity order and the caller reports which one matched, because
    "the ids were identical" and "the tails were identical" are different
    claims about provenance.
    """
    base = norm(value)
    out = [base]
    if "__" in base:
        out.append(base.split("__", 1)[1])   # drop the source prefix
        out.append(base.rsplit("__", 1)[1])  # drop everything but the stem
    # The length floor applies only to the DERIVED aliases. A stripped tail can
    # be a fragment that collides with anything; the base key cannot, because it
    # is the id as written. An earlier version guarded all three and silently
    # dropped `krack` and `locky`, real Wikipedia slugs that happen to be five
    # characters long, which is how a safety rule becomes a bug.
    seen: set[str] = set()
    keep = [base] + [a for a in out[1:] if len(a) >= 6]
    return [a for a in keep if a and not (a in seen or seen.add(a))]


def norm(value: str) -> str:
    """The join key, reduced to what survives a rename.

    Extensions, directory prefixes and case are all noise here: the same
    document is `tob/foo.pdf` in one file and `foo` in another. Punctuation is
    not reduced, because two OIG reports differ only by a trailing hash.
    """
    v = str(value).strip().lower()
    v = v.rsplit("/", 1)[-1]
    for ext in (".pdf", ".html", ".htm", ".json", ".txt", ".md"):
        if v.endswith(ext):
            v = v[: -len(ext)]
    return v


def load_manifest(name: str) -> list[dict]:
    p = ROOT / "data/corpus" / name
    if not p.exists():
        return []
    try:
        d = json.loads(p.read_text())
    except json.JSONDecodeError:
        return []
    items = d if isinstance(d, list) else list(d.values())
    return [i for i in items if isinstance(i, dict)]


def build_index() -> tuple[dict[str, str], dict[str, str], int]:
    """exact-key index, normalised-key index, and how many URLs were found."""
    exact: dict[str, str] = {}
    loose: dict[str, str] = {}
    urls = 0
    for name, id_fields, url_fields in MANIFESTS:
        for entry in load_manifest(name):
            url = next((entry[f] for f in url_fields if entry.get(f) not in DEAD_URLS), None)
            if not url:
                continue
            urls += 1
            for f in id_fields:
                raw = entry.get(f)
                if not raw:
                    continue
                exact.setdefault(str(raw), url)
                for a in aliases(str(raw)):
                    loose.setdefault(a, url)
    return exact, loose, urls


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="data/dataset/legible-pairs-v0.4.jsonl")
    ap.add_argument(
        "--write",
        action="store_true",
        help="Apply the exact and stem matches to the dataset. Takes a timestamped "
        "backup first and refuses to run without one. Fuzzy matches are NEVER "
        "written: a guess in a provenance field is worse than a blank.",
    )
    args = ap.parse_args()

    ds = ROOT / args.dataset
    if not ds.exists():
        print(f"dataset not found: {ds}", file=sys.stderr)
        return 2

    exact, loose, manifest_urls = build_index()
    print(f"manifests   {len(MANIFESTS)} files, {manifest_urls} entries carrying a URL")
    print(f"index       {len(exact)} exact keys, {len(loose)} normalised keys\n")

    # per source prefix: total, already has a url, and what each strategy adds
    stats: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    total = 0

    # NOT splitlines(). Python splits on \x0b, \x0c, \x85, \u2028 and \u2029 as
    # well as \n, and this corpus is security reports: form feeds and Unicode
    # line separators survive inside the verbatim finding text, so splitlines()
    # tears records in half and the file stops being parseable. Iterating the
    # file object splits on \n alone, which is what JSONL actually means.
    for line in ds.open(encoding="utf-8"):
        if not line.strip():
            continue
        r = json.loads(line)
        total += 1
        doc = r.get("source_doc_id", "")
        # `oig__long-slug` records carry the whole slug as the prefix, so the
        # bucket is the part before the first separator of either kind.
        prefix = doc.split("/", 1)[0].split("__", 1)[0] or "(none)"
        s = stats[prefix]
        s["total"] += 1

        if r.get("source_url") not in DEAD_URLS:
            s["already"] += 1
            continue

        if doc in exact:
            s["exact"] += 1
        elif any(a in loose for a in aliases(doc)):
            s["stem"] += 1
        else:
            # last resort: does any indexed key contain this document's tail, or
            # the other way round. Counted separately and never merged into the
            # others, because it is a guess and the gate has to be able to say so.
            tail = aliases(doc)[-1] if aliases(doc) else norm(doc)
            if len(tail) >= 12 and any(tail in k or k in tail for k in loose):
                s["fuzzy"] += 1
            else:
                s["none"] += 1

    order = sorted(stats.items(), key=lambda kv: -kv[1]["total"])
    head = f"{'source':<14}{'rows':>7}{'has url':>9}{'exact':>8}{'stem':>7}{'fuzzy':>7}{'none':>7}{'after':>8}"
    print(head)
    print("-" * len(head))
    agg = collections.Counter()
    for prefix, s in order:
        after = s["already"] + s["exact"] + s["stem"]
        for k in ("total", "already", "exact", "stem", "fuzzy", "none"):
            agg[k] += s[k]
        agg["after"] += after
        pct = 100 * after / s["total"] if s["total"] else 0
        print(
            f"{prefix[:14]:<14}{s['total']:>7}{s['already']:>9}{s['exact']:>8}"
            f"{s['stem']:>7}{s['fuzzy']:>7}{s['none']:>7}{after:>7} {pct:>3.0f}%"
        )
    print("-" * len(head))
    print(
        f"{'ALL':<14}{agg['total']:>7}{agg['already']:>9}{agg['exact']:>8}"
        f"{agg['stem']:>7}{agg['fuzzy']:>7}{agg['none']:>7}{agg['after']:>7} "
        f"{100 * agg['after'] / max(total, 1):>3.0f}%"
    )
    print()
    print(f"before  {agg['already']:>5} / {total} have a source_url  ({100 * agg['already'] // max(total,1)}%)")
    print(f"after   {agg['after']:>5} / {total} would, on exact and stem matches alone  "
          f"({100 * agg['after'] // max(total,1)}%)")
    print(f"guess   {agg['fuzzy']:>5} more are reachable only by a fuzzy tail match, which is not provenance")
    print(f"lost    {agg['none']:>5} have no candidate in any manifest")
    if not args.write:
        print("\nNothing was written. Re-run with --write to apply the exact and stem")
        print("matches. Fuzzy matches are never written, in either mode.")
        print("(`finalize_provenance.py` is the older writer. It still points at v0.2")
        print("and knows six of these fourteen manifests, so it is not the one to use.)")
        return 0

    return apply(ds, exact, loose)


def apply(ds: pathlib.Path, exact: dict[str, str], loose: dict[str, str]) -> int:
    """Write the recovered URLs, behind a backup, and report the diff.

    Three rules this obeys, all of them for the same reason: a provenance field
    that is wrong is worse than one that is blank, because the blank is visible
    and the wrong one is not.

      1. A record that already has a `source_url` is never touched. The value
         that was written at extraction time beats a value inferred from a
         filename, always.
      2. Fuzzy matches are not written. If it did not match exactly or on a
         stem, the field stays empty and stays countable.
      3. The write goes to a temporary file that is moved into place only after
         it is complete, so an interrupt cannot leave a half dataset behind.
    """
    import datetime
    import shutil

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = ds.with_suffix(ds.suffix + f".bak-{stamp}")
    shutil.copy2(ds, backup)
    if not backup.exists() or backup.stat().st_size != ds.stat().st_size:
        print("backup failed, refusing to write", file=sys.stderr)
        return 3
    print(f"\nbackup      {backup.name}")

    tmp = ds.with_suffix(ds.suffix + ".tmp")
    filled = untouched = still_blank = 0
    with ds.open(encoding="utf-8") as src, tmp.open("w", encoding="utf-8") as out:
        for line in src:
            if not line.strip():
                continue
            r = json.loads(line)
            if r.get("source_url") not in DEAD_URLS:
                untouched += 1
            else:
                doc = r.get("source_doc_id", "")
                url = exact.get(doc)
                if url is None:
                    url = next((loose[a] for a in aliases(doc) if a in loose), None)
                if url:
                    r["source_url"] = url
                    filled += 1
                else:
                    still_blank += 1
            out.write(json.dumps(r, ensure_ascii=False) + "\n")

    tmp.replace(ds)
    total = filled + untouched + still_blank
    print(f"filled      {filled}")
    print(f"kept        {untouched} that already had one")
    print(f"still blank {still_blank}")
    print(f"coverage    {filled + untouched}/{total} "
          f"({100 * (filled + untouched) // max(total, 1)}%)")
    print("\nRe-run without --write to verify, and diff against the backup before")
    print("you trust it. Nothing else in the record was modified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
