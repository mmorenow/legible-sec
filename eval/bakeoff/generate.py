"""Fase 2 bake-off — genera traducciones de GPT + Gemini + 9B local para los 30 hallazgos.
El arm de Claude (Opus, este Claude Code) se agrega aparte. Template único (Anexo A, en
inglés para comparabilidad con el 9B). Una pasada, sin iterar; response_format JSON.
"""
from __future__ import annotations
import json, os, pathlib, re, sys, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
RAW = ROOT / "eval/bakeoff/raw"; RAW.mkdir(parents=True, exist_ok=True)

AUD_PHRASE = {  # idénticas a _MLX_AUD_PHRASE, para que los 4 modelos vean lo mismo
    "management": "a corporate board / senior management audience",
    "regulatory": "a regulator or legal audience",
}
TEMPLATE = """You are an expert translator of security findings into clear language for a specific audience.
Target audience: {audience}

Respond ONLY with valid JSON, no extra text, with this structure:
{{"translation": "the finding translated for the audience", "omitted_details": ["omitted technical detail 1", "..."], "severity_conveyed": "critical|high|medium|low|info"}}

Rules:
- Do not invent facts, impacts, or data not present in the finding.
- Preserve numbers, identifiers (CVE/CWE) and conditions/caveats, or declare them explicitly in omitted_details.
- Do not change the severity the finding establishes.
- Adapt vocabulary and level of detail to the indicated audience.

FINDING:
{finding}"""

COST = {"gpt-5.2": (1.75, 14.00), "gemini-3-flash-preview": (0.50, 3.00)}


def load_key(name):
    key = os.environ.get(name, "")
    env = ROOT / ".env"
    if not key and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith(f"{name}="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    return key


def call(model, prompt, key, base_url):
    body = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}],
                       "response_format": {"type": "json_object"}}).encode()
    req = urllib.request.Request(f"{base_url}/chat/completions", data=body,
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                out = json.load(r)
            u = out.get("usage", {})
            text = out["choices"][0]["message"]["content"]
            m = re.search(r"\{.*\}", text, re.S)
            d = json.loads(m.group(0)) if m else {"translation": text, "_parse": "fallback"}
            return d, u.get("prompt_tokens", 0), u.get("completion_tokens", 0)
        except Exception as e:
            if attempt == 2:
                return {"_error": str(e)[:200]}, 0, 0
            time.sleep(2 ** (attempt + 1))


def run_api(model, base_url, key, findings):
    if not key:
        print(f"  [{model}] SIN KEY — se salta"); return
    rows, pt, ct = [], 0, 0
    for i, f in enumerate(findings, 1):
        prompt = TEMPLATE.format(audience=AUD_PHRASE[f["audience_key"]], finding=f["finding"])
        d, a, b = call(model, prompt, key, base_url); pt += a; ct += b
        rows.append({"fid": f["fid"], "audience_key": f["audience_key"], "model": model,
                     "translation": d.get("translation", ""), "omitted_details": d.get("omitted_details", []),
                     "severity_conveyed": d.get("severity_conveyed"), "error": d.get("_error")})
        if i % 10 == 0: print(f"  [{model}] {i}/{len(findings)}")
    ci, co = COST.get(model, (0, 0))
    cost = pt / 1e6 * ci + ct / 1e6 * co
    with open(RAW / f"{model.replace('/','_')}.jsonl", "w") as fh:
        for r in rows: fh.write(json.dumps(r) + "\n")
    errs = sum(1 for r in rows if r.get("error"))
    print(f"  [{model}] listo: {len(rows)} filas, {errs} errores, {pt}+{ct} tok, ~${cost:.3f}")
    return cost


def run_9b(findings):
    from legible.generate import MlxBackend
    if not MlxBackend.available():
        print("  [9b] modelo MLX no disponible — se salta"); return
    be = MlxBackend(); rows = []
    for i, f in enumerate(findings, 1):
        try:
            res = be.translate(f["finding"], f["audience_key"], "email")
            tr = res.translation
        except Exception as e:
            tr = ""; print(f"  [9b] error en {f['fid']}: {e}")
        rows.append({"fid": f["fid"], "audience_key": f["audience_key"], "model": "plaintext-9b",
                     "translation": tr, "omitted_details": [], "severity_conveyed": None})
        if i % 10 == 0: print(f"  [9b] {i}/{len(findings)}")
    with open(RAW / "plaintext-9b.jsonl", "w") as fh:
        for r in rows: fh.write(json.dumps(r) + "\n")
    print(f"  [9b] listo: {len(rows)} filas")


def main():
    findings = [json.loads(l) for l in open(ROOT / "eval/bakeoff/findings.jsonl")]
    print(f"hallazgos: {len(findings)}")
    total = 0
    print("== GPT ==")
    total += run_api("gpt-5.2", "https://api.openai.com/v1", load_key("OPENAI_API_KEY"), findings) or 0
    print("== Gemini ==")
    total += run_api("gemini-3-flash-preview", "https://generativelanguage.googleapis.com/v1beta/openai",
                     load_key("GEMINI_API_KEY"), findings) or 0
    print("== 9B local ==")
    run_9b(findings)
    print(f"\nCOSTO API TOTAL ESTIMADO: ~${total:.3f}")


if __name__ == "__main__":
    main()
