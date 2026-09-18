import os, sys, pathlib, time, json
os.environ.setdefault("LEGIBLE_EMBED_DEVICE","mps")
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/"src")); sys.path.insert(0, str(ROOT/"eval/judge_mutation"))
import run_mutation as R
from legible.judge_nli import check_unsupported_claims_nli as nli_check

def flagged(src, tr):
    return len(nli_check(src, tr)) > 0

t0=time.time(); _=flagged(R.SEM["invented_impact"][0][0], R.SEM["invented_impact"][0][2])
print(f"[carga NLI + warmup] {time.time()-t0:.1f}s")

for cls in ("invented_impact","negation_flip_semantic","caveat_drop_paraphrase"):
    fx = R.SEM[cls]
    t1=time.time()
    rec = sum(flagged(s,mut) for s,b,mut,t in fx)       # mutante malo -> debería marcar
    fp  = sum(flagged(s,b)  for s,b,mut,t in fx if b)    # base fiel -> NO debería marcar
    dt=(time.time()-t1)/(2*len(fx))*1000
    print(f"{cls:26} recall {rec}/{len(fx)}  |  FP(base fiel) {fp}/{len(fx)}  |  ~{dt:.0f} ms/check")
