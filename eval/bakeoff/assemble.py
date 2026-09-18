"""Fase 2 — ensambla el bake-off para evaluación humana ciega.

- Junta las salidas de los 4 modelos (raw/*.jsonl).
- Corre el judge determinista v1 sobre cada traducción (métrica SECUNDARIA; se guarda
  aparte, NO se le muestra al humano para no sesgar).
- Anonimiza + baraja -> anon_items.jsonl (sin identidad de modelo).
- Guarda mapping.json (item_id -> modelo) aparte.
"""
from __future__ import annotations
import json, pathlib, random, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
from legible.judge import run_deterministic  # noqa: E402

BO = ROOT / "eval/bakeoff"
RAW = BO / "raw"
MODELS = ["gpt-5.2", "gemini-3-flash-preview", "plaintext-9b", "claude-opus"]


def main():
    findings = {f["fid"]: f for f in (json.loads(l) for l in open(BO / "findings.jsonl"))}
    n_find = len(findings)
    items = []
    for model in MODELS:
        p = RAW / f"{model}.jsonl"
        if not p.exists():
            print(f"  FALTA {p} — se salta {model}"); continue
        nrows = sum(1 for _ in open(p))
        if nrows < n_find - 2:  # arm incompleto → se excluye del sheet (evita comparación asimétrica)
            print(f"  INCOMPLETO {model}: {nrows}/{n_find} — EXCLUIDO del sheet (pendiente)"); continue
        for r in (json.loads(l) for l in open(p)):
            f = findings.get(r["fid"])
            if not f:
                continue
            tr = (r.get("translation") or "").strip()
            items.append({"fid": r["fid"], "model": model, "audience_key": r["audience_key"],
                          "finding": f["finding"], "translation": tr,
                          "omitted_details": r.get("omitted_details") or [],
                          "severity_conveyed": r.get("severity_conveyed"),
                          "severity_text": f.get("severity_text")})

    # judge v1 sobre cada salida (métrica secundaria)
    judged = {}
    for i, it in enumerate(items):
        rep = run_deterministic(it["finding"], it["translation"],
                                omitted_details=it["omitted_details"],
                                severity_conveyed=it["severity_conveyed"])
        judged[i] = {"ok": rep.ok,
                     "fails": sorted({f.check for f in rep.flags if f.level == "fail"}),
                     "warns": sorted({f.check for f in rep.flags if f.level == "warn"})}

    # anonimizar + barajar
    idx = list(range(len(items)))
    random.seed(20260718)
    random.shuffle(idx)
    anon, mapping, judge_by_item = [], {}, {}
    for new_id, old in enumerate(idx, 1):
        it = items[old]
        iid = f"IT{new_id:03d}"
        anon.append({"item_id": iid, "audience_key": it["audience_key"],
                     "finding": it["finding"], "translation": it["translation"]})
        mapping[iid] = {"model": it["model"], "fid": it["fid"], "severity_text": it["severity_text"]}
        judge_by_item[iid] = judged[old]

    with open(BO / "anon_items.jsonl", "w") as f:
        for a in anon: f.write(json.dumps(a) + "\n")
    json.dump(mapping, open(BO / "mapping.json", "w"), indent=2)
    json.dump(judge_by_item, open(BO / "judge_by_item.json", "w"), indent=2)

    # resumen (agregado por modelo, para el reporte — el humano no lo ve)
    from collections import Counter
    per_model = Counter(); fails_model = Counter(); empty = Counter()
    for iid, m in mapping.items():
        per_model[m["model"]] += 1
        if not judge_by_item[iid]["ok"]:
            fails_model[m["model"]] += 1
    for it in items:
        if not it["translation"]:
            empty[it["model"]] += 1
    print(f"items totales: {len(anon)}")
    for mdl in MODELS:
        print(f"  {mdl:24} n={per_model[mdl]:3}  judge-fail={fails_model[mdl]:3}  vacíos={empty[mdl]}")
    print(f"-> anon_items.jsonl / mapping.json / judge_by_item.json")


if __name__ == "__main__":
    main()
