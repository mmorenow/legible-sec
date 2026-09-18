// Copy for /benchmark: the pre-registered benchmark.
//
// Same division as /rubric. The design's own content is data and lives in
// `@/content/benchmarkDesign`, which in turn reads the dimensions, axes and
// layers out of `@/content/rubric`. What lives here is only the page level
// prose: the metadata, the section headings, the column labels, and the
// sentences that say what a reader is about to look at.
//
// Nothing here restates a dimension name, an axis, a layer or a perturbation.
// If a name appears on the page it was looked up.
//
// House rules for every string below: English, documentary register, third
// person, and no em dashes.

import { benchmarkQuestion } from "@/content/benchmarkDesign";

export const meta = {
  title: "Lost in Translation? Benchmarking LLM fidelity in executive security briefs",
  description:
    "The pre-registered design. A model writes the executive summary from a real finding, a deterministic reviewer scores what the summary lost, reported per error type on two axes that are never averaged. No run has happened.",
  canonical: "/benchmark/",
};

/* ------------------------------------------------------------------ *
 * 1. Header
 * ------------------------------------------------------------------ */

export const header = {
  kicker: "The benchmark · pre-registered, not yet run",
  /* The registered name, fixed 2026-09-12 (D66) after a year of the project
     referring to the benchmark by whatever question it happened to ask that
     month. The question itself follows in the lede, because a name is a handle
     and not a specification. */
  headline: benchmarkQuestion.name,
  question: benchmarkQuestion.asks,
  lede: "The benchmark grades models as writers, and the grader is a deterministic reviewer rather than another model. Each item hands a real security finding to the model under test and asks for the executive summary. The reviewer then reads what the model wrote against the finding it came from and reports what left: a number, an identifier, a severity band, a caveat, a position on the clock.",
  /* The design this replaced, named once. A page about fidelity that quietly
     swaps its own thesis is doing the thing it was built to catch. */
  supersededLabel: "What this replaced",
  superseded:
    "Until September 2026 this design graded models as detectors of an error planted in somebody else's retelling. That framing was adopted when the only available scorer failed almost every arm including frontier models and could rank nothing. The scorer changed, so the question returned to the one worth asking. Planting errors did not go away: it is how the reviewer itself is now validated.",
  gapLabel: "Why not an existing benchmark",
  gap: benchmarkQuestion.gap,
};

/* ------------------------------------------------------------------ *
 * 2. The instrument, as a figure
 * ------------------------------------------------------------------ */

export const scene = {
  caption:
    "One item, end to end. A verbatim finding, the model under test writing its summary, the reviewer reading the two against each other, and a verdict that is only ever preserved, lost or unexaminable.",
  /* The figure is decorative for a screen reader only if it says nothing the
     text does not. It says the sequence, so it gets a described role. */
  ariaLabel:
    "A four stage instrument. A verbatim security finding enters at the left. The model under test writes the executive summary from it. The deterministic reviewer reads that summary against the finding. The result leaves as one of three outcomes: the material survived the retelling, the material was lost and the reviewer can show the string, or the check for it has recall too low to report either way. All three counters are empty because no run has happened.",
  stages: ["Verbatim finding", "Model writes the summary", "Reviewer reads both", "Outcome"],
  outcomes: [
    { key: "preserved", label: "Preserved", note: "the material survived the model's retelling" },
    { key: "lost", label: "Lost", note: "the material left, and the reviewer shows the string" },
    { key: "unexaminable", label: "Unexaminable", note: "the check for it has recall too low to report either way" },
  ],
  emptyNote: "No counter on this figure holds a value, and none will until the run happens.",
};

/* ------------------------------------------------------------------ *
 * 3. The perturbation matrix
 * ------------------------------------------------------------------ */

export const matrixSection = {
  eyebrow: "Error types",
  heading: "One error type at a time",
  lede: "Every error type is written against a single dimension of the rubric, and that dimension settles the rest: the axis the error answers to, and the measurement layer that would catch it. The five below are the seed set the design names. Read the table twice. One way it lists what the benchmark counts in a model's writing. The other way it lists what gets planted deliberately to prove the reviewer can see it, which is the only reason the first reading is allowed.",
  columns: {
    error: "Error type",
    edit: "What the edit does",
    dimension: "Dimension attacked",
    axis: "Axis",
    caughtBy: "Caught by",
  },
  directionLabel: { excess: "by excess", defect: "by defect" },
  bidirectionalNote:
    "Two of the seeds attack the same dimension from opposite sides. A reviewer that only catches softening scores a model that inflates every finding as perfect, and inflating is the error that empties a board's attention. This is why the reviewer's recall on both directions is a prerequisite of the run rather than a refinement after it.",
  noteLabel: "On this mapping",
};

/* ------------------------------------------------------------------ *
 * 3b. Coverage
 *
 * The seed set does not reach every dimension. Saying so on the page is
 * cheaper than being asked.
 * ------------------------------------------------------------------ */

export const coverageSection = {
  heading: "What the seed set reaches",
  /** Rendered with the counts worked out from the data, never as literals. */
  countTemplate: (seeded: number, total: number) =>
    `${seeded} of the ${total} dimensions have a seeded perturbation.`,
  lede: "The remainder are not out of scope. An error can be written against any dimension, and the generator is organised by dimension for that reason. They are unseeded, which is a different statement from unmeasurable, and the page marks which is which rather than showing a full grid.",
  seededLabel: "Seeded",
  unseededLabel: "No seed yet",
};

/* ------------------------------------------------------------------ *
 * 4. Scoring
 * ------------------------------------------------------------------ */

export const scoringSection = {
  eyebrow: "Scoring",
  heading: "A loss rate, and what the grader can see",
  lede: "There is no overall score. Each error type is reported on its own, under the axis it answers to, and it carries the reviewer's measured recall for that check beside it. A model cannot be credited for avoiding an error its grader is unable to see, so an error type whose recall falls under the bar is published as a guarantee not offered rather than as a clean result.",
  aloneLabel: "Reported alone, it hides",
  ruleLabel: "Aggregation rule",
  /* Rule 5 of the rubric is quoted rather than paraphrased, and this is the
     sentence that says why it is a rule and not a preference. */
  ruleReason:
    "The two axes fail separately. A model can be scrupulous about every number in the source and useless to the person reading the result, and one average would report that as a middling model rather than as two different findings. Averaging is how a gain on one axis buys silence on the other.",
  constraintsLabel: "Constraints the design is built under",
};

/* ------------------------------------------------------------------ *
 * 5. Where the results land
 * ------------------------------------------------------------------ */

export const resultsSection = {
  eyebrow: "Results",
  heading: "Two shapes, one per axis",
  lede: "Results land in the two instruments below and nowhere else. A vertex is a dimension, and the value it takes is the share of items the model retold without losing what that dimension protects. There is no third shape combining them, because there is no quantity that combines them.",
  emptyLabel: "Empty until the run happens",
  vertexNote: "A vertex drawn in outline has no seeded perturbation yet and cannot take a value.",
  axisLabel: (id: string, name: string) => `Axis ${id} · ${name}`,
};

/* ------------------------------------------------------------------ *
 * 6. State
 * ------------------------------------------------------------------ */

export const stateSection = {
  eyebrow: "State",
  heading: "Nothing has been run",
  /** The claim itself is read from the ledger, never written here. */
  claimLabel: "Benchmark run",
  lede: "The design is fixed and published here before the first item is scored, which is the only moment at which fixing it costs nothing. What follows is what has to happen before a number from this benchmark would mean anything.",
  prerequisitesLabel: "In order, before the run",
  itemsLabel: "Where the items come from",
  itemsTemplate: (pairs: number, label: string) =>
    `${pairs.toLocaleString("en-US")} pairs in ${label}, from which the items are drawn.`,
  rubricLinkLabel: "The eight dimensions, in full",
  rubricLinkHref: "/rubric/",
};

/* ------------------------------------------------------------------ *
 * 7. Closing
 * ------------------------------------------------------------------ */

export const closing =
  "A benchmark published after its results is a claim about the past. This one is on the page first, with its error types named, its scoring fixed and its instruments empty, so that a result which does not flatter the design has nowhere to go except onto this page.";
