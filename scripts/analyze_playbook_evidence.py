#!/usr/bin/env python3
"""Reproduce every headline statistic cited in docs/PLAYBOOK.md (v1.0).

Companion to scripts/mine_playbook.py (the v0.1 first pass). This script runs
the deeper v0.2 analyses the playbook cites: subject taxonomy, capability
dose-response, severity-naming exactness, calibration language, precondition
folding, number typology and survival, grouping, doc-level structure, and
register signatures. Pure local stats — no LLM, no network.

Usage: .venv/bin/python scripts/analyze_playbook_evidence.py [--dataset PATH]

NOTE on manual adjudications: the playbook's "0 true softenings" claim comes
from reading all lexically flagged pairs by hand; this script prints the flags
(§R6) so the adjudication can be repeated, it does not automate the judgment.
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import statistics


def sents(t: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", t) if s.strip()]


SEV_WORD = re.compile(
    r"\b(critical|high|medium|moderate|low|informational)([- ]severity|[- ]risk|[- ]impact)?\b", re.I)
BANDS = {"critical": 4, "high": 3, "medium": 2, "moderate": 2, "low": 1, "informational": 0, "info": 0}

CAP = re.compile(
    r"\b(can|could|may|would|allow\w*|enabl\w*|lets?|possible|risk of|leads? to|leading to|"
    r"result\w* in|expos\w*|cause\w*)\b", re.I)
BIZ = re.compile(
    r"\b(revenue|financial|cost|budget|fine[sd]?|penalt|lawsuit|legal|regulat|complian|"
    r"reputation|customer trust|business|monetar|insurance|liabilit|shareholder|investor)\b", re.I)
CALIB = re.compile(
    r"\b(not (directly )?exploit|difficult[- ]to[- ]exploit|hard to exploit|no evidence|"
    r"did not (uncover|find|identify|observe)|unlikely|low likelihood|edge case|"
    r"defense[- ]in[- ]depth|theoretical|"
    r"requires? (an? )?(attacker|authenticat|local|physical|admin|elevated|privileged)|"
    r"would require|cannot be (directly )?exploit|"
    r"mitigated|prevented (by|via)|not currently exploitable|no direct|limited impact|"
    r"only if|only when)\b", re.I)
CAVEAT_T = re.compile(
    r"\b(requires? (an? )?(authenticat|local|physical|admin|elevated|user interaction)|"
    r"only if|only when|difficult to exploit|no evidence|not exploitable|theoretical|"
    r"low likelihood)\b", re.I)
ACTOR = re.compile(
    r"\b(an?y?|any|the)\s+"
    r"((?:malicious|unauthenticated|authenticated|unprivileged|low-privileged|local|remote|"
    r"network|physical(?:ly)?)\s+)?"
    r"(attacker|adversary|user|member|site|website|actor|insider|employee|prover|client)s?\b"
    r"((?:\s+(?:with|on|in|who|present on|able to)\s+[\w\s'-]{3,40})?)", re.I)
MECH_FIRST = re.compile(
    r"^(the|a|an)\s+\w+[\w .\-]*?\s(system|application|app|service|platform|codebase|library|"
    r"protocol|contract|implementation|component|website|site|product|API|network|firmware|"
    r"device|server)\b", re.I)
MAT_NUM = re.compile(
    r"(\d[\d,\.]*)\s*(%|percent|records?|users?|customers?|accounts?|victims?|consumers?|"
    r"months?|days?|years?|hours?|vulnerabilit|systems?|servers?|locations?|repositories|"
    r"downloads?|instances?|devices?)", re.I)
HEDGE = re.compile(
    r"\b(no evidence|we believe|we are confident|out of an abundance of caution|"
    r"we have no indication|at this time)\b", re.I)
VERDICT = re.compile(
    r"\b(mature|robust|well[- ](tested|structured|documented|designed|written)|sound|solid|"
    r"high[- ]quality|good (security )?posture|security posture|defense[- ]in[- ]depth|"
    r"immature|adequate|insufficient testing|lacks? (documentation|tests)|code quality)\b", re.I)
AGG = re.compile(
    r"\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+"
    r"(findings?|issues?|vulnerabilit|flaws?|recommendations?)\b", re.I)
REC = re.compile(r"\b(we recommend|should|must|advise|prioritize|remediat)\b", re.I)
SEVW = re.compile(r"\b(critical|high|medium|low|informational)[- ]severity\b", re.I)
TERMS = ["cross-site scripting", "xss", "sql injection", "csrf", "ssrf",
         "remote code execution", "buffer overflow", "race condition", "reentrancy",
         "denial of service", "privilege escalation", "deserialization", "path traversal",
         "out-of-bounds", "integer overflow", "use-after-free", "man-in-the-middle", "nonce"]
IDRX = re.compile(
    r"\b(?:TOB|FVP|DYL|NV|TB|EXP|MON|PBL|DEC|NYM|RSP|KGO|FLO|WAC|ENT|DAP)-[A-Z0-9]*-?\d+\b")


def pct(k: int, n: int) -> str:
    return f"{k}/{n} = {k / max(1, n):.0%}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="data/dataset/legible-pairs-v0.2.jsonl")
    args = ap.parse_args()
    rows = [json.loads(l) for l in open(args.dataset)]
    fl = [r for r in rows if r.get("exec_span_kind") != "doc_level"
          and r.get("alignment_label") in ("aligned", "partial")]
    tl = [r for r in fl if r["audience_observed"] == "technical_leadership"]
    print(f"pairs {len(rows)} | finding-level aligned/partial {len(fl)} | technical_leadership {len(tl)}")

    print("\n== §2/R3 compression anatomy ==")
    t0 = [r for r in rows if r["source_org"] == "trailofbits"
          and r.get("alignment_method") == "id_anchor"
          and r.get("alignment_type") == "1:1" and r.get("alignment_label") == "aligned"]
    tw = [len(r["technical_text"].split()) for r in t0]
    ew = [len(r["executive_text"].split()) for r in t0]
    print(f"  TOB 1:1 (n={len(t0)}): median technical {statistics.median(tw):.0f}w -> exec {statistics.median(ew):.0f}w")
    comp = [len(r['executive_text'].split()) / max(1, len(r['technical_text'].split())) for r in fl]
    print(f"  finding-level compression: median {statistics.median(comp):.0%}, "
          f"<=40% in {pct(sum(c <= 0.4 for c in comp), len(comp))}")

    print("\n== R1 subject anchoring ==")
    first = [sents(r["executive_text"])[0] if sents(r["executive_text"]) else "" for r in tl]
    print(f"  mechanism/system-subject first sentence: {pct(sum(bool(MECH_FIRST.match(f)) for f in first), len(tl))}")
    print(f"  business vocabulary anywhere in exec (tl): {pct(sum(bool(BIZ.search(r['executive_text'])) for r in tl), len(tl))}")

    print("\n== R2 precondition folding ==")
    tcav = [r for r in tl if CAVEAT_T.search(r["technical_text"])]
    k = sum(bool(CALIB.search(r["executive_text"])) for r in tcav)
    print(f"  tech-caveat pairs whose exec carries calibration language: {pct(k, len(tcav))}")
    qual = bare = 0
    for r in tl:
        m = ACTOR.search(r["executive_text"])
        if not m:
            continue
        if (m.group(2) or "").strip() or (m.group(4) or "").strip():
            qual += 1
        else:
            bare += 1
    print(f"  actor mentions qualified (folded precondition): {pct(qual, qual + bare)}")

    print("\n== R4 capability dose-response ==")
    for band in ["Critical", "High", "Medium", "Low", "Informational"]:
        sub = [r for r in tl if (r.get("severity_original") or "").lower() == band.lower()]
        if sub:
            print(f"  {band:14} {pct(sum(bool(CAP.search(r['executive_text'])) for r in sub), len(sub))}")

    print("\n== R5 pointer / grouping ==")
    ida = [r for r in rows if r["source_org"] in ("trailofbits", "cure53")
           and r.get("alignment_method") == "id_anchor"]
    seen, multi, single = set(), 0, 0
    for r in ida:
        e = r["executive_text"]
        if e in seen:
            continue
        seen.add(e)
        n_ids = len(set(IDRX.findall(e)))
        if n_ids > 1:
            multi += 1
        elif n_ids == 1:
            single += 1
    print(f"  distinct ID-citing exec sentences citing >=2 findings: {pct(multi, multi + single)}")

    print("\n== R6 severity naming (flags require manual adjudication) ==")
    have = named = flags = 0
    for r in tl:
        so = (r.get("severity_original") or "").lower()
        if so not in BANDS:
            continue
        have += 1
        m = SEV_WORD.search(r["executive_text"])
        if m:
            named += 1
            if BANDS.get(m.group(1).lower(), 99) < BANDS[so]:
                flags += 1
                print(f"    FLAG {r['pair_id']} [{r['severity_original']}]: "
                      f"{r['executive_text'][:110].replace(chr(10), ' ')}")
    print(f"  spans naming a severity word: {pct(named, have)}; lexical soften-flags: {flags} "
          f"(v1.0 adjudication: all artifacts, 0 true softenings)")

    print("\n== R7 calibration language ==")
    print(f"  overall (tl): {pct(sum(bool(CALIB.search(r['executive_text'])) for r in tl), len(tl))}")
    crit = [r for r in tl if (r.get('severity_original') or '').lower() == 'critical']
    print(f"  at Critical: {pct(sum(bool(CALIB.search(r['executive_text'])) for r in crit), len(crit))}")

    print("\n== R8 material-number survival by register ==")
    for reg in ["practitioner", "management", "technical_leadership", "regulatory"]:
        sub = ([r for r in rows if r["audience_observed"] == reg] if reg == "practitioner"
               else [r for r in fl if r["audience_observed"] == reg])
        app = kept = 0
        for r in sub:
            tm = set(m.group(1).replace(",", "") for m in MAT_NUM.finditer(r["technical_text"]))
            if not tm:
                continue
            app += 1
            if any(n in r["executive_text"] for n in tm):
                kept += 1
        print(f"  {reg:22} {pct(kept, app)}")

    print("\n== R9 bounded assurance ==")
    cust = [r for r in fl if r["audience_observed"] == "customer"]
    print(f"  customer register hedged/bounded claims: {pct(sum(bool(HEDGE.search(r['executive_text'])) for r in cust), len(cust))}")

    print("\n== R10/R11 doc-level structure (TOB) ==")
    dl = [r for r in rows if r["source_org"] == "trailofbits" and r.get("exec_span_kind") == "doc_level"]
    for name, rx in [("posture-verdict", VERDICT), ("aggregate counts", AGG),
                     ("recommendation language", REC), ("severity words", SEVW)]:
        print(f"  {name:24} {pct(sum(bool(rx.search(r['executive_text'])) for r in dl), len(dl))}")

    print("\n== §7 register signatures ==")
    cisa = [r for r in rows if r["source_org"] == "cisa"]
    k = sum(1 for r in cisa if re.search(
        r"successful exploitation of (this|these) vulnerabilit(y|ies) could", r["executive_text"], re.I))
    print(f"  CISA 'Successful exploitation…could' formula: {pct(k, len(cisa))}")

    print("\n== A5 jargon ==")
    both = kept = 0
    for r in tl:
        t, e = r["technical_text"].lower(), r["executive_text"].lower()
        tt = [x for x in TERMS if x in t]
        if tt:
            both += 1
            kept += any(x in e for x in tt)
    print(f"  classic vuln-class term survival (tl): {pct(kept, both)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
