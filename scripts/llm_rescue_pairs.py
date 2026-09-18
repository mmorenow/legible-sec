#!/usr/bin/env python
"""LEGIBLE D44: LLM re-mining pass over heuristic-starved sources.

LLM-as-SELECTOR only -- it never writes or rewrites text, it only points at
exact quotes. Every returned quote is verbatim-asserted against the source
markdown (whitespace-normalized for matching; the ORIGINAL text span is what
gets stored). A quote that fails assertion gets ONE retry ("copy EXACTLY");
if it still fails, it -- and any pair depending on it -- is discarded.

Two independent groups (see research/08-decision-log.md D44):

  A. Postmortems (customer register): all data/corpus/out/md/postmortem__*.md.
     One call/doc -> 0..6 (plain_quote, technical_quote) pairs.
  B. OIG regex-failure rescues (management register): docs listed in
     data/pairs/gov_audit_skipped.txt whose skip reason contains "suspiciously
     long" or "too short" (~49 docs -- NOT the "no exec section" withheld
     stubs, NOT the classification-banner exclusions). One call/doc ->
     0..1 doc-level pair (LLM-located exec span <-> findings span) + 0..3
     claim pairs.

Output: data/pairs/candidates_llm_rescue.jsonl (append-only, resumable)
Manifest: data/pairs/llm_rescue_manifest.json (per-doc calls/tokens/pairs/
          assert-failure counts; drives resumability -- a doc with a terminal
          status ("ok") is skipped on the next run).

Budget: HARD CAP $3.00 total, enforced in code (checked after every call;
stops processing immediately once exceeded, whatever is in flight is
finished/discarded cleanly, remaining docs are left "pending" for a future
run once more budget is available).

Usage:
    .venv/bin/python scripts/llm_rescue_pairs.py --group postmortem --only auth0 cloudflare
    .venv/bin/python scripts/llm_rescue_pairs.py --group oig --only <doc_id> <doc_id>
    .venv/bin/python scripts/llm_rescue_pairs.py                      # bulk, both groups, resumable
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from legible.schema import CandidatePair  # noqa: E402

MD_DIR = ROOT / "data/corpus/out/md"
OUT_PATH = ROOT / "data/pairs/candidates_llm_rescue.jsonl"
MANIFEST_PATH = ROOT / "data/pairs/llm_rescue_manifest.json"
POSTMORTEM_CANDIDATES = ROOT / "data/pairs/candidates_postmortem.jsonl"
GOV_SKIPPED = ROOT / "data/pairs/gov_audit_skipped.txt"
DOWNLOADS_OIG = ROOT / "data/corpus/downloads_oig.json"

MODEL = "gemini-3-flash-preview"
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"
PRICE_IN, PRICE_OUT = 0.50, 3.00  # $/MTok, per scripts/verify_pairs.py PRICES table
HARD_BUDGET_USD = 3.0

# --- budget & LLM plumbing --------------------------------------------------


class Budget:
    def __init__(self, cap: float):
        self.cap = min(cap, HARD_BUDGET_USD)
        self.spend = 0.0
        self.stopped = False

    def add(self, in_tok: int, out_tok: int) -> None:
        self.spend += in_tok * PRICE_IN / 1e6 + out_tok * PRICE_OUT / 1e6
        if self.spend > self.cap:
            self.stopped = True


def load_key() -> str:
    import os

    key = os.environ.get("GEMINI_API_KEY", "")
    env = ROOT / ".env"
    if not key and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("GEMINI_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        sys.exit("No GEMINI_API_KEY found (env var or .env). Aborting before any call.")
    return key


def call_llm(prompt: str, key: str, max_tokens: int = 4000) -> tuple[dict, int, int]:
    # max_tokens is essential: without it, json_object mode occasionally goes
    # into an unbounded generation (observed live: single calls hung 10+ min
    # blocked on the SSL read while the model kept emitting tokens). Quote
    # selection output is small by construction, so a tight cap is safe --
    # but long OIG span quotes CAN legitimately exceed it, so on a truncated
    # (finish_reason=length) or unparseable response the cap is expanded
    # (x3, up to 16k) and the call retried instead of failing outright.
    #
    # Usage accounting: token usage from EVERY received response is summed
    # into the returned totals, including failed/truncated attempts -- those
    # calls are billed by the provider whether or not we keep the output
    # (learned the hard way: an early truncation bug burned 4 full-document
    # calls that were recorded as 0 tokens).
    mt = max_tokens
    total_in = total_out = 0
    last_err = "unreachable"
    for attempt in range(4):
        body = json.dumps(
            {
                "model": MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "temperature": 0.0,
                "max_tokens": mt,
            }
        ).encode()
        req = urllib.request.Request(
            f"{BASE_URL}/chat/completions",
            data=body,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=240) as r:
                out = json.load(r)
        except Exception as e:
            last_err = str(e)[:300]
            if attempt < 3:
                time.sleep(2 ** (attempt + 1))
            continue
        usage = out.get("usage", {})
        total_in += usage.get("prompt_tokens", 0)
        total_out += usage.get("completion_tokens", 0)
        choice = (out.get("choices") or [{}])[0]
        text = (choice.get("message") or {}).get("content") or ""
        finish = choice.get("finish_reason")
        m = re.search(r"\{.*\}", text, re.S)
        try:
            parsed = json.loads(m.group(0)) if m else None
        except json.JSONDecodeError:
            parsed = None
        if parsed is not None and finish != "length":
            return parsed, total_in, total_out
        # truncated or unparseable -> expand the output budget and retry
        last_err = f"truncated/unparseable output (finish_reason={finish}, max_tokens={mt})"
        if mt >= 16000:
            break
        mt = min(mt * 3, 16000)
    return {"_error": last_err}, total_in, total_out


# --- verbatim assertion ------------------------------------------------------


def _normalize_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


class DocIndex:
    """Whitespace-normalized index over a document, mapping normalized
    character positions back to the ORIGINAL text so a verbatim-asserted
    quote can be sliced from the ORIGINAL (not the normalized) source."""

    def __init__(self, text: str):
        self.text = text
        norm_chars: list[str] = []
        orig_idx: list[int] = []
        i, n = 0, len(text)
        while i < n:
            c = text[i]
            if c.isspace():
                norm_chars.append(" ")
                orig_idx.append(i)
                while i < n and text[i].isspace():
                    i += 1
            else:
                norm_chars.append(c)
                orig_idx.append(i)
                i += 1
        self.norm = "".join(norm_chars)
        self.orig_idx = orig_idx

    def find(self, quote: str, search_from_norm: int = 0) -> dict | None:
        nq = _normalize_ws(quote)
        if len(nq) < 8:  # too short to trust as a real quote match
            return None
        pos = self.norm.find(nq, search_from_norm)
        if pos == -1:
            return None
        start = self.orig_idx[pos]
        end_norm = pos + len(nq) - 1
        end = self.orig_idx[end_norm] + 1
        return {
            "original": self.text[start:end],
            "start": start,
            "end": end,
            "norm_start": pos,
            "norm_end": pos + len(nq),
        }


RETRY_PROMPT = """You previously tried to quote a passage from the DOCUMENT below, but it did \
not match the document verbatim (whitespace-normalized comparison). Copy the EXACT text, \
character for character, from the DOCUMENT below that is closest to what you intended. Do not \
paraphrase or fix anything -- copy it exactly as it appears in the DOCUMENT.

INTENDED (possibly slightly wrong) QUOTE: {quote}

WHAT THIS QUOTE IS FOR: {role}

Reply with JSON only: {{"quote": "<exact verbatim text copied from DOCUMENT below, or null if no \
matching passage exists>"}}

DOCUMENT:
{doc}"""


class Asserter:
    """Wraps verbatim-assert + one "copy EXACTLY" retry, with counters for the manifest."""

    def __init__(self, docidx: DocIndex, doc_text_for_retry: str, key: str, budget: Budget):
        self.docidx = docidx
        self.doc_text_for_retry = doc_text_for_retry
        self.key = key
        self.budget = budget
        self.attempts = 0
        self.first_try_ok = 0
        self.retry_calls = 0
        self.retry_saved = 0
        self.failures = 0
        self.in_tokens = 0
        self.out_tokens = 0

    def check(self, quote: str | None, role: str, search_from_norm: int = 0) -> dict | None:
        self.attempts += 1
        if not quote or not isinstance(quote, str):
            self.failures += 1
            return None
        m = self.docidx.find(quote, search_from_norm)
        if m is not None:
            self.first_try_ok += 1
            return m
        if self.budget.stopped:
            self.failures += 1
            return None
        # one retry: "copy EXACTLY"
        prompt = RETRY_PROMPT.format(quote=quote[:800], role=role, doc=self.doc_text_for_retry)
        parsed, in_t, out_t = call_llm(prompt, self.key, max_tokens=1500)
        self.retry_calls += 1
        self.in_tokens += in_t
        self.out_tokens += out_t
        self.budget.add(in_t, out_t)
        retry_quote = parsed.get("quote") if isinstance(parsed, dict) else None
        if retry_quote:
            m = self.docidx.find(retry_quote, search_from_norm)
            if m is not None:
                self.retry_saved += 1
                return m
        self.failures += 1
        return None


def to_jsonl(pair: CandidatePair, license_tag: str) -> str:
    from dataclasses import asdict

    d = asdict(pair)
    d["license"] = license_tag
    return json.dumps(d, ensure_ascii=False)


# --- Group A: postmortems ----------------------------------------------------

POSTMORTEM_PROMPT = """You are mining a security-incident postmortem (a company's public blog post \
about a breach/incident) to build a research dataset that studies how technical security details \
get translated into customer-facing language.

Read the DOCUMENT below (markdown) and find places where:
- a PLAIN quote states, in customer-facing language, what happened / the impact / an assurance \
("no evidence of unauthorized access", "your account is not affected", "we have rotated the \
credential", "out of an abundance of caution", etc.)
- a TECHNICAL quote (nearby or elsewhere in the document) states the concrete technical fact that \
GROUNDS that plain claim: the attack vector, the systems/services involved, a timeline detail, a \
root cause, an indicator of compromise.

Return JSON only: {{"pairs": [{{"plain_quote": "...", "technical_quote": "..."}}, ...]}}

Rules:
- Both quote fields MUST be copied EXACTLY, character-for-character, from the DOCUMENT text below \
(same words, spelling, punctuation, capitalization). Do not paraphrase, summarize, translate, or \
correct anything -- copy verbatim substrings only.
- Each quote should be a complete sentence or a short coherent passage (not a single word or \
fragment, not the whole document).
- Return between 0 and 6 pairs. Prefer fewer, high-confidence pairs over many weak/forced ones.
- If this document has no clear customer-facing ("plain") register at all, return {{"pairs": []}}.

DOCUMENT:
{doc}"""


def maybe_chunk(text: str, cap: int, head: int, tail: int) -> str:
    if len(text) <= cap:
        return text
    return text[:head] + "\n\n[... middle of document omitted ...]\n\n" + text[-tail:]


def process_postmortem_doc(path: pathlib.Path, key: str, budget: Budget, dedup: set[str]) -> dict:
    stem = path.stem  # e.g. postmortem__1password__okta-incident-oct2023
    assert stem.startswith("postmortem__")
    doc_key = stem[len("postmortem__"):]  # e.g. 1password__okta-incident-oct2023
    company = doc_key.split("__")[0]
    source_doc_id = f"postmortem/{doc_key}"

    text = path.read_text(errors="replace")
    docidx = DocIndex(text)
    chunk = maybe_chunk(text, cap=12000, head=8000, tail=4000)

    entry: dict = {
        "group": "postmortem",
        "doc_id": stem,
        "calls": 0,
        "retry_calls": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cost_usd": 0.0,
        "pairs_emitted": 0,
        "pairs_dedup_skipped": 0,
        "assert_attempts": 0,
        "assert_first_try_ok": 0,
        "assert_retry_saved": 0,
        "assert_failures": 0,
        "status": "pending",
    }

    prompt = POSTMORTEM_PROMPT.format(doc=chunk)
    parsed, in_t, out_t = call_llm(prompt, key)
    entry["calls"] += 1
    entry["input_tokens"] += in_t
    entry["output_tokens"] += out_t
    budget.add(in_t, out_t)
    if "_error" in parsed:
        entry["status"] = "error"
        entry["notes"] = parsed["_error"]
        return {"entry": entry, "pairs": []}

    asserter = Asserter(docidx, text, key, budget)
    pairs: list[str] = []
    n = 0
    for item in (parsed.get("pairs") or [])[:6]:
        if budget.stopped:
            break
        plain_m = asserter.check(item.get("plain_quote"), "plain (customer-facing) quote in a postmortem")
        tech_m = asserter.check(item.get("technical_quote"), "technical grounding quote in a postmortem")
        if plain_m is None or tech_m is None:
            continue
        norm_key = _normalize_ws(plain_m["original"])
        if norm_key in dedup:
            entry["pairs_dedup_skipped"] += 1
            continue
        dedup.add(norm_key)
        cp = CandidatePair(
            pair_id=f"{stem}#llm{n}",
            source_doc_id=source_doc_id,
            source_org=company,
            doc_type="incident_postmortem",
            technical_text=tech_m["original"],
            technical_context="technical/timeline passage (LLM-selected)",
            executive_text=plain_m["original"],
            audience_observed="customer",
            alignment_method="llm_selected",
            alignment_type="1:1",
            exec_span_kind="prose",
            needs_llm_verify=True,
            notes="D44 LLM re-mining rescue pass (gemini-3-flash-preview, selector-only, verbatim-asserted)",
        )
        pairs.append(to_jsonl(cp, "research-quotation-noncommercial"))
        n += 1

    entry["calls"] += asserter.retry_calls
    entry["retry_calls"] = asserter.retry_calls
    entry["input_tokens"] += asserter.in_tokens
    entry["output_tokens"] += asserter.out_tokens
    entry["assert_attempts"] = asserter.attempts
    entry["assert_first_try_ok"] = asserter.first_try_ok
    entry["assert_retry_saved"] = asserter.retry_saved
    entry["assert_failures"] = asserter.failures
    entry["pairs_emitted"] = n
    entry["cost_usd"] = round(
        entry["input_tokens"] * PRICE_IN / 1e6 + entry["output_tokens"] * PRICE_OUT / 1e6, 5)
    entry["status"] = "budget_stop" if budget.stopped else "ok"
    return {"entry": entry, "pairs": pairs}


# --- Group B: OIG regex-failure rescues --------------------------------------

OIG_PROMPT = """You are reading a US federal Office of Inspector General (OIG) cybersecurity/FISMA \
audit report (markdown, converted from a PDF). An automated heading-detection pass FAILED to \
cleanly locate two sections in this report:
  (a) the executive-summary-style section -- usually titled "Results in Brief", "Executive \
Summary", "Highlights", "What We Found", or similar -- a short front-matter summary of the \
audit's overall conclusion.
  (b) the findings/technical section -- usually titled "Findings", "Results and Recommendations", \
"Audit Results", "Results of Evaluation", or similar -- the detailed body describing specific \
weaknesses/deficiencies.

Locate both sections yourself by reading the DOCUMENT below, and also find 0-3 places where a \
specific/quantified claim in the executive-summary section (a number, a named control-family or \
FISMA-domain weakness, a maturity-level rating) is elaborated by a specific passage in the \
findings section.

Return JSON only in this exact shape:
{{"exec_span": {{"first_sentence": "<exact quote: FIRST sentence of the executive-summary \
section>", "last_sentence": "<exact quote: LAST sentence of the executive-summary section>"}}, \
"findings_span": {{"first_sentence": "<exact quote: FIRST sentence of the findings section>", \
"last_sentence": "<exact quote: LAST sentence of the findings section>"}}, "claim_pairs": \
[{{"exec_quote": "<exact quote from the executive-summary section>", "finding_quote": "<exact \
quote from the findings section it corresponds to>"}}, ...]}}

Rules:
- EVERY quote MUST be copied EXACTLY, character-for-character, from the DOCUMENT text below. Do \
not paraphrase, summarize, or fix anything.
- If you cannot confidently find one of the two sections, set BOTH its fields to null.
- claim_pairs: 0 to 3 pairs; return [] if none clearly qualify.

DOCUMENT:
{doc}"""

CONTRACTED_FIRMS = [
    "williams adley", "kpmg", "clifton larson allen", "cliftonlarsonallen",
    "kearney", "cotton & company", "cotton and company", "rma associates",
    "sikich", "independent public accounting firm",
    "independent certified public accounting",
]


def detect_license(cover_text: str) -> str:
    low = cover_text.lower()
    for firm in CONTRACTED_FIRMS:
        if firm in low:
            return "us-gov-contracted-verify"
    return "public-domain-us-gov"


def select_oig_docs() -> list[tuple[str, str]]:
    """(doc_id, reason) for skip-log entries whose reason is a regex-boundary
    failure ("suspiciously long" / "too short") -- NOT "no exec section"
    (withheld-report stubs, by design unrescuable) and NOT the classification-
    banner exclusions (D40 caution, correctly excluded, out of scope here)."""
    out = []
    if not GOV_SKIPPED.exists():
        return out
    for line in GOV_SKIPPED.read_text().splitlines():
        if not line.strip() or "\t" not in line:
            continue
        doc_id, reason = line.split("\t", 1)
        if "suspiciously long" in reason or "too short" in reason:
            out.append((doc_id, reason))
    return out


def load_oig_meta() -> dict[str, dict]:
    meta_by_docid: dict[str, dict] = {}
    if not DOWNLOADS_OIG.exists():
        return meta_by_docid
    dl = json.loads(DOWNLOADS_OIG.read_text())
    for r in dl:
        doc_id = r.get("doc_id")
        if not doc_id or r.get("status") not in ("ok", "cached"):
            continue
        source_org = doc_id.split("__")[1] if "__" in doc_id else "unknown-oig"
        doc_type = "oig_audit" if r.get("report_type") == "Audit" else "oig_inspection"
        meta_by_docid[doc_id] = {"source_org": source_org, "doc_type": doc_type}
    return meta_by_docid


def process_oig_doc(doc_id: str, reason: str, meta: dict, key: str, budget: Budget) -> dict:
    path = MD_DIR / f"{doc_id}.md"
    entry: dict = {
        "group": "oig",
        "doc_id": doc_id,
        "calls": 0,
        "retry_calls": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cost_usd": 0.0,
        "doc_pair_emitted": False,
        "claim_pairs_emitted": 0,
        "assert_attempts": 0,
        "assert_first_try_ok": 0,
        "assert_retry_saved": 0,
        "assert_failures": 0,
        "status": "pending",
    }
    if not path.exists():
        entry["status"] = "error"
        entry["notes"] = "md file not found"
        return {"entry": entry, "pairs": []}

    text = path.read_text(errors="replace")
    docidx = DocIndex(text)
    chunk = maybe_chunk(text, cap=220000, head=140000, tail=60000)  # effectively always full text (max observed ~155k chars)
    license_tag = detect_license(text[:3000])
    source_org = meta.get("source_org", doc_id.split("__")[1] if "__" in doc_id else "unknown-oig")
    doc_type = meta.get("doc_type", "oig_audit")

    prompt = OIG_PROMPT.format(doc=chunk)
    parsed, in_t, out_t = call_llm(prompt, key)
    entry["calls"] += 1
    entry["input_tokens"] += in_t
    entry["output_tokens"] += out_t
    budget.add(in_t, out_t)
    if "_error" in parsed:
        entry["status"] = "error"
        entry["notes"] = parsed["_error"]
        return {"entry": entry, "pairs": []}

    asserter = Asserter(docidx, text, key, budget)
    pairs: list[str] = []

    exec_span = parsed.get("exec_span") or {}
    findings_span = parsed.get("findings_span") or {}
    exec_text = findings_text = None

    if exec_span.get("first_sentence") and exec_span.get("last_sentence") and not budget.stopped:
        m1 = asserter.check(exec_span["first_sentence"], "OIG exec-summary span: FIRST sentence")
        if m1 is not None:
            m2 = asserter.check(
                exec_span["last_sentence"], "OIG exec-summary span: LAST sentence",
                search_from_norm=m1["norm_start"],
            )
            if m2 is not None and m2["end"] > m1["start"]:
                candidate = text[m1["start"]: m2["end"]]
                if 200 <= len(candidate) <= 9000:
                    exec_text = candidate

    if findings_span.get("first_sentence") and findings_span.get("last_sentence") and not budget.stopped:
        m3 = asserter.check(findings_span["first_sentence"], "OIG findings span: FIRST sentence")
        if m3 is not None:
            m4 = asserter.check(
                findings_span["last_sentence"], "OIG findings span: LAST sentence",
                search_from_norm=m3["norm_start"],
            )
            if m4 is not None and m4["end"] > m3["start"]:
                candidate = text[m3["start"]: m4["end"]]
                if len(candidate) >= 200:
                    findings_text = candidate

    if exec_text and findings_text:
        cp = CandidatePair(
            pair_id=f"{doc_id}#llmdoc",
            source_doc_id=doc_id,
            source_org=source_org,
            doc_type=doc_type,
            technical_text=findings_text[:15000],
            technical_context="Results and Recommendations / Findings (LLM-located)",
            executive_text=exec_text[:9000],
            audience_observed="management",
            alignment_method="llm_selected",
            alignment_type="1:1",
            exec_span_kind="doc_level",
            needs_llm_verify=True,
            notes=f"D44 LLM re-mining rescue pass (gemini-3-flash-preview); original heuristic skip "
                  f"reason: {reason}",
        )
        pairs.append(to_jsonl(cp, license_tag))
        entry["doc_pair_emitted"] = True

    n_claim = 0
    for item in (parsed.get("claim_pairs") or [])[:3]:
        if budget.stopped:
            break
        exec_m = asserter.check(item.get("exec_quote"), "OIG claim pair: exec-summary quote")
        find_m = asserter.check(item.get("finding_quote"), "OIG claim pair: findings quote")
        if exec_m is None or find_m is None:
            continue
        cp = CandidatePair(
            pair_id=f"{doc_id}#llmc{n_claim}",
            source_doc_id=doc_id,
            source_org=source_org,
            doc_type=doc_type,
            technical_text=find_m["original"],
            technical_context="findings passage (LLM-selected)",
            executive_text=exec_m["original"],
            audience_observed="management",
            alignment_method="llm_selected",
            alignment_type="1:1",
            exec_span_kind="claim",
            needs_llm_verify=True,
            notes=f"D44 LLM re-mining rescue pass (gemini-3-flash-preview); original heuristic skip "
                  f"reason: {reason}",
        )
        pairs.append(to_jsonl(cp, license_tag))
        n_claim += 1

    entry["calls"] += asserter.retry_calls
    entry["retry_calls"] = asserter.retry_calls
    entry["input_tokens"] += asserter.in_tokens
    entry["output_tokens"] += asserter.out_tokens
    entry["assert_attempts"] = asserter.attempts
    entry["assert_first_try_ok"] = asserter.first_try_ok
    entry["assert_retry_saved"] = asserter.retry_saved
    entry["assert_failures"] = asserter.failures
    entry["claim_pairs_emitted"] = n_claim
    entry["cost_usd"] = round(
        entry["input_tokens"] * PRICE_IN / 1e6 + entry["output_tokens"] * PRICE_OUT / 1e6, 5)
    entry["status"] = "budget_stop" if budget.stopped else "ok"
    return {"entry": entry, "pairs": pairs}


# --- manifest / dedup / driver -----------------------------------------------


def load_manifest() -> dict:
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text())
    return {"docs": {}, "total_spend_usd": 0.0}


def save_manifest(m: dict) -> None:
    MANIFEST_PATH.write_text(json.dumps(m, indent=2, ensure_ascii=False))


def load_postmortem_dedup() -> set[str]:
    dedup: set[str] = set()
    if POSTMORTEM_CANDIDATES.exists():
        for line in POSTMORTEM_CANDIDATES.open():
            d = json.loads(line)
            dedup.add(_normalize_ws(d.get("executive_text", "")))
    if OUT_PATH.exists():
        for line in OUT_PATH.open():
            d = json.loads(line)
            if d.get("doc_type") == "incident_postmortem":
                dedup.add(_normalize_ws(d.get("executive_text", "")))
    return dedup


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--group", choices=["postmortem", "oig", "both"], default="both")
    ap.add_argument("--only", nargs="*", default=None, help="restrict to these doc_ids (sample gate)")
    ap.add_argument("--budget-usd", type=float, default=HARD_BUDGET_USD)
    args = ap.parse_args()

    key = load_key()
    manifest = load_manifest()
    docs_manifest = manifest.setdefault("docs", {})
    budget = Budget(args.budget_usd)
    # cross-run budget: prior spend counts against the hard cap (resumable)
    budget.spend = float(manifest.get("total_spend_usd", 0.0))
    if budget.spend > budget.cap:
        sys.exit(f"Budget already exhausted (${budget.spend:.4f} >= ${budget.cap:.2f}); refusing to run.")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    # write-time pair_id guard: never append a pair_id that is already in the
    # output file (protects against manifest/JSONL drift, e.g. a killed run
    # whose pairs were flushed but whose manifest entry was lost).
    existing_pair_ids: set[str] = set()
    if OUT_PATH.exists():
        for line in OUT_PATH.open():
            try:
                existing_pair_ids.add(json.loads(line)["pair_id"])
            except (json.JSONDecodeError, KeyError):
                continue
    out_fh = OUT_PATH.open("a")

    def write_pairs(pairs: list[str]) -> int:
        n = 0
        for line in pairs:
            pid = json.loads(line)["pair_id"]
            if pid in existing_pair_ids:
                continue
            existing_pair_ids.add(pid)
            out_fh.write(line + "\n")
            n += 1
        out_fh.flush()
        return n

    def done(doc_id: str) -> bool:
        e = docs_manifest.get(doc_id)
        return e is not None and e.get("status") == "ok"

    total_new_pairs = 0

    if args.group in ("postmortem", "both"):
        dedup = load_postmortem_dedup()
        paths = sorted(MD_DIR.glob("postmortem__*.md"))
        if args.only:
            paths = [p for p in paths if p.stem in args.only or p.stem.split("__", 2)[1] in args.only]
        for p in paths:
            if budget.stopped:
                print(f"BUDGET STOP before {p.stem} (spend=${budget.spend:.3f})", flush=True)
                break
            if done(p.stem):
                continue
            result = process_postmortem_doc(p, key, budget, dedup)
            entry, pairs = result["entry"], result["pairs"]
            total_new_pairs += write_pairs(pairs)
            docs_manifest[p.stem] = entry
            manifest["total_spend_usd"] = round(budget.spend, 4)
            save_manifest(manifest)
            print(f"[postmortem] {p.stem}: +{entry['pairs_emitted']} pairs "
                  f"(assert {entry['assert_first_try_ok']}+{entry['assert_retry_saved']}/"
                  f"{entry['assert_attempts']}, status={entry['status']}, "
                  f"spend=${budget.spend:.3f})", flush=True)

    if args.group in ("oig", "both") and not budget.stopped:
        oig_docs = select_oig_docs()
        if args.only:
            oig_docs = [(d, r) for d, r in oig_docs if d in args.only]
        meta_by_docid = load_oig_meta()
        for doc_id, reason in oig_docs:
            if budget.stopped:
                print(f"BUDGET STOP before {doc_id} (spend=${budget.spend:.3f})", flush=True)
                break
            if done(doc_id):
                continue
            meta = meta_by_docid.get(doc_id, {})
            result = process_oig_doc(doc_id, reason, meta, key, budget)
            entry, pairs = result["entry"], result["pairs"]
            total_new_pairs += write_pairs(pairs)
            docs_manifest[doc_id] = entry
            manifest["total_spend_usd"] = round(budget.spend, 4)
            save_manifest(manifest)
            print(f"[oig] {doc_id}: doc_pair={entry['doc_pair_emitted']} "
                  f"claims={entry['claim_pairs_emitted']} "
                  f"(assert {entry['assert_first_try_ok']}+{entry['assert_retry_saved']}/"
                  f"{entry['assert_attempts']}, status={entry['status']}, "
                  f"spend=${budget.spend:.3f})", flush=True)

    out_fh.close()
    print(f"\nTOTAL new pairs this run: {total_new_pairs}; cumulative spend: ${budget.spend:.4f}")


if __name__ == "__main__":
    main()
