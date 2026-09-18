#!/usr/bin/env python
"""LLM verification of candidate pairs (GAMEPLAN §4.3 step 0 verify / step 3 gates).

Modes:
  --make-sanity        Build a 50-item gold set (25 hand-verified positives from
                       bron/pypi/gradio + 25 synthetic negatives made by swapping
                       in a WRONG finding from the same report).
  --sanity --model M   Score model M on the gold set (accuracy, cost) — the bake-off.
  --run --model M      Verify a candidates JSONL (3-pass self-consistency, resumable).

Key: read from OPENAI_API_KEY env var or .env file at repo root. Never printed.
Budget guard: hard-stops when estimated spend exceeds --budget-usd (default 3.0).
"""

from __future__ import annotations

import argparse
import json
import pathlib
import random
import re
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]

# $/MTok (input, output) — research/02+04, verified 2026-07-04. Re-check on first run.
PRICES = {
    "gpt-5-mini": (0.25, 2.00),
    "gpt-5.4-mini": (0.75, 4.50),
    "gpt-5.2": (1.75, 14.00),
    "gemini-3-flash-preview": (0.50, 3.00),  # for later, via --base-url
}

PROMPT = """You are verifying a dataset of paired (executive claim → technical finding) \
extractions from security reports. Judge whether the EXECUTIVE sentence is genuinely \
discussing/summarizing the TECHNICAL finding — not merely mentioning its ID in passing, \
and not discussing a different issue.

TECHNICAL FINDING:
{tech}

EXECUTIVE SENTENCE:
{exec}

Reply with JSON only: {{"label": "aligned"|"partial"|"unaligned", "confidence": 0.0-1.0, \
"reason": "<one short sentence>"}}
- aligned: the sentence summarizes/translates this finding (fully or as part of a group)
- partial: related but conflates or only tangentially covers it
- unaligned: different issue, or a bare reference with no substantive claim"""


def load_key() -> str:
    import os
    key = os.environ.get("OPENAI_API_KEY", "")
    env = ROOT / ".env"
    if not key and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("OPENAI_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        sys.exit("No OPENAI_API_KEY found (env var or .env). Aborting before any call.")
    return key


def call(model: str, prompt: str, key: str, temperature: float, base_url: str) -> tuple[dict, int, int]:
    # NB: gpt-5* reasoning models reject any temperature other than the default —
    # omit the field everywhere; default-temp variation is what self-consistency needs.
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
    }).encode()
    req = urllib.request.Request(
        f"{base_url}/chat/completions", data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                out = json.load(r)
            usage = out.get("usage", {})
            text = out["choices"][0]["message"]["content"]
            m = re.search(r"\{.*\}", text, re.S)
            return (json.loads(m.group(0)) if m else {"label": "parse_error"},
                    usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0))
        except Exception as e:
            if attempt == 3:
                return {"label": "api_error", "reason": str(e)[:200]}, 0, 0
            time.sleep(2 ** (attempt + 1))
    return {"label": "api_error"}, 0, 0


def make_sanity(out_path: pathlib.Path) -> None:
    src = [json.loads(l) for l in open(ROOT / "data/pairs/candidates_tob.jsonl")]
    gold_docs = ("bron-mcp", "pypi-warehouse", "huggingface-gradio")
    pos = [p for p in src if any(g in p["source_doc_id"] for g in gold_docs)]
    random.seed(42)
    pos = random.sample(pos, min(25, len(pos)))
    # negatives: same exec sentence, WRONG finding from the same report
    by_doc: dict[str, list[dict]] = {}
    for p in src:
        by_doc.setdefault(p["source_doc_id"], []).append(p)
    neg = []
    for p in random.sample(pos, len(pos)):
        others = [q for q in by_doc[p["source_doc_id"]]
                  if q["finding_numbers"] != p["finding_numbers"]
                  and not (set(q["finding_numbers"]) & set(p["finding_numbers"]))
                  and q["executive_text"] != p["executive_text"]]
        if not others:
            continue
        wrong = random.choice(others)
        neg.append({**p, "pair_id": p["pair_id"] + "-NEG",
                    "technical_text": wrong["technical_text"],
                    "technical_context": wrong["technical_context"],
                    "_gold": "unaligned"})
        if len(neg) >= 25:
            break
    items = [{**p, "_gold": "aligned"} for p in pos] + neg
    random.shuffle(items)
    with out_path.open("w") as fh:
        for it in items:
            fh.write(json.dumps(it) + "\n")
    print(f"sanity set: {len(items)} items ({sum(1 for i in items if i['_gold']=='aligned')} pos / "
          f"{sum(1 for i in items if i['_gold']=='unaligned')} neg) -> {out_path}")


def run(args) -> None:
    key = load_key()
    in_price, out_price = PRICES.get(args.model, (1.0, 5.0))
    items = [json.loads(l) for l in open(args.pairs)]
    if args.limit:
        items = items[: args.limit]
    out_path = pathlib.Path(args.out)
    done = set()
    if out_path.exists():
        done = {json.loads(l)["pair_id"] for l in open(out_path)}
    spend = 0.0
    correct = total_gold = 0
    with out_path.open("a") as fh:
        for it in items:
            if it["pair_id"] in done:
                continue
            prompt = PROMPT.format(tech=it["technical_text"][:2400], exec=it["executive_text"][:900])
            votes, in_t, out_t = [], 0, 0
            passes = 1 if args.sanity else args.passes
            for _ in range(passes):
                res, i_t, o_t = call(args.model, prompt, key, 0.7 if passes > 1 else 0.0, args.base_url)
                votes.append(res)
                in_t += i_t; out_t += o_t
            spend += in_t * in_price / 1e6 + out_t * out_price / 1e6
            labels = [v.get("label", "?") for v in votes]
            label = max(set(labels), key=labels.count)
            confs = [v.get("confidence", 0) for v in votes if isinstance(v.get("confidence"), (int, float))]
            rec = {**it, "alignment_label": label,
                   "alignment_confidence": round(sum(confs) / len(confs), 3) if confs else None,
                   "passes_agree": len(set(labels)) == 1, "verifier_model": args.model,
                   "verifier_reason": votes[0].get("reason", "")}
            fh.write(json.dumps(rec) + "\n")
            if "_gold" in it:
                total_gold += 1
                ok = (label == "aligned") == (it["_gold"] == "aligned")
                correct += ok
            if spend > args.budget_usd:
                print(f"BUDGET STOP at ${spend:.2f}")
                break
    print(f"model={args.model} done. est. spend=${spend:.3f}")
    if total_gold:
        print(f"SANITY ACCURACY: {correct}/{total_gold} = {correct/total_gold:.1%}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--make-sanity", action="store_true")
    ap.add_argument("--sanity", action="store_true", help="run on the gold set, report accuracy")
    ap.add_argument("--run", action="store_true")
    ap.add_argument("--model", default="gpt-5-mini")
    ap.add_argument("--pairs", default="data/pairs/sanity_gold.jsonl")
    ap.add_argument("--out", default="")
    ap.add_argument("--passes", type=int, default=3)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--budget-usd", type=float, default=3.0)
    ap.add_argument("--base-url", default="https://api.openai.com/v1")
    args = ap.parse_args()
    if args.make_sanity:
        make_sanity(ROOT / "data/pairs/sanity_gold.jsonl")
        return
    if not args.out:
        tag = "sanity" if args.sanity else "verified"
        args.out = f"data/pairs/{tag}_{args.model.replace('.', '_')}.jsonl"
    run(args)


if __name__ == "__main__":
    main()
