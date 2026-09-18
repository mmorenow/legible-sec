#!/usr/bin/env python3
"""LEGIBLE P1 Task A: download the full Trail of Bits `reviews/` PDF corpus.

Lists every PDF under reviews/ in github.com/trailofbits/publications via the
git trees API (untruncated), downloads each from raw.githubusercontent.com to
data/corpus/pdfs/tob/, verifying it starts with %PDF. The 20 PDFs already
present in data/calibration/pdfs/tob/ (P0 calibration set) are copied over
instead of re-downloaded. Writes data/corpus/downloads_tob.json with filename,
url, sha256, size per file.

Resumable: a file already present and verified in data/corpus/pdfs/tob/ is
skipped. Politeness: ~0.3s delay between network downloads, 2 retries with
backoff on failure.
"""
import hashlib
import json
import os
import sys
import subprocess
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS = os.path.join(ROOT, "data", "corpus")
PDF_DIR = os.path.join(CORPUS, "pdfs", "tob")
CAL_TOB_DIR = os.path.join(ROOT, "data", "calibration", "pdfs", "tob")
MANIFEST_JSON = os.path.join(CORPUS, "downloads_tob.json")
TREE_CACHE = os.path.join(CORPUS, "logs", "tob_tree.json")

RAW_BASE = "https://raw.githubusercontent.com/trailofbits/publications/master/"
REPO = "trailofbits/publications"
DELAY_S = 0.3
MAX_RETRIES = 2  # additional attempts beyond the first


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


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
        print("WARNING: tree listing truncated by GitHub API!", file=sys.stderr)
    with open(TREE_CACHE, "w") as f:
        json.dump(d, f)
    return d


def list_pdfs():
    d = get_tree()
    tree = d["tree"]
    pdfs = [t["path"] for t in tree
            if t["path"].startswith("reviews/") and t["path"].endswith(".pdf")]
    return sorted(pdfs)


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "legible-p1/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    with open(dest, "wb") as f:
        f.write(data)
    return len(data)


def verify(dest):
    if not os.path.exists(dest):
        return False, 0
    size = os.path.getsize(dest)
    if size < 1024:
        return False, size
    with open(dest, "rb") as f:
        head = f.read(5)
    return head.startswith(b"%PDF"), size


def main():
    os.makedirs(PDF_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(TREE_CACHE), exist_ok=True)

    paths = list_pdfs()
    print(f"{len(paths)} PDF(s) found under reviews/ in trailofbits/publications.")

    cal_files = set(os.listdir(CAL_TOB_DIR)) if os.path.isdir(CAL_TOB_DIR) else set()

    results = []
    n_copied = n_cached = n_downloaded = n_failed = 0
    for path in paths:
        filename = path.split("/")[-1]
        dest = os.path.join(PDF_DIR, filename)
        url = RAW_BASE + path
        rec = {"filename": filename, "url": url}

        ok, size = verify(dest)
        if ok:
            rec.update(status="cached", size=size, sha256=sha256_of(dest))
            results.append(rec)
            n_cached += 1
            continue

        if filename in cal_files:
            src = os.path.join(CAL_TOB_DIR, filename)
            ok_src, size_src = verify(src)
            if ok_src:
                with open(src, "rb") as fsrc, open(dest, "wb") as fdst:
                    fdst.write(fsrc.read())
                ok2, size2 = verify(dest)
                rec.update(status="copied_from_calibration", size=size2,
                           sha256=sha256_of(dest))
                results.append(rec)
                n_copied += 1
                print(f"COPIED  {filename} ({size2} B)")
                continue

        # Download with retries.
        err = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                size = download(url, dest)
                ok, size = verify(dest)
                if not ok:
                    raise ValueError(f"downloaded file failed %PDF/size check (size={size})")
                err = None
                break
            except Exception as ex:  # noqa: BLE001
                err = f"{type(ex).__name__}: {ex}"
                if attempt < MAX_RETRIES:
                    time.sleep(1.5 * (attempt + 1))
        if err is None:
            rec.update(status="downloaded", size=size, sha256=sha256_of(dest))
            n_downloaded += 1
            print(f"OK      {filename} ({size} B)")
        else:
            rec.update(status=f"ERROR {err}", size=None, sha256=None)
            n_failed += 1
            print(f"FAIL    {filename}: {err}")
        results.append(rec)
        time.sleep(DELAY_S)

    with open(MANIFEST_JSON, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nTotals: cached={n_cached} copied={n_copied} downloaded={n_downloaded} "
          f"failed={n_failed} / {len(paths)}")
    print(f"Manifest -> {MANIFEST_JSON}")
    return 0 if n_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
