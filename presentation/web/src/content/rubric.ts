// The LEGIBLE rubric, v0.1, as structured content.
//
// The rubric is the definition the rest of the project is built around: what it
// means to communicate a security finding well or badly. The benchmark scores
// against it and the checker implements it. This file is only the content the
// site renders. No thresholds, no verdicts and no scoring logic live here.
//
// The record of the rubric is RUBRICA_v0.1.md, written in Spanish. This module
// is the English translation, kept as data rather than prose so a component can
// render a dimension as a card, a table row, a checklist or a column without
// parsing sentences back apart. Translation choices that were not mechanical are
// noted next to the field they affect.
//
// Two things here are claims the Spanish source implies but never states, and
// both are marked where they appear: `weightLegend[3].contrast` and
// `versionProvenance`.

import * as f from "./facts";

// ---------------------------------------------------------------------------
// Version and provenance
// ---------------------------------------------------------------------------

/*
 * The review corpus is a different body of documents from the pair dataset, so
 * its counts are not in @/content/facts and are stated here. The pair count is
 * never restated: it comes from facts.
 */
const REVIEW_DOCUMENTS = 237;
const REVIEW_SITUATIONS = 11;
const REVIEW_SOURCE_TYPES = 6;

export const rubricMeta = {
  version: "0.1",
  label: "v0.1",
  /** First formalization. Date of the source document. */
  date: "2026-08-30",
  title: "Fidelity and utility in the communication of security findings",
  /** What the rubric answers, given a source text and a translation of it. */
  question:
    "Given a source text, a technical finding, alert, incident or report, and a translation of it addressed to a different audience: is the translation faithful to the original and useful to its reader?",
  derivedFrom: {
    reviewDocuments: REVIEW_DOCUMENTS,
    reviewSituations: REVIEW_SITUATIONS,
    reviewSourceTypes: REVIEW_SOURCE_TYPES,
    pairs: f.PAIRS,
    summary: `${REVIEW_DOCUMENTS} industry documents, ${REVIEW_SITUATIONS} situations by ${REVIEW_SOURCE_TYPES} source types, plus analysis of the project's own dataset of ${f.formatCount(f.PAIRS)} technical to executive pairs.`,
    traceability:
      "Per dimension traceability lives in the Master Guide and in the extraction spreadsheets.",
  },
} as const;

/**
 * How v0.1 was actually sourced, which is not how the method describes itself.
 *
 * This is not in the Spanish source. It belongs on the page anyway: the method
 * claims two independent sources validating each other, and v0.1 has one. A
 * project whose subject is not claiming more than the evidence supports cannot
 * make that particular omission.
 */
export const versionProvenance = {
  status: "single-sourced" as const,
  claimedMethod:
    "Double sourcing: what practitioners say about this work, and what they do across the corpus of pairs. Where the two agree a dimension is solid; where they disagree there is a finding.",
  declarativeHalf: {
    label: "What practitioners say",
    state: "done" as const,
    detail:
      `${REVIEW_DOCUMENTS} collected documents in which the industry teaches, exemplifies, requires and criticizes how security is communicated. Guides, templates, readers stating what they need, and teardowns. Explicit evidence, citable.`,
  },
  behaviouralHalf: {
    label: "What practitioners do",
    state: "pending" as const,
    detail: `The ${f.formatCount(f.PAIRS)} pairs read for behaviour: what was kept, what was dropped, how the register changed. Implicit evidence, and it has to be inferred. This exercise has not been run.`,
  },
  statement: `Version 0.1 derives from the declarative half only. Every dimension and every weight in it rests on one source, not two. The validation against the ${f.formatCount(f.PAIRS)} pairs is a pending exercise, and until it is run the mutual validation the method describes has not happened.`,
} as const;

// ---------------------------------------------------------------------------
// The two axes
// ---------------------------------------------------------------------------

export type AxisId = "F" | "U";

export type Axis = {
  id: AxisId;
  name: string;
  /** What this axis holds the translation to. */
  definition: string;
};

export const axes: Record<AxisId, Axis> = {
  F: {
    id: "F",
    name: "Fidelity",
    definition:
      "What the translation may not lose or distort from the original: numbers, severity, scope, caveats, uncertainty.",
  },
  U: {
    id: "U",
    name: "Decision utility",
    definition:
      "What the translation owes its actual reader: answering the reader's questions, ending in an action, speaking the reader's language.",
  },
};

export const axisOrder: AxisId[] = ["F", "U"];

/** The load-bearing reason the two axes are measured apart. */
export const axisIndependence = {
  headline: "Two axes, measured separately, because they fail separately.",
  claim:
    "A text can be entirely faithful and entirely useless, or highly useful and unfaithful. Both are failures.",
} as const;

/** Label for a dimension that sits on one axis or on both. */
export function axisLabel(ids: AxisId[]): string {
  if (ids.length === 1) return `Axis ${ids[0]}`;
  return `Axes ${ids.join(" and ")}`;
}

// ---------------------------------------------------------------------------
// The four measurement layers
// ---------------------------------------------------------------------------

export type LayerId = "L0" | "L1" | "L2" | "H";

export type Layer = {
  id: LayerId;
  name: string;
  /** What the layer is. */
  definition: string;
  /** What a result from this layer is allowed to be called. */
  mayConclude: string;
  /** What it has to show when it reports. */
  evidenceRule: string;
};

/*
 * Section 2 of the source is titled "measurement contract (zero false
 * authority)". "Zero false authority" is the term the project already uses in
 * English for the same contract in the judge, so it is kept.
 */
export const measurementContract = {
  name: "Measurement contract",
  subtitle: "Zero false authority",
  rule: "Every check declares its measurement layer, and the layer defines how much authority its verdict carries.",
  escalation:
    "What a layer cannot decide is passed up to a higher layer or marked as requiring review. It is never passed silently.",
} as const;

export const layers: Record<LayerId, Layer> = {
  L0: {
    id: "L0",
    name: "Deterministic",
    definition: "Rules that can be verified with certainty.",
    mayConclude:
      "A pass means the property was genuinely checked. A fail is a fact, not an opinion.",
    evidenceRule:
      "It may only fail by showing the exact string that made it fail.",
  },
  L1: {
    id: "L1",
    name: "Entailment and embeddings",
    definition: "Sentence by sentence support checked against the source text.",
    mayConclude: "A finding reported with a confidence score, not a verdict.",
    evidenceRule: "It reports the score alongside the sentence it scored.",
  },
  L2: {
    id: "L2",
    name: "LLM judgement",
    definition: "Qualitative judgements that no rule and no entailment check can make.",
    mayConclude:
      "An opinion. It is always marked as an opinion and never presented as a verdict.",
    evidenceRule: "It includes the evidence that motivated the opinion.",
  },
  H: {
    id: "H",
    name: "Human",
    definition: "What no layer automates honestly.",
    mayConclude:
      "Nothing automatic. The rubric declares this rather than pretending to measure it.",
    evidenceRule: "It is stated as a declared limit, not reported as a result.",
  },
};

export const layerOrder: LayerId[] = ["L0", "L1", "L2", "H"];

// ---------------------------------------------------------------------------
// The eight dimensions
// ---------------------------------------------------------------------------

export type DimensionId = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8";

export type Check = {
  /** Stable id, axis letter plus dimension number plus check number, e.g. "F2.2". */
  id: string;
  /** The layers the check runs at. Two layers means the check splits by case. */
  layers: LayerId[];
  text: string;
  /** Present when the source qualifies when the check runs at which layer. */
  note?: string;
};

/**
 * The two directions a bidirectional dimension fails in. Three of the eight
 * dimensions fail by excess and by defect, and the source marks that on the
 * dimension itself, so it is a field here and not a sentence inside `grounding`.
 */
export type Bidirectional = {
  /** Failure by doing too much of the thing. */
  excess: string;
  /** Failure by doing too little of it. */
  defect: string;
};

export type Dimension = {
  id: DimensionId;
  /** 1 to 8, for display where the id would be redundant. */
  number: number;
  name: string;
  /** Row label for the weights table and other narrow columns. */
  shortName: string;
  axes: AxisId[];
  /** Null when the dimension fails in one direction only. */
  bidirectional: Bidirectional | null;
  question: string;
  /** Why the dimension exists: the evidence that produced it. */
  grounding: string;
  checks: Check[];
  /** How a result on this dimension is expressed. */
  scale: string;
  /** What a verdict on this dimension has to show. */
  evidence: string;
  /** A note about the translation or about an inconsistency in the source. */
  sourceNote?: string;
};

export const dimensions: Dimension[] = [
  {
    id: "D1",
    number: 1,
    name: "The reader's contract",
    shortName: "Reader contract",
    axes: ["U"],
    bidirectional: null,
    question:
      "Does the text answer the fixed questions its reader has, in the order the reader has them?",
    grounding:
      "Every situation has a reader with questions that can be enumerated and are often published. The board: are we protected, are we spending well, is there anything material to decide, what do you need from me. The regulator: the ICO checklist, SEC comment letters. The triager: seven fields. The next analyst: evidence, hypothesis, next action. The affected person: what do I do.",
    checks: [
      {
        id: "U1.1",
        layers: ["L0", "L2"],
        text: "Answer every question the genre requires of you, or say which one you are not answering.",
        note: "For genres with a published checklist (8-K, GDPR and the ICO, triage) this runs at L0 against the checklist. For the rest it runs at L2.",
      },
      {
        id: "U1.2",
        layers: ["L2"],
        text: "Put the answer first. The verdict opens the text, it does not close it.",
      },
    ],
    scale: "Coverage percentage of the genre's questions, plus pass or fail on BLUF.",
    evidence: "The unanswered question, or the position of the verdict.",
  },
  {
    id: "D2",
    number: 2,
    name: "Survival of facts with their frame",
    shortName: "Facts and frame",
    axes: ["F"],
    bidirectional: null,
    question: "Do the material facts survive with the context needed to interpret them?",
    grounding:
      "Numbers, identifiers, dates, assets, versions. And the new finding from the research: a number without its frame of reference, meaning its trend, target, comparison or method of calculation, is degraded information. “47 servers” that becomes “several servers” is omission. “MFA at 92%” that loses “against a 98% target and falling” is distortion, even though the number itself survived.",
    checks: [
      {
        id: "F2.1",
        layers: ["L0"],
        text: "Carry every number, identifier, date, host and version across, or declare the ones you dropped.",
      },
      {
        id: "F2.2",
        layers: ["L0", "L1"],
        text: "Carry each number's frame with it: its trend, its target, its baseline, its unit.",
      },
      {
        id: "F2.3",
        layers: ["L1", "L2"],
        text: "Keep \u201chow was this calculated\u201d answerable for every figure you state.",
      },
    ],
    scale: "Percentage of facts preserved, percentage of frames preserved.",
    evidence: "The list of what survived, what disappeared, and what lost its frame.",
  },
  {
    id: "D3",
    number: 3,
    name: "Severity and risk calibration",
    shortName: "Severity",
    axes: ["F"],
    bidirectional: {
      excess:
        "Inflating. It destroys credibility through threat fatigue, the security leader who cried wolf, and FUD, and it contaminates ecosystems.",
      defect:
        "Softening. It creates legal exposure, which is the SEC and SolarWinds pattern.",
    },
    question:
      "Does the severity the text conveys match the severity of the original, without softening and without inflating?",
    grounding:
      "Softening creates legal exposure (the SEC, SolarWinds) and inflating destroys credibility (threat fatigue, the security leader who cried wolf, FUD) and contaminates ecosystems: in the curl case, CVE-2020-19909, third parties assigned critical severity to a bug that was not a security bug, against the maintainer's own analysis. Severity is not priority (IEEE 1044). They are different judgements and conflating them is an error.",
    checks: [
      {
        id: "F3.1",
        layers: ["L0"],
        text: "Do not move the severity band. Critical stays critical, Low stays low.",
      },
      {
        id: "F3.2",
        layers: ["L2"],
        text: "Match the tone to the band you were given.",
      },
      {
        id: "F3.3",
        layers: ["L0", "L2"],
        text: "Keep severity and priority apart. If you turn one into the other, say so.",
      },
    ],
    scale: "Preserved, softened or inflated, per finding.",
    evidence: "The sentence that softens or inflates.",
  },
  {
    id: "D4",
    number: 4,
    name: "Declared uncertainty and the temporal contract",
    shortName: "Uncertainty and time",
    axes: ["F"],
    bidirectional: null,
    question:
      "Is what is not known declared, and does the text honour the clock its genre runs on?",
    grounding:
      "A practice four or more independent genres converge on. MITRE has standard vocabulary for the unknown. The SEC requires declaring now and amending later, and penalizes boilerplate. The ICO puts the 72 hours above completeness. Mature operators keep a fixed cadence even when there is nothing new: “we are still testing the fix” is a valid update, and silence is a failure.",
    checks: [
      {
        id: "F4.1",
        layers: ["L1"],
        text: "Carry every condition across: only with local access, no evidence of exploitation.",
      },
      {
        id: "F4.2",
        layers: ["L0", "L1"],
        text: "Say what is unknown in plain words. Do not let uncertainty harden into certainty.",
      },
      {
        id: "F4.3",
        layers: ["L0"],
        text: "State where you are on the clock: what is known now, and when the next update comes.",
      },
      {
        id: "F4.4",
        layers: ["L1", "L2"],
        text: "Do not promise upward more than was tested. A tabletop is not a proven recovery.",
      },
    ],
    scale: "Percentage of caveats with a counterpart, plus pass or fail on the temporal check.",
    evidence: "The orphaned caveat, the manufactured certainty, the ignored clock.",
  },
  {
    id: "D5",
    number: 5,
    name: "Density and selection by materiality",
    shortName: "Density and materiality",
    axes: ["F", "U"],
    bidirectional: {
      excess:
        "The dump. Over-reporting obscures what is distinctive, and detail overloads and frightens the reader of a breach letter.",
      defect:
        "The one-liner without context. Under-reporting breaks matching, and accidental omission of what is material is the failure the dimension is named for.",
    },
    question: "Does the text contain what is material, and only what is material, for its reader?",
    grounding:
      "The two mirror failures, documented in four independent situations: the one-liner with no context and the dump of 800 lines. Under-reporting breaks matching and over-reporting obscures what is distinctive (MITRE). Overload frightens the reader of a breach letter. The critical few (NACD). Activity reports bore the board. Deliberate, declared omission is a virtue. Accidental omission of what is material is the failure.",
    checks: [
      {
        id: "F5.1",
        layers: ["L1", "L2"],
        text: "Cover every material finding, or say which one you left out and why.",
      },
      {
        id: "U5.2",
        layers: ["L2"],
        text: "Cut what does not carry risk: activity in place of risk, framework percentages, background.",
      },
      {
        id: "F5.3",
        layers: ["L1"],
        text: "Write nothing the source does not support.",
      },
    ],
    scale: "Coverage of what is material as a percentage, plus inventions as pass or fail.",
    evidence: "The finding that was not covered, the filler pointed at, the sentence with no support.",
  },
  {
    id: "D6",
    number: 6,
    name: "Register and specificity by audience",
    shortName: "Register and specificity",
    axes: ["U"],
    bidirectional: {
      excess:
        "Technical detail the reader cannot use: geek speak in front of a board, excluding technicality in front of the public, histrionics in place of proportion.",
      defect:
        "Resolution the reader cannot act on: empty abstraction in front of a board, and for the engineer, “harden AD”, which is an intention and not an instruction.",
    },
    question:
      "Do the level of abstraction, the jargon and the specificity match the actor who is reading?",
    grounding:
      "The failure is bidirectional at both ends of the gradient. For the board, neither geek speak nor empty abstraction: the observable symptom is perfunctory questions. For the engineer, the failure is a lack of resolution, since “harden AD” is an intention and not an instruction, and the real remediation is the exact GPO path. Translating is not simplifying: it is changing the resolution to the level the actor needs in order to act. For a public register: neither excluding technicality nor histrionics.",
    checks: [
      {
        id: "U6.1",
        layers: ["L0"],
        text: "Drop the words this reader cannot use. No raw CVSS in a board deck, no vagueness in a ticket.",
      },
      {
        id: "U6.2",
        layers: ["L2"],
        text: "Give this reader the resolution they need to act. The developer needs the endpoint, the director needs the consequence.",
      },
      {
        id: "U6.3",
        layers: ["L2"],
        text: "Neither dramatise nor soften.",
      },
    ],
    scale: "One to five, plus jargon violations as pass or fail.",
    evidence: "The term, the vagueness, or the mismatch pointed at.",
  },
  {
    id: "D7",
    number: 7,
    name: "Actionable ending",
    shortName: "Actionable ending",
    axes: ["U"],
    bidirectional: null,
    question: "Does the reader know what is being asked of them, or what happens next?",
    grounding:
      "A critical finding with no proposed remediation is a complaint. The board pattern ends in an explicit ask. Good reporting ends in an owner, a deadline and a decision. A ticket ends in a verifiable fix with a verification step. A handoff ends in a next action. A breach letter includes, by law, protective advice for the person affected (the ICO).",
    checks: [
      {
        id: "U7.1",
        layers: ["L0", "L1"],
        text: "End on the action the genre requires: an ask, an owner, a next step, a remediation, protective advice.",
      },
      {
        id: "U7.2",
        layers: ["L2"],
        text: "Make the action executable by this reader. Implement best practices is not an action.",
      },
    ],
    scale: "Pass or fail, plus quality from 0 to 2.",
    evidence: "The presence or absence of the element, or the action that cannot be executed.",
  },
  {
    id: "D8",
    number: 8,
    name: "Genre form",
    shortName: "Genre form",
    axes: ["U"],
    bidirectional: null,
    question:
      "Does the text respect the format constants its genre has already published?",
    grounding:
      "The industry has already fixed hard numbers: a two page memo for the board (NACD), one page within 24 hours for a material incident, an 8-K within four business days, 72 hours under GDPR, a cadence of 20 to 60 minutes during an active incident, five sections in an alert closure, seven triage fields, CVE grammar with a controlled attacker taxonomy, handovers of 12 or more items.",
    checks: [
      { id: "U8.1", layers: ["L0"], text: "Stay inside the length the genre allows." },
      { id: "U8.2", layers: ["L0"], text: "Include every mandatory field and section." },
      {
        id: "U8.3",
        layers: ["L0"],
        text: "Follow the controlled template where one exists, as CVE has.",
      },
    ],
    scale: "Pass or fail per rule.",
    evidence: "The rule, and the value that was measured.",
    sourceNote:
      "The source heads this dimension with its measurement layer, “pure deterministic layer”, instead of an axis. Its check identifiers (U8.1 to U8.3) put it on the utility axis, and that is what is recorded here.",
  },
];

export const dimensionIds: DimensionId[] = dimensions.map((d) => d.id);

export const dimensionsById: Record<DimensionId, Dimension> = Object.fromEntries(
  dimensions.map((d) => [d.id, d])
) as Record<DimensionId, Dimension>;

/** "L0", or "L0/L1" when a check splits across layers. Matches the source's notation. */
export function checkLayerLabel(check: Check): string {
  return check.layers.join("/");
}

// ---------------------------------------------------------------------------
// The eleven situations
// ---------------------------------------------------------------------------

export type SituationId =
  | "S01" | "S02" | "S03" | "S04" | "S05" | "S06"
  | "S07" | "S08" | "S09" | "S10" | "S11";

/**
 * The floor of the industry a situation belongs to. Not part of the rubric
 * document: it comes from the corpus design in the Master Guide, and it is here
 * because it is the only grouping the eleven columns have.
 */
export type SituationTier = "formal" | "managerial" | "operational" | "bridge" | "stress";

export type Situation = {
  id: SituationId;
  /** The two digit number the rubric and the corpus both use. */
  number: string;
  /** Column header for the weights table. */
  shortLabel: string;
  name: string;
  tier: SituationTier;
};

export const situations: Situation[] = [
  { id: "S01", number: "01", shortLabel: "Pentest", name: "Executive summary of a penetration test", tier: "bridge" },
  { id: "S02", number: "02", shortLabel: "Board", name: "CISO to the board", tier: "managerial" },
  { id: "S03", number: "03", shortLabel: "Sitrep", name: "Situation report during an active incident", tier: "operational" },
  { id: "S04", number: "04", shortLabel: "Postmortem", name: "Postmortem", tier: "managerial" },
  { id: "S05", number: "05", shortLabel: "Regulatory", name: "Regulatory notification", tier: "formal" },
  { id: "S06", number: "06", shortLabel: "Public breach", name: "Public communication of a breach", tier: "formal" },
  { id: "S07", number: "07", shortLabel: "Advisory/CVE", name: "Vendor advisory or CVE", tier: "formal" },
  { id: "S08", number: "08", shortLabel: "Tickets", name: "Tickets to engineering", tier: "operational" },
  { id: "S09", number: "09", shortLabel: "SOC", name: "Alert closure and SOC handoff", tier: "operational" },
  { id: "S10", number: "10", shortLabel: "Risk/Budget", name: "Risk acceptance and budget", tier: "managerial" },
  { id: "S11", number: "11", shortLabel: "Public", name: "General public", tier: "stress" },
];

export const situationIds: SituationId[] = situations.map((s) => s.id);

export const situationsById: Record<SituationId, Situation> = Object.fromEntries(
  situations.map((s) => [s.id, s])
) as Record<SituationId, Situation>;

// ---------------------------------------------------------------------------
// Weights: 8 dimensions by 11 situations
// ---------------------------------------------------------------------------

export type Weight = 1 | 2 | 3;

export type WeightLevel = {
  weight: Weight;
  label: string;
  /** What the weight asserts about a failure on that dimension. */
  meaning: string;
  /** Only on weight 3: the claim the legend is often mistaken for. */
  contrast?: string;
};

/*
 * The source's legend for 3 is "critical (a failure here invalidates the text)".
 * The parenthesis is the claim, not a gloss on the word critical, and it is a
 * stronger claim than a ranking of importance. `contrast` says so, because a
 * reader who reads 3 as "most important" reads the whole table wrong.
 */
export const weightLegend: Record<Weight, WeightLevel> = {
  3: {
    weight: 3,
    label: "Critical",
    meaning: "A failure on this dimension invalidates the text for this situation.",
    contrast:
      "Weight 3 is not a ranking of importance. It is a claim about consequence: the text does not survive a failure here, however good the rest of it is.",
  },
  2: { weight: 2, label: "High", meaning: "A failure here is serious and is reported as such." },
  1: {
    weight: 1,
    label: "Secondary",
    meaning: "Present in the situation, but secondary to the dimensions above it.",
  },
};

/**
 * The weights table, as rows of dimensions by columns of situations.
 *
 * The Record types are what guarantee the table is complete: a missing
 * dimension or a missing situation will not compile, and neither will a weight
 * outside 1, 2 or 3.
 */
export const weights: Record<DimensionId, Record<SituationId, Weight>> = {
  D1: { S01: 3, S02: 3, S03: 3, S04: 2, S05: 3, S06: 3, S07: 2, S08: 3, S09: 3, S10: 3, S11: 2 },
  D2: { S01: 3, S02: 2, S03: 3, S04: 3, S05: 3, S06: 2, S07: 3, S08: 3, S09: 3, S10: 2, S11: 1 },
  D3: { S01: 3, S02: 3, S03: 3, S04: 2, S05: 3, S06: 3, S07: 3, S08: 3, S09: 2, S10: 3, S11: 2 },
  D4: { S01: 2, S02: 2, S03: 3, S04: 2, S05: 3, S06: 3, S07: 2, S08: 1, S09: 2, S10: 2, S11: 1 },
  D5: { S01: 3, S02: 3, S03: 2, S04: 2, S05: 3, S06: 3, S07: 3, S08: 2, S09: 2, S10: 3, S11: 3 },
  D6: { S01: 2, S02: 3, S03: 2, S04: 2, S05: 2, S06: 3, S07: 2, S08: 3, S09: 1, S10: 3, S11: 3 },
  D7: { S01: 3, S02: 3, S03: 2, S04: 3, S05: 1, S06: 3, S07: 3, S08: 3, S09: 3, S10: 3, S11: 2 },
  D8: { S01: 2, S02: 3, S03: 2, S04: 2, S05: 3, S06: 2, S07: 3, S08: 2, S09: 2, S10: 1, S11: 1 },
};

export function weightFor(dimension: DimensionId, situation: SituationId): Weight {
  return weights[dimension][situation];
}

export type WeightNote = {
  situation: SituationId;
  text: string;
};

/** The three reading notes the source gives beneath the table. */
export const weightNotes: WeightNote[] = [
  {
    situation: "S05",
    text: "In 05 the actionable ending carries little weight, because the genre is declarative, but D4, the temporal contract, and D2 are law.",
  },
  {
    situation: "S09",
    text: "In 09 register carries little weight, because the reader is a technical peer, but D7, the next action, is the essence of the handoff.",
  },
  {
    situation: "S11",
    text: "In 11 fine grained facts give way to D5 and D6: selection and register are the game, with the precision tradeoff declared. Better understood in simple terms than not understood at all.",
  },
];

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export type AggregationRule = {
  n: number;
  text: string;
  /** Rule 5 is the one the site gives more weight: the axes are never averaged. */
  emphasis: boolean;
};

export const aggregationRules: AggregationRule[] = [
  {
    n: 1,
    text: "L0 violations at weight 3 fail the text, with their evidence attached. Red.",
    emphasis: false,
  },
  {
    n: 2,
    text: "L1 violations are reported with a score. Above a configurable threshold they become amber or red.",
    emphasis: false,
  },
  {
    n: 3,
    text: "L2 judgements never fail a text on their own. They advise: amber, with the opinion marked as an opinion.",
    emphasis: false,
  },
  {
    n: 4,
    text: "What cannot be decided is declared as requiring human review. It is never passed silently.",
    emphasis: false,
  },
  {
    n: 5,
    text: "The final report always separates the two axes: a fidelity score and a utility score, never a single average that mixes them.",
    emphasis: true,
  },
];

// ---------------------------------------------------------------------------
// Declared limitations of v0.1
// ---------------------------------------------------------------------------

export type Limitation = { id: string; text: string };

/** Section 7 of the source, translated without softening. */
export const limitations: Limitation[] = [
  {
    id: "LIM-1",
    text: "The weights in the table are a first reasoned calibration from the corpus. They have to be adjusted against the 30 pair exercise on the project's own dataset and against human annotation of the test set.",
  },
  {
    id: "LIM-2",
    /* This limitation was closed after v0.1 was written and is restated rather
       than removed, because the shape of what was built is not the shape the
       original text assumed: the lists exist, but only five of the eleven
       genres have a published authority behind them. */
    text: "D1 and D6 depend on per genre lists of mandatory questions and prohibited jargon. Those lists have since been compiled from the corpus: 178 questions, 128 prohibited classes and 151 format constants over 120 documents, every quote verified as a literal substring of its source. The remaining limitation is authority, not coverage. Only five of the eleven situations have a checklist published by a named body, so on the other six a failed check advises rather than decides.",
  },
  {
    id: "LIM-3",
    text: "Caveat recovery, check F4.1, inherits the judge's open problem, which is that it sits below the 85% threshold. Until that is solved, the check reports assisted review rather than verification.",
  },
  {
    id: "LIM-4",
    text: "Real time operational situations, 03 and 09, are backed by fewer specimens than the formal ones, and the project's own dataset bias toward formal register applies here as well.",
  },
  {
    id: "LIM-5",
    /* Found while wiring the rubric into the checker: the weights and the
       aggregation rules disagree with each other about D5, and no reading of
       the source resolves it. Recording it here is the honest move, since the
       instrument would otherwise carry a weight that can never fire. */
    text: "D5 carries weight 3 in seven of the eleven situations, but no deterministic check reaches it, and aggregation rule 1 only fails a text on a violation at layer 0. As written, the weight the rubric assigns to D5 can never take effect. Either rule 1 needs a path that does not run through layer 0, or D5 needs a check that does.",
  },
];

// ---------------------------------------------------------------------------
// Annex: the analogy rule
// ---------------------------------------------------------------------------

/**
 * Section 6 of the source. It governs the analogy library rather than the
 * scoring of a translation, which is why it is an annex and not a ninth
 * dimension.
 */
export const analogyRule = {
  requirement: "Every analogy in the system is annotated with three things.",
  annotations: [
    { key: "a", label: "Concept", text: "The concept the analogy illuminates." },
    { key: "b", label: "Audience", text: "The audience it works for." },
    {
      key: "c",
      label: "Failure modes",
      text: "Its known failure modes: where the mental model stops corresponding to the real implementation.",
    },
  ],
  legitimateUse: "Forming a first mental model.",
  illegitimateUse: "Reasoning about controls.",
  explanationPreference: {
    label: "Order of preference when explaining",
    order: ["Plain explanation first", "Narrative or scenario second", "Analogy third"],
  },
} as const;
