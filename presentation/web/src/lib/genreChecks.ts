/* The genre dependent checks: rubric U1.1, U6.1 and U8.1 to U8.3.
 *
 * judge.ts holds the eight checks that need nothing but the two texts. These
 * three need to know what is being written, because a term banned in a board
 * deck is required in a SOC handover, and a length limit only exists inside a
 * genre. They run on the lists in content/genres.ts, mined from the research
 * corpus, where every entry carries the document and the quote behind it.
 *
 * Same contract as judge.ts: a check may only fail by showing the exact strings
 * that made it fail, and a pass is a non detection. Two rules extend that here.
 *
 * First, authority follows the source. Five situations have a checklist a named
 * body publishes; six only have practitioner convergence. A check on the second
 * kind reports as advisory, because failing a text against a rule nobody wrote
 * is the false authority this project exists to name.
 *
 * Second, only what is mechanically decidable is decided. Of 128 mined jargon
 * terms, 30 are literal strings. Of 151 format constants, 3 length limits and
 * 26 field lists can be measured against a draft. The rest are declared and
 * handed upward rather than guessed at.
 */

import {
  authorityFor,
  genreFor,
  type FormatConstant,
  type GenreAuthority,
  type GenreQuestion,
  type ProhibitedTerm,
} from "@/content/genres";
import type { SituationId } from "@/content/rubric";
import type { Flag } from "./judge";

export const GENRE_CHECKS = ["reader_questions", "prohibited_jargon", "format_constants"] as const;
export type GenreCheck = (typeof GENRE_CHECKS)[number];

/** Something the rule layer looked at and could not settle. It is not a pass. */
export type Undecided = {
  check: GenreCheck;
  /** What would have to be judged. */
  item: string;
  /** Why a rule cannot settle it. */
  reason: string;
  source?: string;
  sourceFile?: string;
};

/** Something true of the genre that the checker states but does not enforce. */
export type DeclaredContext = {
  rule: string;
  value: string;
  kind: FormatConstant["kind"];
  sourceFile: string;
};

export type GenreReport = {
  situation: SituationId;
  authority: GenreAuthority;
  /** Set when the genre has no published norm, so nothing here is a verdict. */
  advisoryNote: string | null;
  passed: GenreCheck[];
  flags: Flag[];
  undecided: Undecided[];
  declared: DeclaredContext[];
};

/* ---------------------------------------------------------- jurisdiction -- */

/**
 * Situation 06 is the only genre where two authorities require opposite things.
 * The ICO requires the notice to individuals to describe the nature of the
 * breach in clear language; Massachusetts statute prohibits the consumer notice
 * from stating it. Both are in the corpus, both are law, and neither is wrong.
 * So the applicable set has to be chosen, and a check that ran all of them at
 * once would fail every compliant notice on earth.
 *
 * The signal is already in the mined data, in `source` and `sourceFile`, so it
 * is resolved here rather than by regenerating the compiled content. An entry
 * that names no jurisdiction applies everywhere: the FTC model letter and the
 * OMB guidance are federal practice, not a jurisdictional mandate.
 */
export type JurisdictionId = "uk-eu" | "massachusetts" | "california";

export const JURISDICTION_SITUATION: SituationId = "S06";

const JURISDICTION_SIGNAL: { id: JurisdictionId; test: RegExp }[] = [
  { id: "uk-eu", test: /\b(UK GDPR|GDPR|ICO|Information Commissioner|personal-data-breaches-a-guide)\b/i },
  { id: "massachusetts", test: /\b(M\.G\.L|Massachusetts|OCABR|requirements-for-data-breach-notifications)\b/i },
  { id: "california", test: /\b(California|search-data-security-breaches)\b/i },
];

/** Null means the entry is not jurisdiction bound and always applies. */
function jurisdictionOf(...fields: (string | undefined)[]): JurisdictionId | null {
  const hay = fields.filter(Boolean).join(" ");
  for (const j of JURISDICTION_SIGNAL) if (j.test.test(hay)) return j.id;
  return null;
}

/**
 * Keeps entries that either name no jurisdiction or name the chosen one.
 *
 * This filter applies to situation 06 alone. Everywhere else, naming a
 * jurisdiction does not make a rule exclusive: a regulatory notification may
 * have to satisfy the ICO and the SEC and a state statute at once, and those
 * regimes do not contradict each other, they stack. Filtering them would drop
 * most of the genre's requirements for no reason. An earlier version of this
 * function applied everywhere and cut situation 05 from 18 mandatory questions
 * to 5.
 */
function applies(
  situation: SituationId,
  chosen: JurisdictionId | null,
  ...fields: (string | undefined)[]
): boolean {
  if (situation !== JURISDICTION_SITUATION) return true;
  const bound = jurisdictionOf(...fields);
  if (bound === null) return true;
  if (chosen === null) return false; // a bound rule needs a jurisdiction to be chosen
  return bound === chosen;
}

/* ------------------------------------------------------------------ util -- */

const WORD = /[A-Za-z0-9][A-Za-z0-9'’-]*/g;

function words(text: string): string[] {
  return text.match(WORD) ?? [];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

/** Escapes a mined pattern so punctuation in it cannot act as regex syntax. */
function escape(pattern: string): string {
  return pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word bounded, case insensitive search. `\b` is wrong for patterns that start
 * or end in punctuation, which several mined terms do, so the boundary is only
 * applied on the side where the pattern has a word character.
 */
function findPattern(draft: string, pattern: string): { index: number; matched: string } | null {
  const p = escape(pattern.trim());
  if (!p) return null;
  const left = /^[A-Za-z0-9]/.test(pattern) ? "\\b" : "";
  const right = /[A-Za-z0-9]$/.test(pattern) ? "\\b" : "";
  const re = new RegExp(`${left}${p}${right}`, "i");
  const m = re.exec(draft);
  return m ? { index: m.index, matched: m[0] } : null;
}

/** The matched string with a little surrounding text, so evidence is legible. */
function withContext(draft: string, index: number, matched: string, pad = 34): string {
  const start = Math.max(0, index - pad);
  const end = Math.min(draft.length, index + matched.length + pad);
  const lead = start > 0 ? "..." : "";
  const tail = end < draft.length ? "..." : "";
  return `${lead}${draft.slice(start, end).replace(/\s+/g, " ").trim()}${tail}`;
}

/* ------------------------------------------------------------------ U6.1 -- */

/**
 * Prohibited jargon. Only a literal pattern can fail a draft: the term is in the
 * text or it is not. A conditional term is reported for confirmation, because
 * the source bans it in a case no regex can see. A conceptual term has no string
 * at all and is declared for the layer above.
 */
export function checkProhibitedJargon(draft: string, situation: SituationId, jurisdiction: JurisdictionId | null = null) {
  const genre = genreFor(situation);
  const authority = authorityFor(genre.checklistStatus);
  const flags: Flag[] = [];
  const undecided: Undecided[] = [];

  for (const term of genre.prohibitedJargon) {
    if (!applies(situation, jurisdiction, term.sourceFile, term.why)) continue;
    const m = term.match;

    if (m.kind === "conceptual") {
      undecided.push({
        check: "prohibited_jargon",
        item: term.term,
        reason: m.reason,
        sourceFile: term.sourceFile,
      });
      continue;
    }

    for (const pattern of m.patterns) {
      const hit = findPattern(draft, pattern);
      if (!hit) continue;

      const evidence = [withContext(draft, hit.index, hit.matched)];

      if (m.kind === "conditional") {
        undecided.push({
          check: "prohibited_jargon",
          item: `${term.term}: ${evidence[0]}`,
          reason: m.condition,
          sourceFile: term.sourceFile,
        });
      } else {
        flags.push({
          check: "prohibited_jargon",
          // An advisory genre never produces a fail from this check.
          level: authority === "L0" ? "fail" : "warn",
          message: `${term.term} is not for this reader. ${term.why}`,
          evidence,
        });
      }
      break; // one report per term, not one per occurrence
    }
  }

  return { flags, undecided };
}

/* ------------------------------------------------------- U8.1 to U8.3 ----- */

function countUnit(draft: string, unit: string): number | null {
  if (unit === "words") return words(draft).length;
  if (unit === "sentences") {
    const parts = draft.split(/(?<=[.!?])\s+(?=[A-Z"'(])/).filter((s) => s.trim().length > 1);
    return parts.length;
  }
  // pages, slides and minutes are properties of a rendered artifact, not of text
  return null;
}

/**
 * Field lists match on function rather than on the exact heading. The corpus
 * carries the same section as "What We Are Doing" in four specimens and as
 * "What Is Being Done?" in a fifth, so a literal match would fail a compliant
 * notice. A field counts as present when its distinctive words appear.
 */
function fieldPresent(draft: string, field: string): boolean {
  const stop = new Set(["what", "the", "we", "are", "is", "was", "and", "of", "to", "a", "an", "for", "your", "our", "you", "in", "on", "it", "that", "this", "be", "been", "has", "have", "will", "how", "why", "when", "who"]);
  const key = words(field).map((w) => w.toLowerCase()).filter((w) => !stop.has(w) && w.length > 2);
  if (key.length === 0) return normalize(draft).includes(normalize(field));
  const hay = normalize(draft);
  const hits = key.filter((w) => hay.includes(w)).length;
  // a field is present when most of its distinctive words are
  return hits / key.length >= 0.6;
}

export function checkFormatConstants(draft: string, situation: SituationId, jurisdiction: JurisdictionId | null = null) {
  const genre = genreFor(situation);
  const authority = authorityFor(genre.checklistStatus);
  const flags: Flag[] = [];
  const undecided: Undecided[] = [];
  const declared: DeclaredContext[] = [];

  for (const c of genre.formatConstants) {
    if (!applies(situation, jurisdiction, c.sourceFile, c.rule)) continue;
    // A deadline is a property of the process, and a controlled template needs
    // structure this checker does not have. Both are stated, never judged.
    if (c.kind === "clock" || c.kind === "template") {
      declared.push({ rule: c.rule, value: c.value, kind: c.kind, sourceFile: c.sourceFile });
      continue;
    }

    if (c.kind === "length") {
      if (!c.limit?.measurable) {
        declared.push({ rule: c.rule, value: c.value, kind: c.kind, sourceFile: c.sourceFile });
        continue;
      }
      const measured = countUnit(draft, c.limit.unit);
      if (measured === null) {
        declared.push({ rule: c.rule, value: c.value, kind: c.kind, sourceFile: c.sourceFile });
        continue;
      }
      if (measured > c.limit.max) {
        flags.push({
          check: "format_constants",
          level: authority === "L0" ? "fail" : "warn",
          message: `${c.rule}. This draft runs to ${measured} ${c.limit.unit}.`,
          evidence: [`${measured} ${c.limit.unit} against a limit of ${c.limit.max}`],
        });
      }
      continue;
    }

    // fields
    if (!c.fields || c.fields.length === 0) {
      declared.push({ rule: c.rule, value: c.value, kind: c.kind, sourceFile: c.sourceFile });
      continue;
    }
    const missing = c.fields.filter((f) => !fieldPresent(draft, f));
    if (missing.length > 0) {
      flags.push({
        check: "format_constants",
        level: authority === "L0" ? "fail" : "warn",
        message: `${c.rule}. Nothing in the draft covers ${missing.length === 1 ? "this section" : "these sections"}.`,
        evidence: missing,
      });
    }
  }

  return { flags, undecided, declared };
}

/* ------------------------------------------------------------------ U1.1 -- */

/**
 * A literal signal is the trace an answer must leave regardless of how it is
 * worded. A question about when cannot be answered without a date or a duration
 * somewhere in the draft; one about how many cannot be answered without a
 * number. Absence of the signal is evidence the question went unanswered.
 * Presence is not evidence that it was answered well, which is why a present
 * signal still goes to the layer above.
 */
type Signal = { kind: "date" | "quantity" | "identifier"; test: (d: string) => boolean };

const HAS_DATE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)|(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\d+\s+(hours?|days?|weeks?|months?|business days?))\b/i;
const HAS_QUANTITY = /\b\d[\d,.]*\s*(%|percent)?\b/;
const HAS_IDENTIFIER = /\b(CVE-\d{4}-\d{4,7}|CWE-\d+|GHSA-[\w-]+|ICSA-[\w-]+)\b/i;

function signalFor(question: string): Signal | null {
  const q = question.toLowerCase();
  if (/\bwhen\b|\bdate\b|\btimeline\b|\bhow long\b|\bdeadline\b|\bby when\b/.test(q)) {
    return { kind: "date", test: (d) => HAS_DATE.test(d) };
  }
  if (/\bhow many\b|\bhow much\b|\bnumber of\b|\bcount\b|\bscope\b|\bhow far\b/.test(q)) {
    return { kind: "quantity", test: (d) => HAS_QUANTITY.test(d) };
  }
  if (/\bwhich (cve|identifier|advisory)\b|\bcve\b|\bidentifier\b/.test(q)) {
    return { kind: "identifier", test: (d) => HAS_IDENTIFIER.test(d) };
  }
  return null;
}

const SIGNAL_LABEL: Record<Signal["kind"], string> = {
  date: "no date or duration appears anywhere in the draft",
  quantity: "no number appears anywhere in the draft",
  identifier: "no identifier appears anywhere in the draft",
};

export function checkReaderQuestions(draft: string, situation: SituationId, jurisdiction: JurisdictionId | null = null) {
  const genre = genreFor(situation);
  const authority = authorityFor(genre.checklistStatus);
  const flags: Flag[] = [];
  const undecided: Undecided[] = [];

  const mandatory: GenreQuestion[] = genre.questions.filter(
    (q) => q.mandatory && applies(situation, jurisdiction, q.source, q.sourceFile),
  );

  for (const q of mandatory) {
    const signal = signalFor(q.question);

    if (signal && !signal.test(draft)) {
      flags.push({
        check: "reader_questions",
        level: authority === "L0" ? "fail" : "warn",
        message: `${q.question} Required by ${q.source}.`,
        evidence: [SIGNAL_LABEL[signal.kind]],
      });
      continue;
    }

    // Either there is no literal signal, or the signal is present and only says
    // the answer is possible. Whether it was actually answered is judgement.
    undecided.push({
      check: "reader_questions",
      item: q.question,
      reason: signal
        ? "the draft carries the kind of fact this question needs, but whether it answers the question is a judgement"
        : "no literal signal can stand for this answer",
      source: q.source,
      sourceFile: q.sourceFile,
    });
  }

  return { flags, undecided };
}

/* ------------------------------------------------------------------ run --- */

export function runGenreChecks(
  draft: string,
  situation: SituationId,
  jurisdiction: JurisdictionId | null = null,
): GenreReport {
  const genre = genreFor(situation);
  const authority = authorityFor(genre.checklistStatus);

  const jargon = checkProhibitedJargon(draft, situation, jurisdiction);
  const format = checkFormatConstants(draft, situation, jurisdiction);
  const questions = checkReaderQuestions(draft, situation, jurisdiction);

  const flags = [...questions.flags, ...jargon.flags, ...format.flags];
  const undecided = [...questions.undecided, ...jargon.undecided, ...format.undecided];
  const fired = new Set(flags.map((f) => f.check));

  return {
    situation,
    authority,
    advisoryNote:
      authority === "L0"
        ? null
        : `No body publishes a checklist for this genre, so nothing here is a verdict. ${genre.checklistNote}`,
    passed: GENRE_CHECKS.filter((c) => !fired.has(c)),
    flags,
    undecided,
    declared: format.declared,
  };
}
