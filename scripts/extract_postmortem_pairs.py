#!/usr/bin/env python3
"""LEGIBLE D42: parse postmortem HTML -> md/headers, extract pair candidates.

Two responsibilities (kept in one script; HTML->md is a simple bs4 job, not a
Docling PDF parse like the rest of the corpus):

1. parse(): data/corpus/html/postmortem/<key>.html
             -> data/corpus/out/md/postmortem__<key>.md      (verbatim article text,
                                                                headings kept as `## `)
             -> data/corpus/out/headers/postmortem__<key>.headers.txt (heading list)
   Strips nav/footer/script/style/share/subscribe/related-posts boilerplate.

2. extract(): reads the parsed .md files + postmortem_targets.json, buckets each
   doc's sections into plain (customer register) vs technical (register cues),
   and emits two kinds of CandidatePair into data/pairs/candidates_postmortem.jsonl:
     - doc-level: concatenated plain section(s) <-> concatenated technical
       section(s). alignment_method=same_section_1to1, needs_llm_verify=False
       (structural, mirrors CISA doc-level treatment).
     - claim-level: a single plain assurance/impact sentence <-> its best-matching
       technical paragraph (local Qwen3-Embedding cosine similarity, no paid API).
       alignment_method=thematic, needs_llm_verify=True.

Usage:
    .venv/bin/python scripts/extract_postmortem_pairs.py --parse
    .venv/bin/python scripts/extract_postmortem_pairs.py --extract
    .venv/bin/python scripts/extract_postmortem_pairs.py --parse --extract --only cloudflare circleci
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

from bs4 import BeautifulSoup, Comment

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))
from legible.schema import CandidatePair  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGETS = ROOT / "data/corpus/postmortem_targets.json"
HTML_DIR = ROOT / "data/corpus/html/postmortem"
MD_DIR = ROOT / "data/corpus/out/md"
HEADERS_DIR = ROOT / "data/corpus/out/headers"
OUT = ROOT / "data/pairs/candidates_postmortem.jsonl"

HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5"]
BLOCK_TAGS = HEADING_TAGS + ["p", "li", "blockquote", "pre", "td"]

STRIP_TAGS = ["script", "style", "nav", "footer", "aside", "iframe", "noscript", "svg", "button"]
# NOTE: deliberately NOT stripping <form> wholesale -- old.reddit.com wraps
# its actual post/comment body text in `<form class="usertext">` (an
# edit-in-place affordance), so a blanket <form> strip deletes the article
# itself on that site. Genuine boilerplate forms (search bars, newsletter
# signups) are caught by STRIP_CLASS_TOKEN_RX below instead.
# Matched against INDIVIDUAL class tokens (not the joined class string) with
# fullmatch, so a WordPress/plugin body class like "mega-menu-menu-1" (a
# single hyphenated token) does NOT trigger on the substring "menu" the way a
# naive `re.search` over the joined class string would.
STRIP_CLASS_TOKEN_RX = re.compile(
    r"^(nav(bar)?|menu|dropdown-?menu|mobile-?menu|hamburger.*|sidebar|comments?|"
    r"comment-list|share.*|social.*|subscribe.*|newsletter.*|cookie.*|breadcrumbs?|"
    r"related-?posts?|recirc.*|read-more|read-next|tag-list|author-bio|"
    r"site-header|site-footer|masthead|cta[-_].*)$",
    re.I,
)
BOILERPLATE_TAIL_RX = re.compile(
    r"(similar posts you may enjoy|related posts|related articles|you (might|may) (also )?"
    r"(like|enjoy)|share this (post|article)|leave a (reply|comment)|"
    r"subscribe to (our|the) (blog|newsletter)|sign up for updates|continue reading|"
    r"more from|recommended for you)",
    re.I,
)


# --- Stage 1: HTML -> md + headers ---------------------------------------------------

def pick_container(soup: BeautifulSoup):
    """Pick the element most likely to hold the article body: the longest of
    <article>/<main>, falling back to the longest <div>/<section> if those are
    absent or suspiciously short (some sites litter the DOM with tiny
    <article> cards for 'related posts' teasers, or use neither tag at all --
    e.g. old.reddit.com's self-post body lives in a plain <div class="md">)."""
    # old.reddit.com self-posts: the OP body is reliably the largest
    # `.usertext-body` block (comments run second, the empty reply box is
    # first and empty) -- everything else on the page (subreddit nav,
    # sidebar) is not wrapped in <article>/<main> at all.
    usertext = soup.find_all(attrs={"class": lambda c: c and "usertext-body" in c})
    if usertext:
        biggest = max(usertext, key=lambda t: len(t.get_text(strip=True)))
        if len(biggest.get_text(strip=True)) > 400:
            return biggest
    candidates = soup.find_all("article") + soup.find_all("main")
    best = max(candidates, key=lambda t: len(t.get_text(strip=True))) if candidates else None
    if best is None or len(best.get_text(strip=True)) < 800:
        divs = soup.find_all(["div", "section"])
        if divs:
            best_div = max(divs, key=lambda t: len(t.get_text(strip=True)))
            if best is None or len(best_div.get_text(strip=True)) > len(best.get_text(strip=True)):
                best = best_div
    return best if best is not None else (soup.body or soup)


def clean_soup(soup: BeautifulSoup) -> None:
    body = soup.body or soup
    total_len = len(body.get_text(strip=True)) or 1
    for tag in soup.find_all(STRIP_TAGS):
        if tag.parent is not None:
            tag.decompose()
    for c in soup.find_all(string=lambda s: isinstance(s, Comment)):
        c.extract()
    for tag in soup.find_all(attrs={"class": True}):
        if tag.parent is None or tag.attrs is None:
            continue  # already decomposed as a descendant of an earlier match
        classes = tag.get("class") or []
        if not any(STRIP_CLASS_TOKEN_RX.match(c) for c in classes):
            continue
        # safety valve: a plugin/theme can stuff a boilerplate-looking class
        # (e.g. "mega-menu-menu-1") onto <body> itself -- never let a class
        # match nuke a block holding most of the page's text.
        if len(tag.get_text(strip=True)) > 0.4 * total_len:
            continue
        tag.decompose()


def is_pseudo_heading(el, text: str) -> bool:
    """Some CMSes (LastPass's blog among them) don't use real <h*> tags for
    subheadings -- they bold a short lead-in phrase inside an otherwise-empty
    <p> (e.g. <p><b>What We've Learned</b></p>). Detect that pattern: a short
    block whose text is ~entirely covered by a single <b>/<strong> child."""
    if el.name not in ("p", "div") or not (3 <= len(text) <= 90):
        return False
    bold = el.find(["b", "strong"])
    if bold is None:
        return False
    bold_text = re.sub(r"\s+", " ", bold.get_text(" ", strip=True)).strip()
    return len(bold_text) >= len(text) - 15


def blocks_to_md(container) -> tuple[str, list[str]]:
    """Walk block-level elements in document order; cut at boilerplate tail."""
    lines: list[str] = []
    headings: list[str] = []
    level_prefix = {"h1": "# ", "h2": "## ", "h3": "### ", "h4": "#### ", "h5": "##### "}
    for el in container.find_all(BLOCK_TAGS):
        # skip nested duplicates (e.g. <li> inside a <p> won't happen, but a <p>
        # inside a <blockquote> would double-count -- guard via a seen-id set)
        text = re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip()
        if not text:
            continue
        if BOILERPLATE_TAIL_RX.search(text) and len(text) < 120:
            break
        if el.name in level_prefix:
            headings.append(text)
            lines.append(f"\n{level_prefix[el.name]}{text}\n")
        elif el.name == "li":
            lines.append(f"- {text}")
        elif el.name == "pre":
            lines.append(f"```\n{text}\n```")
        elif is_pseudo_heading(el, text):
            headings.append(text)
            lines.append(f"\n#### {text}\n")
        else:
            lines.append(text)
    return "\n".join(lines).strip(), headings


def parse_one(key: str) -> bool:
    html_f = HTML_DIR / f"{key}.html"
    if not html_f.exists():
        return False
    soup = BeautifulSoup(html_f.read_text(errors="replace"), "html.parser")
    clean_soup(soup)
    container = pick_container(soup)
    md, headings = blocks_to_md(container)
    if len(md) < 400:
        return False
    MD_DIR.mkdir(parents=True, exist_ok=True)
    HEADERS_DIR.mkdir(parents=True, exist_ok=True)
    (MD_DIR / f"postmortem__{key}.md").write_text(md)
    (HEADERS_DIR / f"postmortem__{key}.headers.txt").write_text("\n".join(headings))
    return True


def stage_parse(only: list[str] | None) -> None:
    targets = json.load(open(TARGETS))["targets"]
    accepted = [t for t in targets if t["verdict"] == "accept" and t.get("url")]
    if only:
        accepted = [t for t in accepted if t["company"] in only]
    ok = fail = 0
    for t in accepted:
        key = re.sub(r"[^a-z0-9_.-]", "-", f"{t['company']}__{t['slug']}".lower())[:120]
        if parse_one(key):
            ok += 1
        else:
            fail += 1
            print(f"PARSE FAIL (no html or too short): {key}")
    print(f"parsed: {ok} ok, {fail} failed -> {MD_DIR}")


# --- Stage 2: section classification + pair extraction -------------------------------

TECH_HEADING_RX = re.compile(
    r"(timeline|technical (detail|analysis|background)|attack (timeline|vector|chain|details)|"
    r"root cause|indicators? of compromise|\bioc(s)?\b|investigation (findings|details)|"
    r"how (the|this) (attack|incident|breach) (worked|happened)|threat actor|"
    r"detailed (findings|timeline)|forensic|key acquisition|results of.*investigation|"
    r"internal investigations|what (we|our team) found|analysis of|methods? used|"
    r"technical (update|summary))",
    re.I,
)
PLAIN_HEADING_RX = re.compile(
    r"(^what happened\??$|what (we|you) (know|need to know)|"
    r"how (were|are) (customers|users|you) affected|"
    r"(recommended|next) (actions?|steps?) for (customers|users)|"
    r"^faq|frequently asked|our commitment|^summary$|^introduction$|^overview$|"
    r"^conclusion$|closing thoughts|what (you should|to) do|"
    r"communication and support|customer (support|notice)|"
    r"protecting (your|our) account|^tl;?dr$)",
    re.I,
)

# NOTE: bare "impact" was deliberately dropped from PLAIN_HEADING_RX -- headings
# like "Impact to GitHub.com and npm" or "Impact and Data Exposed" routinely
# hold the densest technical content in the whole post (specific systems,
# counts, mechanisms), so a heading-text match alone is the wrong signal there;
# density scoring (below) decides those instead.

TECH_TERM_RX = re.compile(
    r"\b(token|credential|session|API|database|hash(ed)?|CVE-\d|exploit|malware|"
    r"C2\b|command and control|DNS|endpoint|IP address|log(s)?|admin(istrative)?|"
    r"forensic|actor(s)? (used|gained|accessed)|OAuth|repository|repo\b|script|"
    r"vulnerabilit|payload|backdoor|lateral movement|privileg|encrypt(ed|ion)?|"
    r"UTC|timestamp|decrypt|vault|brute force|PBKDF2|AES|iterations?|key derivation|"
    r"salt(ed)?|plaintext|master password|source code|S3 bucket|access key|"
    r"phishing (page|kit|infrastructure|domain)|deepfake|MFA bypass|service account)\b",
    re.I,
)
# Deliberately excludes bare "customers?|users?" -- those appear constantly in
# BOTH registers ("the threat actor accessed customer data" is technical) and
# don't discriminate; only phrases distinctive of the reassurance/support
# register are kept.
PLAIN_TERM_RX = re.compile(
    r"\b(we recommend|please contact|thank you|your account|"
    r"we (are|were) sorry|no evidence|we (do not|don't) believe|"
    r"as a precaution|out of an abundance of caution|"
    r"we (have )?notified|appreciate|apolog)\b",
    re.I,
)

ASSURANCE_RX = re.compile(
    r"\b(no (evidence|indication)|we (have |)?(do not|don't|found no) believe|"
    r"was not (accessed|impacted|affected)|were not (accessed|impacted|affected)|"
    r"did not (access|include|affect|impact)|no (customer|user) data (was|were)|"
    r"no unauthorized access to|as a precaution|out of an abundance of caution|"
    r"have already been (notified|reset|rotated)|remains? (safe|secure|encrypted)|"
    r"no (evidence|indication) (that|of)|not (been|able to) (access|compromise))",
    re.I,
)


def split_sentences(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", text)
    return [p.strip() for p in parts if len(p.strip()) > 25]


def parse_sections(md: str) -> list[dict]:
    """Split md into [{heading, level, text}], heading='' for the lead-in block."""
    lines = md.split("\n")
    sections = []
    cur_heading, cur_level, buf = "", 0, []
    for line in lines:
        m = re.match(r"^(#{1,5})\s+(.*)", line)
        if m:
            if buf or cur_heading:
                sections.append({"heading": cur_heading, "level": cur_level,
                                  "text": "\n".join(buf).strip()})
            cur_heading, cur_level, buf = m.group(2).strip(), len(m.group(1)), []
        else:
            buf.append(line)
    sections.append({"heading": cur_heading, "level": cur_level, "text": "\n".join(buf).strip()})
    return [s for s in sections if s["text"] or s["heading"]]


def classify_section(sec: dict) -> str:
    """Heading text is a NUDGE, not an absolute override -- a heading like
    'Impact to GitHub.com and npm' can introduce the most technical paragraph
    in the whole post, so a heading-keyword match alone must not out-vote a
    strong opposite signal from the body text itself."""
    heading, text = sec["heading"], sec["text"]
    if not text or len(text) < 60:
        if heading and TECH_HEADING_RX.search(heading):
            return "technical"
        if heading and PLAIN_HEADING_RX.search(heading):
            return "plain"
        return "other"
    tech_hits = len(TECH_TERM_RX.findall(text))
    plain_hits = len(PLAIN_TERM_RX.findall(text))
    # normalize by length so long sections don't always win on raw count
    tech_score = tech_hits / max(len(text) / 500, 1)
    plain_score = plain_hits / max(len(text) / 500, 1)
    if heading and TECH_HEADING_RX.search(heading):
        tech_score += 2.5
    if heading and PLAIN_HEADING_RX.search(heading):
        plain_score += 2.5
    if tech_score >= plain_score * 1.1 and tech_score >= 0.9:
        return "technical"
    if plain_score >= tech_score * 1.1 and plain_score >= 0.6:
        return "plain"
    if not heading:  # lead-in paragraph with no clear signal defaults to plain
        return "plain"
    return "other"


def score_section(sec: dict) -> tuple[float, float]:
    """(tech_score, plain_score) -- the raw density numbers classify_section
    computes internally, exposed for the fallback pass below."""
    text = sec["text"]
    if not text:
        return 0.0, 0.0
    tech_hits = len(TECH_TERM_RX.findall(text))
    plain_hits = len(PLAIN_TERM_RX.findall(text))
    return tech_hits / max(len(text) / 500, 1), plain_hits / max(len(text) / 500, 1)


def classify_all(sections: list[dict]) -> list[str]:
    """Per-section classify_section, then a document-level fallback: a lot of
    postmortems never hit the absolute density bar anywhere (the vocabulary
    varies too much across 26 companies for one fixed keyword list to catch
    every register), which would otherwise leave a document with an empty
    'technical' or 'plain' bucket and zero pairs. If a bucket is empty but at
    least one section has ANY nonzero signal for it, promote the single
    best-scoring eligible section into that bucket instead of discarding the
    whole document."""
    buckets = [classify_section(s) for s in sections]
    if not any(b == "technical" for b in buckets):
        cands = [(i, score_section(s)[0]) for i, s in enumerate(sections)
                  if buckets[i] in ("other", "plain") and len(s["text"]) >= 150]
        cands = [c for c in cands if c[1] > 0]
        if cands:
            i = max(cands, key=lambda c: c[1])[0]
            buckets[i] = "technical"
    if not any(b == "plain" for b in buckets):
        cands = [(i, score_section(s)[1]) for i, s in enumerate(sections)
                  if buckets[i] in ("other",) and len(s["text"]) >= 150]
        cands = [c for c in cands if c[1] > 0]
        if cands:
            i = max(cands, key=lambda c: c[1])[0]
            buckets[i] = "plain"
        elif sections and buckets[0] == "other":
            buckets[0] = "plain"  # last resort: lead-in section is plain by convention
    return buckets


IOC_TAIL_RX = re.compile(r"\bIOCs?\b\s*(Below|:|\n)|indicators? of compromise", re.I)


def strip_ioc_tail(text: str) -> str:
    """A plain/wrap-up section sometimes runs straight into a raw IOC dump
    (IPs/hashes/domains) with no heading of its own -- cut it off."""
    m = IOC_TAIL_RX.search(text)
    return text[: m.start()].rstrip() if m else text


def build_doc_level(key: str, meta: dict, sections: list[dict], buckets: list[str]) -> CandidatePair | None:
    plain_parts, tech_parts = [], []
    for s, bucket in zip(sections, buckets):
        chunk = (f"{s['heading']}\n{s['text']}" if s["heading"] else s["text"]).strip()
        if not chunk:
            continue
        if bucket == "plain":
            plain_parts.append(strip_ioc_tail(chunk))
        elif bucket == "technical":
            tech_parts.append(chunk)
    plain_text = "\n\n".join(plain_parts)[:8000]
    tech_text = "\n\n".join(tech_parts)[:12000]
    if len(plain_text) < 300 or len(tech_text) < 300:
        return None
    return CandidatePair(
        pair_id=f"postmortem__{key}#doc",
        source_doc_id=f"postmortem/{key}",
        source_org=meta["company"],
        doc_type="incident_postmortem",
        technical_text=tech_text,
        technical_context="technical/timeline section(s)",
        executive_text=plain_text,
        audience_observed="customer",
        alignment_method="same_section_1to1",
        alignment_type="1:1",
        exec_span_kind="doc_level",
        needs_llm_verify=False,
        notes=f"company blog postmortem ({meta['url']}); section-heuristic split",
    )


def build_claim_level(key: str, meta: dict, sections: list[dict], buckets: list[str],
                       model) -> list[CandidatePair]:
    """Assurance/impact sentences can land in ANY section -- postmortems often
    mix registers within one paragraph (e.g. Cloudflare's intro: 'no customer
    data...was impacted' sits next to token/Jira/Bitbucket technical detail in
    the same block). So scan every section for assurance-pattern sentences,
    but only match them against paragraphs from sections classified
    'technical', and exclude the sentence's OWN section from its candidate
    pool (coarse self-match guard)."""
    import numpy as np

    plain_sents: list[tuple[str, int]] = []  # (sentence, source_section_idx)
    tech_paras: list[tuple[str, int]] = []   # (paragraph, source_section_idx)
    for idx, (s, bucket) in enumerate(zip(sections, buckets)):
        plain_sents.extend(
            (sent, idx) for sent in split_sentences(s["text"]) if ASSURANCE_RX.search(sent)
        )
        if bucket == "technical":
            for para in re.split(r"\n\s*\n", s["text"]):
                para = para.strip()
                if len(para) >= 100:
                    tech_paras.append(
                        (f"{s['heading']}: {para}" if s["heading"] else para, idx)
                    )
    if not plain_sents or not tech_paras:
        return []
    sent_texts = [p[0] for p in plain_sents]
    para_texts = [p[0] for p in tech_paras]
    emb_s = model.encode(sent_texts, normalize_embeddings=True)
    emb_t = model.encode(para_texts, normalize_embeddings=True)
    sims = emb_s @ emb_t.T
    pairs = []
    seen_sent = set()
    for i, (sent, sent_sec) in enumerate(plain_sents):
        if sent in seen_sent:
            continue  # dedup identical sentence recurring across sections
        row = sims[i].copy()
        for j, (_, para_sec) in enumerate(tech_paras):
            if para_sec == sent_sec:
                row[j] = -1.0  # exclude same-section self-match
        j = int(np.argmax(row))
        score = float(row[j])
        if score < 0.25:
            continue
        seen_sent.add(sent)
        pairs.append(CandidatePair(
            pair_id=f"postmortem__{key}#claim{len(pairs)}",
            source_doc_id=f"postmortem/{key}",
            source_org=meta["company"],
            doc_type="incident_postmortem",
            technical_text=tech_paras[j][0],
            technical_context="technical passage (embed-matched)",
            executive_text=sent,
            audience_observed="customer",
            alignment_method="thematic",
            alignment_type="1:1",
            exec_span_kind="prose",
            needs_llm_verify=True,
            notes=f"cosine={score:.3f}; company blog postmortem ({meta['url']})",
        ))
    return pairs


def stage_extract(only: list[str] | None) -> None:
    from sentence_transformers import SentenceTransformer

    targets = json.load(open(TARGETS))["targets"]
    accepted = [t for t in targets if t["verdict"] == "accept" and t.get("url")]
    if only:
        accepted = [t for t in accepted if t["company"] in only]

    done = set()
    if OUT.exists():
        done = {json.loads(l)["pair_id"].split("#")[0] for l in open(OUT)}

    model = None
    n_doc = n_claim = n_skip_doc = n_skip_claim = 0
    with OUT.open("a") as fh:
        for t in accepted:
            key = re.sub(r"[^a-z0-9_.-]", "-", f"{t['company']}__{t['slug']}".lower())[:120]
            if f"postmortem__{key}" in done:
                continue
            md_f = MD_DIR / f"postmortem__{key}.md"
            if not md_f.exists():
                print(f"SKIP (not parsed): {key}")
                continue
            sections = parse_sections(md_f.read_text())
            buckets = classify_all(sections)
            doc_pair = build_doc_level(key, t, sections, buckets)
            if doc_pair:
                fh.write(doc_pair.to_jsonl() + "\n")
                n_doc += 1
            else:
                n_skip_doc += 1
                print(f"SKIP doc-level (thin plain/technical split): {key}")
            if model is None:
                model = SentenceTransformer("Qwen/Qwen3-Embedding-0.6B")
            claim_pairs = build_claim_level(key, t, sections, buckets, model)
            for cp in claim_pairs:
                fh.write(cp.to_jsonl() + "\n")
            n_claim += len(claim_pairs)
            if not claim_pairs:
                n_skip_claim += 1
    print(f"postmortem pairs: +{n_doc} doc-level ({n_skip_doc} skipped), "
          f"+{n_claim} claim-level ({n_skip_claim} docs with none) -> {OUT}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--parse", action="store_true")
    ap.add_argument("--extract", action="store_true")
    ap.add_argument("--only", nargs="*", default=None)
    a = ap.parse_args()
    if a.parse:
        stage_parse(a.only)
    if a.extract:
        stage_extract(a.only)
