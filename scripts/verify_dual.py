#!/usr/bin/env python3
"""LEGIBLE D6-am: 2-model cross-family verification (owner decision 2026-07-09).

Replaces the 3-pass single-model scheme for all NEW batches:
  pass A: OpenAI  (gpt-5-mini,  OPENAI_API_KEY)
  pass B: Gemini  (gemini-3-flash-preview via OpenAI-compat endpoint, GEMINI_API_KEY)
Vote:  both aligned          -> aligned   (confidence = mean)
       exactly one aligned   -> partial   (kept flagged; human-adjudication pile)
       zero aligned          -> unaligned (out; kept labeled, never deleted)

Runs scripts/verify_pairs.py twice (--passes 1 each) then merges. Resumable:
each single-model run is itself resumable, and the merge is pure/local.

Usage:
  .venv/bin/python scripts/verify_dual.py --pairs data/pairs/candidates_X.jsonl \
      --out data/pairs/verified_X.jsonl [--budget-usd 3]
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai"


def env_key(name: str) -> str:
    v = os.environ.get(name, "")
    if v:
        return v
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"No {name} in env or .env")


def run_leg(pairs: str, out: str, model: str, base_url: str | None, key: str, budget: float):
    cmd = [
        str(ROOT / ".venv/bin/python"), str(ROOT / "scripts/verify_pairs.py"),
        "--run", "--passes", "1", "--model", model,
        "--pairs", pairs, "--out", out, "--budget-usd", str(budget),
    ]
    if base_url:
        cmd += ["--base-url", base_url]
    env = dict(os.environ, OPENAI_API_KEY=key)
    print(f"[leg] {model} -> {out}")
    subprocess.run(cmd, check=True, env=env, cwd=ROOT)


def load(path: str) -> dict[str, dict]:
    out = {}
    p = ROOT / path
    if p.exists():
        for line in p.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                out[r["pair_id"]] = r
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pairs", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--budget-usd", type=float, default=3.0, help="per leg")
    ap.add_argument("--openai-model", default="gpt-5-mini")
    ap.add_argument("--gemini-model", default="gemini-3-flash-preview")
    ap.add_argument("--merge-only", action="store_true")
    args = ap.parse_args()

    stem = pathlib.Path(args.out).stem
    leg_a = f"data/pairs/{stem}__openai.jsonl"
    leg_b = f"data/pairs/{stem}__gemini.jsonl"

    if not args.merge_only:
        run_leg(args.pairs, leg_a, args.openai_model, None, env_key("OPENAI_API_KEY"), args.budget_usd)
        run_leg(args.pairs, leg_b, args.gemini_model, GEMINI_BASE, env_key("GEMINI_API_KEY"), args.budget_usd)

    A, B = load(leg_a), load(leg_b)
    ids = sorted(set(A) | set(B))
    tally = {"aligned": 0, "partial": 0, "unaligned": 0, "missing_leg": 0}
    with (ROOT / args.out).open("w") as fh:
        for pid in ids:
            a, b = A.get(pid), B.get(pid)
            if not (a and b):
                tally["missing_leg"] += 1
                continue
            yes_a = a["alignment_label"] == "aligned"
            yes_b = b["alignment_label"] == "aligned"
            confs = [x.get("alignment_confidence") or 0.0 for x in (a, b)]
            if yes_a and yes_b:
                label = "aligned"
            elif yes_a or yes_b:
                label = "partial"
            else:
                label = "unaligned"
            tally[label] += 1
            fh.write(json.dumps({
                "pair_id": pid,
                "alignment_label": label,
                "alignment_confidence": round(sum(confs) / 2, 3),
                "verifier_model": f"{args.openai_model}+{args.gemini_model} (2-model vote, D6-am)",
                "verifier_reason": f"openai={a['alignment_label']} | gemini={b['alignment_label']}",
                "needs_llm_verify": True,
                "vote": {"openai": a["alignment_label"], "gemini": b["alignment_label"]},
            }, ensure_ascii=False) + "\n")
    print(f"merged -> {args.out}  {tally}")
    disagree = tally["partial"]
    total = max(1, tally["aligned"] + tally["partial"] + tally["unaligned"])
    print(f"disagreement rate: {disagree/total:.0%} (D6-am revisit trigger at >25%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
