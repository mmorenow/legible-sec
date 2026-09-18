#!/usr/bin/env python3
"""Download the 30-doc LEGIBLE calibration set, verify each is a real PDF,
compute SHA-256, and write a downloads manifest (JSON) for the parse step.

Every filename below was obtained by listing the real source (GitHub API /
cure53.de page HTML) -- none are guessed.
"""
import hashlib
import json
import os
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(ROOT, "data", "calibration", "pdfs")
DOWNLOADS_JSON = os.path.join(ROOT, "data", "calibration", "downloads.json")

TOB_RAW = "https://raw.githubusercontent.com/trailofbits/publications/master/reviews/"
PPR_RAW = "https://raw.githubusercontent.com/juliocesarfort/public-pentesting-reports/master/"
CURE_BASE = "https://cure53.de/"

# (firm, filename) for Trail of Bits, stratified by year, varied subjects.
TOB = [
    # 2026 x4
    ("TrailOfBits", "2026-02-aave-v4-securityreview.pdf"),
    ("TrailOfBits", "2026-01-bron-mcp-securityreview.pdf"),
    ("TrailOfBits", "2026-04-pypi-warehouse-securityreview.pdf"),
    ("TrailOfBits", "2026-03-Zoo-TextToCad-security-review.pdf"),
    # 2025 x4
    ("TrailOfBits", "2025-03-google-gocryptographiclibraries-securityreview.pdf"),
    ("TrailOfBits", "2025-05-libvlc-securityreview.pdf"),
    ("TrailOfBits", "2025-08-meta-whatsapp-privateprocessing-securityreview.pdf"),
    ("TrailOfBits", "2025-11-edera-container-runtime-securityreview.pdf"),
    # 2024 x4
    ("TrailOfBits", "2024-07-uniswap-v4-core-securityreview.pdf"),
    ("TrailOfBits", "2024-10-huggingface-gradio-securityreview.pdf"),
    ("TrailOfBits", "2024-12-istio-ztunnel-securityreview.pdf"),
    ("TrailOfBits", "2024-09-kraken-mobile-wallet-icloud-backup-securityreview.pdf"),
    # 2023 x3
    ("TrailOfBits", "2023-09-openssl-securityreview.pdf"),
    ("TrailOfBits", "2023-08-worldcoin-orb-securityreview.pdf"),
    ("TrailOfBits", "2023-01-keda-securityreview.pdf"),
    # 2022 x2
    ("TrailOfBits", "2022-12-curl-securityreview.pdf"),
    ("TrailOfBits", "2022-12-openvpn-openvpn2-securityreview.pdf"),
    # 2021 x1
    ("TrailOfBits", "2021-11-aave-v3-securityreview.pdf"),
    # no-year x2 (older)
    ("TrailOfBits", "CloudEvents.pdf"),
    ("TrailOfBits", "88mph.pdf"),
]

# Cure53: the obsidian-3 pair (required) + 3 spanning different years/subjects.
CURE53 = [
    ("Cure53", "summary-report_obsidian-3.pdf"),
    ("Cure53", "pentest-report_obsidian-3.pdf"),
    ("Cure53", "pentest-report_expressvpn-mailguard_2026.pdf"),
    ("Cure53", "pentest-report_mullvad_2024_v1.pdf"),
    ("Cure53", "pentest-report_keepassium.pdf"),
]

# public-pentesting-reports: 5 different firms, none ToB/Cure53.
PPR = [
    ("NCCGroup", "NCCGroup/NCC-Group-Public-Report-VPN-by-Google-One-v1.0.pdf"),
    ("Bishop Fox", "Bishop Fox/C Plus Plus Alliance - Boost JSON Security Assessment 2020 - Assessment Report - 20210317.pdf"),
    ("Doyensec", "Doyensec/Doyensec_Apollo_Report_Q22022_v4_AfterRetest.pdf"),
    ("RadicallyOpenSecurity", "RadicallyOpenSecurity/2017-Pentest-Ushahidi_crowdsource_mapping_tool-v1.0.pdf"),
    ("X41 D-Sec", "X41 D-Sec/X41-ISC-BIND9-Code-Audit-Public-Report-2024-02-13.pdf"),
]


def build_entries():
    entries = []
    for firm, name in TOB:
        entries.append({
            "source_group": "tob", "firm": firm, "filename": name,
            "url": TOB_RAW + urllib.parse.quote(name), "subdir": "tob",
        })
    for firm, name in CURE53:
        entries.append({
            "source_group": "cure53", "firm": firm, "filename": name,
            "url": CURE_BASE + urllib.parse.quote(name), "subdir": "cure53",
        })
    for firm, path in PPR:
        name = os.path.basename(path)
        entries.append({
            "source_group": "ppr", "firm": firm, "filename": name,
            "url": PPR_RAW + urllib.parse.quote(path), "subdir": "ppr",
        })
    return entries


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "legible-p0/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    with open(dest, "wb") as f:
        f.write(data)
    return len(data)


def main():
    entries = build_entries()
    results = []
    for e in entries:
        dest = os.path.join(PDF_DIR, e["subdir"], e["filename"])
        rec = dict(e)
        try:
            if os.path.exists(dest) and os.path.getsize(dest) > 50 * 1024:
                with open(dest, "rb") as f:
                    head = f.read(5)
                if head.startswith(b"%PDF"):
                    size = os.path.getsize(dest)
                    rec.update(status="cached", file_size_bytes=size,
                               sha256=sha256_of(dest))
                    results.append(rec)
                    print(f"CACHED  {e['filename']} ({size} B)")
                    continue
            size = download(e["url"], dest)
            with open(dest, "rb") as f:
                head = f.read(5)
            ok_pdf = head.startswith(b"%PDF")
            ok_size = size > 50 * 1024
            if ok_pdf and ok_size:
                rec.update(status="ok", file_size_bytes=size, sha256=sha256_of(dest))
                print(f"OK      {e['filename']} ({size} B)")
            else:
                rec.update(status=f"BADFILE pdf={ok_pdf} size={size}",
                           file_size_bytes=size, sha256=None)
                print(f"BADFILE {e['filename']} pdf={ok_pdf} size={size}")
        except Exception as ex:  # noqa: BLE001
            rec.update(status=f"ERROR {type(ex).__name__}: {ex}",
                       file_size_bytes=None, sha256=None)
            print(f"ERROR   {e['filename']}: {ex}")
        results.append(rec)

    with open(DOWNLOADS_JSON, "w") as f:
        json.dump(results, f, indent=2)

    ok = sum(1 for r in results if r["status"] in ("ok", "cached"))
    print(f"\n{ok}/{len(results)} verified PDFs. Manifest -> {DOWNLOADS_JSON}")
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
