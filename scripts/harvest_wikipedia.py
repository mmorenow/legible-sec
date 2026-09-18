#!/usr/bin/env python3
"""LEGIBLE D43: Wikipedia vulnerability-article harvest (LLM-as-SELECTOR).

Mines lay-register translation pairs from Wikipedia VULNERABILITY articles
(Log4Shell, Heartbleed, Spectre, ...). Owner's translation-vs-impact rule
(research/09-enrichment.md §6): a vulnerability article's LEAD genuinely
RE-EXPLAINS the mechanism in plain language (verified 3/3 on a hand sample);
a BREACH/incident article only narrates impact (0/1) -- so this harvest
targets vulnerability/exploit articles only and explicitly excludes anything
that reads as an incident/company/breach writeup.

THE SACRED RULE: the dataset contains ONLY natural text. The LLM never
writes or rewrites anything -- it only POINTS at exact quotes (LLM-as-
SELECTOR). Every quote the model returns is verbatim-asserted against the
source text (`find_verbatim_span`, whitespace-normalized match with the
ORIGINAL span recovered and stored -- never the model's copy of the string).
On a mismatch we retry the whole call once with a "copy EXACTLY" reminder;
whatever still fails to verify after that is discarded, never salvaged by
edits.

Pipeline (3 stages, each independently resumable):
  --discover      Wikipedia category walk (+ named-vuln seed pages) -> keep/
                   exclude via title heuristics + structural KEEP filter
                   (technical-section heading present AND lead >=2 paragraphs).
                   $0, writes data/corpus/wikipedia_discovery.json +
                   data/corpus/html/wikipedia/<slug>.txt + downloads_wikipedia.json.
  --sample-gate   Runs the full extract flow on 5 kept articles (forcing
                   Log4Shell + Heartbleed in). Reports the verbatim-assert
                   pass rate; per the D43 revisit trigger, a failure rate
                   >20% means STOP (selector prompt is broken).
  --extract       Full run over all kept articles not yet in the output file.
                   One Gemini call per article (+ <=1 retry call on a
                   verification miss). Hard budget cap enforced in code
                   (default $2, see BUDGET_USD) -- tracks cumulative spend
                   in data/corpus/wikipedia_spend.json across runs and stops
                   before any call would exceed it.

Usage:
    .venv/bin/python scripts/harvest_wikipedia.py --discover
    .venv/bin/python scripts/harvest_wikipedia.py --sample-gate
    .venv/bin/python scripts/harvest_wikipedia.py --extract
    .venv/bin/python scripts/harvest_wikipedia.py --discover --extract   # both

Output: data/pairs/candidates_wiki.jsonl (CandidatePair + license field,
matching scripts/extract_govaudit_pairs.py's to_jsonl_with_license pattern).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))
from legible.schema import CandidatePair  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
HTML_DIR = ROOT / "data/corpus/html/wikipedia"
MANIFEST = ROOT / "data/corpus/downloads_wikipedia.json"
DISCOVERY = ROOT / "data/corpus/wikipedia_discovery.json"
SPEND_LOG = ROOT / "data/corpus/wikipedia_spend.json"
OUT = ROOT / "data/pairs/candidates_wiki.jsonl"

# --- Wikipedia API ------------------------------------------------------------------

UA = "legible-research/0.1 (dataset research)"
API = "https://en.wikipedia.org/w/api.php"
RATE_DELAY = 1.0  # <=2 req/s per the task brief; the sandbox's egress IP is
                   # apparently shared/throttled harder than that alone would
                   # suggest (observed intermittent 429 x-envoy-ratelimited
                   # even at 1 req/1.8s), so api_get() below also honors
                   # Retry-After on 429 with generous backoff.

CATEGORIES = [
    "Injection exploits",
    "Web security exploits",
    "Computer security exploits",
    "Denial-of-service attacks",
    "Cryptographic attacks",
    "Speculative execution security vulnerabilities",
    "Hardware bugs",
]

# Resolved by hand (2026-07-09) against the live API -- see agent notes.
# ProxyLogon deliberately DROPPED: it now redirects to "2021 Microsoft
# Exchange Server data breach" (an incident article, out of scope per the
# translation-vs-impact rule) rather than to a standalone vuln article.
NAMED_PAGES = [
    "Log4Shell", "Heartbleed", "Shellshock", "Spectre", "Meltdown",
    "EternalBlue", "Dirty COW", "KRACK", "BlueKeep", "Zerologon",
    "PrintNightmare", "Stagefright (bug)",
]

# Subcategories not worth recursing into (maintenance/off-topic buckets).
SKIP_SUBCAT_RX = re.compile(
    r"redirect|stub|by country|by year|people|births|deaths|companies|organi[sz]ation",
    re.I,
)

# Owner's rule: incident/breach/company articles narrate impact, they don't
# translate mechanism -- exclude by title pattern (checked pre-fetch AND
# again post-redirect-resolution, since some named pages redirect INTO an
# incident article, e.g. ProxyLogon above).
EXCLUDE_TITLE_RX = re.compile(
    r"\bdata breach(es)?\b|\bbreach\b|\bhack(ing)?\s+of\b|\bhacked\b|"
    r"\bcyber ?attack(s)?\b|\battacks? on\b|\bhacking (incident|group)\b|"
    r"\b(19|20)\d{2}\b.{0,40}\b(breach|hack|attack|leak|incident|outage)\b|"
    r"^Operation\s|"  # "Operation Payback"-style campaign/incident articles
    r"\(disambiguation\)|^list of |^category:",
    re.I,
)

# Scope guard (owner's rule, research/09 §6: vulnerability/exploit/technical-
# malware articles only): the FIRST SENTENCE of the lead must assert the
# subject IS a security-mechanism thing. Drops concept/product/company pages
# that survive the title filter and structural KEEP filter ("Computer
# security", "Tor (network)", "Micro Bill Systems", ...). Deliberately broad
# on the noun list -- the LLM selector + downstream 3-pass verifier are the
# fine filter; this only removes the clearly-off-scope.
TOPIC_FIRST_SENT_RX = re.compile(
    r"\b(vulnerabilit(y|ies)|exploits?|attacks?|bugs?|flaws?|weakness|malware|"
    r"worms?|ransomware|trojan|backdoor|rootkit|botnet|spyware|virus|overflow|"
    r"denial.of.service|side.channel|injection|phishing|"
    r"malicious (software|code|program)|unwanted software|exploitation)\b",
    re.I,
)


def first_sentence(lead: str) -> str:
    first_para = lead.split("\n")[0]
    m = re.match(r"(.{40,400}?[.!?])\s", first_para + " ")
    return m.group(1) if m else first_para[:400]

# NB: "Vulnerabilit(y|ies)" -- an earlier draft wrote "Vulnerabilit\b" which
# can never match (no word boundary between "t" and "y"); fixed + excluded
# articles rechecked via --recheck.
TECH_HEADING_RX = re.compile(
    r"\b(Behaviors?|Behaviour|Exploitation|Mechanisms?|Technical details?|"
    r"Vulnerabilit(y|ies)|How it works|Operation|Details)\b",
    re.I,
)

HEADING_RX = re.compile(r"^(=+)\s*(.*?)\s*\1\s*$", re.M)


def api_get(params: dict, max_attempts: int = 7) -> dict:
    """GET action=query with exponential backoff; sleeps RATE_DELAY after
    every attempt (success or fail) to stay under the 2 req/s cap. On a 429
    (observed intermittently -- x-envoy-ratelimited on this sandbox's shared
    egress IP, not our own request rate) honors the Retry-After header
    instead of the normal backoff schedule."""
    q = dict(params)
    q["format"] = "json"
    url = f"{API}?{urllib.parse.urlencode(q)}"
    delay = 2.0
    last_err = None
    for attempt in range(max_attempts):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.load(r)
            time.sleep(RATE_DELAY)
            return data
        except urllib.error.HTTPError as ex:
            last_err = f"HTTP {ex.code}"
            if ex.code == 429:
                wait = int(ex.headers.get("Retry-After", 12)) + 1
                time.sleep(wait)
            else:
                time.sleep(delay)
                delay *= 1.7
        except urllib.error.URLError as ex:
            last_err = str(ex)
            time.sleep(delay)
            delay *= 1.7
    time.sleep(RATE_DELAY)
    raise RuntimeError(f"Wikipedia API failed after {max_attempts} attempts: {last_err}")


def get_category_members(cattitle: str, cmtype: str) -> list[str]:
    titles: list[str] = []
    cont = None
    while True:
        params = {
            "action": "query", "list": "categorymembers",
            "cmtitle": f"Category:{cattitle}", "cmlimit": "500", "cmtype": cmtype,
        }
        if cont:
            params["cmcontinue"] = cont
        data = api_get(params)
        for m in data.get("query", {}).get("categorymembers", []):
            titles.append(m["title"])
        cont = data.get("continue", {}).get("cmcontinue")
        if not cont:
            break
    return titles


def walk_categories() -> dict[str, list[str]]:
    """title -> list of source categories (for provenance in the manifest)."""
    raw: dict[str, list[str]] = {}

    def add(title: str, source: str) -> None:
        raw.setdefault(title, [])
        if source not in raw[title]:
            raw[title].append(source)

    for cat in CATEGORIES:
        try:
            pages = get_category_members(cat, "page")
        except RuntimeError as e:
            print(f"  WARN: category walk failed for {cat}: {e}")
            continue
        for t in pages:
            add(t, f"Category:{cat}")
        try:
            subcats = get_category_members(cat, "subcat")
        except RuntimeError as e:
            print(f"  WARN: subcat walk failed for {cat}: {e}")
            continue
        for sc in subcats:
            sc_name = sc.split(":", 1)[1] if ":" in sc else sc
            if SKIP_SUBCAT_RX.search(sc_name) or sc_name in CATEGORIES:
                continue
            try:
                sub_pages = get_category_members(sc_name, "page")
            except RuntimeError as e:
                print(f"  WARN: subcat page walk failed for {sc_name}: {e}")
                continue
            for t in sub_pages:
                add(t, f"Category:{cat} > Category:{sc_name}")
    for t in NAMED_PAGES:
        add(t, "named-seed")
    return raw


# --- article fetch + section parsing -------------------------------------------------

def fetch_article(title: str) -> dict | None:
    data = api_get({
        "action": "query", "titles": title, "prop": "extracts|revisions",
        "explaintext": "1", "exsectionformat": "wiki", "rvprop": "ids",
        "redirects": "1",
    })
    pages = data.get("query", {}).get("pages", {})
    if not pages:
        return None
    page = list(pages.values())[0]
    if "missing" in page or "extract" not in page:
        return None
    canonical = page["title"]
    revid = (page.get("revisions") or [{}])[0].get("revid")
    text = page["extract"]
    if not text or len(text) < 300:
        return None
    return {"canonical": canonical, "revid": revid, "text": text, "pageid": page.get("pageid")}


def parse_sections(text: str) -> tuple[str, list[re.Match]]:
    matches = list(HEADING_RX.finditer(text))
    lead = text[: matches[0].start()] if matches else text
    return lead, matches


def section_full_end(matches: list[re.Match], i: int, text_len: int) -> int:
    level = len(matches[i].group(1))
    for j in range(i + 1, len(matches)):
        if len(matches[j].group(1)) <= level:
            return matches[j].start()
    return text_len


def count_paragraphs(lead: str) -> int:
    return sum(1 for line in lead.split("\n") if len(line.strip()) > 20)


def keep_verdict(lead: str, matches: list[re.Match]) -> str | None:
    """None = keep; else the exclusion reason string."""
    reasons = []
    if not any(TECH_HEADING_RX.search(m.group(2)) for m in matches):
        reasons.append("no technical-section heading")
    if count_paragraphs(lead) < 2:
        reasons.append("lead <2 paragraphs")
    if not TOPIC_FIRST_SENT_RX.search(first_sentence(lead)):
        reasons.append("scope guard: first sentence not a vulnerability/exploit/malware is-a")
    return "; ".join(reasons) if reasons else None


def slugify(title: str) -> str:
    return re.sub(r"[^a-z0-9_.-]", "-", title.lower()).strip("-")[:120]


# --- Stage 1: discover -----------------------------------------------------------------

def stage_discover(limit: int | None) -> None:
    print("Walking Wikipedia categories...")
    raw = walk_categories()
    titles = sorted(raw)
    if limit:
        titles = titles[:limit]
    print(f"raw candidate titles: {len(titles)}")

    excluded_title: dict[str, str] = {}
    survivors = []
    for t in titles:
        if EXCLUDE_TITLE_RX.search(t):
            excluded_title[t] = "title-pattern (breach/incident/list/disambiguation)"
        else:
            survivors.append(t)
    print(f"excluded by title pattern: {len(excluded_title)}; fetching {len(survivors)}...")

    kept: list[dict] = []
    excluded_keep: dict[str, str] = {}
    fetch_fail: dict[str, str] = {}
    seen_canonical: set[str] = set()
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []

    for i, t in enumerate(survivors):
        try:
            art = fetch_article(t)
        except RuntimeError as e:
            fetch_fail[t] = str(e)[:200]
            continue
        if art is None:
            fetch_fail[t] = "missing or too short"
            continue
        canonical = art["canonical"]
        if EXCLUDE_TITLE_RX.search(canonical):
            excluded_title[t] = f"title-pattern after redirect resolution -> {canonical}"
            continue
        if canonical in seen_canonical:
            continue  # dedup: multiple raw titles resolving to the same article
        seen_canonical.add(canonical)
        lead, matches = parse_sections(art["text"])
        verdict = keep_verdict(lead, matches)
        if verdict is not None:
            excluded_keep[canonical] = verdict
            continue
        slug = slugify(canonical)
        html_path = HTML_DIR / f"{slug}.txt"
        html_path.write_text(art["text"], encoding="utf-8")
        sha256 = hashlib.sha256(art["text"].encode("utf-8")).hexdigest()
        url = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(canonical.replace(" ", "_"))
        rec = {
            "title": canonical, "slug": slug, "revid": art["revid"], "url": url,
            "sha256": sha256, "bytes": len(art["text"].encode("utf-8")),
            "categories": raw.get(t, raw.get(canonical, [])), "kept": True,
        }
        manifest.append(rec)
        kept.append(rec)
        if (i + 1) % 25 == 0:
            print(f"  ...{i + 1}/{len(survivors)} processed, {len(kept)} kept so far")

    for t, reason in {**excluded_title, **excluded_keep}.items():
        manifest.append({"title": t, "kept": False, "reason": reason})
    for t, reason in fetch_fail.items():
        manifest.append({"title": t, "kept": False, "reason": f"fetch failed: {reason}"})

    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    DISCOVERY.write_text(json.dumps({
        "raw_count": len(titles),
        "excluded_title_count": len(excluded_title),
        "excluded_keep_filter_count": len(excluded_keep),
        "fetch_fail_count": len(fetch_fail),
        "kept_count": len(kept),
        "kept_titles": [k["title"] for k in kept],
    }, indent=2, ensure_ascii=False))

    print(f"\nDISCOVER done: raw={len(titles)} excluded_title={len(excluded_title)} "
          f"excluded_keep_filter={len(excluded_keep)} fetch_fail={len(fetch_fail)} "
          f"KEPT={len(kept)}")
    print(f"-> {DISCOVERY}\n-> {MANIFEST}\n-> {HTML_DIR}/*.txt")


def stage_recheck() -> None:
    """Re-apply the (fixed) keep filter without redoing the category walk:
      - currently-kept entries: re-evaluate from the saved .txt (no refetch)
        so the scope guard / regex fixes can DEMOTE them;
      - entries previously excluded with 'no technical-section heading':
        refetch and re-evaluate (the TECH_HEADING_RX 'Vulnerabilit\\b' bug
        wrongly excluded articles whose tech section is headed
        'Vulnerability');
      - title-pattern / lead-too-short / fetch-fail exclusions stand.
    Rewrites the manifest + discovery summary in place."""
    manifest = json.loads(MANIFEST.read_text())
    new_manifest: list[dict] = []
    kept: list[dict] = []
    n_demoted = n_promoted = n_refetched = 0

    for rec in manifest:
        if rec.get("kept"):
            text = (HTML_DIR / f"{rec['slug']}.txt").read_text(encoding="utf-8")
            lead, matches = parse_sections(text)
            verdict = keep_verdict(lead, matches)
            if verdict is None:
                new_manifest.append(rec)
                kept.append(rec)
            else:
                n_demoted += 1
                print(f"  DEMOTE {rec['title']}: {verdict}")
                new_manifest.append({"title": rec["title"], "kept": False,
                                      "reason": f"recheck: {verdict}"})
            continue
        reason = rec.get("reason", "")
        if ("no technical-section heading" not in reason) or reason.startswith("title-pattern"):
            new_manifest.append(rec)
            continue
        # candidate for promotion under the fixed TECH_HEADING_RX -- refetch
        if EXCLUDE_TITLE_RX.search(rec["title"]):
            new_manifest.append(rec)
            continue
        n_refetched += 1
        try:
            art = fetch_article(rec["title"])
        except RuntimeError as e:
            new_manifest.append({"title": rec["title"], "kept": False,
                                  "reason": f"recheck fetch failed: {str(e)[:200]}"})
            continue
        if art is None:
            new_manifest.append(rec)
            continue
        lead, matches = parse_sections(art["text"])
        verdict = keep_verdict(lead, matches)
        if verdict is not None:
            new_manifest.append({"title": rec["title"], "kept": False,
                                  "reason": verdict})
            continue
        canonical = art["canonical"]
        slug = slugify(canonical)
        (HTML_DIR / f"{slug}.txt").write_text(art["text"], encoding="utf-8")
        url = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(canonical.replace(" ", "_"))
        new_rec = {
            "title": canonical, "slug": slug, "revid": art["revid"], "url": url,
            "sha256": hashlib.sha256(art["text"].encode("utf-8")).hexdigest(),
            "bytes": len(art["text"].encode("utf-8")),
            "categories": ["recheck-promotion"], "kept": True,
        }
        new_manifest.append(new_rec)
        kept.append(new_rec)
        n_promoted += 1
        print(f"  PROMOTE {canonical}")

    MANIFEST.write_text(json.dumps(new_manifest, indent=2, ensure_ascii=False))
    summary = json.loads(DISCOVERY.read_text())
    summary["kept_count"] = len(kept)
    summary["kept_titles"] = [k["title"] for k in kept]
    summary["recheck"] = {"demoted": n_demoted, "promoted": n_promoted,
                           "refetched": n_refetched}
    DISCOVERY.write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"\nRECHECK done: refetched={n_refetched} promoted={n_promoted} "
          f"demoted={n_demoted} KEPT={len(kept)}")


# --- Stage 2/3: extraction (LLM-as-SELECTOR) --------------------------------------------

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai"
GEMINI_MODEL = "gemini-3-flash-preview"
PRICE_IN, PRICE_OUT = 0.50, 3.00  # $/MTok, per scripts/verify_pairs.py PRICES table

PROMPT = """You are extracting exact, verbatim quotes from the LEAD (introductory) section \
of a Wikipedia article about a security vulnerability, titled "{title}".

Find two kinds of sentence:
1. "mechanism_quotes": sentence(s) that RE-EXPLAIN, in plain language, HOW the \
vulnerability technically works (its mechanism/cause) -- not merely that it exists or \
how severe it is.
2. "impact_quotes": sentence(s) stating its SCALE or CONSEQUENCES (how many systems/\
devices/people affected, what damage resulted).

Rules:
- Every quote MUST be copied CHARACTER-FOR-CHARACTER from the LEAD TEXT below. Do not \
paraphrase, summarize, fix typos, or change punctuation/capitalization in any way.
- Each quote should be one complete sentence (or a short run of adjacent complete \
sentences) exactly as it appears in the text.
- If none found for a category, return an empty list for it.

LEAD TEXT:
{lead}

Reply with JSON only: {{"mechanism_quotes": ["..."], "impact_quotes": ["..."]}}"""

RETRY_PREFIX = (
    "Your previous answer contained quotes that did NOT match the source text exactly. "
    "This time, copy EXACTLY -- character for character, including all punctuation and "
    "capitalization -- from the LEAD TEXT below. Do not paraphrase.\n\n"
)


def load_gemini_key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "")
    env = ROOT / ".env"
    if not key and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("GEMINI_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        sys.exit("No GEMINI_API_KEY found (env var or .env). Aborting before any call.")
    return key


def call_gemini(prompt: str, key: str) -> tuple[dict, int, int]:
    body = json.dumps({
        "model": GEMINI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
    }).encode()
    req = urllib.request.Request(
        f"{GEMINI_BASE}/chat/completions", data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                out = json.load(r)
            usage = out.get("usage", {})
            text = out["choices"][0]["message"]["content"]
            m = re.search(r"\{.*\}", text, re.S)
            parsed = json.loads(m.group(0)) if m else {}
            return parsed, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)
        except Exception as e:
            if attempt == 3:
                return {"_error": str(e)[:200]}, 0, 0
            time.sleep(2 ** (attempt + 1))
    return {"_error": "unreachable"}, 0, 0


# --- verbatim assertion: whitespace-normalized match, ORIGINAL span recovered -----------

def build_normalized_map(source: str) -> tuple[str, list[int]]:
    """normalized string (runs of whitespace -> single space, stripped) plus a
    parallel index_map where index_map[i] is the offset in `source` of
    normalized[i]. Used to recover the exact original substring after
    matching against whitespace-normalized text -- the stored text is always
    a real slice of `source`, never the model's copy."""
    norm_chars: list[str] = []
    index_map: list[int] = []
    i, n = 0, len(source)
    prev_space = True
    while i < n:
        c = source[i]
        if c.isspace():
            j = i
            while j < n and source[j].isspace():
                j += 1
            if not prev_space and j < n:
                norm_chars.append(" ")
                index_map.append(i)
                prev_space = True
            i = j
        else:
            norm_chars.append(c)
            index_map.append(i)
            prev_space = False
            i += 1
    if norm_chars and norm_chars[-1] == " ":
        norm_chars.pop()
        index_map.pop()
    return "".join(norm_chars), index_map


def normalize_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def find_verbatim_span(quote: str, source: str, norm_source: str, index_map: list[int]) -> str | None:
    norm_quote = normalize_ws(quote)
    if not norm_quote:
        return None
    pos = norm_source.find(norm_quote)
    if pos == -1:
        return None
    start = index_map[pos]
    end = index_map[pos + len(norm_quote) - 1] + 1
    return source[start:end]


def merge_spans(source: str, spans: list[tuple[int, int]]) -> str:
    """Sort by position; merge spans separated only by whitespace into one
    contiguous original slice, else join pieces with a single space. Every
    character in the result is copied straight out of `source`."""
    spans = sorted(set(spans))
    pieces: list[str] = []
    cur_start, cur_end = spans[0]
    for s, e in spans[1:]:
        gap = source[cur_end:s]  # empty when spans overlap (s < cur_end)
        if gap.strip() == "":
            cur_end = max(cur_end, e)  # adjacent/overlapping -- extend, never shrink
        else:
            pieces.append(source[cur_start:cur_end])
            cur_start, cur_end = s, e
    pieces.append(source[cur_start:cur_end])
    return " ".join(pieces)


def tokenize(text: str) -> set[str]:
    return set(w for w in re.findall(r"[a-zA-Z]{4,}", text.lower()))


def pick_technical_section(text: str, matches: list[re.Match], exec_text: str) -> tuple[str, str] | None:
    """Returns (heading, technical_text) for the tech-heading section whose
    vocabulary best overlaps exec_text, including its nested subsections."""
    tech_idxs = [i for i, m in enumerate(matches) if TECH_HEADING_RX.search(m.group(2))]
    if not tech_idxs:
        return None
    exec_tokens = tokenize(exec_text)
    best_i, best_score = tech_idxs[0], -1.0
    for i in tech_idxs:
        end = section_full_end(matches, i, len(text))
        body = text[matches[i].end():end]
        score = len(exec_tokens & tokenize(body))
        if score > best_score:
            best_i, best_score = i, score
    end = section_full_end(matches, best_i, len(text))
    full = text[matches[best_i].start():end].strip()
    if len(full) > 4000:
        cut = full.rfind(". ", 0, 4000)
        full = full[: cut + 1] if cut > 2000 else full[:4000]
    return matches[best_i].group(2).strip(), full


def load_spend() -> float:
    if SPEND_LOG.exists():
        return json.loads(SPEND_LOG.read_text()).get("cumulative_usd", 0.0)
    return 0.0


def save_spend(v: float, calls: int) -> None:
    SPEND_LOG.write_text(json.dumps({"cumulative_usd": round(v, 4), "calls": calls}, indent=2))


def extract_one(title: str, slug: str, revid: int, url: str, key: str,
                 budget_left: float) -> tuple[dict | None, int, int, str, dict]:
    """Returns (pair_dict_or_None, in_tokens, out_tokens, status, qstats).
    status: ok / no_mechanism_verified / no_tech_section / api_error.
    qstats: FIRST-PASS quote-level verbatim-assert bookkeeping
    ({"returned": n, "verified": n}, mechanism+impact together) -- this is
    the number the D43 sample-gate trigger is defined on."""
    html_path = HTML_DIR / f"{slug}.txt"
    text = html_path.read_text(encoding="utf-8")
    lead, matches = parse_sections(text)
    lead_capped = lead[:6000]
    norm_lead, lead_map = build_normalized_map(lead)

    prompt = PROMPT.format(title=title, lead=lead_capped)
    parsed, in_t, out_t = call_gemini(prompt, key)
    total_in, total_out = in_t, out_t

    def verify(parsed_json: dict) -> tuple[list[tuple[int, int]], int]:
        mech_spans = []
        n_impact_verified = 0
        for q in parsed_json.get("mechanism_quotes", []) or []:
            span = find_verbatim_span(q, lead, norm_lead, lead_map)
            if span:
                idx = lead.find(span)
                mech_spans.append((idx, idx + len(span)))
        for q in parsed_json.get("impact_quotes", []) or []:
            if find_verbatim_span(q, lead, norm_lead, lead_map):
                n_impact_verified += 1
        return mech_spans, n_impact_verified

    n_mech_returned = len(parsed.get("mechanism_quotes", []) or [])
    n_impact_returned = len(parsed.get("impact_quotes", []) or [])
    mech_spans, n_impact_verified = verify(parsed)
    qstats = {"returned": n_mech_returned + n_impact_returned,
              "verified": len(mech_spans) + n_impact_verified}

    retried = False
    if n_mech_returned and not mech_spans and (budget_left - (total_in * PRICE_IN + total_out * PRICE_OUT) / 1e6) > 0:
        retried = True
        retry_prompt = RETRY_PREFIX + PROMPT.format(title=title, lead=lead_capped)
        parsed2, in_t2, out_t2 = call_gemini(retry_prompt, key)
        total_in += in_t2
        total_out += out_t2
        n_mech_returned2 = len(parsed2.get("mechanism_quotes", []) or [])
        mech_spans2, n_impact_verified2 = verify(parsed2)
        if mech_spans2:
            mech_spans, n_impact_verified, n_mech_returned = mech_spans2, n_impact_verified2, n_mech_returned2

    if "_error" in parsed:
        return None, total_in, total_out, "api_error", qstats
    if not mech_spans:
        return None, total_in, total_out, "no_mechanism_verified", qstats

    exec_text = merge_spans(lead, mech_spans)
    picked = pick_technical_section(text, matches, exec_text)
    if picked is None:
        return None, total_in, total_out, "no_tech_section", qstats
    heading, tech_text = picked

    pair = CandidatePair(
        pair_id=f"wikipedia__{slug}#mech",
        source_doc_id=f"wikipedia/{slug}",
        source_org="wikipedia",
        doc_type="wikipedia_article",
        technical_text=tech_text,
        technical_context=heading,
        executive_text=exec_text,
        audience_observed="lay",
        alignment_method="llm_selected",
        alignment_type="1:1",
        exec_span_kind="prose",
        needs_llm_verify=True,
        notes=(f"rev {revid}; {url}; impact_quotes_verified={n_impact_verified}; "
               f"mechanism_quotes={len(mech_spans)}/{n_mech_returned} verified"
               f"{' (after 1 retry)' if retried else ''}"),
    )
    d = asdict(pair)
    d["license"] = "cc-by-sa-4.0"
    return d, total_in, total_out, "ok", qstats


def stage_sample_gate(key: str, budget_usd: float) -> bool:
    if not DISCOVERY.exists():
        sys.exit("Run --discover first.")
    kept = json.loads(DISCOVERY.read_text())["kept_titles"]
    manifest = {r["title"]: r for r in json.loads(MANIFEST.read_text()) if r.get("kept")}
    forced = [t for t in ("Log4Shell", "Heartbleed") if t in kept]
    rest = [t for t in kept if t not in forced]
    import random
    random.seed(43)
    sample = forced + random.sample(rest, min(5 - len(forced), len(rest)))
    print(f"SAMPLE GATE on: {sample}")

    spend = load_spend()
    calls = 0
    n_articles = n_ok = q_returned = q_verified = 0
    for title in sample:
        rec = manifest.get(title)
        if rec is None:
            print(f"  SKIP {title}: not found in manifest")
            continue
        if spend >= budget_usd:
            print(f"BUDGET STOP at ${spend:.3f}")
            break
        pair, in_t, out_t, status, qstats = extract_one(
            title, rec["slug"], rec["revid"], rec["url"], key, budget_usd - spend)
        calls += 1
        spend += in_t * PRICE_IN / 1e6 + out_t * PRICE_OUT / 1e6
        save_spend(spend, calls)
        n_articles += 1
        q_returned += qstats["returned"]
        q_verified += qstats["verified"]
        if status == "ok":
            n_ok += 1
            print(f"  OK  {title}: exec_text={pair['executive_text'][:140]!r}")
        else:
            print(f"  MISS {title}: {status}")

    # The D43 revisit trigger is defined on the verbatim-assert failure rate
    # of the quotes the selector returns (first pass, before the retry).
    fail_rate = 1 - (q_verified / q_returned) if q_returned else 1.0
    print(f"\nSAMPLE GATE: {n_ok}/{n_articles} articles ok; quote-level verbatim "
          f"assert {q_verified}/{q_returned} verified (failure rate {fail_rate:.0%}); "
          f"spend=${spend:.4f}")
    if fail_rate > 0.20:
        print("STOP: failure rate exceeds 20% -- D43 revisit trigger. Do not proceed to --extract.")
        return False
    print("PASS: proceeding is safe.")
    return True


def stage_extract(budget_usd: float) -> None:
    if not DISCOVERY.exists():
        sys.exit("Run --discover first.")
    kept_titles = json.loads(DISCOVERY.read_text())["kept_titles"]
    manifest = {r["title"]: r for r in json.loads(MANIFEST.read_text()) if r.get("kept")}
    key = load_gemini_key()

    done = set()
    if OUT.exists():
        done = {json.loads(l)["source_doc_id"] for l in open(OUT)}

    spend = load_spend()
    calls = 0
    n_ok = n_miss = 0
    status_counts: dict[str, int] = {}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("a") as fh:
        for title in kept_titles:
            rec = manifest.get(title)
            if rec is None:
                continue
            slug = rec["slug"]
            if f"wikipedia/{slug}" in done:
                continue
            if spend >= budget_usd:
                print(f"BUDGET STOP at ${spend:.3f} (cap ${budget_usd})")
                break
            pair, in_t, out_t, status, qstats = extract_one(
                title, slug, rec["revid"], rec["url"], key, budget_usd - spend)
            calls += 1
            cost = in_t * PRICE_IN / 1e6 + out_t * PRICE_OUT / 1e6
            spend += cost
            status_counts[status] = status_counts.get(status, 0) + 1
            status_counts["q_returned"] = status_counts.get("q_returned", 0) + qstats["returned"]
            status_counts["q_verified"] = status_counts.get("q_verified", 0) + qstats["verified"]
            if pair:
                fh.write(json.dumps(pair, ensure_ascii=False) + "\n")
                fh.flush()
                n_ok += 1
            else:
                n_miss += 1
            save_spend(spend, calls)
            if calls % 20 == 0:
                print(f"  ...{calls} articles processed, {n_ok} pairs, spend=${spend:.3f}")

    print(f"\nEXTRACT done: {n_ok} pairs built, {n_miss} misses ({status_counts}), "
          f"spend=${spend:.3f} over {calls} calls -> {OUT}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--discover", action="store_true")
    ap.add_argument("--recheck", action="store_true",
                    help="re-apply the keep filter to an existing manifest (no category walk)")
    ap.add_argument("--sample-gate", action="store_true")
    ap.add_argument("--extract", action="store_true")
    ap.add_argument("--limit", type=int, default=None, help="cap raw candidate titles (discover, testing only)")
    ap.add_argument("--budget-usd", type=float, default=2.0)
    args = ap.parse_args()

    if not (args.discover or args.recheck or args.sample_gate or args.extract):
        ap.error("pass at least one of --discover / --recheck / --sample-gate / --extract")

    if args.discover:
        stage_discover(args.limit)
    if args.recheck:
        stage_recheck()
    if args.sample_gate:
        key = load_gemini_key()
        ok = stage_sample_gate(key, args.budget_usd)
        if not ok:
            sys.exit(1)
    if args.extract:
        stage_extract(args.budget_usd)


if __name__ == "__main__":
    main()
