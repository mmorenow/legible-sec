"""Fase 3 — evalúa judge_v2 vs judge v1 sobre las clases que v2 cambia.
Reusa los fixtures y el generador mecánico de run_mutation.py."""
import os, json, pathlib, sys, random, time
os.environ.setdefault("LEGIBLE_EMBED_DEVICE", "mps")
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "eval/judge_mutation"))
import run_mutation as R  # noqa: E402
from legible.judge_v2 import check_caveats_embed, check_severity_drift_bidir  # noqa: E402
from legible.judge import check_caveats  # noqa: E402


def cav_fail(fn, src, tr, thr=None, omitted=None):
    flags = fn(src, tr, omitted or [], thr) if thr is not None else fn(src, tr, omitted or [])
    return any(f.check == "caveat_parity" and f.level == "fail" for f in flags)


cdp = R.SEM["caveat_drop_paraphrase"]      # (src, base_fiel, mutante_drop, target)
ctrl = R.SEM["control_good_paraphrase"]     # (src, "", paráfrasis_cercana, target)

# --- warmup + latencia de un check con embeddings ---
t0 = time.time()
_ = check_caveats_embed(cdp[0][0], cdp[0][2], [], 0.55)
print(f"[warmup+carga modelo] {time.time()-t0:.1f}s")
t1 = time.time()
for s, b, mut, t in cdp:
    check_caveats_embed(s, mut, [], 0.55)
print(f"latencia media por check_caveats_embed: {(time.time()-t1)/len(cdp)*1000:.0f} ms\n")

# --- v1 baseline (token-overlap) ---
v1_recall = sum(cav_fail(check_caveats, s, mut) for s, b, mut, t in cdp)
v1_base_fp = sum(cav_fail(check_caveats, s, b) for s, b, mut, t in cdp if b)
v1_ctrl_fp = sum(cav_fail(check_caveats, s, m) for s, b, m, t in ctrl)
print(f"D5 v1 (token-overlap): recall drop {v1_recall}/{len(cdp)} | "
      f"FP bases realistas {v1_base_fp}/{len(cdp)} | FP control {v1_ctrl_fp}/{len(ctrl)}\n")

# --- v2 sweep de umbral (embeddings) ---
print("D5 v2 (embeddings) — barrido de umbral:")
print(f"{'thr':>5} {'recall(drop)':>13} {'FP(realista)':>13} {'FP(control)':>12}")
best = None
for thr in [0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65]:
    rec = sum(cav_fail(check_caveats_embed, s, mut, thr) for s, b, mut, t in cdp)
    bfp = sum(cav_fail(check_caveats_embed, s, b, thr) for s, b, mut, t in cdp if b)
    cfp = sum(cav_fail(check_caveats_embed, s, m, thr) for s, b, m, t in ctrl)
    tot_fp = bfp + cfp
    tot_n = len([1 for s, b, mut, t in cdp if b]) + len(ctrl)
    print(f"{thr:>5.2f} {rec:>6}/{len(cdp)}      {bfp:>6}/{len(cdp)}      {cfp:>5}/{len(ctrl)}")
    # criterio del plan: recall alto con FP total <= 10%
    if tot_fp / tot_n <= 0.10:
        if best is None or rec > best[1]:
            best = (thr, rec, tot_fp, tot_n)
if best:
    print(f"\n-> mejor umbral con FP<=10%: {best[0]:.2f} (recall {best[1]}/{len(cdp)}, "
          f"FP total {best[2]}/{best[3]})")
else:
    print("\n-> ningún umbral logra FP<=10% en este set semilla (N chico)")

# --- D3 bidireccional: severity_up ---
rows = [json.loads(l) for l in open(R.DATASET)]
fl = [r for r in rows if r.get("alignment_method") in R.FINDING_LEVEL]
random.seed(13); random.shuffle(fl); pool = fl[:1200]
cases = R.gen_mechanical(pool)
su = [c for c in cases if c["cls"] == "severity_up"]
v2_su = sum(
    any(f.check == "severity_drift" and f.level == "fail"
        for f in check_severity_drift_bidir(c["source"], c["mutant"], c.get("severity_mut")))
    for c in su
)
print(f"\nD3 severity_up (inflar): v1 0/{len(su)} (0%)  ->  v2 {v2_su}/{len(su)} ({100*v2_su/len(su):.0f}%)")

json.dump({"v1_d5_recall": v1_recall, "v1_d5_base_fp": v1_base_fp, "v1_ctrl_fp": v1_ctrl_fp,
           "cdp_n": len(cdp), "ctrl_n": len(ctrl),
           "best_thr": best[0] if best else None, "best_recall": best[1] if best else None,
           "sev_up_v2": v2_su, "sev_up_n": len(su)},
          open(ROOT / "eval/judge_mutation/results_v2.json", "w"), indent=2)
