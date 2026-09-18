// Copy for /rubric: the definition the rest of the project is built around.
//
// The rubric's own content is already data. It lives in `@/content/rubric`,
// `@/content/evidence` and `@/content/behaviour`, and the page is a rendering
// of those three modules, not a retelling of them. What lives HERE is only the
// page-level prose: the metadata, the section headings, and the sentences that
// say what a reader is about to look at. Nothing in this file restates a fact
// the data already carries, and no number is written as a literal.
//
// House rules that apply to every string below: English, documentary register,
// and no em dashes. A middle dot, a colon or a comma instead.

import { POPULATION } from "@/content/behaviour";
import { rubricMeta } from "@/content/rubric";

export const meta = {
  title: "The LEGIBLE rubric: is the retelling faithful, and is it useful?",
  description:
    "The definition the project is built around. Two axes, four measurement layers, eight dimensions, eleven situations, and the evidence each one rests on.",
  canonical: "/rubric/",
};

/* ------------------------------------------------------------------ *
 * 1. Header
 * ------------------------------------------------------------------ */

export const header = {
  eyebrow: "The rubric",
  heading: "Rubric",
  frame:
    "LEGIBLE uses one rubric for both the benchmark and the checker. It measures whether a retelling of a security finding stays faithful to that finding, and whether it is useful to the person it was written for. Everything else in the project is built on it, and it is set out in full below.",
  derivedLabel: "Derived from",
  versionLabel: "Version",
  dateLabel: "Source document",
  traceabilityLabel: "Traceability",
};

/* ------------------------------------------------------------------ *
 * 1b. How v0.1 was actually sourced
 *
 * Placed second on purpose. On a project whose subject is not claiming more
 * than the evidence supports, the reader is owed the state of the evidence
 * before the claims, not after them.
 * ------------------------------------------------------------------ */

export const provenance = {
  eyebrow: "Provenance",
  heading: "Method claims, and what has actually been done",
  lede:
    "The method describes two independent sources validating each other. Version 0.1 was written from one of them. This is stated here rather than left to be discovered.",
  claimLabel: "The method claims",
  stateLabel: {
    done: "Done",
    pending: "Pending",
    partial: "Partly done",
  },
  statementLabel: "Where that leaves v0.1",
  /* The correction the two data modules force. `versionProvenance` was written
     when the behavioural half had not been run at all; `behaviour.ts` is that
     exercise, re-derived on a later build. Neither module is edited here, so
     the page reconciles them out loud. */
  update: {
    label: "Since that was written",
    body: `The behavioural half is no longer entirely pending. Eight rules of conventional advice have since been measured against ${POPULATION.pairs.toLocaleString("en-US")} finding level pairs on build ${POPULATION.build}, and the measurements are further down this page. What has not happened is the part that would change the rubric: no dimension has been rewritten and no weight has been revised against those numbers. Version ${rubricMeta.version} is still the single sourced version.`,
    anchorLabel: "See the measurements",
    anchorHref: "#behaviour",
  },
};

/* ------------------------------------------------------------------ *
 * 2. The two axes
 * ------------------------------------------------------------------ */

export const axesSection = {
  eyebrow: "The two axes",
  heading: "The two axes",
  lede: "An axis is a class of obligation. The rubric sorts every judgement it makes into one of two, because a retelling answers to two different parties and can satisfy one while failing the other. Fidelity is the obligation to the source document. Decision utility is the obligation to the reader the retelling was written for. Each of the eight dimensions below belongs to one axis, or to both, and every result is reported as two scores. Merging them into one number would let a gain on either side conceal a failure on the other.",
  /** The two halves of `axisIndependence.claim`, as labels on the failure band. */
  failures: [
    { label: "Faithful and useless", note: "Everything survived. Nobody can act on it." },
    { label: "Useful and unfaithful", note: "The reader can act. On something the source did not say." },
  ],
  verdict: "Both are failures.",
};

/* ------------------------------------------------------------------ *
 * 3. The measurement contract
 * ------------------------------------------------------------------ */

export const contractSection = {
  eyebrow: "Layers",
  heading: "Measurement layers",
  lede:
    "A layer is the kind of evidence a check can produce, and it fixes how far the verdict may be trusted. A deterministic check either matches a string or it does not, so its failure is a fact. An entailment check returns a confidence, so its finding is a score. A model judgement is an opinion and is labelled as one. What no layer can decide is declared rather than passed. Only the deterministic layer runs on this site.",
  columns: {
    definition: "What it is",
    mayConclude: "What it may conclude",
    evidenceRule: "What it has to show",
  },
  authorityLabel: "Authority",
  authorityNote: "How much a verdict from this rung is worth, by the contract above.",
};

/* ------------------------------------------------------------------ *
 * 4. The eight dimensions
 * ------------------------------------------------------------------ */

export const dimensionsSection = {
  /* The check identifiers were on the page for weeks with nothing saying what
     they meant. They are worth keeping, because the checker cites them when it
     reports a failure, but only if the scheme is stated once. */
  idScheme:
    "Checks are numbered by axis, dimension and position, so F5.1 is the first check of dimension 5 on the fidelity axis. The checker cites these identifiers when it reports what it caught.",
  hoverHint: "Hover a check to see what it asks of the text.",
  eyebrow: "The eight dimensions",
  heading: "The eight dimensions",
  lede:
    "A dimension is a single property of the retelling that can be examined on its own: whether the numbers survived, whether the severity held, whether the reader is left with something to do. Each one states the question it asks, the axis it answers to, and the checks that decide it, and each check names the measurement layer it runs at. Three dimensions fail in both directions, by excess as well as by defect, and are marked for it: a severity can be softened or inflated, and both are errors.",
  labels: {
    question: "The question",
    grounding: "Where it comes from",
    checks: "Checks",
    scale: "Scale",
    evidence: "Required evidence",
    sourceNote: "Note on the source",
    excess: "Fails by excess",
    defect: "Fails by defect",
  },
  bidirectionalGlyphLabel: "Fails in both directions: by excess and by defect",
  bidirectionalNote:
    "Three of the eight fail in two directions. Doing too much of the thing is a failure, and so is doing too little of it. The mark on the rail says which ones.",
};

/* ------------------------------------------------------------------ *
 * 5. The weights
 * ------------------------------------------------------------------ */

export const weightsSection = {
  eyebrow: "The weights",
  heading: "Weights by situation",
  lede:
    "The matrix has one row per dimension and one column per situation, and each cell holds the weight that dimension carries in that situation: 1, 2 or 3, drawn darker as it rises. Read across a row to see where a dimension matters most. Read down a column to see what a given kind of document is judged on. A weight of 3 means a failure there invalidates the text regardless of the rest. Rows and columns are never added up: a total would merge the two axes the rubric keeps apart.",
  notesLabel: "Reading the table",
};

/* ------------------------------------------------------------------ *
 * 6. What the pairs actually do
 * ------------------------------------------------------------------ */

export const behaviourSection = {
  eyebrow: "Behaviour",
  heading: "What the pairs do",
  lede:
    "The dimensions above were drawn from what practitioners write about this work. The table below is what they do: eight rules of conventional advice, checked against the corpus to see how often the people who write these documents for a living actually follow them. Adherence is the share of applicable pairs where the rule held.",
  columns: {
    rule: "The rule, as the advice states it",
    adherence: "Followed",
    applicable: "Applicable pairs",
    verdict: "Verdict",
    definition: "What was counted",
  },
  verdictLabels: {
    holds: "Holds",
    weakened: "Weakened",
    "not a norm": "Not a norm",
  },
  populationLabel: "Population",
  previousLabel: "Previous build",
  cautionLabel: "What this does not say",
};

/* ------------------------------------------------------------------ *
 * 7. Aggregation
 * ------------------------------------------------------------------ */

export const aggregationSection = {
  eyebrow: "Aggregation",
  heading: "Aggregation",
  lede: "Individual verdicts do not become a result on their own. Five rules govern what a set of checks may be turned into, and what it may never be turned into.",
};

/* ------------------------------------------------------------------ *
 * 8. Declared limitations
 * ------------------------------------------------------------------ */

export const limitationsSection = {
  eyebrow: "Limits",
  heading: "Limitations",
  lede:
    "Version 0.1 declares four. They are reproduced as written. A fifth is worth stating: the dimensions and weights below were drawn from what practitioners say about this work. The corpus measurements further up the page came later and have not been used to revise any of them.",
};

/* ------------------------------------------------------------------ *
 * 9. Where it comes from
 * ------------------------------------------------------------------ */

export const sourcesSection = {
  eyebrow: "Evidence",
  heading: "Sources",
  methodLede:
    "Each dimension is listed with the documents it was drawn from. Sources carry the kind of authority they hold, because a regulator and a vendor blog do not support a claim equally, and the date every link was last checked.",
  summaryLabels: {
    citations: "Citations",
    distinctSources: "Distinct documents",
    reachable: "Answered the check",
    blocked: "Refused automated requests",
    inCorpus: "Held in the local corpus",
  },
  checkedOnLabel: "Every URL was requested on",
  checkedOnNote:
    "A source recorded as dead fails the build rather than reaching a reader. None are recorded as dead.",
  statusLabels: {
    reachable: "Reachable",
    blocked: "Exists, refuses automated requests",
    dead: "Dead",
  },
  blockedNote:
    "The host answered and declined the request, which is a bot policy and not a broken link. The document is held in the local corpus, captured when it was collected.",
  kindLegendLabel: "Standing of a source",
  corpusTypeLabel: "Corpus type",
  situationLabel: "Situation",
  contributesLabel: "What it contributes",
  expandHint: "sources",
};

export const objectionsSection = {
  eyebrow: "Objections",
  heading: "Objections",
  lede:
    "Eight, in the strongest form they can be put.",
  objectionLabel: "The objection",
  answerLabel: "The answer",
};

/* ------------------------------------------------------------------ *
 * Footer marker
 * ------------------------------------------------------------------ */

export const footerVersion = rubricMeta.label;

/* ------------------------------------------------------------------ *
 * The weights matrix
 *
 * The 8 dimensions by 11 situations grid. Two of these three strings exist to
 * say the thing the picture cannot: that no row and no column is ever summed.
 * The rubric's fifth aggregation rule forbids it, so the table states the
 * prohibition in its caption and repeats it under every slice a reader opens.
 *
 * `sliceNote` takes the word for what the slice is, because the same sentence
 * serves a row and a column and the component knows which one it drew.
 * ------------------------------------------------------------------ */

export const weightsMatrix = {
  caption: "Weights, 8 dimensions by 11 situations",
  readoutIdle:
    "Hover, tap or arrow onto a cell to read it. Weights are never added up: the rubric reports fidelity and utility separately, so a row total or a column average would mix the two axes it keeps apart.",
  sliceNote: (unit: "situation" | "dimension") =>
    `A slice is read one line at a time. The weights on it are not added together and there is no score for the ${unit} as a whole.`,
};
