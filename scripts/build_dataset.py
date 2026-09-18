#!/usr/bin/env python
"""FINAL ASSEMBLY — legible-pairs (GAMEPLAN §4.4–4.6). Version is set by V below.

Merges every pair source, applies verification labels and drops, enriches to
the 27-field schema, generates 1:N group pairs (D32-approved), freezes splits
(report-level, OOD-firm, OOD-temporal — D8), and writes:
  data/dataset/legible-pairs-<V>.jsonl   (one record per pair)
  data/dataset/build_stats.json          (auditable accounting of every drop)

Inclusion rules (decided with owner):
  - verified label 'aligned' → in;  'partial' → in, labeled;  'unaligned' → out
  - structural pairs (CISA, doc-level) → in (needs_llm_verify=False by design)
  - thematic (embed+llm) → in when adjudication confidence >= 0.80
  - dedup: keep first member of each near-dup group, drop the rest
"""

from __future__ import annotations

import hashlib
import json
import pathlib
import random
import re
from collections import Counter, defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data/dataset"
V = "v0.3"

# v0.3: normalización de strings de licencia entre olas de harvest (2026-07-13)
LICENSE_NORM = {
    "public-domain": "public-domain-us-gov",
    "cc by-sa 4.0": "cc-by-sa-4.0", "cc by-sa 3.0": "cc-by-sa-3.0",
    "cc by-sa 2.5": "cc-by-sa-2.5", "cc by 3.0 us": "cc-by-3.0-us",
    "cc-by-4.0": "cc-by-4.0", "cc by 4.0": "cc-by-4.0",
    "ogl-v3-uk": "ogl-uk-3.0",
}

CVE_RX = re.compile(r"CVE-\d{4}-\d{4,7}")
CWE_RX = re.compile(r"CWE-\d{1,4}")
NUM_RX = re.compile(r"\b\d+(?:\.\d+)+\b|\b\d{2,}\b|\b\d+(?:\.\d+)?%")
EMAIL_RX = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")

# Per-record license basis. Core has real licenses; everything else ships full
# text under a research-quotation rationale (Option B: transformative + non-
# commercial + attribution + honored takedown). NOT "pointer-only" — full text is
# included; the reconstruction manifest is kept for provenance transparency only.
LICENSE = {"trailofbits": "cc-by-sa-4.0", "cisa": "public-domain-us-gov"}
NONCORE_LICENSE = "research-quotation-noncommercial"
ORG_TYPE = {"trailofbits": "consultancy", "cisa": "government", "cure53": "consultancy",
            "ostif": "nonprofit"}
# v0.2 sources: org varies per document (34 OIG agencies, 26 companies…) — type
# is determined by the doc_type instead.
DOC_ORG_TYPE = {"oig_audit": "government", "oig_inspection": "government",
                "gao_report": "government", "csrb_report": "government",
                "ghsa_advisory": "maintainer", "ftc_complaint": "government",
                "sec_complaint": "government", "sec_admin_order": "government",
                "incident_postmortem": "vendor", "sec_8k_item105": "issuer",
                "wikipedia_article": "encyclopedia"}

VULN_KEYWORDS = [
    ("web", r"xss|csrf|ssrf|sql injection|idor|cookie|session|http|url|endpoint|api"),
    ("crypto", r"cryptograph|signature|key material|encryption|nonce|hash|zero-knowledge|zk|mpc|dkg"),
    ("cloud", r"kubernetes|container|docker|aws|gcp|azure|iam|s3|ci/cd|pipeline|workflow"),
    ("network", r"tls|certificate|dns|packet|firewall|port|protocol"),
    ("ics", r"plc|scada|modbus|industrial"),
    ("access_control", r"privilege|permission|authoriz|access control|authentication"),
    ("memory", r"overflow|use-after-free|memory safety|out-of-bounds|null pointer"),
]


def jsonl(p):
    f = ROOT / p
    if not f.exists():
        return []
    out, bad = [], 0
    # split on '\n' only — PDF-extracted text carries form-feeds / U+2028 / U+2029
    # that str.splitlines() would (wrongly) treat as record boundaries
    for l in f.read_text().split("\n"):
        if not l.strip():
            continue
        try:
            out.append(json.loads(l))
        except json.JSONDecodeError:
            bad += 1
    if bad:
        print(f"  [warn] {p}: skipped {bad} malformed line(s)")
    return out


def enrich(p: dict) -> dict:
    org = p["source_org"]
    tech, execu = p["technical_text"], p["executive_text"]
    both = tech + " " + execu
    vuln = "other"
    for name, rx in VULN_KEYWORDS:
        if re.search(rx, tech[:3000], re.I):
            vuln = name
            break
    year_m = re.match(r".*?/(\d{4})-", p["source_doc_id"]) or re.match(r".*?(20\d\d)", p["source_doc_id"])
    return {
        "pair_id": p["pair_id"],
        "source_doc_id": p["source_doc_id"],
        "source_org": org,
        "source_org_type": DOC_ORG_TYPE.get(p.get("doc_type", ""), ORG_TYPE.get(org, "consultancy")),
        "source_url": p.get("source_url", ""),  # filled from manifests below
        "doc_type": p["doc_type"],
        "report_year": int(year_m.group(1)) if year_m else None,
        "technical_text": tech,
        "technical_context": p.get("technical_context", ""),
        "executive_text": execu,
        "executive_text_provenance": "natural",
        "audience_observed": p.get("audience_observed", ""),
        "audience_label": None,
        "format_label": "bullet" if p.get("exec_span_kind") == "bullet_list" else "paragraph",
        "severity_original": p.get("severity_original", ""),
        "severity_conveyed": None,  # filled by a later judge pass (product phase)
        "cve_ids": sorted(set(CVE_RX.findall(both))),
        "cwe_ids": sorted(set(CWE_RX.findall(both))),
        "vuln_class": vuln,
        "numeric_facts": sorted(set(NUM_RX.findall(tech)))[:40],
        "alignment_method": p.get("alignment_method", ""),
        "alignment_type": p.get("alignment_type", ""),
        "alignment_label": p.get("alignment_label", "structural"),
        "alignment_confidence": p.get("alignment_confidence"),
        "human_verified": False,
        "pii_scrubbed": not EMAIL_RX.search(both[:8000]),
        # v0.2 candidates carry a per-document license (PD vs contracted-verify
        # for OIG; mixed for 8-K) — honor it; fall back to the per-org table.
        "license": (lambda L: LICENSE_NORM.get(L.lower(), L))(
            p.get("license") or LICENSE.get(org, NONCORE_LICENSE)),
        "split": None,
        "exec_span_kind": p.get("exec_span_kind", "prose"),
        "notes": p.get("notes", ""),
    }


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    stats: dict = {"in": {}, "dropped": Counter(), "kept": Counter()}

    verified = {}
    for fn in ["verified_tob.jsonl", "verified_wave2.jsonl", "verified_ppr_v2.jsonl",
               "verified_recovered.jsonl", "verified_v02.jsonl", "verified_v02b.jsonl",
               "verified_board.jsonl", "verified_ghsa.jsonl", "verified_writeups_v2.jsonl"]:
        for r in jsonl(f"data/pairs/{fn}"):
            verified[r["pair_id"]] = r

    drop_ids = set()
    dedup_f = ROOT / "data/pairs/dedup_groups.json"
    if dedup_f.exists():
        for g in json.load(open(dedup_f)):
            for m in g["members"][1:]:
                drop_ids.add(m["pair_id"])

    sources = {
        "tob_tier0": "data/pairs/candidates_tob_v2.jsonl",  # v2: anaphora fix + recovered units
        "tob_doclevel": "data/pairs/candidates_tob_doclevel.jsonl",
        "tob_thematic": "data/pairs/candidates_tob_thematic.jsonl",
        "cisa": "data/pairs/candidates_cisa.jsonl",
        "wave2": "data/pairs/candidates_wave2.jsonl",
        "ppr_v2": "data/pairs/candidates_ppr_v2.jsonl",
        # ---- v0.2 "registers expansion" (D40-D42, D36-am) ----
        "gov_audit": "data/pairs/candidates_gov_audit.jsonl",    # management (OIG)
        "legal": "data/pairs/candidates_legal.jsonl",            # regulatory (FTC/SEC)
        "postmortem": "data/pairs/candidates_postmortem.jsonl",  # customer (incident)
        "sec8k": "data/pairs/candidates_8k.jsonl",               # investor (event_anchor)
        # ---- v0.2b: lay register + LLM-rescue (D43, D44) ----
        "wiki": "data/pairs/candidates_wiki.jsonl",              # lay (Wikipedia, CC-BY-SA)
        "llm_rescue": "data/pairs/candidates_llm_rescue.jsonl",  # customer/management rescues
        # ---- v0.3: registro board (CSRB/OIG/GAO, adapt_harvest_v03.py) ----
        "board": "data/pairs/candidates_board.jsonl",            # board (verified_board)
        "ghsa": "data/pairs/candidates_ghsa.jsonl",              # developer (verified_ghsa)
        "writeups": "data/pairs/candidates_writeups_v2.jsonl",   # practitioner hard-tier (OOD-style, D46)
    }
    OOD_STYLE_TAGS = {"writeups"}  # D46: 100% held out of train (contamination probe)
    # Doc-level pairs (whole exec ↔ whole findings section) are STRUCTURAL: the
    # finding-level verifier prompt doesn't apply to them, so its unaligned verdict
    # is not meaningful. Treat them as structural (keep as doc_level), regardless of
    # any verifier label they may carry. Finding-level tags still gate on verdict.
    DOCLEVEL_SPANKINDS = {"doc_level"}
    records = []
    seen = set()
    for tag, path in sources.items():
        rows = jsonl(path)
        stats["in"][tag] = len(rows)
        for p in rows:
            pid = p["pair_id"]
            if pid in seen:
                stats["dropped"]["duplicate_id"] += 1
                continue
            seen.add(pid)
            if pid in drop_ids:
                stats["dropped"]["near_duplicate"] += 1
                continue
            is_doclevel = p.get("exec_span_kind") in DOCLEVEL_SPANKINDS
            v = verified.get(pid)
            if is_doclevel:
                # structural: keep, label as doc_level; verifier verdict N/A.
                # (v0.1 lesson: OSTIF/ppr doc-levels were verified with the
                # finding-level prompt → unfairly unaligned; NEVER gate generic
                # doc-levels on that verdict.)
                # EXCEPTION (v0.2, gov_audit ONLY): OIG doc-levels built via
                # the positional fallback carry needs_llm_verify=True as a
                # section-boundary sanity check — drop those on an unaligned
                # consensus.
                if tag in ("gov_audit", "llm_rescue") and p.get("needs_llm_verify") and v and \
                        v["alignment_label"] in ("unaligned", "api_error", "parse_error"):
                    stats["dropped"]["doclevel_positional_rejected"] += 1
                    continue
                p["alignment_label"] = "structural_doclevel"
                p["alignment_confidence"] = None
            elif p.get("needs_llm_verify") and v is None and tag != "tob_thematic":
                stats["dropped"]["unverified_pending"] += 1
                continue
            elif v:
                label = v["alignment_label"]
                if label in ("unaligned", "api_error", "parse_error"):
                    stats["dropped"][f"verifier_{label}"] += 1
                    continue
                p["alignment_label"] = label
                p["alignment_confidence"] = v.get("alignment_confidence")
            if tag == "tob_thematic":
                m = re.search(r"adj_conf=([\d.]+)", p.get("notes", ""))
                conf = float(m.group(1)) if m else 0.0
                if conf < 0.80:
                    stats["dropped"]["thematic_low_conf"] += 1
                    continue
                p["alignment_label"] = "aligned"
                p["alignment_confidence"] = conf
            rec = enrich(p)
            if tag in OOD_STYLE_TAGS:
                rec["_force_split"] = "test_ood_style"   # D46
            records.append(rec)
            stats["kept"][tag] += 1

    # ---- group pairs for 1:N tier-0 (aligned members only) ----
    by_span: dict[tuple, list] = defaultdict(list)
    for r in records:
        if r["alignment_method"] == "id_anchor" and r["alignment_type"] == "1:N" \
                and r["alignment_label"] == "aligned" and "#s" in r["pair_id"]:
            span_key = (r["source_doc_id"], r["pair_id"].split("-f")[0], r["executive_text"])
            by_span[span_key].append(r)
    n_groups = 0
    for (doc, span_id, execu), members in by_span.items():
        if len(members) < 2:
            continue
        tech = "\n\n---\n\n".join(f"[{m['technical_context']}] (severity: {m['severity_original'] or 'n/a'})\n"
                                  + m["technical_text"][:2500] for m in members)
        g = dict(members[0])
        g.update({
            "pair_id": span_id + "-GROUP",
            "technical_text": tech[:14000],
            "technical_context": f"group of {len(members)} findings",
            "alignment_type": "1:N-group",
            "numeric_facts": sorted({n for m in members for n in m["numeric_facts"]})[:40],
            "severity_original": max((m["severity_original"] for m in members), key=lambda s:
                ["", "informational", "undetermined", "low", "medium", "high", "critical"].index(s.lower())
                if s and s.lower() in ["", "informational", "undetermined", "low", "medium", "high", "critical"] else 0),
        })
        records.append(g)
        n_groups += 1
    stats["kept"]["group_pairs"] = n_groups

    # ---- v0.3: group pairs extendidos (1:N embed+llm + Cure53, pre-generados) ----
    n_ext = 0
    for g in jsonl("data/pairs/group_pairs_extended.jsonl"):
        if g["pair_id"] in seen:
            continue
        seen.add(g["pair_id"])
        records.append(g)
        n_ext += 1
    stats["kept"]["group_pairs_ext"] = n_ext

    # ---- dedup near-duplicados (MinHash+LSH sobre executive_text) ANTES de splits ----
    # (prerrequisito del consejo: colapsar boilerplate cross-doc para que near-dups no
    #  crucen train/test). Casero — sin datasketch. Bloquea por LSH banding, verifica
    #  jaccard de word-3-grams; conserva el primer miembro de cada cluster.
    def shingles(t: str) -> set:
        toks = re.findall(r"\w+", (t or "").lower())
        return {" ".join(toks[i:i+3]) for i in range(max(0, len(toks) - 2))} or {t.strip().lower()}

    def minhash(sh: set, n: int = 48) -> tuple:
        sig = []
        for k in range(n):
            best = 1 << 62
            for s in sh:
                h = int(hashlib.blake2b(f"{k}:{s}".encode(), digest_size=8).hexdigest(), 16)
                if h < best:
                    best = h
            sig.append(best)
        return tuple(sig)

    BANDS, ROWS = 12, 4
    buckets: dict = defaultdict(list)
    sigs: dict = {}
    order = [r for r in records if r.get("alignment_type") != "1:N-group"]  # no dedup group pairs
    for idx, r in enumerate(order):
        # dedup sobre AMBOS lados: los 1:N comparten exec por diseño (N findings → 1 frase),
        # así que solo son duplicados reales si técnico Y ejecutivo casi coinciden (boilerplate).
        sh = shingles((r.get("technical_text", "") or "")[:2000] + " || " + r.get("executive_text", ""))
        sig = minhash(sh)
        sigs[idx] = (sig, sh)
        for b in range(BANDS):
            band = sig[b * ROWS:(b + 1) * ROWS]
            buckets[(b, band)].append(idx)

    parent = list(range(len(order)))
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    def union(a, b):
        parent[find(a)] = find(b)

    checked = set()
    for members in buckets.values():
        if len(members) < 2:
            continue
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                a, b = members[i], members[j]
                if (a, b) in checked:
                    continue
                checked.add((a, b))
                sa, sb = sigs[a][1], sigs[b][1]
                jac = len(sa & sb) / max(1, len(sa | sb))
                if jac >= 0.85:
                    union(a, b)

    clusters: dict = defaultdict(list)
    for idx in range(len(order)):
        clusters[find(idx)].append(idx)
    drop_dup = set()
    n_dupclusters = 0
    for root, idxs in clusters.items():
        if len(idxs) < 2:
            continue
        n_dupclusters += 1
        # conservar el primero por pair_id estable; soltar el resto
        idxs_sorted = sorted(idxs, key=lambda k: order[k]["pair_id"])
        for k in idxs_sorted[1:]:
            drop_dup.add(id(order[k]))
    before = len(records)
    records = [r for r in records if id(r) not in drop_dup]
    stats["dropped"]["minhash_near_dup"] = before - len(records)
    stats["dedup_clusters"] = n_dupclusters

    # ---- splits (D8 + D52 + D46 OOD-style): report-level, OOD-firm/temporal/style ----
    # D52: asignación por HASH del doc_id, no RNG secuencial.
    OOD_FIRMS = {"Doyensec", "NCCGroup"}         # whole firms held out
    docs = sorted({r["source_doc_id"] for r in records})

    def doc_rand(d: str) -> float:
        h = hashlib.sha1(f"20260707:{d}".encode()).hexdigest()[:12]
        return int(h, 16) / 16**12

    doc_split = {}
    for d in docs:
        org = next(r["source_org"] for r in records if r["source_doc_id"] == d)
        year = next(r["report_year"] for r in records if r["source_doc_id"] == d)
        if org in OOD_FIRMS:
            doc_split[d] = "test_ood_firm"
        elif year and year >= 2026:
            doc_split[d] = "test_ood_temporal"
        else:
            x = doc_rand(d)
            doc_split[d] = "train" if x < 0.8 else ("val" if x < 0.9 else "test")
    for r in records:
        r["split"] = r.get("_force_split") or doc_split[r["source_doc_id"]]  # D46 OOD-style wins
        r.pop("_force_split", None)

    with (OUT_DIR / f"legible-pairs-{V}.jsonl").open("w") as fh:
        for r in records:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    stats["total_records"] = len(records)
    stats["by_split"] = dict(Counter(r["split"] for r in records))
    stats["by_license"] = dict(Counter(r["license"] for r in records))
    stats["by_org"] = dict(Counter(r["source_org"] for r in records).most_common(15))
    stats["dropped"] = dict(stats["dropped"])
    stats["kept"] = dict(stats["kept"])
    json.dump(stats, open(OUT_DIR / "build_stats.json", "w"), indent=1)
    print(json.dumps(stats, indent=1)[:1500])


if __name__ == "__main__":
    main()
