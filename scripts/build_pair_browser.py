#!/usr/bin/env python3
"""Build a self-contained HTML browser for the pairs dataset.

The dataset ships as JSONL because that is what a program wants: one pair per
line, streamable, HuggingFace-ready. It is not a reading format. This turns it
into one, offline: open the file, no server, no internet, no install.

Two jobs it has to do well:
  1. READ - move through 5k pairs by register, source, severity, method; see the
     technical and the executive side next to each other; jump to the source PDF.
  2. JUDGE - mark a pair good / unsure / bad with a note, keyboard-first, and get
     the verdicts back out as JSONL. Judgements live in the browser's localStorage
     (a file:// page cannot write to disk), so EXPORT when you finish a session.

Usage:
    python scripts/build_pair_browser.py
    python scripts/build_pair_browser.py --dataset data/dataset/legible-pairs-v0.3.jsonl \
                                         --out data/dataset/legible-browser.html
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parents[1]

# Short keys keep the embedded payload small: the dataset is ~21 MB of text and
# the full field names would add megabytes of nothing.
FIELD_MAP = {
    "pair_id": "id",
    "technical_text": "t",
    "executive_text": "e",
    "source_org": "org",
    "source_org_type": "orgt",
    "source_doc_id": "doc",
    "source_url": "url",
    "audience_observed": "aud",
    "severity_original": "sev",
    "alignment_method": "meth",
    "alignment_label": "lab",
    "alignment_type": "atype",
    "alignment_confidence": "conf",
    "split": "split",
    "license": "lic",
    "vuln_class": "vc",
    "report_year": "yr",
    "cve_ids": "cve",
    "format_label": "fmt",
    "notes": "note",
}

# Facets offered in the sidebar, in display order.
FACETS = [
    ("lab", "Alignment"),
    ("aud", "Register"),
    ("meth", "Method"),
    ("orgt", "Source type"),
    ("org", "Organisation"),
    ("sev", "Severity"),
    ("split", "Split"),
    ("lic", "Licence"),
]


def find_local_files(doc_id: str, cache: dict) -> tuple[str, str]:
    """Locate the source PDF and the parsed markdown for a source_doc_id.

    Returns (pdf_path, md_path) relative to the repo root, empty when missing.
    Cached per document: ~1.2k documents back ~5.3k pairs.
    """
    if doc_id in cache:
        return cache[doc_id]
    stem = pathlib.Path(doc_id).name
    pdf = md = ""
    for c in ROOT.glob(f"data/corpus/pdfs/*/{stem}.pdf"):
        pdf = str(c.relative_to(ROOT))
        break
    c = ROOT / "data/corpus/out/md" / f"{stem}.md"
    if c.exists():
        md = str(c.relative_to(ROOT))
    cache[doc_id] = (pdf, md)
    return pdf, md


def load_pairs(path: pathlib.Path) -> tuple[list[dict], dict]:
    rows: list[dict] = []
    cache: dict = {}
    manifest_urls = load_manifest_urls()
    recovered = 0

    for line in path.open():
        d = json.loads(line)
        r = {}
        for long, short in FIELD_MAP.items():
            v = d.get(long)
            if v in (None, "", [], {}):
                continue
            r[short] = v

        doc = d.get("source_doc_id", "")
        pdf, md = find_local_files(doc, cache)
        if pdf:
            r["pdf"] = pdf
        if md:
            r["md"] = md

        # If the record has no source_url, offer the manifest one as a HINT.
        # Kept separate from `url` on purpose: this is a display convenience,
        # NOT a fix to the dataset. The real repair is D58, at publication time.
        if not r.get("url"):
            hint = manifest_urls.get(pathlib.Path(doc).name)
            if hint:
                r["urlh"] = hint
                recovered += 1

        rows.append(r)

    stats = {"n": len(rows), "url_hints": recovered, "docs": len(cache)}
    return rows, stats


def load_manifest_urls() -> dict:
    """filename stem -> public URL, from every download manifest on disk."""
    out: dict = {}
    for f in ROOT.glob("data/corpus/downloads_*.json"):
        try:
            data = json.loads(f.read_text())
        except Exception:
            continue
        entries = data if isinstance(data, list) else list(data.values())
        for e in entries:
            if not isinstance(e, dict):
                continue
            fn = e.get("filename") or e.get("name") or ""
            url = e.get("url") or e.get("source_url") or ""
            if fn and url:
                out[pathlib.Path(fn).stem] = url
    return out


def build_facets(rows: list[dict]) -> dict:
    facets = {}
    for key, _label in FACETS:
        c = Counter(r.get(key) or "(none)" for r in rows)
        facets[key] = sorted(c.items(), key=lambda kv: (-kv[1], str(kv[0])))
    return facets


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="data/dataset/legible-pairs-v0.3.jsonl")
    ap.add_argument("--out", default="data/dataset/legible-browser.html")
    args = ap.parse_args()

    ds = ROOT / args.dataset
    if not ds.exists():
        print(f"dataset not found: {ds}", file=sys.stderr)
        return 1

    print(f"reading {ds.name} ...")
    rows, stats = load_pairs(ds)
    facets = build_facets(rows)
    print(f"  {stats['n']} pairs across {stats['docs']} documents")
    print(f"  {sum(1 for r in rows if r.get('pdf'))} pairs have their source PDF on disk")
    print(f"  {stats['url_hints']} url hints recovered from manifests (display only)")

    payload = json.dumps(
        {"rows": rows, "facets": facets, "labels": dict(FACETS), "dataset": ds.name},
        ensure_ascii=False,
        separators=(",", ":"),
    )

    # THIS IS NOT OPTIONAL. The corpus is security reports, so it contains real
    # exploit payloads as prose: 32 pairs across 9 firms carry a literal
    # "</script>" inside a finding. Embedded raw, the browser ends the data block
    # early and executes the rest of the finding as code, which is how the first
    # build of this viewer popped an alert box the moment it opened.
    # Inside a JSON string these escapes decode back to the same characters, so
    # the payload is unchanged for the reader and inert for the parser.
    payload = (
        payload.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    )
    assert "</script" not in payload.lower(), "script breakout survived escaping"

    html = TEMPLATE.replace("/*__PAYLOAD__*/", payload).replace("__ROOT__", str(ROOT))
    out = ROOT / args.out
    out.write_text(html, encoding="utf-8")
    mb = out.stat().st_size / 1e6
    print(f"\nwrote {out.relative_to(ROOT)}  ({mb:.1f} MB)")
    print("open it with: open " + str(out.relative_to(ROOT)))
    return 0


TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LEGIBLE - pair browser</title>
<style>
  :root{
    --paper:#fdfdfb; --ink:#12151c; --muted:#6b7280; --rule:#e5e3dd;
    --cobalt:#3f77ff; --cobalt-deep:#1f4fd8; --coral:#e9603f;
    --good:#1f7a4d; --unsure:#b5850b; --bad:#c0392b;
    --panel:#ffffff; --hover:#f4f6fb;
    --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  }
  @media (prefers-color-scheme:dark){
    :root{
      --paper:#14161a; --ink:#e8e6e1; --muted:#9aa0aa; --rule:#2b2f36;
      --panel:#1a1d22; --hover:#22262e;
      --good:#4ade80; --unsure:#fbbf24; --bad:#f87171;
    }
  }
  *{box-sizing:border-box}
  html,body{height:100%;margin:0}
  body{background:var(--paper);color:var(--ink);font:14px/1.5 var(--sans);overflow:hidden}

  header{
    display:flex;align-items:center;gap:16px;padding:10px 16px;
    border-bottom:1px solid var(--rule);background:var(--panel);
  }
  header h1{font-size:14px;margin:0;font-weight:650;letter-spacing:.01em;white-space:nowrap}
  header h1 span{color:var(--cobalt);font-weight:700}
  #q{
    flex:1;max-width:520px;padding:7px 11px;border:1px solid var(--rule);border-radius:7px;
    background:var(--paper);color:var(--ink);font:13px var(--sans);
  }
  #q:focus{outline:2px solid var(--cobalt);outline-offset:-1px;border-color:transparent}
  .count{font:12px var(--mono);color:var(--muted);white-space:nowrap}
  .count b{color:var(--ink);font-weight:650}
  header button{
    padding:6px 12px;border:1px solid var(--rule);border-radius:7px;background:var(--paper);
    color:var(--ink);font:12px var(--sans);cursor:pointer;white-space:nowrap;
  }
  header button:hover{background:var(--hover);border-color:var(--cobalt)}
  header button.primary{background:var(--cobalt);color:#fff;border-color:var(--cobalt)}
  header button.primary:hover{background:var(--cobalt-deep)}

  main{display:grid;grid-template-columns:216px 400px 1fr;height:calc(100vh - 53px)}
  aside,#list,#detail{overflow-y:auto;height:100%}
  aside{border-right:1px solid var(--rule);padding:12px 0 40px}
  #list{border-right:1px solid var(--rule)}

  .queues{padding:0 12px 12px;border-bottom:1px solid var(--rule);margin-bottom:8px}
  .queues h3,.facet h3{
    font:11px/1.4 var(--sans);text-transform:uppercase;letter-spacing:.07em;
    color:var(--muted);margin:12px 0 6px;font-weight:650;
  }
  .queues button{
    display:block;width:100%;text-align:left;padding:5px 8px;margin-bottom:3px;
    border:1px solid transparent;border-radius:6px;background:none;color:var(--ink);
    font:12px var(--sans);cursor:pointer;
  }
  .queues button:hover{background:var(--hover)}
  .queues button.on{background:var(--cobalt);color:#fff}
  .queues button i{float:right;font-style:normal;font-family:var(--mono);opacity:.65;font-size:11px}

  .facet{padding:0 12px}
  .facet .opt{
    display:flex;align-items:center;gap:7px;padding:3px 6px;border-radius:5px;
    cursor:pointer;font-size:12.5px;
  }
  .facet .opt:hover{background:var(--hover)}
  .facet .opt input{margin:0;accent-color:var(--cobalt);flex-shrink:0}
  .facet .opt span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .facet .opt i{font-style:normal;font-family:var(--mono);font-size:11px;color:var(--muted)}
  .facet .more{
    font-size:11.5px;color:var(--cobalt);cursor:pointer;padding:3px 6px;display:inline-block;
  }

  .row{
    padding:9px 13px;border-bottom:1px solid var(--rule);cursor:pointer;
    display:grid;grid-template-columns:1fr auto;gap:3px 8px;
  }
  .row:hover{background:var(--hover)}
  .row.sel{background:var(--cobalt);color:#fff}
  .row.sel .meta,.row.sel .snip{color:rgba(255,255,255,.82)}
  .row .snip{
    grid-column:1/-1;font-size:12.5px;color:var(--muted);
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
  }
  .row .meta{font:11px var(--mono);color:var(--muted);white-space:nowrap}
  .row .tag{
    font:10px var(--mono);padding:1px 5px;border-radius:4px;border:1px solid currentColor;
    opacity:.8;white-space:nowrap;
  }
  .mark{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
  .mark.good{background:var(--good)} .mark.unsure{background:var(--unsure)} .mark.bad{background:var(--bad)}

  #detail{padding:0}
  .empty{padding:60px 40px;color:var(--muted);text-align:center;font-size:13px}
  .dhead{padding:16px 22px 12px;border-bottom:1px solid var(--rule);position:sticky;top:0;background:var(--panel);z-index:2}
  .dhead .pid{font:12px var(--mono);color:var(--cobalt);word-break:break-all;margin-bottom:8px}
  .chips{display:flex;flex-wrap:wrap;gap:5px}
  .chip{
    font:11px var(--mono);padding:2px 7px;border-radius:5px;
    background:var(--hover);border:1px solid var(--rule);color:var(--muted);
  }
  .chip b{color:var(--ink);font-weight:600}
  .sides{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid var(--rule)}
  .side{padding:16px 22px;min-width:0}
  .side+.side{border-left:1px solid var(--rule)}
  .side h4{
    font:11px var(--sans);text-transform:uppercase;letter-spacing:.07em;color:var(--muted);
    margin:0 0 9px;font-weight:650;
  }
  .side.tech h4{color:var(--muted)}
  .side.exec h4{color:var(--cobalt)}
  .side .body{
    white-space:pre-wrap;word-wrap:break-word;font-size:13px;line-height:1.62;
    max-height:44vh;overflow-y:auto;
  }
  .side.exec .body{font-size:14px}
  .links{padding:12px 22px;border-bottom:1px solid var(--rule);display:flex;gap:14px;flex-wrap:wrap;font-size:12px}
  .links a{color:var(--cobalt);text-decoration:none}
  .links a:hover{text-decoration:underline}
  .links .none{color:var(--muted)}
  .hint{font-size:11px;color:var(--muted);font-style:italic}

  .judge{padding:16px 22px 40px}
  .judge h4{font:11px var(--sans);text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:0 0 10px;font-weight:650}
  .jbtns{display:flex;gap:8px;margin-bottom:11px}
  .jbtns button{
    flex:1;padding:9px;border:1.5px solid var(--rule);border-radius:8px;background:var(--paper);
    color:var(--ink);font:13px var(--sans);cursor:pointer;
  }
  .jbtns button:hover{border-color:currentColor}
  .jbtns button kbd{font:10px var(--mono);opacity:.5;margin-left:5px}
  .jbtns button.good.on{background:var(--good);border-color:var(--good);color:#fff}
  .jbtns button.unsure.on{background:var(--unsure);border-color:var(--unsure);color:#fff}
  .jbtns button.bad.on{background:var(--bad);border-color:var(--bad);color:#fff}
  #note{
    width:100%;padding:9px 11px;border:1px solid var(--rule);border-radius:7px;
    background:var(--paper);color:var(--ink);font:13px var(--sans);resize:vertical;min-height:56px;
  }
  #note:focus{outline:2px solid var(--cobalt);outline-offset:-1px}

  .kbd{padding:10px 22px;border-top:1px solid var(--rule);font:11px var(--mono);color:var(--muted)}
  .kbd b{color:var(--ink)}
</style>
</head>
<body>

<header>
  <h1><span>LEGIBLE</span> pair browser</h1>
  <input id="q" type="search" placeholder="Search technical, executive, or id     /" autocomplete="off">
  <span class="count"><b id="nshown">0</b> shown &nbsp;/&nbsp; <b id="njudged">0</b> judged</span>
  <button id="reset">Clear filters</button>
  <button id="export" class="primary">Export judgements</button>
</header>

<main>
  <aside>
    <div class="queues">
      <h3>Queues</h3>
      <button data-queue="all">Everything <i id="q-all"></i></button>
      <button data-queue="partial">Partial, the split votes <i id="q-partial"></i></button>
      <button data-queue="unverified">Never verified <i id="q-unverified"></i></button>
      <button data-queue="lowconf">Confidence under 1.0 <i id="q-lowconf"></i></button>
      <button data-queue="unjudged">Not judged yet <i id="q-unjudged"></i></button>
      <button data-queue="mine">Judged by me <i id="q-mine"></i></button>
    </div>
    <div id="facets"></div>
  </aside>

  <div id="list"></div>
  <div id="detail"><div class="empty">Pick a pair on the left.<br><br>j and k move, 1 2 3 judge.</div></div>
</main>

<script type="application/json" id="data">/*__PAYLOAD__*/</script>
<script>
const DATA = JSON.parse(document.getElementById('data').textContent);
const ROWS = DATA.rows, FACETS = DATA.facets, FLABEL = DATA.labels;
const REPO = "__ROOT__";
const LSKEY = 'legible.judgements.' + DATA.dataset;

let judged = {};
try { judged = JSON.parse(localStorage.getItem(LSKEY) || '{}'); } catch(e){ judged = {}; }

let filters = {}, queue = 'all', query = '', view = [], selIdx = -1;

/* ---------- filtering ---------- */
function matchesQueue(r){
  switch(queue){
    case 'partial':    return r.lab === 'partial';
    case 'unverified': return r.lab === 'structural_doclevel';
    case 'lowconf':    return r.conf !== undefined && r.conf < 1;
    case 'unjudged':   return !judged[r.id];
    case 'mine':       return !!judged[r.id];
    default:           return true;
  }
}
function matchesFacets(r){
  for (const k in filters){
    const set = filters[k];
    if (!set || !set.size) continue;
    if (!set.has(r[k] || '(none)')) return false;
  }
  return true;
}
function matchesQuery(r){
  if (!query) return true;
  const q = query.toLowerCase();
  return (r.t||'').toLowerCase().includes(q)
      || (r.e||'').toLowerCase().includes(q)
      || (r.id||'').toLowerCase().includes(q);
}
function recompute(){
  view = ROWS.filter(r => matchesQueue(r) && matchesFacets(r) && matchesQuery(r));
  document.getElementById('nshown').textContent = view.length.toLocaleString();
  document.getElementById('njudged').textContent = Object.keys(judged).length.toLocaleString();
  renderList();
}

/* ---------- list, windowed so 5k rows stay instant ---------- */
const listEl = document.getElementById('list');
let windowSize = 60;
function renderList(keepScroll){
  const top = keepScroll ? listEl.scrollTop : 0;
  const slice = view.slice(0, windowSize);
  listEl.innerHTML = slice.map((r,i) => rowHTML(r,i)).join('')
    + (view.length > windowSize
        ? `<div style="padding:14px;text-align:center"><button id="more">Show more (${(view.length-windowSize).toLocaleString()} left)</button></div>`
        : '');
  const more = document.getElementById('more');
  if (more) more.onclick = () => { windowSize += 200; renderList(true); };
  listEl.scrollTop = top;
}
function rowHTML(r, i){
  const j = judged[r.id];
  const mark = j ? `<span class="mark ${j.verdict}"></span> ` : '';
  const sev = r.sev ? `<span class="tag">${esc(r.sev)}</span>` : '';
  return `<div class="row ${i===selIdx?'sel':''}" data-i="${i}">
      <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${mark}<b style="font-size:12.5px">${esc(r.org||'')}</b>
        <span class="meta"> ${esc(r.aud||'')}</span>
      </div>
      <div style="display:flex;gap:4px;align-items:center">${sev}<span class="tag">${esc(r.lab||'')}</span></div>
      <div class="snip">${esc((r.e||r.t||'').slice(0,190))}</div>
    </div>`;
}
listEl.addEventListener('click', e => {
  const row = e.target.closest('.row');
  if (row) select(+row.dataset.i);
});

/* ---------- detail ---------- */
function select(i){
  if (i < 0 || i >= view.length) return;
  selIdx = i;
  renderList(true);
  const r = view[i];
  const j = judged[r.id] || {};
  const chips = [
    ['method', r.meth], ['type', r.atype], ['confidence', r.conf],
    ['register', r.aud], ['severity', r.sev], ['class', r.vc],
    ['year', r.yr], ['split', r.split], ['licence', r.lic],
    ['cve', (r.cve||[]).join(' ')]
  ].filter(([,v]) => v !== undefined && v !== '' && v !== null)
   .map(([k,v]) => `<span class="chip">${k} <b>${esc(String(v))}</b></span>`).join('');

  let links = [];
  if (r.pdf) links.push(`<a href="file://${esc(REPO)}/${esc(r.pdf)}" target="_blank">Open source PDF</a>`);
  if (r.md)  links.push(`<a href="file://${esc(REPO)}/${esc(r.md)}" target="_blank">Open parsed markdown</a>`);
  if (r.url) links.push(`<a href="${esc(r.url)}" target="_blank">Public URL</a>`);
  else if (r.urlh) links.push(`<a href="${esc(r.urlh)}" target="_blank">Public URL</a> <span class="hint">from the download manifest, not yet written into the record (D58)</span>`);
  if (!links.length) links.push('<span class="none">No local file found for this document.</span>');

  document.getElementById('detail').innerHTML = `
    <div class="dhead">
      <div class="pid">${esc(r.id)}</div>
      <div class="chips">${chips}</div>
    </div>
    <div class="sides">
      <div class="side tech"><h4>Technical, as published</h4><div class="body">${esc(r.t||'')}</div></div>
      <div class="side exec"><h4>The translation</h4><div class="body">${esc(r.e||'')}</div></div>
    </div>
    <div class="links">${links.join('')}</div>
    <div class="judge">
      <h4>Your verdict</h4>
      <div class="jbtns">
        <button class="good ${j.verdict==='good'?'on':''}"   data-v="good">Good <kbd>1</kbd></button>
        <button class="unsure ${j.verdict==='unsure'?'on':''}" data-v="unsure">Unsure <kbd>2</kbd></button>
        <button class="bad ${j.verdict==='bad'?'on':''}"     data-v="bad">Bad <kbd>3</kbd></button>
      </div>
      <textarea id="note" placeholder="Why? Optional, but future you will want it.">${esc(j.note||'')}</textarea>
    </div>
    <div class="kbd"><b>j</b> next &nbsp; <b>k</b> previous &nbsp; <b>1 2 3</b> judge &nbsp; <b>/</b> search &nbsp; judgements are saved in this browser, export before you finish</div>`;

  document.querySelectorAll('.jbtns button').forEach(b => {
    b.onclick = () => judge(r.id, b.dataset.v);
  });
  const note = document.getElementById('note');
  note.onblur = () => {
    if (!note.value.trim() && !judged[r.id]) return;
    judged[r.id] = Object.assign({verdict:null}, judged[r.id], {note: note.value.trim()});
    save();
  };
  document.querySelector('.row.sel')?.scrollIntoView({block:'nearest'});
}

function judge(id, verdict){
  const prev = judged[id] || {};
  judged[id] = {verdict, note: (document.getElementById('note')?.value || prev.note || '').trim(), at: new Date().toISOString()};
  save();
  recompute();
  if (queue === 'unjudged') { select(Math.min(selIdx, view.length-1)); }
  else { select(selIdx); }
}
function save(){
  localStorage.setItem(LSKEY, JSON.stringify(judged));
  document.getElementById('njudged').textContent = Object.keys(judged).length.toLocaleString();
  refreshQueueCounts();
}

/* ---------- facets ---------- */
function renderFacets(){
  document.getElementById('facets').innerHTML = Object.entries(FLABEL).map(([key,label]) => {
    const opts = FACETS[key] || [];
    const shown = opts.slice(0, 6);
    return `<div class="facet" data-key="${key}">
      <h3>${esc(label)}</h3>
      ${shown.map(([v,n]) => optHTML(key,v,n)).join('')}
      ${opts.length > 6 ? `<span class="more" data-key="${key}">+ ${opts.length-6} more</span>` : ''}
    </div>`;
  }).join('');

  document.querySelectorAll('.facet input').forEach(cb => {
    cb.onchange = () => {
      const {key, val} = cb.dataset;
      filters[key] = filters[key] || new Set();
      cb.checked ? filters[key].add(val) : filters[key].delete(val);
      recompute();
    };
  });
  document.querySelectorAll('.more').forEach(m => {
    m.onclick = () => {
      const key = m.dataset.key;
      const box = m.parentElement;
      box.innerHTML = `<h3>${esc(FLABEL[key])}</h3>` + FACETS[key].map(([v,n]) => optHTML(key,v,n)).join('');
      box.querySelectorAll('input').forEach(cb => {
        if (filters[key]?.has(cb.dataset.val)) cb.checked = true;
        cb.onchange = () => {
          filters[key] = filters[key] || new Set();
          cb.checked ? filters[key].add(cb.dataset.val) : filters[key].delete(cb.dataset.val);
          recompute();
        };
      });
    };
  });
}
function optHTML(key, val, n){
  return `<label class="opt">
    <input type="checkbox" data-key="${esc(key)}" data-val="${esc(String(val))}">
    <span>${esc(String(val))}</span><i>${n.toLocaleString()}</i>
  </label>`;
}

function refreshQueueCounts(){
  const saved = queue;
  for (const q of ['all','partial','unverified','lowconf','unjudged','mine']){
    queue = q;
    document.getElementById('q-'+q).textContent = ROWS.filter(matchesQueue).length.toLocaleString();
  }
  queue = saved;
}

/* ---------- wiring ---------- */
document.querySelectorAll('.queues button').forEach(b => {
  b.onclick = () => {
    queue = b.dataset.queue;
    document.querySelectorAll('.queues button').forEach(x => x.classList.toggle('on', x === b));
    selIdx = -1; windowSize = 60; recompute();
  };
});
document.getElementById('q').oninput = e => { query = e.target.value; windowSize = 60; recompute(); };
document.getElementById('reset').onclick = () => {
  filters = {}; query = ''; queue = 'all'; windowSize = 60;
  document.getElementById('q').value = '';
  document.querySelectorAll('.facet input').forEach(cb => cb.checked = false);
  document.querySelectorAll('.queues button').forEach((x,i) => x.classList.toggle('on', i === 0));
  recompute();
};
document.getElementById('export').onclick = () => {
  const out = Object.entries(judged).map(([id,j]) => JSON.stringify({pair_id:id, ...j})).join('\n');
  if (!out){ alert('Nothing judged yet.'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([out], {type:'application/x-ndjson'}));
  a.download = 'legible-judgements.jsonl';
  a.click();
};

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'){
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  if (e.key === 'j'){ select(selIdx + 1); e.preventDefault(); }
  if (e.key === 'k'){ select(selIdx - 1); e.preventDefault(); }
  if (e.key === '/'){ document.getElementById('q').focus(); e.preventDefault(); }
  if (selIdx >= 0 && ['1','2','3'].includes(e.key)){
    judge(view[selIdx].id, {'1':'good','2':'unsure','3':'bad'}[e.key]);
    e.preventDefault();
  }
});

function esc(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

renderFacets();
refreshQueueCounts();
document.querySelector('.queues button').classList.add('on');
recompute();
</script>
</body>
</html>
"""


if __name__ == "__main__":
    raise SystemExit(main())
