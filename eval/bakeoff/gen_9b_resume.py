"""9B arm resumible: escribe incremental (append+flush por línea), salta lo ya hecho.
Uso: python gen_9b_resume.py [max_this_run]   (default 6 por corrida, para chunks cortos)."""
import json, sys, pathlib
sys.path.insert(0, str(pathlib.Path("src").resolve()))
from legible.generate import MlxBackend

BO = pathlib.Path("eval/bakeoff")
OUT = BO / "raw/plaintext-9b.jsonl"
limit = int(sys.argv[1]) if len(sys.argv) > 1 else 6

findings = [json.loads(l) for l in open(BO / "findings.jsonl")]
done = set()
if OUT.exists():
    done = {json.loads(l)["fid"] for l in open(OUT)}
todo = [f for f in findings if f["fid"] not in done][:limit]
print(f"hechos: {len(done)}/{len(findings)} | esta corrida: {len(todo)}", flush=True)
if not todo:
    print("TODO COMPLETO", flush=True); sys.exit(0)

be = MlxBackend()
with open(OUT, "a") as fh:
    for i, f in enumerate(todo, 1):
        try:
            res = be.translate(f["finding"], f["audience_key"], "email")
            tr = res.translation
        except Exception as e:
            tr = ""; print(f"  err {f['fid']}: {e}", flush=True)
        fh.write(json.dumps({"fid": f["fid"], "audience_key": f["audience_key"],
                             "model": "plaintext-9b", "translation": tr,
                             "omitted_details": [], "severity_conveyed": None}) + "\n")
        fh.flush()
        print(f"  {i}/{len(todo)} {f['fid'][:40]}", flush=True)
print(f"chunk listo. total ahora: {len(done)+len(todo)}/{len(findings)}", flush=True)
