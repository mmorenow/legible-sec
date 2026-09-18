/* LEGIBLE deterministic fidelity gate, ported 1:1 from src/legible/judge.py
   (checks D1-D5 + D7-D9) so the /try page can run REAL verification in the
   browser. Contract preserved: ZERO FALSE AUTHORITY. A check may only fail
   with the exact matched strings as evidence; a pass means the property was
   genuinely verified. format_lint (D6) needs the audience/format contract of
   the live motor and is not part of the in-tab gate.

   The port is validated against the Python judge's output on every pair this
   site embeds (scripts in the repo run both and diff the reports). */

export type FlagLevel = "fail" | "warn";
export type Flag = { check: string; level: FlagLevel; message: string; evidence: string[] };
export type GateReport = { ok: boolean; passed: string[]; flags: Flag[] };

export const GATE_CHECKS = [
  "id_parity",
  "numeric_parity",
  "severity_drift",
  "entity_check",
  "caveat_parity",
  "claim_inflation",
  "status_drift",
  "negation_flip",
] as const;
export type GateCheck = (typeof GATE_CHECKS)[number];

/* ------------------------------------------------------------------ D1 --- */

const ID_PATTERNS: RegExp[] = [
  /\bCVE-\d{4}-\d{4,7}\b/gi,
  /\bCWE-\d{1,4}\b/gi,
  /\bGHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}\b/gi,
  /\bICSA-\d{2}-\d{3}-\d{2}\b/gi,
  /\b(?:TOB|DYL|PBL|NCC|KL|OSTIF)-[A-Z0-9]{2,12}-\d{1,4}\b/g, // case-sensitive, as in Python
];

function extractIds(text: string): Set<string> {
  const out = new Set<string>();
  for (const rx of ID_PATTERNS) {
    for (const m of text.matchAll(new RegExp(rx.source, rx.flags))) out.add(m[0].toUpperCase());
  }
  return out;
}

function checkIdParity(source: string, translation: string, omitted: string[]): Flag[] {
  const srcIds = extractIds(source);
  if (srcIds.size === 0) return [];
  const covered = new Set([...extractIds(translation), ...extractIds(omitted.join(" "))]);
  const missing = [...srcIds].filter((i) => !covered.has(i)).sort();
  if (missing.length)
    return [{ check: "id_parity", level: "fail", message: "identifier(s) in the source neither kept nor declared omitted", evidence: missing }];
  return [];
}

/* ------------------------------------------------------------------ D2 --- */

const NUM_RX = /(?<![\w.-])(\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?|\$?\d+\.\d+|\$\d+|\d+(?:\.\d+)?\s?%|\d{4,6}|\b\d+\b)/g;
const YEAR_RX = /^(19|20)\d{2}$/;

type Span = [number, number];

function idSpans(text: string): Span[] {
  const spans: Span[] = [];
  for (const rx of [...ID_PATTERNS, VERSION_RX, IP_RX]) {
    for (const m of text.matchAll(new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g"))) {
      spans.push([m.index!, m.index! + m[0].length]);
    }
  }
  return spans;
}

function extractNumbers(text: string, ignoreSpans: Span[]): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(new RegExp(NUM_RX.source, "g"))) {
    const start = m.index!;
    if (ignoreSpans.some(([a, b]) => a <= start && start < b)) continue;
    const tok = m[0];
    const norm = tok.replace(/,/g, "").replace(/\s/g, "").replace(/^\$/, "").replace(/%$/, "");
    if (YEAR_RX.test(tok) || norm === "1" || norm === "2") continue;
    out.add(norm);
  }
  return out;
}

function checkNumericParity(source: string, translation: string, omitted: string[]): Flag[] {
  const src = extractNumbers(source, idSpans(source));
  if (src.size === 0) return [];
  const kept = extractNumbers(translation, idSpans(translation));
  const omittedJoined = omitted.join(" ");
  const declared = extractNumbers(omittedJoined, []);
  const missing = [...src]
    .filter((n) => !kept.has(n) && !declared.has(n) && !translation.includes(n) && !omittedJoined.includes(n))
    .sort();
  if (missing.length)
    return [{ check: "numeric_parity", level: "fail", message: "number(s) in the source neither kept nor declared omitted", evidence: missing }];
  return [];
}

/* ------------------------------------------------------------------ D3 --- */

const SEVERITY_BANDS: [RegExp, number][] = [
  [/\bcritical\b/gi, 4],
  [/\bhigh(?:[-\s]severity| risk| impact)?\b/gi, 3],
  [/\b(?:actively exploited|exploit\w*\s+in the wild|exploitation observed)\b/gi, 4],
  [/\bmedium\b|\bmoderate\b/gi, 2],
  [/\blow(?:[-\s]severity| risk)?\b/gi, 1],
  [/\binformational\b|\binfo\b/gi, 0],
];
const CVSS_RX = /\bCVSS(?:\s*v?\d(?:\.\d)?)?\s*(?:base\s*)?(?:score\s*)?(?:of\s*)?[:\s]\s*(\d{1,2}(?:\.\d)?)/gi;
const BAND_BY_NAME: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

const NEGATORS =
  /\b(?:no evidence|no indication|no sign|not been|have not|has not|was not|were not|without any|not observed|not aware|not exploit)\b/i;

function negated(text: string, start: number): boolean {
  const sentStart = Math.max(text.lastIndexOf(".", start - 1), text.lastIndexOf("\n", start - 1)) + 1;
  return NEGATORS.test(text.slice(sentStart, start));
}

function severitySignal(text: string): [number, string] | null {
  let best: [number, string] | null = null;
  for (const [rx, band] of SEVERITY_BANDS) {
    for (const m of text.matchAll(new RegExp(rx.source, rx.flags))) {
      if (negated(text, m.index!)) continue;
      if (best === null || band > best[0]) best = [band, m[0]];
      break; // first non-negated occurrence per band, as in Python
    }
  }
  for (const m of text.matchAll(new RegExp(CVSS_RX.source, CVSS_RX.flags))) {
    const score = parseFloat(m[1]);
    const band = score >= 9.0 ? 4 : score >= 7.0 ? 3 : score >= 4.0 ? 2 : 1;
    if (best === null || band > best[0]) best = [band, m[0]];
  }
  return best;
}

function checkSeverityDrift(source: string, translation: string, severityConveyed?: string | null): Flag[] {
  const src = severitySignal(source);
  if (src === null) return [];
  const flags: Flag[] = [];
  const tr = severitySignal(translation);
  if (tr !== null && tr[0] < src[0]) {
    flags.push({
      check: "severity_drift",
      level: "fail",
      message: "translation's strongest severity signal is below the source's",
      evidence: [`source: ${src[1]}`, `translation: ${tr[1]}`],
    });
  } else if (tr === null) {
    flags.push({
      check: "severity_drift",
      level: "warn",
      message: "source carries a severity signal but the translation names none",
      evidence: [`source: ${src[1]}`],
    });
  }
  if (severityConveyed) {
    const claimed = BAND_BY_NAME[severityConveyed.toLowerCase()];
    if (claimed !== undefined && claimed < src[0]) {
      flags.push({
        check: "severity_drift",
        level: "fail",
        message: "declared severity_conveyed is below the source's band",
        evidence: [`declared: ${severityConveyed}`, `source signal: ${src[1]}`],
      });
    }
  }
  return flags;
}

/* ------------------------------------------------------------------ D4 --- */

const IP_RX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const VERSION_RX = /\bv?\d+\.\d+(?:\.\d+){1,3}\b/g;
const DOMAIN_RX =
  /\b[a-z0-9][a-z0-9-]{1,62}(?:\.[a-z0-9][a-z0-9-]{1,62})+\.(?:com|net|org|io|gov|edu|dev|co|us|uk|de|cloud)\b/gi;
const PORT_RX = /\bport\s+(\d{2,5})\b/gi;

function techEntities(text: string): Set<string> {
  const out = new Set<string>();
  for (const rx of [IP_RX, VERSION_RX, DOMAIN_RX]) {
    for (const m of text.matchAll(new RegExp(rx.source, rx.flags))) out.add(m[0].toLowerCase());
  }
  for (const m of text.matchAll(new RegExp(PORT_RX.source, PORT_RX.flags))) out.add(`port ${m[1]}`);
  return out;
}

function checkEntities(source: string, translation: string, omitted: string[]): Flag[] {
  const src = techEntities(source);
  const tr = techEntities(translation);
  const flags: Flag[] = [];
  const invented = [...tr].filter((e) => !src.has(e)).sort();
  if (invented.length)
    flags.push({
      check: "entity_check",
      level: "fail",
      message: "technical entity in the translation does not appear in the source (possible invention)",
      evidence: invented,
    });
  const declared = techEntities(omitted.join(" "));
  const dropped = [...src].filter((e) => !tr.has(e) && !declared.has(e)).sort();
  if (dropped.length)
    flags.push({
      check: "entity_check",
      level: "warn",
      message: "technical entity dropped without declaration (may be justified for this audience)",
      evidence: dropped,
    });
  return flags;
}

/* ------------------------------------------------------------------ D5 --- */

const CAVEAT_MARKERS = [
  "requires authenticat", "requires local access", "requires physical access",
  "requires user interaction", "only if", "only when", "in certain configurations",
  "under certain conditions", "no evidence of exploitation", "no evidence that",
  "not exploitable", "did not observe", "we did not find", "theoretical",
  "difficult to exploit", "mitigated by", "already patched", "requires admin",
  "requires elevated", "low likelihood", "unlikely to", "provided that",
  "as long as", "if an attacker", "would require",
];
const WORD_RX = /[a-z0-9']+/g;
const STOP = new Set(["the", "a", "an", "of", "to", "and", "in", "is", "that", "this", "for", "on", "be", "by", "it", "as", "with"]);

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set((a.toLowerCase().match(WORD_RX) ?? []).filter((w) => !STOP.has(w)));
  const tb = new Set((b.toLowerCase().match(WORD_RX) ?? []).filter((w) => !STOP.has(w)));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter += 1;
  return inter / ta.size;
}

function markerClause(sentence: string, marker: string): string {
  for (const clause of sentence.split(/[,;]| and /)) {
    if (clause.toLowerCase().includes(marker)) return clause.trim();
  }
  return sentence;
}

function checkCaveats(source: string, translation: string, omitted: string[], threshold = 0.35): Flag[] {
  const flags: Flag[] = [];
  const trSents = [...splitSentences(translation), ...omitted];
  for (const sent of splitSentences(source)) {
    const low = sent.toLowerCase();
    const marker = CAVEAT_MARKERS.find((m) => low.includes(m));
    if (!marker) continue;
    const clause = markerClause(sent, marker);
    const best = trSents.reduce((acc, t) => Math.max(acc, tokenOverlap(clause, t)), 0);
    if (best < threshold)
      flags.push({
        check: "caveat_parity",
        level: "fail",
        message: "caveat/condition in the source has no counterpart in the translation and was not declared omitted",
        evidence: [clause],
      });
  }
  return flags;
}

/* --------------------------------------------------------------- D7-D9 --- */

const ACTION =
  "allow\\w*|enabl\\w*|permit\\w*|grant\\w*|expos\\w*|leak\\w*|caus\\w*|" +
  "lead\\w*|result\\w*|access\\w*|read\\w*|writ\\w*|execut\\w*|compromis\\w*|" +
  "bypass\\w*|escalat\\w*|steal|stole|stolen|disclos\\w*|overwrit\\w*|" +
  "drain\\w*|delet\\w*|modif\\w*|tamper\\w*|impersonat\\w*|spoof\\w*|forg\\w*|" +
  "hijack\\w*|poison\\w*|inject\\w*|deface\\w*|encrypt\\w*|exfiltrat\\w*|" +
  "takeover|take\\s+over|elevat\\w*|manipulat\\w*|corrupt\\w*|redirect\\w*";
const HEDGE =
  /\b(?:could|may|might|can|would|potential\w*|possibl\w*|if\s+exploited|under\s+certain|in\s+theory|theoretically|is\s+able\s+to|be\s+able\s+to)\b/i;
const ASSERT_ACTION = new RegExp(`\\b(?:${ACTION})\\b`, "i");

function checkClaimInflation(source: string, translation: string): Flag[] {
  const srcHedged = HEDGE.test(source) && ASSERT_ACTION.test(source);
  if (!srcHedged) return [];
  if (HEDGE.test(translation)) return [];
  const m = ASSERT_ACTION.exec(translation);
  if (!m) return [];
  const clause = translation.slice(Math.max(0, m.index - 24), m.index + m[0].length + 16);
  return [
    {
      check: "claim_inflation",
      level: "fail",
      message: "source hedges the impact but the translation asserts it as fact",
      evidence: [`source hedge: ${HEDGE.exec(source)![0]}`, `translation: …${clause.trim()}…`],
    },
  ];
}

const STATUS: Record<string, RegExp> = {
  exploited_actual:
    /\b(?:was|were|has been|have been|is being|are being)\s+exploit\w*|attackers?\s+(?:accessed|stole|exfiltrat\w*|compromis\w*|drained|encrypted)|breach\s+occurred|\b\w+\s+(?:was|were|have been|has been)\s+(?:stolen|exfiltrat\w*|breached|compromised|encrypted|leaked)|(?:already|successfully)\s+(?:stolen|exploited|breached|compromised|accessed)/i,
  exploited_potential:
    /\b(?:could|may|might|can)\s+(?:be\s+)?exploit\w*|an?\s+attacker\s+could|potential\w*\s+(?:for\s+)?exploit\w*|if\s+exploited/i,
  remediated:
    /\b(?:has been|was|is|are|were)\s+(?:fixed|patched|remediat\w*|resolved|addressed|mitigat\w*)|no longer\s+vulnerable/i,
  active: /\b(?:is|are|remains?|still)\s+vulnerable|unpatched|unremediat\w*|not\s+(?:yet\s+)?(?:fixed|patched|remediat\w*)/i,
};

function status(text: string, key: string): string | null {
  const m = STATUS[key].exec(text);
  return m && !negated(text, m.index) ? m[0] : null;
}

function checkStatusDrift(source: string, translation: string): Flag[] {
  const flags: Flag[] = [];
  if (status(translation, "exploited_actual") && !status(source, "exploited_actual")) {
    if (status(source, "exploited_potential") || ASSERT_ACTION.test(source)) {
      flags.push({
        check: "status_drift",
        level: "fail",
        message: "translation implies exploitation occurred; source only describes the potential",
        evidence: [`translation: ${status(translation, "exploited_actual")}`],
      });
    }
  }
  if (status(source, "remediated") && status(translation, "active")) {
    flags.push({
      check: "status_drift",
      level: "fail",
      message: "source states the issue was remediated; translation implies it is still active",
      evidence: [`source: ${status(source, "remediated")}`, `translation: ${status(translation, "active")}`],
    });
  }
  if (status(source, "active") && status(translation, "remediated")) {
    flags.push({
      check: "status_drift",
      level: "warn",
      message: "translation implies remediation the source does not state",
      evidence: [`translation: ${status(translation, "remediated")}`],
    });
  }
  return flags;
}

function checkNegationFlip(source: string, translation: string): Flag[] {
  const flags: Flag[] = [];
  const srcNegExploit = /\bno\s+(?:evidence|indication|sign)\s+of\s+(?:exploit\w*|compromis\w*|access|breach)/i.test(source);
  if (srcNegExploit && status(translation, "exploited_actual")) {
    flags.push({
      check: "negation_flip",
      level: "fail",
      message: "source explicitly reports no evidence of exploitation; translation asserts it occurred",
      evidence: [`translation: ${status(translation, "exploited_actual")}`],
    });
  }
  return flags;
}

/* ------------------------------------------------------------------ run --- */

export function runGate(
  source: string,
  translation: string,
  opts?: { omitted?: string[]; severityConveyed?: string | null }
): GateReport {
  const omitted = opts?.omitted ?? [];
  const all: Flag[] = [
    ...checkIdParity(source, translation, omitted),
    ...checkNumericParity(source, translation, omitted),
    ...checkSeverityDrift(source, translation, opts?.severityConveyed),
    ...checkEntities(source, translation, omitted),
    ...checkCaveats(source, translation, omitted),
    ...checkClaimInflation(source, translation),
    ...checkStatusDrift(source, translation),
    ...checkNegationFlip(source, translation),
  ];
  const flagged = new Set(all.map((f) => f.check));
  const passed = GATE_CHECKS.filter((c) => !flagged.has(c));
  return { ok: !all.some((f) => f.level === "fail"), passed: [...passed], flags: all };
}

/* -------------------------------------------------- sentence annotation --- */
/* Mirrors src/legible/review.py's split: coverage flags live at draft level,
   assertion checks (inflation / status / negation) run per sentence, and any
   gate flag whose translation-side evidence lands inside a sentence tints it.
   red = dangerous (fabrication, flip, downgrade), amber = confirm intent. */

export type SentenceNote = {
  text: string;
  level: "ok" | "amber" | "red";
  checks: string[];
  reasons: string[];
};

const RED_CHECKS = new Set(["status_drift", "negation_flip", "severity_drift", "entity_check"]);

/** Evidence strings that point at the translation (strip the "translation:" prefix). */
export function translationTargets(flag: Flag): string[] {
  const out: string[] = [];
  for (const e of flag.evidence) {
    const m = /^(source|translation):\s*(.+)$/i.exec(e);
    if (m) {
      if (m[1].toLowerCase() === "translation") out.push(m[2].trim().replace(/^…|…$/g, ""));
    } else out.push(e);
  }
  return out;
}

/** Evidence strings that point at the source. */
export function sourceTargets(flag: Flag): string[] {
  const out: string[] = [];
  for (const e of flag.evidence) {
    const m = /^(source|translation):\s*(.+)$/i.exec(e);
    if (m) {
      if (m[1].toLowerCase() === "source") out.push(m[2].trim());
    } else out.push(e);
  }
  return out;
}

export function annotateDraft(source: string, draft: string, report: GateReport): SentenceNote[] {
  return splitSentences(draft).map((sent) => {
    const note: SentenceNote = { text: sent, level: "ok", checks: [], reasons: [] };
    // per-sentence assertion checks, exactly as review.py runs them
    const assertion = [
      ...checkClaimInflation(source, sent).map((f) => ({ f, lvl: "amber" as const })),
      ...checkStatusDrift(source, sent).map((f) => ({ f, lvl: f.level === "fail" ? ("red" as const) : ("amber" as const) })),
      ...checkNegationFlip(source, sent).map((f) => ({ f, lvl: f.level === "fail" ? ("red" as const) : ("amber" as const) })),
    ];
    for (const { f, lvl } of assertion) {
      if (!note.checks.includes(f.check)) {
        note.checks.push(f.check);
        note.reasons.push(f.message);
      }
      if (lvl === "red" || note.level === "ok") note.level = lvl;
    }
    // draft-level flags whose translation-side evidence lives in this sentence
    for (const f of report.flags) {
      if (note.checks.includes(f.check)) continue;
      const hit = translationTargets(f).some((t) => t && sent.toLowerCase().includes(t.toLowerCase()));
      if (hit) {
        note.checks.push(f.check);
        note.reasons.push(f.message);
        const lvl = f.level === "fail" && RED_CHECKS.has(f.check) ? "red" : "amber";
        if (lvl === "red" || note.level === "ok") note.level = lvl;
      }
    }
    return note;
  });
}
