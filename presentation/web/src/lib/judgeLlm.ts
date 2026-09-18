/* The layers above the rule layer.
 *
 * The deterministic checks in judge.ts and genreChecks.ts fail only by showing
 * the string that made them fail. That is the whole reason they are allowed to
 * decide anything. A model cannot make that promise: it can produce a fluent
 * sentence about a passage that is not in the text, and a checker that renders
 * that sentence as evidence would be doing the exact thing this project exists
 * to name.
 *
 * So the model here is never trusted for the part that can be verified. It is
 * asked to answer WITH QUOTES, and every quote it returns is anchored back into
 * the text it claims to come from by literal substring match. An anchored quote
 * is rendered as the real span from the source, never as the model's copy of it.
 * An unanchored quote is reported as unanchored and its verdict is demoted. The
 * count of unanchored quotes ships with the report, because a model that cannot
 * point at the text is telling you something about the answer.
 *
 * Two jobs run in one call, and they answer to different layers:
 *
 *   L1, entailment. Is each claim the draft makes supported by the finding?
 *   This is the fidelity axis: D2 facts, D3 severity, D4 caveats. It is the
 *   half a rule already covers well when the fact is a literal, and covers not
 *   at all when the fact is a paraphrase.
 *
 *   L2, judgement. The items the rule layer surfaced as undecidable: reader
 *   questions no literal signal can stand for, and jargon classes that ban a
 *   kind of language rather than a string. This is the utility axis, D1 and D6.
 *
 * Nothing here returns a pass. A claim nobody flagged is a non detection.
 */

import { complete, LlmError, type JsonSchema } from "./llm";
import type { Undecided } from "./genreChecks";
import type { SituationId } from "@/content/rubric";
import { genreFor } from "@/content/genres";

export { LlmError };

/* ------------------------------------------------------------- anchoring -- */

/** Collapse runs of whitespace so a quote survives re-wrapping by the model. */
function flatten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Find the model's quote in the text it claims to come from, and return the
 * REAL span rather than the model's copy of it. Matching ignores whitespace
 * runs and case, because models re-wrap and re-case constantly, but it will not
 * match a paraphrase, which is the point.
 *
 * Returns null when the quote is not in the text. That is not a failure of the
 * search, it is a finding about the answer.
 */
export function anchor(haystack: string, needle: string | null | undefined): string | null {
  if (!needle) return null;
  const flatNeedle = flatten(needle);
  if (flatNeedle.length < 4) return null;

  /* Walk the original text and build a flattened copy alongside a map back to
     original offsets, so the span returned is verbatim, punctuation and line
     breaks included. */
  const offsets: number[] = [];
  let flat = "";
  let pendingSpace = false;
  for (let i = 0; i < haystack.length; i++) {
    const ch = haystack[i];
    if (/\s/.test(ch)) {
      pendingSpace = flat.length > 0;
      continue;
    }
    if (pendingSpace) {
      flat += " ";
      offsets.push(i);
      pendingSpace = false;
    }
    flat += ch;
    offsets.push(i);
  }

  const at = flat.toLowerCase().indexOf(flatNeedle.toLowerCase());
  if (at === -1) return null;
  const start = offsets[at];
  const end = offsets[Math.min(at + flatNeedle.length - 1, offsets.length - 1)];
  return haystack.slice(start, end + 1);
}

/* ----------------------------------------------------------------- types -- */

export type Support = "supported" | "contradicted" | "absent";

/** One claim the draft makes, judged against the finding. L1. */
export type ClaimVerdict = {
  /** The claim, as the model quoted it out of the draft. */
  claim: string;
  /** The same claim as it literally appears in the draft, when it is there. */
  claimSpan: string | null;
  support: Support;
  /** The passage of the finding that settles it, verbatim, when it is there. */
  sourceSpan: string | null;
  note: string;
  /** True when both quotes were found in the texts they were claimed from. */
  anchored: boolean;
};

/** One reader question the rules could not settle. L2. */
export type QuestionVerdict = {
  question: string;
  answered: boolean;
  draftSpan: string | null;
  note: string;
  /** Who requires the question, carried through from the genre list. */
  source?: string;
  anchored: boolean;
};

/** One prohibited class of language, judged as a class rather than a string. L2. */
export type JargonVerdict = {
  /** The class the corpus bans, in the corpus's own words. */
  className: string;
  present: boolean;
  draftSpan: string | null;
  note: string;
  source?: string;
  anchored: boolean;
};

export type JudgementReport = {
  provider: string;
  model: string;
  situation: SituationId;
  /** L2 when no body publishes a checklist for this genre. */
  authority: "L0" | "L2";
  claims: ClaimVerdict[];
  questions: QuestionVerdict[];
  jargon: JargonVerdict[];
  /** How many quotes the model produced that are not in the text it named. */
  unanchored: number;
  /** Items the rule layer surfaced that were not sent, and why. */
  omitted: { kind: "question" | "jargon"; count: number } | null;
};

/* --------------------------------------------------------------- prompt -- */

/* A ceiling on how many undecidables go in one request. S05 alone carries 22.
   Sending all of them is affordable; sending an unbounded number is not, and a
   silently truncated list would be the same sin the checker exists to catch, so
   whatever is left out is counted and reported. */
const MAX_QUESTIONS = 24;
const MAX_JARGON = 16;

const SYSTEM = [
  "You judge whether a short executive summary is faithful to the technical security finding it was written from, and whether it serves the reader it was written for.",
  "",
  "You answer only with quotes. Every judgement you make must carry the exact words from the text it is about, copied character for character. Never paraphrase inside a quote field. If you cannot find words that settle a point, say so and leave the quote empty rather than inventing one: an empty quote is an acceptable answer and a fabricated one is not.",
  "",
  "You are not the only layer. Deterministic checks have already read both texts for identifiers, numbers, severity words, caveats and negations, and they have already reported what they found. Do not repeat them. Your job is the part a rule cannot reach: claims that are paraphrases rather than literals, questions that have no keyword, and language that is banned as a class rather than as a string.",
  "",
  "Never say the text is good, correct, approved or safe. You report what you found. Silence from you is not a verdict.",
].join("\n");

const SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["claims", "questions", "jargon"],
  properties: {
    claims: {
      type: "array",
      description:
        "Each substantive claim the draft makes about the finding, judged against the finding. Skip pure connective sentences.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "support", "source_quote", "note"],
        properties: {
          claim: { type: "string", description: "The claim, copied verbatim from the draft." },
          support: {
            type: "string",
            enum: ["supported", "contradicted", "absent"],
            description:
              "supported: the finding states or entails it. contradicted: the finding states the opposite. absent: the finding neither states nor entails it.",
          },
          source_quote: {
            type: "string",
            description:
              "The passage of the FINDING that settles this claim, copied verbatim. Empty string when support is absent.",
          },
          note: { type: "string", description: "One sentence. What the difference is. No advice." },
        },
      },
    },
    questions: {
      type: "array",
      description: "One entry per question given to you, in the same order, none skipped.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answered", "draft_quote", "note"],
        properties: {
          question: { type: "string", description: "The question, copied from the list given to you." },
          answered: { type: "boolean", description: "Does the draft answer it, in substance?" },
          draft_quote: {
            type: "string",
            description: "The words in the DRAFT that answer it, verbatim. Empty string when it is unanswered.",
          },
          note: { type: "string", description: "One sentence. What is answered or what is missing." },
        },
      },
    },
    jargon: {
      type: "array",
      description: "One entry per banned class given to you, in the same order, none skipped.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["class_name", "present", "draft_quote", "note"],
        properties: {
          class_name: { type: "string", description: "The class, copied from the list given to you." },
          present: { type: "boolean", description: "Does the draft use language of this class?" },
          draft_quote: {
            type: "string",
            description: "The words in the DRAFT that belong to the class, verbatim. Empty string when absent.",
          },
          note: { type: "string", description: "One sentence." },
        },
      },
    },
  },
};

type RawClaim = { claim: string; support: string; source_quote: string; note: string };
type RawQuestion = { question: string; answered: boolean; draft_quote: string; note: string };
type RawJargon = { class_name: string; present: boolean; draft_quote: string; note: string };
type RawAnswer = { claims?: RawClaim[]; questions?: RawQuestion[]; jargon?: RawJargon[] };

function isSupport(v: string): v is Support {
  return v === "supported" || v === "contradicted" || v === "absent";
}

/* ------------------------------------------------------------------ run -- */

export type JudgementRequest = {
  source: string;
  draft: string;
  situation: SituationId;
  /** What the rule layer could not settle. Drives the L2 half of the prompt. */
  undecided: Undecided[];
  signal?: AbortSignal;
};

/**
 * One call. Throws LlmError, including "no-key", which the caller should render
 * as the key panel rather than as an error.
 */
export async function runJudgement(req: JudgementRequest): Promise<JudgementReport> {
  const genre = genreFor(req.situation);

  const questionItems = req.undecided.filter((u) => u.check === "reader_questions");
  const jargonItems = req.undecided.filter((u) => u.check === "prohibited_jargon");
  const sentQuestions = questionItems.slice(0, MAX_QUESTIONS);
  const sentJargon = jargonItems.slice(0, MAX_JARGON);
  const dropped = questionItems.length - sentQuestions.length + (jargonItems.length - sentJargon.length);

  const prompt = [
    `WHAT IS BEING WRITTEN: ${genre.reader ? genre.reader : req.situation}`,
    "",
    "THE FINDING, as filed:",
    "<<<FINDING",
    req.source,
    "FINDING",
    "",
    "THE DRAFT, written from it:",
    "<<<DRAFT",
    req.draft,
    "DRAFT",
    "",
    sentQuestions.length > 0
      ? [
          "QUESTIONS THIS READER IS ENTITLED TO HAVE ANSWERED.",
          "These come from published guidance for this genre. Judge each one against the draft.",
          ...sentQuestions.map((q, i) => `${i + 1}. ${q.item}`),
        ].join("\n")
      : "",
    "",
    sentJargon.length > 0
      ? [
          "CLASSES OF LANGUAGE THIS GENRE BANS.",
          "Each bans a kind of language, not a fixed string, which is why no rule could settle it. Judge each one against the draft.",
          ...sentJargon.map((j, i) => `${i + 1}. ${j.item}`),
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await complete<RawAnswer>({
    system: SYSTEM,
    prompt,
    schema: SCHEMA,
    schemaName: "legible_judgement",
    signal: req.signal,
  });

  return {
    provider: res.provider,
    model: res.model,
    ...mapAnswer({
      raw: res.data ?? {},
      source: req.source,
      draft: req.draft,
      situation: req.situation,
      authority: genre.checklistStatus === "published" ? "L0" : "L2",
      sentQuestions,
      sentJargon,
      dropped,
    }),
  };
}

/**
 * The mapping, lifted out of the request so it can be exercised without a
 * provider. This is where a hallucinated quote either gets caught or gets
 * rendered as evidence, so it is the half that has to be testable on its own.
 */
export function mapAnswer(args: {
  raw: RawAnswer;
  source: string;
  draft: string;
  situation: SituationId;
  authority: "L0" | "L2";
  sentQuestions: Undecided[];
  sentJargon: Undecided[];
  dropped: number;
}): Omit<JudgementReport, "provider" | "model"> {
  const { raw, source, draft, sentQuestions, sentJargon, dropped } = args;
  let unanchored = 0;

  const claims: ClaimVerdict[] = (raw.claims ?? []).map((c) => {
    const claimSpan = anchor(draft, c.claim);
    const sourceSpan = anchor(source, c.source_quote);
    /* A claim quote that is not in the draft is always a miss. A source quote is
       only expected when the model says the finding settles the claim. */
    const expectsSource = c.support === "supported" || c.support === "contradicted";
    const ok = claimSpan !== null && (!expectsSource || sourceSpan !== null);
    if (!ok) unanchored += 1;
    return {
      claim: c.claim ?? "",
      claimSpan,
      support: isSupport(c.support) ? c.support : "absent",
      sourceSpan,
      note: c.note ?? "",
      anchored: ok,
    };
  });

  const questions: QuestionVerdict[] = (raw.questions ?? []).map((q, i) => {
    const draftSpan = anchor(draft, q.draft_quote);
    /* A quote is only owed when the model says the question IS answered. */
    const ok = !q.answered || draftSpan !== null;
    if (!ok) unanchored += 1;
    return {
      question: q.question ?? sentQuestions[i]?.item ?? "",
      answered: Boolean(q.answered),
      draftSpan,
      note: q.note ?? "",
      source: sentQuestions[i]?.source,
      anchored: ok,
    };
  });

  const jargon: JargonVerdict[] = (raw.jargon ?? []).map((j, i) => {
    const draftSpan = anchor(draft, j.draft_quote);
    const ok = !j.present || draftSpan !== null;
    if (!ok) unanchored += 1;
    return {
      className: j.class_name ?? sentJargon[i]?.item ?? "",
      present: Boolean(j.present),
      draftSpan,
      note: j.note ?? "",
      source: sentJargon[i]?.source,
      anchored: ok,
    };
  });

  return {
    situation: args.situation,
    authority: args.authority,
    claims,
    questions,
    jargon,
    unanchored,
    omitted: dropped > 0 ? { kind: "question", count: dropped } : null,
  };
}

/* --------------------------------------------------------------- digest -- */

/** What the panel header states before anything is expanded. */
export function digest(r: JudgementReport): {
  contradicted: number;
  absent: number;
  unanswered: number;
  jargonPresent: number;
  total: number;
} {
  const contradicted = r.claims.filter((c) => c.support === "contradicted").length;
  const absent = r.claims.filter((c) => c.support === "absent").length;
  const unanswered = r.questions.filter((q) => !q.answered).length;
  const jargonPresent = r.jargon.filter((j) => j.present).length;
  return {
    contradicted,
    absent,
    unanswered,
    jargonPresent,
    total: contradicted + absent + unanswered + jargonPresent,
  };
}
