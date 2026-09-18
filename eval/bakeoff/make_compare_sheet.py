#!/usr/bin/env python3
"""Build the head-to-head scoring sheet: 30 screens, 4 anonymous translations each.

Replaces the 120-item absolute-rating sheet (1,440 decisions) with 30 forced-choice
comparisons (30 decisions). The owner could not complete the first one: it asked him
to be a security expert and a lay reader at once, on findings full of jargon he does
not read. Pairwise/forced choice is both faster and more reliable than absolute
Likert rating, and picking the best of 4 yields a win rate for every arm at once,
which is exactly what the Phase 4 gate (F vs L) needs.

Blindness is preserved two ways: A/B/C/D order is shuffled per finding, and the
letter->model key is written to a SEPARATE file, never into the HTML. Reading the
page source cannot reveal which model wrote which translation.

The facts strip above each comparison is extracted by regex from the finding itself
(severity, finding ID, target, type, CVE/CWE). No model writes it. A model-written
prose summary would act as a fifth translation and anchor the choice toward whichever
candidate echoed it; a deterministic fact list cannot.

    python eval/bakeoff/make_compare_sheet.py
"""
from __future__ import annotations

import argparse
import json
import pathlib
import random
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
BAKE = ROOT / "eval/bakeoff"

# The exact prompt every arm received (eval/bakeoff/generate.py). Shown at the top of
# the sheet so the rater judges against what the models were actually asked to do.
AUD_PHRASE = {
    "management": "a corporate board / senior management audience",
    "regulatory": "a regulator or legal audience",
}
AUD_LABEL = {"management": "Corporate board / senior management", "regulatory": "Regulator / legal"}

PROMPT_SHOWN = """You are an expert translator of security findings into clear language for a specific audience.
Target audience: {audience}

Rules:
- Do not invent facts, impacts, or data not present in the finding.
- Preserve numbers, identifiers (CVE/CWE) and conditions/caveats, or declare them
  explicitly in omitted_details.
- Do not change the severity the finding establishes.
- Adapt vocabulary and level of detail to the indicated audience.

FINDING:
{finding}"""

RE_ID = re.compile(r"\b(?:TOB|MM|ODK|CLHW|ICSA|AA)-[A-Z0-9]+-\d+\b")
RE_CVE = re.compile(r"\bCVE-\d{4}-\d{4,7}\b")
RE_CWE = re.compile(r"\bCWE-\d+\b")
# These headers run inline in the TOB template ("Severity: X Difficulty: Y Type: Z
# Finding ID: ..."), so each value has to stop at the next label, not at a newline.
_NEXT = r"(?=\s*(?:Severity|Difficulty|Type|Finding ID|Target|Description)\b|\s*#|\s*$)"
RE_TARGET = re.compile(r"Target:\s*(.{3,80}?)" + _NEXT)
RE_TYPE = re.compile(r"Type:\s*([A-Za-z /]{3,40}?)" + _NEXT)
RE_DIFF = re.compile(r"Difficulty:\s*(\w+)")
CAVEAT_HINTS = re.compile(
    r"\b(however|although|only if|requires|cannot be exploited|not exploitable|"
    r"mitigat\w+|fixed in|patched|remediat\w+|assuming|provided that)\b", re.I)


def facts_for(rec: dict) -> list[tuple[str, str]]:
    """Deterministic fact strip, extracted from the finding text only."""
    t = rec["finding"]
    out: list[tuple[str, str]] = [("severity", rec.get("severity_text") or "not stated")]

    m = RE_ID.search(t)
    if m:
        out.append(("finding id", m.group(0)))
    m = RE_TYPE.search(t)
    if m:
        out.append(("type", m.group(1).strip()))
    m = RE_DIFF.search(t)
    if m:
        out.append(("difficulty", m.group(1)))
    m = RE_TARGET.search(t)
    if m:
        out.append(("target", m.group(1).strip()))

    ids = sorted(set(RE_CVE.findall(t)) | set(RE_CWE.findall(t)))
    if ids:
        out.append(("identifiers", " ".join(ids[:4])))
    if rec.get("has_caveat") or CAVEAT_HINTS.search(t):
        out.append(("caveat", "the finding states a condition or limit — check it survives"))
    out.append(("source", rec.get("source_org") or "?"))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="eval/bakeoff/compare_sheet.html")
    ap.add_argument("--key", default="eval/bakeoff/compare_key.json")
    ap.add_argument("--seed", type=int, default=20260725)
    args = ap.parse_args()

    findings = {}
    for line in (BAKE / "findings.jsonl").open():
        d = json.loads(line)
        findings[d["fid"]] = d
    if not findings:
        print("no findings", file=sys.stderr)
        return 1

    # every arm's translations, keyed by finding
    arms: dict[str, dict[str, dict]] = {}
    for f in sorted((BAKE / "raw").glob("*.jsonl")):
        model = f.stem
        for line in f.open():
            d = json.loads(line)
            arms.setdefault(d["fid"], {})[model] = d

    rng = random.Random(args.seed)
    LETTERS = ["A", "B", "C", "D"]
    screens, key = [], {}

    for fid in findings:
        by_model = arms.get(fid, {})
        models = sorted(by_model)
        if len(models) != 4:
            print(f"  skip {fid}: {len(models)} arms", file=sys.stderr)
            continue
        order = models[:]
        rng.shuffle(order)

        rec = findings[fid]
        cands = []
        for letter, model in zip(LETTERS, order):
            row = by_model[model]
            cands.append({
                "letter": letter,
                "text": (row.get("translation") or "").strip() or "(empty output)",
                "omitted": row.get("omitted_details") or [],
                "sev": row.get("severity_conveyed") or "",
            })
            key.setdefault(fid, {})[letter] = model

        screens.append({
            "fid": fid,
            "aud": rec["audience_key"],
            "audLabel": AUD_LABEL.get(rec["audience_key"], rec["audience_key"]),
            "audPhrase": AUD_PHRASE.get(rec["audience_key"], rec["audience_key"]),
            "finding": rec["finding"].strip(),
            "facts": facts_for(rec),
            "cands": cands,
        })

    payload = json.dumps({"screens": screens, "prompt": PROMPT_SHOWN},
                         ensure_ascii=False, separators=(",", ":"))

    # NOT OPTIONAL. These are security findings: they quote exploit payloads verbatim,
    # and 32 pairs in the corpus carry a literal "</script>". Embedded raw, the browser
    # ends the data block at the finding's own closing tag and executes the rest.
    payload = payload.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    assert "</script" not in payload.lower(), "script breakout survived escaping"

    html = TEMPLATE.replace("/*__PAYLOAD__*/", payload)
    out = ROOT / args.out
    out.write_text(html, encoding="utf-8")
    (ROOT / args.key).write_text(json.dumps(key, indent=1))

    print(f"{len(screens)} comparisons · {sum(len(s['cands']) for s in screens)} translations")
    print(f"wrote {out.relative_to(ROOT)}  ({out.stat().st_size/1e6:.1f} MB)")
    print(f"key  {args.key}  (letter -> model; do NOT open before scoring)")
    return 0


TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LEGIBLE - bake-off, head to head</title>
<style>
  :root{
    --paper:#fdfdfb; --ink:#12151c; --ink2:#3b4250; --muted:#6b7280; --rule:#e5e3dd;
    --cobalt:#3f77ff; --deep:#1f4fd8; --coral:#e9603f; --panel:#fff; --hover:#f4f6fb;
    --good:#1f7a4d;
    --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  }
  @media (prefers-color-scheme:dark){
    :root{ --paper:#14161a; --ink:#e8e6e1; --ink2:#c3c7ce; --muted:#9aa0aa;
           --rule:#2b2f36; --panel:#1a1d22; --hover:#22262e; --good:#4ade80; }
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.6 var(--sans)}
  .wrap{max-width:1500px;margin:0 auto;padding:0 20px 120px}

  header{position:sticky;top:0;z-index:20;background:var(--panel);
         border-bottom:1px solid var(--rule);padding:11px 20px;display:flex;
         align-items:center;gap:18px;flex-wrap:wrap}
  header h1{font-size:14px;margin:0;font-weight:650;white-space:nowrap}
  header h1 span{color:var(--cobalt)}
  .count{font:12.5px var(--mono);color:var(--muted)}
  .count b{color:var(--ink)}
  .bar{flex:1;min-width:120px;height:5px;border-radius:3px;background:var(--rule);overflow:hidden}
  .bar i{display:block;height:100%;background:var(--cobalt);width:0;transition:width .25s}
  button{font:inherit;cursor:pointer}
  .btn{padding:6px 13px;border:1px solid var(--rule);border-radius:7px;
       background:var(--paper);color:var(--ink);font-size:12.5px}
  .btn:hover{border-color:var(--cobalt)}
  .btn.primary{background:var(--cobalt);color:#fff;border-color:var(--cobalt)}
  .btn.primary:hover{background:var(--deep)}

  details.prompt{margin:18px 0 0;border:1px solid var(--rule);border-radius:10px;
                 background:var(--panel);padding:12px 16px}
  details.prompt summary{cursor:pointer;font-size:13px;font-weight:600}
  details.prompt pre{margin:12px 0 2px;white-space:pre-wrap;font:12px/1.6 var(--mono);
                     color:var(--ink2)}
  .note{font-size:13px;color:var(--muted);margin:14px 0 0}

  .screen{margin:26px 0 0;border:1px solid var(--rule);border-radius:14px;
          background:var(--panel);overflow:hidden}
  .screen.done{border-color:var(--good)}
  .shead{padding:14px 18px;border-bottom:1px solid var(--rule);display:flex;
         align-items:baseline;gap:14px;flex-wrap:wrap}
  .idx{font:12px var(--mono);color:var(--cobalt);font-weight:700}
  .aud{font-size:13px;font-weight:650}
  .audph{font:11.5px var(--mono);color:var(--muted)}

  .facts{display:flex;flex-wrap:wrap;gap:7px;padding:12px 18px;
         border-bottom:1px solid var(--rule);background:var(--hover)}
  .fact{font:11.5px var(--mono);padding:3px 9px;border-radius:6px;
        border:1px solid var(--rule);background:var(--panel);color:var(--muted)}
  .fact b{color:var(--ink);font-weight:600}
  .fact.caveat{border-color:var(--coral)}
  .fact.caveat b{color:var(--coral)}

  details.finding{border-bottom:1px solid var(--rule)}
  details.finding summary{padding:10px 18px;cursor:pointer;font-size:12.5px;
                          color:var(--cobalt)}
  details.finding pre{margin:0;padding:0 18px 16px;white-space:pre-wrap;
                      word-wrap:break-word;font:12px/1.65 var(--mono);color:var(--ink2);
                      max-height:44vh;overflow:auto}

  .cands{display:grid;grid-template-columns:repeat(4,1fr)}
  @media (max-width:1180px){ .cands{grid-template-columns:repeat(2,1fr)} }
  @media (max-width:640px){ .cands{grid-template-columns:1fr} }
  .cand{padding:15px 17px;border-right:1px solid var(--rule);
        border-bottom:1px solid var(--rule);display:flex;flex-direction:column;gap:10px}
  .cand:last-child{border-right:0}
  .cand.picked{background:rgba(63,119,255,.07)}
  .cand.broken{opacity:.5}
  .cl{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .letter{font:13px var(--mono);font-weight:700;color:var(--cobalt)}
  .cand.picked .letter{color:var(--deep)}
  .ctext{font-size:14px;line-height:1.62;flex:1}
  .cmeta{font:10.5px var(--mono);color:var(--muted);border-top:1px solid var(--rule);
         padding-top:8px}
  .flag{display:flex;align-items:center;gap:6px;font:11px var(--sans);color:var(--muted);
        cursor:pointer;user-select:none}
  .flag input{margin:0;accent-color:var(--coral)}

  .pick{padding:14px 18px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .pick .lab{font-size:13px;font-weight:600;margin-right:4px}
  .pk{width:44px;height:36px;border:1.5px solid var(--rule);border-radius:8px;
      background:var(--paper);color:var(--ink);font:14px var(--mono);font-weight:700}
  .pk:hover{border-color:var(--cobalt)}
  .pk.on{background:var(--cobalt);border-color:var(--cobalt);color:#fff}
  .why{flex:1;min-width:200px;padding:7px 11px;border:1px solid var(--rule);
       border-radius:7px;background:var(--paper);color:var(--ink);font:13px var(--sans)}

  .kbd{position:fixed;bottom:0;left:0;right:0;background:var(--panel);
       border-top:1px solid var(--rule);padding:9px 20px;font:11.5px var(--mono);
       color:var(--muted);z-index:19}
  .kbd b{color:var(--ink)}
</style>
</head>
<body>

<header>
  <h1><span>LEGIBLE</span> bake-off, head to head</h1>
  <span class="count"><b id="done">0</b> / <b id="tot">0</b> scored</span>
  <span class="bar"><i id="bar"></i></span>
  <button class="btn" id="next">Next unscored</button>
  <button class="btn primary" id="exp">Export</button>
</header>

<div class="wrap">
  <details class="prompt">
    <summary>The prompt every model received (identical for all four)</summary>
    <pre id="promptText"></pre>
  </details>
  <p class="note">Same finding, four anonymous translations, shuffled. Pick the one you
  would actually hand to that audience. The facts strip is pulled from the finding by
  code, not written by a model. Judgements save in this browser as you go, so
  <b>Export</b> before you finish.</p>
  <div id="list"></div>
</div>

<div class="kbd">
  <b>A B C D</b> or <b>1-4</b> pick the best &nbsp;·&nbsp; <b>x</b> flag the focused one as broken
  &nbsp;·&nbsp; <b>j / k</b> next / previous &nbsp;·&nbsp; scroll works too
</div>

<script type="application/json" id="data">/*__PAYLOAD__*/</script>
<script>
const DATA = JSON.parse(document.getElementById('data').textContent);
const S = DATA.screens;
const LS = 'legible.bakeoff.headtohead';
let V = {};
try { V = JSON.parse(localStorage.getItem(LS) || '{}'); } catch(e){ V = {}; }

document.getElementById('promptText').textContent = DATA.prompt;
document.getElementById('tot').textContent = S.length;

function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function render(){
  document.getElementById('list').innerHTML = S.map((s,i) => {
    const v = V[s.fid] || {};
    const facts = s.facts.map(([k,val]) =>
      `<span class="fact${k==='caveat'?' caveat':''}">${esc(k)} <b>${esc(val)}</b></span>`).join('');
    const cands = s.cands.map(c => {
      const brk = (v.broken||[]).includes(c.letter);
      const om = (c.omitted||[]).length ? `omitted: ${esc(c.omitted.slice(0,3).join(' · '))}` : 'omitted: none declared';
      return `<div class="cand${v.best===c.letter?' picked':''}${brk?' broken':''}">
        <div class="cl"><span class="letter">${c.letter}</span>
          <label class="flag"><input type="checkbox" data-fid="${esc(s.fid)}" data-brk="${c.letter}" ${brk?'checked':''}> broken</label>
        </div>
        <div class="ctext">${esc(c.text)}</div>
        <div class="cmeta">severity said: ${esc(c.sev||'-')}<br>${om}</div>
      </div>`;
    }).join('');
    return `<section class="screen${v.best?' done':''}" id="s${i}" data-i="${i}">
      <div class="shead">
        <span class="idx">${i+1} / ${S.length}</span>
        <span class="aud">Audience: ${esc(s.audLabel)}</span>
        <span class="audph">models were told: "${esc(s.audPhrase)}"</span>
      </div>
      <div class="facts">${facts}</div>
      <details class="finding"><summary>The finding, verbatim</summary><pre>${esc(s.finding)}</pre></details>
      <div class="cands">${cands}</div>
      <div class="pick">
        <span class="lab">Best for this audience:</span>
        ${['A','B','C','D'].map(L => `<button class="pk${v.best===L?' on':''}" data-fid="${esc(s.fid)}" data-pick="${L}">${L}</button>`).join('')}
        <input class="why" data-fid="${esc(s.fid)}" placeholder="why, in a few words (optional)" value="${esc(v.why||'')}">
      </div>
    </section>`;
  }).join('');

  document.querySelectorAll('.pk').forEach(b => b.onclick = () => pick(b.dataset.fid, b.dataset.pick));
  document.querySelectorAll('[data-brk]').forEach(cb => cb.onchange = () => {
    const v = V[cb.dataset.fid] || (V[cb.dataset.fid] = {});
    const set = new Set(v.broken || []);
    cb.checked ? set.add(cb.dataset.brk) : set.delete(cb.dataset.brk);
    v.broken = [...set]; save(); render(); focusCur();
  });
  document.querySelectorAll('.why').forEach(inp => inp.onblur = () => {
    const v = V[inp.dataset.fid] || (V[inp.dataset.fid] = {});
    v.why = inp.value.trim(); save();
  });
  // re-observe: render() replaces every node, so the observer would otherwise be
  // left watching detached elements and `cur` would stop following the scroll —
  // which lets a keystroke score the wrong screen.
  observeAll();
  stats();
}

function pick(fid, letter){
  const v = V[fid] || (V[fid] = {});
  v.best = (v.best === letter) ? null : letter;
  v.at = new Date().toISOString();
  save(); render();
  if (v.best) advance();
}
function save(){ localStorage.setItem(LS, JSON.stringify(V)); stats(); }
function stats(){
  const n = Object.values(V).filter(v => v.best).length;
  document.getElementById('done').textContent = n;
  document.getElementById('bar').style.width = (100*n/S.length) + '%';
}

let cur = 0;
function focusCur(){
  const el = document.getElementById('s'+cur);
  if (el) el.scrollIntoView({behavior:'smooth', block:'center'});
}
function advance(){
  const nxt = S.findIndex((s,i) => i > cur && !(V[s.fid]||{}).best);
  cur = nxt >= 0 ? nxt : Math.min(cur+1, S.length-1);
  focusCur();
}

document.getElementById('next').onclick = () => {
  const nxt = S.findIndex(s => !(V[s.fid]||{}).best);
  if (nxt < 0) { alert('All scored. Hit Export.'); return; }
  cur = nxt; focusCur();
};
document.getElementById('exp').onclick = () => {
  const lines = S.filter(s => (V[s.fid]||{}).best).map(s => {
    const v = V[s.fid];
    return JSON.stringify({fid: s.fid, audience: s.aud, best: v.best,
                           broken: v.broken || [], why: v.why || '', at: v.at});
  });
  if (!lines.length) { alert('Nothing scored yet.'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], {type:'application/x-ndjson'}));
  a.download = 'bakeoff-headtohead.jsonl';
  a.click();
};

// keep `cur` in sync with what the reader is actually looking at
const io = new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting) cur = +e.target.dataset.i; });
}, {rootMargin: '-45% 0px -45% 0px'});
function observeAll(){
  io.disconnect();
  document.querySelectorAll('.screen').forEach(el => io.observe(el));
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'){
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  const k = e.key.toLowerCase();
  const L = {a:'A', b:'B', c:'C', d:'D', '1':'A', '2':'B', '3':'C', '4':'D'}[k];
  if (L){ pick(S[cur].fid, L); e.preventDefault(); return; }
  if (k === 'j'){ cur = Math.min(cur+1, S.length-1); focusCur(); e.preventDefault(); }
  if (k === 'k'){ cur = Math.max(cur-1, 0); focusCur(); e.preventDefault(); }
});

render();
</script>
</body>
</html>
"""


if __name__ == "__main__":
    raise SystemExit(main())
