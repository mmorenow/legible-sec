"""Genera la planilla de puntuación ciega (HTML autocontenido) desde anon_items.jsonl.
Rúbrica del Anexo B. Guarda en localStorage y exporta JSON. Offline (file://)."""
import json, pathlib, html

BO = pathlib.Path(__file__).resolve().parent
items = [json.loads(l) for l in open(BO / "anon_items.jsonl")]
AUD = {"management": "Dirección / board (CFO)", "regulatory": "Regulador / legal"}

CATS = [
    ("sev", "Severidad distinta a la del original (cualquier dirección)"),
    ("impact", "Impacto o claim inventado (ausente del original)"),
    ("caveat", "Caveat material perdido y no declarado"),
    ("numid", "Número, ID o entidad alterado o inventado"),
    ("status", "Estado o negación invertidos"),
]

rows = []
for it in items:
    finding = html.escape(it["finding"])
    tr = html.escape(it["translation"]) or "<em>(vacío)</em>"
    cats = "".join(
        f'<label class="cat"><input type="checkbox" data-k="{k}"> {html.escape(lbl)}</label>'
        for k, lbl in CATS)
    rows.append(f'''<div class="item" id="{it['item_id']}">
  <div class="hd"><span class="iid">{it['item_id']}</span>
    <span class="aud">Audiencia: {AUD.get(it['audience_key'], it['audience_key'])}</span></div>
  <details class="finding"><summary>Ver hallazgo técnico original</summary><pre>{finding}</pre></details>
  <div class="tr">{tr}</div>
  <div class="rubric">
    <div class="q"><b>1. Distorsiones materiales</b> (marca las que apliquen):<br>{cats}</div>
    <div class="q"><b>2. Ajuste a la audiencia</b> (1 = jerga cruda/tono malo … 5 = un CFO/regulador lo entiende perfecto):
      <span class="fit">{''.join(f'<label><input type="radio" name="fit-{it['item_id']}" data-fit="{n}"> {n}</label>' for n in range(1,6))}</span></div>
    <div class="q"><b>3. ¿Lo enviarías tal cual?</b>
      <label><input type="radio" name="send-{it['item_id']}" data-send="yes"> Sí</label>
      <label><input type="radio" name="send-{it['item_id']}" data-send="no"> No</label></div>
    <div class="q"><b>Nota</b> (opcional): <input type="text" class="note" placeholder="qué distorsionó / por qué"></div>
  </div>
</div>''')

HTML = '''<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LEGIBLE · Bake-off — puntuación ciega</title>
<style>
:root{color-scheme:light dark}
body{font:15px/1.5 -apple-system,system-ui,sans-serif;max-width:820px;margin:0 auto;padding:20px;
  background:#0f1115;color:#e6e6e6}
h1{font-size:20px} .bar{position:sticky;top:0;background:#0f1115;padding:12px 0;border-bottom:1px solid #333;
  z-index:9;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.item{border:1px solid #2a2d34;border-radius:10px;padding:14px 16px;margin:16px 0;background:#161922}
.hd{display:flex;justify-content:space-between;font-size:12px;color:#9aa;margin-bottom:8px}
.iid{font-weight:700;color:#7bd} .finding summary{cursor:pointer;color:#89a;font-size:13px}
.finding pre{white-space:pre-wrap;font-size:12px;color:#bcc;background:#0d0f14;padding:10px;border-radius:6px;max-height:260px;overflow:auto}
.tr{font-size:15.5px;margin:10px 0 14px;padding:10px 12px;background:#1b2230;border-left:3px solid #4a7;border-radius:4px}
.rubric .q{margin:8px 0} .cat{display:block;margin:3px 0;font-size:13.5px} .fit label,.q label{margin-right:12px}
.note{width:100%;padding:6px;background:#0d0f14;border:1px solid #333;color:#eee;border-radius:5px;margin-top:4px}
button{font:inherit;padding:8px 14px;border-radius:7px;border:0;background:#2d7;color:#012;font-weight:700;cursor:pointer}
.count{font-variant-numeric:tabular-nums} .done{outline:2px solid #2d7}
small{color:#89a}
</style></head><body>
<div class="bar">
  <h1 style="margin:0">Bake-off — puntuación ciega</h1>
  <span class="count" id="prog">0 / TOTAL</span>
  <button onclick="exportJSON()">Exportar puntuaciones (JSON)</button>
  <small>se guarda solo mientras avanzás</small>
</div>
<p><small>No sabés qué modelo escribió cada traducción — esa es la idea. Puntuá la fidelidad y el ajuste a la audiencia. Al final, tocá <b>Exportar</b> y pasame el archivo.</small></p>
ROWS
<script>
const KEY="legible_bakeoff_scores_v1";
let S=JSON.parse(localStorage.getItem(KEY)||"{}");
const items=[...document.querySelectorAll(".item")];
const TOTAL=items.length; document.getElementById("prog").textContent="0 / "+TOTAL;
document.querySelector(".count").textContent = (Object.keys(S).length)+" / "+TOTAL;
function rec(id){ S[id]=S[id]||{cats:{},fit:null,send:null,note:""}; return S[id]; }
function save(){ localStorage.setItem(KEY,JSON.stringify(S)); prog(); }
function prog(){ let done=items.filter(el=>{const s=S[el.id];return s&&(s.fit||s.send||Object.keys(s.cats).length||s.note)}).length;
  document.getElementById("prog").textContent=done+" / "+TOTAL;
  items.forEach(el=>{const s=S[el.id];el.classList.toggle("done", !!(s&&(s.fit||s.send)))}); }
items.forEach(el=>{ const id=el.id; const s=rec(id);
  el.querySelectorAll('[data-k]').forEach(c=>{ c.checked=!!s.cats[c.dataset.k];
    c.onchange=()=>{ if(c.checked)s.cats[c.dataset.k]=true; else delete s.cats[c.dataset.k]; save(); }; });
  el.querySelectorAll('[data-fit]').forEach(r=>{ r.checked=(s.fit==r.dataset.fit);
    r.onchange=()=>{ s.fit=r.dataset.fit; save(); }; });
  el.querySelectorAll('[data-send]').forEach(r=>{ r.checked=(s.send==r.dataset.send);
    r.onchange=()=>{ s.send=r.dataset.send; save(); }; });
  const n=el.querySelector('.note'); n.value=s.note||"";
  n.oninput=()=>{ s.note=n.value; save(); };
});
prog();
function exportJSON(){ const blob=new Blob([JSON.stringify(S,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download="bakeoff_scores.json"; a.click(); }
</script></body></html>'''

out = HTML.replace("ROWS", "\n".join(rows)).replace("TOTAL", str(len(items)))
(BO / "scoring_sheet.html").write_text(out, encoding="utf-8")
print(f"scoring_sheet.html: {len(items)} ítems")
