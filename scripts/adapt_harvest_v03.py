#!/usr/bin/env python3
"""v0.3 ADAPTER — convierte el harvest de registros al esquema nativo del build.

Produce:
  data/pairs/candidates_board.jsonl   333 pares board (CSRB/OIG/GAO) en esquema candidato
  data/pairs/verified_board.jsonl     veredictos unificados (dual-API ola 1 + Claude ola 2)
  data/dataset/legible-register-v0.3.jsonl   material de registro aprobado (keeps del judge)
                                             — config separado, NUNCA cuenta como pares

Idempotente; correr antes de scripts/build_dataset.py.
"""
from __future__ import annotations

import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
H = ROOT / "data/pairs/harvest"


def jsonl(p: pathlib.Path):
    if not p.exists():
        return []
    return [json.loads(l) for l in p.read_text().split("\n") if l.strip()]


def slug(s: str, cap: int = 60) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")[:cap] or "untitled"


def board_candidates() -> list[dict]:
    out = []

    def mk(r: dict, pid: str) -> dict:
        source = (r.get("source") or "").upper()
        doc_type = {"CSRB": "csrb_report", "GAO": "gao_report"}.get(source, "oig_audit")
        title = r.get("report_title") or ""
        year_m = re.search(r"(20\d\d)", title) or re.search(r"(20\d\d)", r.get("source_url") or "")
        year = year_m.group(1) if year_m else "0000"
        return {
            "pair_id": pid,
            "source_doc_id": f"{source.lower()}/{year}-{slug(title)}",
            "source_org": r.get("agency") or source,
            "doc_type": doc_type,
            "technical_text": r.get("technical_text") or "",
            "technical_context": title,
            "executive_text": r.get("board_text") or r.get("executive_text") or "",
            "audience_observed": "board",
            "exec_span_kind": "prose",
            "alignment_method": "board_extract",
            "alignment_type": "1:1",
            "license": "public-domain-us-gov",
            "source_url": r.get("source_url") or "",
            "needs_llm_verify": True,
            "notes": r.get("note") or "",
        }

    for r in jsonl(H / "board_all_for_verify.jsonl"):
        out.append(mk(r, r["pair_id"]))
    for fname in ("board_oig_4.jsonl", "board_gao_2.jsonl"):
        for i, r in enumerate(jsonl(H / fname)):
            out.append(mk(r, r.get("pair_id") or f"{fname}#{i}"))
    return out


def main() -> None:
    # ---- board: candidatos + veredictos unificados ----
    cands = board_candidates()
    with (ROOT / "data/pairs/candidates_board.jsonl").open("w") as fh:
        for r in cands:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")

    verd = jsonl(H / "board_verified.jsonl") + jsonl(H / "board_verified_2.jsonl")
    with (ROOT / "data/pairs/verified_board.jsonl").open("w") as fh:
        for r in verd:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"board: {len(cands)} candidatos, {len(verd)} veredictos")

    # ---- GHSA developer register (ola 3, verificado) ----
    dates = {}
    dpath = H / "ghsa_dates.json"
    if dpath.exists():
        dates = json.loads(dpath.read_text())
    gh = []
    for r in jsonl(H / "ghsa_v2.jsonl"):
        year = (dates.get(r["ghsa_id"]) or "0000")[:4]
        gh.append({
            "pair_id": r["ghsa_id"],
            "source_doc_id": f"ghsa/{year}-{r['ghsa_id'].lower()}",
            "source_org": "GHSA",
            "doc_type": "ghsa_advisory",
            "technical_text": r["technical_text"],
            "technical_context": f"{r.get('package','')} ({r.get('severity','')})",
            "executive_text": r["impact_text"],
            "audience_observed": "developer",
            "exec_span_kind": "prose",
            "alignment_method": "ghsa_impact",
            "alignment_type": "1:1",
            "severity_original": (r.get("severity") or "").capitalize(),
            "license": "cc-by-4.0",
            "source_url": r.get("source_url") or "",
            "needs_llm_verify": True,
            "notes": f"vuln_class_harvest={r.get('vuln_class','')}",
        })
    with (ROOT / "data/pairs/candidates_ghsa.jsonl").open("w") as fh:
        for r in gh:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"ghsa: {len(gh)} candidatos (verified_ghsa.jsonl aparte)")

    # ---- writeups hard-tier (verificados) → candidatos, ruta OOD-style (D46) ----
    wv = {r["pair_id"]: r for r in jsonl(ROOT / "data/pairs/verified_writeups_v2.jsonl")}
    n_wr = 0
    for r in jsonl(ROOT / "data/pairs/candidates_writeups_v2.jsonl"):
        r["_ood_style"] = True  # D46: 100% held out of train (contamination probe)
        n_wr += 1
    print(f"writeups: {n_wr} candidatos (ruta OOD-style, verified_writeups_v2.jsonl aparte)")

    # ---- material de registro (keeps) → config separado ----
    reg = []
    for src in ("pa_judged.jsonl", "wave2_judged.jsonl"):
        for r in jsonl(H / src):
            if r.get("judge_verdict") != "keep":
                continue
            reg.append({
                "text": r.get("analogy_text") or r.get("plain_text") or "",
                "kind": r.get("mode") or r.get("register") or "public",
                "concept": r.get("concept") or "",
                "source": r.get("source") or r.get("author") or r.get("author_or_org") or "",
                "source_url": r.get("source_url") or "",
                "license": r.get("license") or "research-quotation-noncommercial",
                "score": r.get("score"),
                "judge_confidence": r.get("judge_confidence"),
                "judge_model": r.get("judge_model"),
                "truncated_suspect": bool(r.get("truncated_suspect")),
            })
    # 8-K investor-register exemplars (todos; texto de divulgación investor-facing)
    for r in jsonl(H / "sec8k_v2.jsonl"):
        reg.append({
            "text": r.get("disclosure_text") or "", "kind": "investor",
            "concept": r.get("incident") or "",
            "source": r.get("company") or "", "source_url": r.get("source_url") or "",
            "license": "edgar-public-filing", "technical_ref_url": r.get("technical_ref_url"),
            "filing_date": r.get("filing_date"), "score": None,
            "judge_confidence": None, "judge_model": None, "truncated_suspect": False,
        })
    # customer-register exemplars (solo keeps del judge)
    cv = {r["line_idx"]: r for r in jsonl(H / "judge_queue/customer_letters_1.verdicts.jsonl")}
    for i, r in enumerate(jsonl(H / "customer_letters_1.jsonl")):
        v = cv.get(i, {})
        if v.get("verdict") == "drop":
            continue
        reg.append({
            "text": r.get("customer_text") or "", "kind": "customer",
            "concept": r.get("incident") or "",
            "source": r.get("company") or "", "source_url": r.get("source_url") or "",
            "license": "public-record-breach-notification",
            "technical_ref_url": r.get("technical_ref_url"),
            "judge_verdict": v.get("verdict"), "score": None,
            "judge_confidence": v.get("confidence"), "judge_model": "claude-sonnet-max 2026-07-13",
            "truncated_suspect": bool(v.get("truncated_suspect")),
        })
    outp = ROOT / "data/dataset/legible-register-v0.3.jsonl"
    with outp.open("w") as fh:
        for r in reg:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    from collections import Counter
    print(f"registro: {len(reg)} keeps → {outp.name}")
    print("  por kind:", dict(Counter(r['kind'] for r in reg)))


if __name__ == "__main__":
    main()
