#!/usr/bin/env python3
"""FINETUNE MIX v0.3 — contabilidad en TOKENS supervisados, no en ejemplos.

Corrección al mix de research/14 §3 (aceptada por el owner 2026-07-12): el
60/25/15 se especificaba en pesos de ejemplo, pero con train_on_responses_only
el gradiente vive en los tokens del target — y un target T3 de 300 palabras
pesa ~10× un T1 de 25. Aquí los shares se imponen SOBRE TOKENS:

  T1 crisp 1:1      60% de los tokens supervisados   (la habilidad titular)
  T2 grouped        25%
  T3 doc-verdict    15%  (target capado al párrafo-veredicto)

Caps de research/13 §4: ninguna casa >45% de los tokens de T1 (aplicado por
re-pesado); registro condicionado en el system prompt (D45 + register tags).

Entradas:  data/dataset/legible-pairs-v0.3.jsonl + core_1to1_curated.jsonl
Salidas:   data/finetune/train_v03.jsonl  (messages + weight por ejemplo)
           data/finetune/val_v03.jsonl
           data/finetune/mix_report_v03.json  (mix realizado, para la card — D48)
"""
from __future__ import annotations

import json
import pathlib
import re
from collections import Counter, defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
DS = ROOT / "data/dataset/legible-pairs-v0.3.jsonl"
OUT = ROOT / "data/finetune"

TOKEN_SHARE = {"T1": 0.60, "T2": 0.25, "T3": 0.15}
HOUSE_CAP_T1 = 0.45          # ninguna org >45% de los tokens de T1
T3_TARGET_WORD_CAP = 180     # párrafo-veredicto, no el exec entero

AUDIENCE_PHRASE = {
    "technical_leadership": "a technical leadership audience",
    "board": "a corporate board / oversight audience",
    "management": "a senior management audience",
    "regulatory": "a regulator or legal audience",
    "customer": "affected customers",
    "investor": "public investors (SEC disclosure register)",
    "lay": "a general non-technical audience",
    "developer": "downstream developers who depend on this software",
    "public": "the general public",
}

SYSTEM_T1 = ("You are a security communication translator. Rewrite the technical "
             "security finding as one crisp executive translation for {aud}. Lead "
             "with what an attacker can do; preserve the severity band, numbers, "
             "and preconditions exactly; never invent facts.")
SYSTEM_T2 = ("You are a security communication translator. The findings below share "
             "one executive takeaway. Synthesize them into a single faithful "
             "executive sentence for {aud}; preserve severity bands, numbers, and "
             "preconditions exactly; never invent facts.")
SYSTEM_T3 = ("You are a security communication translator. Write the executive "
             "verdict paragraph for this report's findings, addressed to {aud}. "
             "Be faithful to severity and scope; never invent facts.")


def est_tokens(text: str) -> int:
    return max(1, round(len(text.split()) * 1.3))


def first_paragraphs(text: str, word_cap: int) -> str:
    out, n = [], 0
    for para in re.split(r"\n\s*\n", text.strip()):
        w = len(para.split())
        if out and n + w > word_cap:
            break
        out.append(para)
        n += w
        if n >= word_cap:
            break
    return "\n\n".join(out)


def tier_of(r: dict, core_ids: set) -> str | None:
    if r["alignment_type"] == "1:N-group":
        return "T2"
    if r["alignment_label"] == "structural_doclevel" or r.get("exec_span_kind") == "doc_level":
        return "T3"
    if r["alignment_type"] == "1:1" and r["alignment_label"] == "aligned":
        if r["pair_id"] in core_ids:
            return "T1"
        if r["alignment_method"] in ("board_extract", "ghsa_impact", "writeup_summary"):
            return "T1"   # registros verificados finding-level (v0.3+)
    return None           # 1:N crudo, thematic, partial, 1:1 no curado → fuera del SFT


def to_example(r: dict, tier: str) -> dict:
    aud = AUDIENCE_PHRASE.get(r.get("audience_observed") or "", AUDIENCE_PHRASE["technical_leadership"])
    system = {"T1": SYSTEM_T1, "T2": SYSTEM_T2, "T3": SYSTEM_T3}[tier].format(aud=aud)
    target = r["executive_text"].strip()
    if tier == "T3":
        target = first_paragraphs(target, T3_TARGET_WORD_CAP)
    return {
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": r["technical_text"].strip()[:8000]},
            {"role": "assistant", "content": target},
        ],
        "pair_id": r["pair_id"],
        "tier": tier,
        "register": r.get("audience_observed") or "technical_leadership",
        "source_org": r["source_org"],
        "split": r["split"],
        "est_target_tokens": est_tokens(target),
    }


def main() -> None:
    OUT.mkdir(exist_ok=True)
    core_ids = {json.loads(l)["pair_id"]
                for l in open(ROOT / "data/pairs/core_1to1_curated.jsonl") if l.strip()}

    examples = {"train": [], "val": []}
    excluded = Counter()
    for l in open(DS):
        r = json.loads(l)
        if r["split"] not in ("train", "val"):
            continue
        t = tier_of(r, core_ids)
        if t is None:
            excluded[r["alignment_type"] + "/" + str(r["alignment_label"])] += 1
            continue
        examples[r["split"]].append(to_example(r, t))

    train = examples["train"]
    tok = defaultdict(int)
    for e in train:
        tok[e["tier"]] += e["est_target_tokens"]

    # peso base: share_objetivo / tokens_totales_del_tier
    for e in train:
        e["weight"] = TOKEN_SHARE[e["tier"]] / tok[e["tier"]]

    # cap de casa dentro de T1 (sobre tokens ponderados)
    t1 = [e for e in train if e["tier"] == "T1"]
    wtok = lambda es: sum(e["weight"] * e["est_target_tokens"] for e in es)
    total_t1 = wtok(t1)
    by_org = Counter()
    for e in t1:
        by_org[e["source_org"]] += e["weight"] * e["est_target_tokens"]
    for org, share_tok in by_org.items():
        share = share_tok / total_t1
        if share > HOUSE_CAP_T1:
            scale_down = HOUSE_CAP_T1 / share
            rest_scale = (1 - HOUSE_CAP_T1) / (1 - share)
            for e in t1:
                e["weight"] *= scale_down if e["source_org"] == org else rest_scale

    # normalizar: media de peso = 1 (solo importa lo relativo para el sampler)
    mean_w = sum(e["weight"] for e in train) / len(train)
    for e in train:
        e["weight"] = round(e["weight"] / mean_w, 6)

    for split, path in (("train", OUT / "train_v03.jsonl"), ("val", OUT / "val_v03.jsonl")):
        with path.open("w") as fh:
            for e in examples[split]:
                fh.write(json.dumps(e, ensure_ascii=False) + "\n")

    # ---- mix realizado (para la model card, D48) ----
    realized_tok = defaultdict(float)
    for e in train:
        realized_tok[e["tier"]] += e["weight"] * e["est_target_tokens"]
    tot = sum(realized_tok.values())
    t1_org = Counter()
    for e in train:
        if e["tier"] == "T1":
            t1_org[e["source_org"]] += e["weight"] * e["est_target_tokens"]
    report = {
        "examples": dict(Counter(e["tier"] for e in train)),
        "raw_target_tokens": dict(tok),
        "weighted_token_share": {t: round(v / tot, 4) for t, v in realized_tok.items()},
        "t1_org_token_share": {o: round(v / sum(t1_org.values()), 4)
                               for o, v in t1_org.most_common(8)},
        "register_distribution": dict(Counter(e["register"] for e in train)),
        "excluded_from_sft": dict(excluded),
        "val_examples": len(examples["val"]),
        "token_share_targets": TOKEN_SHARE, "house_cap_t1": HOUSE_CAP_T1,
        "t3_target_word_cap": T3_TARGET_WORD_CAP,
        "token_estimator": "words*1.3 (sustituir por tokenizer real en el freeze)",
    }
    json.dump(report, open(OUT / "mix_report_v03.json", "w"), indent=1)
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
