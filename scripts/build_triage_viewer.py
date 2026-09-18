#!/usr/bin/env python3
"""Genera el visualizer de triage LEGIBLE: revisados / pendientes / resto v0.2."""
import json, os

ROOT = "/Users/marcelomoreno/Downloads/legible-sec"
OUT = os.path.join(ROOT, "data/dataset/legible-triage.html")

CAP_FULL = 1400   # secciones 1-2
CAP_MINI = 240    # sección 3

def rows(path):
    with open(os.path.join(ROOT, path)) as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)

def cut(s, cap):
    s = (s or "").strip()
    if len(s) <= cap:
        return s
    return s[:cap].rsplit(" ", 1)[0] + " …"

items = []

# ---------- Sección 1: revisados ----------
curated_ids = set()
for r in rows("data/pairs/core_1to1_curated.jsonl"):
    curated_ids.add(r["pair_id"])
    items.append({
        "sec": "rev", "grp": "core", "id": r["pair_id"],
        "org": r.get("source_org") or "?", "year": r.get("report_year"),
        "lbl": r.get("alignment_label"), "conf": r.get("alignment_confidence"),
        "sev": r.get("severity_original"), "split": r.get("split"),
        "lic": r.get("license"), "diff": r.get("difficulty"),
        "t": cut(r.get("technical_text"), CAP_FULL),
        "e": cut(r.get("executive_text"), CAP_FULL),
        "title": r.get("technical_context") or "",
    })

verdicts = {r["pair_id"]: r for r in rows("data/pairs/harvest/board_verified.jsonl")}
for r in rows("data/pairs/harvest/board_all_for_verify.jsonl"):
    v = verdicts.get(r["pair_id"], {})
    items.append({
        "sec": "rev", "grp": "board", "id": r["pair_id"],
        "org": r.get("source") or "?", "year": None,
        "lbl": v.get("alignment_label"), "conf": v.get("alignment_confidence"),
        "sev": None, "split": None, "lic": r.get("license"),
        "t": cut(r.get("technical_text"), CAP_FULL),
        "e": cut(r.get("board_text") or r.get("executive_text"), CAP_FULL),
        "title": r.get("report_title") or "",
        "vote": " · ".join(f"{k}={x}" for k, x in (v.get("vote") or {}).items()),
    })

# ---------- Sección 1b: board ola 2 (verificados con subagente Claude) ----------
v2 = {r["pair_id"]: r for r in rows("data/pairs/harvest/board_verified_2.jsonl")}
for fname in ["board_oig_4.jsonl", "board_gao_2.jsonl"]:
    for i, r in enumerate(rows("data/pairs/harvest/" + fname)):
        pid = r.get("pair_id") or f"{fname}#{i}"
        v = v2.get(pid, {})
        items.append({
            "sec": "rev", "grp": "board", "id": pid,
            "org": r.get("source") or "?", "year": None,
            "lbl": v.get("alignment_label"), "conf": v.get("alignment_confidence"),
            "sev": None, "split": None, "lic": r.get("license"),
            "t": cut(r.get("technical_text"), CAP_FULL),
            "e": cut(r.get("board_text"), CAP_FULL),
            "title": r.get("report_title") or "", "agency": r.get("agency") or "",
        })

# ---------- Sección 2: cosecha juzgada (ambas olas) ----------
for src in ["data/pairs/harvest/pa_judged.jsonl", "data/pairs/harvest/wave2_judged.jsonl"]:
    for r in rows(src):
        items.append({
            "sec": "jz", "grp": r.get("mode") or r.get("register") or "public",
            "id": "", "org": (r.get("source") or r.get("author")
                              or r.get("author_or_org") or "?"),
            "lbl": r["judge_verdict"], "conf": r.get("judge_confidence"),
            "e": cut(r.get("analogy_text") or r.get("plain_text"), CAP_FULL),
            "concept": r.get("concept") or "", "url": r.get("source_url") or "",
            "score": r.get("score"), "lic": r.get("license"),
            "jreason": r.get("judge_reason") or "",
        })

# ---------- Sección 3: resto del v0.2 (fuera del core 1:1) ----------
for r in rows("data/dataset/legible-pairs-v0.2.jsonl"):
    if r["pair_id"] in curated_ids:
        continue
    items.append({
        "sec": "rest", "grp": r.get("source_org") or "?", "id": r["pair_id"],
        "org": r.get("source_org") or "?", "year": r.get("report_year"),
        "lbl": r.get("alignment_label"), "split": r.get("split"),
        "meth": r.get("alignment_method"), "lic": r.get("license"),
        "t": cut(r.get("technical_text"), CAP_MINI),
        "e": cut(r.get("executive_text"), CAP_MINI),
    })

# blob de búsqueda
for it in items:
    it["q"] = " ".join(str(it.get(k) or "") for k in
                       ("id", "org", "title", "concept", "t", "e", "agency")).lower()

counts = {s: sum(1 for i in items if i["sec"] == s) for s in ("rev", "jz", "rest")}
print("items:", counts, "total", len(items))

payload = json.dumps(items, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
print("payload MB:", round(len(payload.encode()) / 1e6, 2))

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "triage_viewer_template.html")) as f:
    html = f.read()

html = (html.replace("__DATA__", payload)
            .replace("__N_REV__", str(counts["rev"]))
            .replace("__N_JZ__", str(counts["jz"]))
            .replace("__N_REST__", str(counts["rest"])))

with open(OUT, "w") as f:
    f.write(html)
print("OK →", OUT, round(os.path.getsize(OUT) / 1e6, 2), "MB")
