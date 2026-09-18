/* LEGIBLE library search: find the real pairs in the corpus that look like the
   finding you just pasted, entirely in the tab, with one fetch and no backend.

   The index is baked by scripts/gen_library_index.py, which is where the two
   hard filters live: only redistributable licences and only pii_scrubbed rows
   ever reach public/library-index.json. Nothing here can widen that, and
   meta.withheld / meta.withheldReason carry the count of what was held back so
   the UI can say so out loud.

   Two commitments this file inherits from the rest of the project:

   1. NOTHING IS FABRICATED. Every result is a pair that exists in the dataset.
      A query that matches nothing returns an empty array, not the least-bad
      row on file. This is the same abstention ExplainMode.tsx makes when no
      analogy covers the concept.
   2. EVERY HIT SAYS WHY. `signals` reports what actually matched, term by term
      and identifier by identifier. A hit that cannot name its own evidence is
      a bug, not a low-confidence result.

   The extractors are NOT reimplemented here. CVE / CWE identifiers and the
   severity band come from src/lib/judge.ts, the 1:1 port of the Python judge,
   by running the gate with an empty translation: every identifier and every
   severity signal in the source is then, by definition, "missing from the
   translation", so the gate reports it as evidence. That is a slightly unusual
   call shape, but it means there is exactly one CVE regex and one severity
   ladder in this codebase, and the search agrees with the judge by
   construction rather than by luck. */

import { runGate, sourceTargets, type Flag } from "./judge";

/* ------------------------------------------------------------ public API --- */

export type LibraryPair = {
  id: string;
  tech: string;
  exec: string;
  techTruncated: boolean;
  execTruncated: boolean;
  org: string;
  orgType: string;
  severity: string | null;
  vulnClass: string;
  cves: string[];
  cwes: string[];
  year: number | null;
  license: string;
  url: string | null;
};

export type MatchSignal =
  | { kind: "cve"; value: string }
  | { kind: "cwe"; value: string }
  | { kind: "severity"; value: string }
  | { kind: "vulnClass"; value: string }
  | { kind: "term"; value: string };

export type LibraryHit = { pair: LibraryPair; score: number; signals: MatchSignal[]; exact: boolean };

export type IndexMeta = {
  pairs: number;
  withheld: number;
  total: number;
  buildTag: string;
  generatedAt: string;
  licenses: Record<string, number>;
  withheldReason: string;
};

export type LibraryIndex = {
  meta: IndexMeta;
  pairs: LibraryPair[];
  /* internals: everything below is derived at load and is not part of the
     contract the UI codes against. */
  stop: Set<string>;
  /** term -> delta-encoded document ids, exactly as baked. Decoded on demand. */
  raw: Record<string, number[]>;
  /** decoded posting lists, filled lazily so load costs nothing. */
  decoded: Map<string, number[]>;
  /** unique-term count per document, for length normalisation. */
  docLen: number[];
  avgDocLen: number;
  /** severity band per document, precomputed once from severity_original. */
  bands: (string | null)[];
  byCve: Map<string, number[]>;
  byCwe: Map<string, number[]>;
};

export const INDEX_URL = "/library-index.json";

/* ------------------------------------------------------------- tokenising --- */

/* Mirrors TOKEN_RX in scripts/gen_library_index.py. A token starts with a
   letter, so bare numbers never become terms: numbers in a finding are the
   judge's business (it knows currency, percentages and version strings) and a
   word tokeniser would only mangle them. If you change this, change it there
   too, or the client silently stops matching what the index baked. */
const TOKEN_SOURCE = "[a-z][a-z0-9]{2,}";

function tokenize(text: string, stop: Set<string>): string[] {
  const out: string[] = [];
  // Fresh regex per call: a shared /g/ literal carries lastIndex between calls.
  for (const m of text.toLowerCase().matchAll(new RegExp(TOKEN_SOURCE, "g"))) {
    if (!stop.has(m[0])) out.push(m[0]);
  }
  return out;
}

/* --------------------------------------------------------- severity bands --- */

/* Band names, coarse on purpose: the pair's severity_original and the band the
   judge read out of free prose have to land in the same vocabulary before they
   can be compared at all. */
const BAND_PATTERNS: [RegExp, string][] = [
  [/\bcritical\b/i, "critical"],
  [/actively exploited|exploit\w*\s+in the wild|exploitation observed/i, "critical"],
  [/\bhigh\b/i, "high"],
  [/\bmedium\b|\bmoderate\b/i, "medium"],
  [/\blow\b/i, "low"],
  [/\binformational\b|\binfo\b/i, "info"],
];

function severityBand(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // A CVSS signal arrives as the matched phrase with its score on the end.
  const cvss = /cvss[^0-9]*(\d{1,2}(?:\.\d)?)/i.exec(raw);
  if (cvss) {
    const score = parseFloat(cvss[1]);
    return score >= 9 ? "critical" : score >= 7 ? "high" : score >= 4 ? "medium" : "low";
  }
  for (const [rx, band] of BAND_PATTERNS) if (rx.test(raw)) return band;
  return null;
}

/* --------------------------------------------------------------- loading --- */

type BakedPair = {
  i: string; t: string; e: string; tt: boolean; et: boolean;
  o: string; ot: string; s: string | null; vc: string;
  cv: string[]; cw: string[]; y: number | null; l: string; u: string | null;
};

type BakedIndex = {
  meta: IndexMeta;
  pairs: BakedPair[];
  postings: Record<string, number[]>;
  dl: number[];
  stop: string[];
};

/* Resolved indexes are cached so a second panel on the same page does not pay
   the parse again. Only successes are cached: a failed or aborted load must be
   retryable. */
let cached: LibraryIndex | null = null;

export async function loadIndex(signal?: AbortSignal): Promise<LibraryIndex> {
  if (cached) return cached;

  const res = await fetch(INDEX_URL, { signal });
  if (!res.ok) throw new Error(`library index unavailable (HTTP ${res.status})`);
  const baked = (await res.json()) as BakedIndex;

  const stop = new Set(baked.stop);
  const pairs: LibraryPair[] = baked.pairs.map((p) => ({
    id: p.i,
    tech: p.t,
    exec: p.e,
    techTruncated: p.tt,
    execTruncated: p.et,
    org: p.o,
    orgType: p.ot,
    severity: p.s,
    vulnClass: p.vc,
    cves: p.cv,
    cwes: p.cw,
    year: p.y,
    license: p.l,
    url: p.u,
  }));

  const byCve = new Map<string, number[]>();
  const byCwe = new Map<string, number[]>();
  const bands: (string | null)[] = [];
  pairs.forEach((p, idx) => {
    for (const c of p.cves) push(byCve, c.toUpperCase(), idx);
    for (const c of p.cwes) push(byCwe, c.toUpperCase(), idx);
    bands.push(severityBand(p.severity));
  });

  const docLen = baked.dl;
  const avgDocLen = docLen.length ? docLen.reduce((a, b) => a + b, 0) / docLen.length : 1;

  const index: LibraryIndex = {
    meta: baked.meta,
    pairs,
    stop,
    raw: baked.postings,
    decoded: new Map(),
    docLen,
    avgDocLen: avgDocLen || 1,
    bands,
    byCve,
    byCwe,
  };
  cached = index;
  return index;
}

function push(map: Map<string, number[]>, key: string, value: number): void {
  const cur = map.get(key);
  if (cur) cur.push(value);
  else map.set(key, [value]);
}

/** Posting lists ship delta-encoded (it costs ~100 KB less gzipped). Decode the
    handful of terms a query actually touches, never the whole 27k vocabulary. */
function postingsFor(index: LibraryIndex, term: string): number[] | undefined {
  const hit = index.decoded.get(term);
  if (hit) return hit;
  const deltas = index.raw[term];
  if (!deltas) return undefined;
  const docs = new Array<number>(deltas.length);
  let acc = 0;
  for (let i = 0; i < deltas.length; i += 1) {
    acc += deltas[i];
    docs[i] = acc;
  }
  index.decoded.set(term, docs);
  return docs;
}

/* ---------------------------------------------------- reading the query --- */

type QueryProbe = {
  cves: string[];
  cwes: string[];
  band: string | null;
  vulnClasses: string[];
};

const CVE_RX = /^CVE-\d{4}-\d{4,7}$/;
const CWE_RX = /^CWE-\d{1,4}$/;

/* vuln_class values in the dataset, and the words that name them in prose.
   "other" is deliberately absent: it is a bucket, not a claim about the
   finding, and matching on it would be a signal that means nothing. */
const VULN_CLASS_WORDS: [string, RegExp][] = [
  ["network", /\bnetwork\b|\brouting\b|\bfirewall\b|\bvpn\b/i],
  ["web", /\bweb\b|\bhttp\b|\bxss\b|\bcross-site\b|\bbrowser\b/i],
  ["crypto", /\bcrypto\w*\b|\bencrypt\w*\b|\bcipher\b|\bsignature\b|\bkey exchange\b/i],
  ["access_control", /\baccess control\b|\bauthoriz\w*\b|\bprivilege\b|\bpermission\b/i],
  ["cloud", /\bcloud\b|\bs3\b|\baws\b|\bazure\b|\bkubernetes\b/i],
  ["memory", /\bbuffer overflow\b|\buse[- ]after[- ]free\b|\bmemory corruption\b|\bheap\b/i],
  ["ics", /\bics\b|\bscada\b|\bplc\b|\bindustrial control\b/i],
];

/** Read the paste with the judge's own extractors, never with new ones. */
function probe(query: string): QueryProbe {
  /* Running the gate against an EMPTY translation turns it into an extractor:
     every identifier and every severity signal in the source is then reported
     as evidence, because nothing in the (empty) translation covers it. */
  const report = runGate(query, "");
  const byCheck = (name: string): Flag | undefined => report.flags.find((f) => f.check === name);

  const ids = byCheck("id_parity")?.evidence ?? [];
  const sevFlag = byCheck("severity_drift");
  const band = severityBand(sevFlag ? sourceTargets(sevFlag)[0] : null);

  return {
    cves: ids.filter((i) => CVE_RX.test(i)),
    cwes: ids.filter((i) => CWE_RX.test(i)),
    band,
    vulnClasses: VULN_CLASS_WORDS.filter(([, rx]) => rx.test(query)).map(([name]) => name),
  };
  /* The gate also hands back every number in the paste (numeric_parity). It is
     deliberately unused: the MatchSignal union has no way to name a number
     match, and a hit that cannot say why it is a hit is exactly what this file
     refuses to produce. */
}

/* -------------------------------------------------------------- ranking --- */

/* A long paste has to be cut down or it drowns its own signal: 3,000 characters
   of a finding contain hundreds of terms, most of them the shared vocabulary of
   every security report ("vulnerability", "attacker", "impact"), and summing
   over all of them buries the two or three words that actually identify it.
   Keeping the top terms by idf keeps the words that discriminate. */
const MAX_QUERY_TERMS = 40;
const MAX_QUERY_PHRASES = 40;

/* Weights. The scale is anchored on the lexical score, which is the fraction of
   the query's idf mass a pair covers, so it sits in 0..1 for a normal match. */
const W_CVE = 4;        // an exact CVE is the highest-precision signal available
const W_CWE = 0.8;      // a class of weakness, not an instance: real, much weaker
const W_PHRASE = 0.12;  // ExplainMode's "phrase hit: strong evidence", generalised
const MAX_PHRASE_BONUS = 0.5;
const W_SEVERITY = 0.05;
const W_VULN_CLASS = 0.1;

/* Abstention floor, generalising ExplainMode's `bestScore >= 2`: one weak
   keyword is not evidence. Below this a pair is not a result, it is noise with
   an ordering. */
const MIN_LEXICAL = 0.1;

function normalizeForPhrases(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

export function search(index: LibraryIndex, query: string, opts?: { limit?: number }): LibraryHit[] {
  const limit = opts?.limit ?? 20;
  if (!query.trim() || limit <= 0) return [];

  const p = probe(query);
  const n = index.pairs.length;
  if (n === 0) return [];

  /* --- term selection: top MAX_QUERY_TERMS by idf --- */
  const seq = tokenize(query, index.stop);
  const tf = new Map<string, number>();
  for (const t of seq) tf.set(t, (tf.get(t) ?? 0) + 1);

  const scored: { term: string; idf: number }[] = [];
  for (const [term] of tf) {
    const docs = index.raw[term];
    if (!docs || docs.length === 0) continue; // not in the corpus: cannot match
    scored.push({ term, idf: Math.log(1 + n / docs.length) });
  }
  scored.sort((a, b) => b.idf - a.idf || (tf.get(b.term)! - tf.get(a.term)!) || a.term.localeCompare(b.term));
  const terms = scored.slice(0, MAX_QUERY_TERMS);
  const kept = new Set(terms.map((t) => t.term));
  const mass = terms.reduce((s, t) => s + t.idf, 0);

  /* --- lexical accumulation over the posting lists --- */
  const matchedMass = new Map<number, number>();
  const matchedTerms = new Map<number, { term: string; idf: number }[]>();
  for (const { term, idf } of terms) {
    const docs = postingsFor(index, term);
    if (!docs) continue;
    for (const d of docs) {
      matchedMass.set(d, (matchedMass.get(d) ?? 0) + idf);
      const list = matchedTerms.get(d);
      if (list) list.push({ term, idf });
      else matchedTerms.set(d, [{ term, idf }]);
    }
  }

  /* Identifier hits enter as candidates in their own right: a pair can carry
     the pasted CVE and share almost no wording with it. */
  const candidates = new Set<number>(matchedMass.keys());
  const cveDocs = new Map<number, string[]>();
  const cweDocs = new Map<number, string[]>();
  for (const cve of p.cves) {
    for (const d of index.byCve.get(cve) ?? []) {
      candidates.add(d);
      pushStr(cveDocs, d, cve);
    }
  }
  for (const cwe of p.cwes) {
    for (const d of index.byCwe.get(cwe) ?? []) {
      candidates.add(d);
      pushStr(cweDocs, d, cwe);
    }
  }

  type Scratch = { doc: number; base: number; lexical: number; exact: boolean };
  const shortlist: Scratch[] = [];

  for (const doc of candidates) {
    const cves = cveDocs.get(doc) ?? [];
    const cwes = cweDocs.get(doc) ?? [];

    /* Length normalisation, BM25's b applied gently: without it a 15,000
       character finding outranks a precise one purely by containing more
       words. 0.3 keeps long findings competitive without letting them win on
       size alone. */
    const norm = 0.7 + 0.3 * (index.docLen[doc] / index.avgDocLen);
    const lexical = mass > 0 ? (matchedMass.get(doc) ?? 0) / mass / (norm || 1) : 0;
    const hitTerms = matchedTerms.get(doc)?.length ?? 0;

    // The abstention rule: identifiers always qualify, wording has to clear the
    // floor, and a single weak keyword out of a real paste never does.
    const lexicalQualifies =
      lexical >= MIN_LEXICAL && (terms.length < 3 ? hitTerms >= 1 : hitTerms >= 2);
    if (cves.length === 0 && cwes.length === 0 && !lexicalQualifies) continue;

    let base = lexical + cves.length * W_CVE + cwes.length * W_CWE;
    if (p.band && index.bands[doc] === p.band) base += W_SEVERITY;
    if (p.vulnClasses.includes(index.pairs[doc].vulnClass)) base += W_VULN_CLASS;

    shortlist.push({ doc, base, lexical, exact: cves.length > 0 });
  }

  if (shortlist.length === 0) return [];

  shortlist.sort((a, b) => Number(b.exact) - Number(a.exact) || b.base - a.base || a.doc - b.doc);

  /* --- phrase refinement, on the shortlist only --- */
  const phrases: string[] = [];
  for (let i = 0; i + 1 < seq.length && phrases.length < MAX_QUERY_PHRASES; i += 1) {
    if (!kept.has(seq[i]) || !kept.has(seq[i + 1])) continue;
    const bigram = `${seq[i]} ${seq[i + 1]}`;
    if (!phrases.includes(bigram)) phrases.push(bigram);
  }

  const refineTo = Math.min(shortlist.length, Math.max(limit * 5, 50));
  const refined = shortlist.slice(0, refineTo).map((s) => {
    if (phrases.length === 0) return { ...s, phrases: [] as string[], score: s.base };
    const pair = index.pairs[s.doc];
    // Only the excerpt is here to search, so a phrase can only ever ADD
    // evidence: a miss means "not visible", never "not present".
    const hay = normalizeForPhrases(`${pair.tech} ${pair.exec}`);
    const found = phrases.filter((ph) => hay.includes(` ${ph} `));
    const bonus = Math.min(found.length * W_PHRASE, MAX_PHRASE_BONUS);
    return { ...s, phrases: found, score: s.base + bonus };
  });

  refined.sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score || a.doc - b.doc);

  /* --- signals, for the results that survive --- */
  return refined.slice(0, limit).map((s) => {
    const pair = index.pairs[s.doc];
    const signals: MatchSignal[] = [];
    for (const cve of cveDocs.get(s.doc) ?? []) signals.push({ kind: "cve", value: cve });
    for (const cwe of cweDocs.get(s.doc) ?? []) signals.push({ kind: "cwe", value: cwe });
    for (const ph of s.phrases) signals.push({ kind: "term", value: ph });
    // Strongest wording first, and all of it: the UI decides how much to show,
    // this function does not decide how much to admit.
    const words = (matchedTerms.get(s.doc) ?? []).slice().sort((a, b) => b.idf - a.idf);
    for (const w of words) signals.push({ kind: "term", value: w.term });
    if (p.band && index.bands[s.doc] === p.band) signals.push({ kind: "severity", value: p.band });
    if (p.vulnClasses.includes(pair.vulnClass)) signals.push({ kind: "vulnClass", value: pair.vulnClass });

    return { pair, score: Math.round(s.score * 1000) / 1000, signals, exact: s.exact };
  });
}

function pushStr(map: Map<number, string[]>, key: number, value: string): void {
  const cur = map.get(key);
  if (cur) cur.push(value);
  else map.set(key, [value]);
}
