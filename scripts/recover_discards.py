#!/usr/bin/env python3
"""Recover the pairs the alignment judge discarded, for HUMAN review.

The pair-alignment judge (verify_dual.py) is being set aside as a hard gate:
owner found it too aggressive (2026-07-12). This script does NOT re-judge — it
joins the verdicts back to the full pair text and writes everything the judge
marked `partial` or `unaligned` into data/pairs/review/ so the owner can eyeball
each one and decide keep/drop by hand.

Outputs:
  data/pairs/review/board_discarded.jsonl   full text + the judge's verdict/votes
  data/pairs/review/index.html              a readable, offline review page
                                            (keep/drop toggles, persists to
                                            localStorage, exports kept pair_ids)
"""
import json, pathlib, html, collections

ROOT = pathlib.Path("/Users/marcelomoreno/Downloads/legible-sec")
HARV = ROOT / "data/pairs/harvest"
REVIEW = ROOT / "data/pairs/review"
REVIEW.mkdir(parents=True, exist_ok=True)

DISCARD_LABELS = {"partial", "unaligned"}

# pair_id -> full row (has technical_text, board_text, source, title, url, ...)
text = {}
for line in (HARV / "board_all_for_verify.jsonl").read_text().splitlines():
    if line.strip():
        r = json.loads(line)
        text[r["pair_id"]] = r

rows = []
for line in (HARV / "board_verified.jsonl").read_text().splitlines():
    if not line.strip():
        continue
    v = json.loads(line)
    if v.get("alignment_label") not in DISCARD_LABELS:
        continue
    t = text.get(v["pair_id"])
    if not t:
        continue
    rows.append({
        "pair_id": v["pair_id"],
        "label": v["alignment_label"],
        "confidence": v.get("alignment_confidence"),
        "votes": v.get("vote", {}),
        "reason": v.get("verifier_reason", ""),
        "source": t.get("source", "?"),
        "report_title": t.get("report_title", ""),
        "source_url": t.get("source_url", ""),
        "license": t.get("license", ""),
        "technical_text": t.get("technical_text", ""),
        "board_text": t.get("board_text") or t.get("executive_text", ""),
    })

# stable order: unaligned first (most suspect), then partial; then by source
rows.sort(key=lambda r: (r["label"] != "unaligned", r["source"], r["pair_id"]))

out_jsonl = REVIEW / "board_discarded.jsonl"
with out_jsonl.open("w") as fh:
    for r in rows:
        fh.write(json.dumps(r, ensure_ascii=False) + "\n")

by_label = collections.Counter(r["label"] for r in rows)
by_source = collections.Counter(r["source"] for r in rows)

# ---- readable HTML review page (self-contained, opens as file://) ----
DATA_JSON = json.dumps(rows, ensure_ascii=False)
PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LEGIBLE - board pairs the judge discarded</title>
<style>
:root{--bg:#0f1115;--card:#171a21;--line:#262b36;--ink:#e8ebf0;--mut:#9aa3b2;
--tech:#c9d3e0;--cobalt:#5b7cff;--amber:#e0a53a;--red:#e06666;--ok:#4fbf82;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
header{position:sticky;top:0;z-index:10;background:rgba(15,17,21,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:14px 20px}
h1{font-size:17px;margin:0 0 3px;font-weight:650}
.sub{color:var(--mut);font-size:12.5px}
.bar{display:flex;flex-wrap:wrap;gap:8px;margin-top:11px;align-items:center}
.chip{font:600 12px var(--mono);padding:5px 11px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);cursor:pointer;user-select:none}
.chip.on{color:var(--ink);border-color:var(--cobalt);background:color-mix(in oklab,var(--cobalt) 18%,var(--card))}
.spacer{flex:1}
.btn{font:600 12px var(--mono);padding:6px 13px;border-radius:8px;border:1px solid var(--cobalt);background:color-mix(in oklab,var(--cobalt) 16%,var(--card));color:var(--ink);cursor:pointer}
.wrap{max-width:920px;margin:0 auto;padding:20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0;margin:0 0 16px;overflow:hidden}
.card.drop{opacity:.4}
.card.keep{border-color:color-mix(in oklab,var(--ok) 55%,var(--line))}
.chd{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}
.badge{font:700 10.5px var(--mono);text-transform:uppercase;letter-spacing:.05em;padding:3px 9px;border-radius:999px}
.b-partial{background:color-mix(in oklab,var(--amber) 22%,transparent);color:var(--amber);border:1px solid color-mix(in oklab,var(--amber) 45%,transparent)}
.b-unaligned{background:color-mix(in oklab,var(--red) 20%,transparent);color:var(--red);border:1px solid color-mix(in oklab,var(--red) 45%,transparent)}
.src{font:600 11.5px var(--mono);color:var(--mut)}
.pid{font:11px var(--mono);color:#5b6473}
.votes{font:11.5px var(--mono);color:var(--mut)}
.title{padding:9px 16px 0;font-size:12px;color:var(--mut)}
.title a{color:var(--cobalt);text-decoration:none}
.pane{padding:13px 16px}
.lab{font:700 10px var(--mono);letter-spacing:.09em;text-transform:uppercase;color:#6b7482;margin-bottom:5px}
.tech{color:var(--tech);font:13px/1.5 var(--mono);white-space:pre-wrap}
.board{color:var(--ink);font-size:14.5px;white-space:pre-wrap;border-top:1px dashed var(--line);padding-top:12px;margin-top:5px}
.acts{display:flex;gap:8px;padding:11px 16px;border-top:1px solid var(--line);background:#12151b}
.act{font:600 12px var(--mono);padding:6px 15px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--mut);cursor:pointer}
.act.keep.on{border-color:var(--ok);color:var(--ok);background:color-mix(in oklab,var(--ok) 14%,transparent)}
.act.drop.on{border-color:var(--red);color:var(--red);background:color-mix(in oklab,var(--red) 14%,transparent)}
.count{font:600 12px var(--mono);color:var(--mut);margin-left:auto;align-self:center}
.hidden{display:none}
</style></head><body>
<header>
  <h1>Board pairs the judge discarded &mdash; your call</h1>
  <div class="sub">__N__ pairs the alignment judge marked <b>partial</b> or <b>unaligned</b>. The judge is OFF as a gate. Read each, mark <b>keep</b> or <b>drop</b>. Your decisions save in this browser; hit <b>Export keeps</b> to hand the list back.</div>
  <div class="bar">
    <span class="chip on" data-f="all">all</span>
    <span class="chip" data-f="unaligned">unaligned</span>
    <span class="chip" data-f="partial">partial</span>
    <span class="chip" data-f="CSRB">CSRB</span>
    <span class="chip" data-f="GAO">GAO</span>
    <span class="chip" data-f="OIG">OIG</span>
    <span class="chip" data-f="undecided">undecided</span>
    <span class="spacer"></span>
    <span class="count" id="tally"></span>
    <button class="btn" id="export">Export keeps</button>
  </div>
</header>
<div class="wrap" id="list"></div>
<script>
const DATA = __DATA__;
const KEY = "legible_board_review_v1";
let dec = JSON.parse(localStorage.getItem(KEY) || "{}");
let filter = "all";
const esc = s => (s||"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
function tally(){
  const k = Object.values(dec).filter(v=>v==="keep").length;
  const d = Object.values(dec).filter(v=>v==="drop").length;
  document.getElementById("tally").textContent = k+" keep / "+d+" drop / "+(DATA.length-k-d)+" left";
}
function visible(r){
  if(filter==="all") return true;
  if(filter==="undecided") return !dec[r.pair_id];
  if(filter==="partial"||filter==="unaligned") return r.label===filter;
  return r.source===filter;
}
function render(){
  const L = document.getElementById("list");
  L.innerHTML = "";
  DATA.filter(visible).forEach(r=>{
    const st = dec[r.pair_id]||"";
    const c = document.createElement("div");
    c.className = "card"+(st?" "+st:"");
    const votes = Object.entries(r.votes||{}).map(([m,v])=>m+"="+v).join(" &middot; ");
    c.innerHTML = `
      <div class="chd">
        <span class="badge b-${r.label}">${r.label}</span>
        <span class="src">${esc(r.source)}</span>
        <span class="votes">${votes} &middot; conf ${r.confidence??"?"}</span>
        <span class="pid">${esc(r.pair_id)}</span>
      </div>
      ${r.report_title?`<div class="title">${esc(r.report_title)} ${r.source_url?`&middot; <a href="${esc(r.source_url)}" target="_blank">source</a>`:""}</div>`:""}
      <div class="pane">
        <div class="lab">Technical finding</div>
        <div class="tech">${esc(r.technical_text)}</div>
        <div class="board"><div class="lab">Board translation</div>${esc(r.board_text)}</div>
      </div>
      <div class="acts">
        <button class="act keep ${st==="keep"?"on":""}" data-id="${r.pair_id}" data-v="keep">&#10003; keep</button>
        <button class="act drop ${st==="drop"?"on":""}" data-id="${r.pair_id}" data-v="drop">&#10007; drop</button>
      </div>`;
    L.appendChild(c);
  });
  tally();
}
document.addEventListener("click",e=>{
  const a = e.target.closest(".act");
  if(a){
    const id=a.dataset.id, v=a.dataset.v;
    dec[id] = (dec[id]===v)?undefined:v;
    if(!dec[id]) delete dec[id];
    localStorage.setItem(KEY, JSON.stringify(dec));
    render();
    return;
  }
  const ch = e.target.closest(".chip");
  if(ch){
    filter = ch.dataset.f;
    document.querySelectorAll(".chip").forEach(x=>x.classList.toggle("on",x===ch));
    render();
  }
});
document.getElementById("export").addEventListener("click",()=>{
  const keeps = DATA.filter(r=>dec[r.pair_id]==="keep").map(r=>r.pair_id);
  const drops = DATA.filter(r=>dec[r.pair_id]==="drop").map(r=>r.pair_id);
  const blob = JSON.stringify({keep:keeps, drop:drops}, null, 2);
  navigator.clipboard?.writeText(blob).then(
    ()=>alert("Copied "+keeps.length+" keep + "+drops.length+" drop pair_ids to clipboard."),
    ()=>prompt("Copy your decisions:", blob));
});
render();
</script></body></html>"""
PAGE = PAGE.replace("__DATA__", DATA_JSON).replace("__N__", str(len(rows)))

(REVIEW / "index.html").write_text(PAGE)

print(f"Recovered {len(rows)} discarded board pairs -> {out_jsonl}")
print(f"  by label:  {dict(by_label)}")
print(f"  by source: {dict(by_source)}")
print(f"Review page -> {REVIEW/'index.html'}")
