// The pre-registered benchmark design, as structured content.
//
// WHAT THIS MODULE IS FOR
//
// The benchmark is not a separate instrument from the rubric. It is the rubric
// pointed at a model instead of at a text: each planted error is written against
// one dimension, and that dimension already fixes the axis the error answers to
// and the layer that would catch it. So nothing here restates a dimension name,
// an axis or a layer. Those are looked up from `@/content/rubric`, which is the
// record. This module only holds what belongs to the benchmark itself: which
// errors get planted, what each one does to the text, which check it is aimed
// at, and what has to happen before a run is honest.
//
// THE ERA THIS BELONGS TO
//
// Two designs came before this one and both are dead. The first measured a laptop
// model against frontier models across five prompting conditions and averaged five
// scored dimensions into one number. The second, carried between 2026-08-30 and
// 2026-09-12, graded models as detectors of an error somebody else planted; it was
// adopted because the only scorer available at the time could rank nothing, and it
// was reversed once a deterministic reviewer replaced that scorer (D64).
//
// The design recorded here: a model is handed a verbatim finding and writes the
// executive summary, the deterministic reviewer scores what the summary lost
// against the source, and every loss rate ships beside the reviewer's own measured
// recall for that check (D65). Planting an error survives as the way the reviewer
// is validated, which is a statement about the grader and not about the graded.
//
// A NOTE ON SOURCES
//
// Both source documents name the same five seed perturbations: delete the
// number, soften the Critical, inflate the Low, omit the caveat, break the
// cadence. They are reproduced here and nothing is added to the list, because a
// sixth invented perturbation would be a design decision made by a web page.

import { SPLITS } from "./facts";
import {
  axisOrder,
  dimensions,
  dimensionsById,
  layerOrder,
  type AxisId,
  type Check,
  type DimensionId,
  type LayerId,
} from "./rubric";

// ---------------------------------------------------------------------------
// What the benchmark asks
// ---------------------------------------------------------------------------

/**
 * The question, kept as data rather than as page prose because it is the
 * design's own definition and the page is only one place it could be rendered.
 */
export const benchmarkQuestion = {
  /** The registered name of the benchmark, used in the project's own documents. */
  name: "Lost in Translation? Benchmarking LLM Fidelity in Executive Security Briefs",
  asks:
    "Given a real security finding, how much does a model lose when it writes the executive summary for somebody who will not read the technical text?",
  /** The question it deliberately does not ask, stated because a reader assumes it. */
  doesNotAsk:
    "Whether the prose is good. Register and tone are not machine checkable, and that question has its own instrument, a blind human evaluation that stays a human metric.",
  /** Why the box is empty and why an existing benchmark cannot be borrowed. */
  gap:
    "The factual consistency literature covers news and clinical text, and it shows that the methods do not transfer between domains: the clinical benchmark had to be built because the news ones failed on clinical text. Security adds what no news benchmark measures, which is severity, exploitability caveats, a regulatory clock, and readers who arrive with a legal checklist.",
} as const;

// ---------------------------------------------------------------------------
// The perturbations
// ---------------------------------------------------------------------------

export type Perturbation = {
  /** Stable key. Also the order the errors are listed in. */
  id: string;
  /** The edit, named the way the design documents name it. */
  name: string;
  /** What the edit does to the retelling. */
  edit: string;
  /**
   * Which of the two directions of a bidirectional dimension the edit takes.
   * Two of the five seeds attack the same dimension from opposite sides, which
   * is the reason that dimension is marked bidirectional in the first place.
   */
  direction?: "excess" | "defect";
  /** The dimensions the edit attacks. Names and axes come from the rubric. */
  dimensions: DimensionId[];
  /** The rubric checks the edit is written against, by check id. */
  checks: string[];
  /** Present when the mapping needs defending. */
  note?: string;
};

export const perturbations: Perturbation[] = [
  {
    id: "delete-number",
    name: "Delete a number",
    edit: "A material figure leaves the retelling and the sentence around it closes over the gap, so the text still reads as complete.",
    dimensions: ["D2"],
    checks: ["F2.1"],
  },
  {
    id: "soften-critical",
    name: "Soften a Critical",
    edit: "A finding the source declares Critical is retold in the register of routine maintenance, with the band itself moved down or dropped.",
    direction: "defect",
    dimensions: ["D3"],
    checks: ["F3.1"],
  },
  {
    id: "inflate-low",
    name: "Inflate a Low",
    edit: "A finding the source declares Low is retold as urgent, which is the error a checker that only punishes softening would reward.",
    direction: "excess",
    dimensions: ["D3"],
    checks: ["F3.1"],
  },
  {
    id: "drop-caveat",
    name: "Drop a caveat",
    edit: "A condition the source attaches to the finding, exploitable only with local access, no evidence of exploitation, is left out, so a bounded statement is retold as an unbounded one.",
    dimensions: ["D4"],
    checks: ["F4.1"],
  },
  {
    id: "break-cadence",
    name: "Break the clock",
    edit: "The retelling loses its position in time: what is known as of now, and when the next update is due.",
    dimensions: ["D4", "D8"],
    checks: ["F4.3", "U8.2"],
    note: "The source documents call this one breaking the cadence, and cadence is grounded twice in the rubric. It is the temporal contract a text owes its reader, and in the genres that publish a fixed interval it is also a format constant. The edit is scored against both, which is why it is the one perturbation that lands on both axes.",
  },
];

// ---------------------------------------------------------------------------
// Derived views of the perturbation set
//
// Everything below is computed, so the page cannot state a coverage figure the
// list above does not support.
// ---------------------------------------------------------------------------

/** The checks a perturbation is written against, resolved from the rubric. */
export function checksFor(p: Perturbation): Check[] {
  return p.dimensions
    .flatMap((id) => dimensionsById[id].checks)
    .filter((c) => p.checks.includes(c.id));
}

/** The axes a perturbation answers to, in the rubric's own axis order. */
export function axesFor(p: Perturbation): AxisId[] {
  const hit = new Set(p.dimensions.flatMap((id) => dimensionsById[id].axes));
  return axisOrder.filter((a) => hit.has(a));
}

/** The layers that would catch it, in the ladder's order. */
export function layersFor(p: Perturbation): LayerId[] {
  const hit = new Set(checksFor(p).flatMap((c) => c.layers));
  return layerOrder.filter((l) => hit.has(l));
}

/** The dimensions that currently have a seeded perturbation, in rubric order. */
export const seededDimensionIds: DimensionId[] = dimensions
  .map((d) => d.id)
  .filter((id) => perturbations.some((p) => p.dimensions.includes(id)));

export function isSeeded(id: DimensionId): boolean {
  return seededDimensionIds.includes(id);
}

/** The perturbations aimed at one dimension, for a vertex or a row group. */
export function perturbationsFor(id: DimensionId): Perturbation[] {
  return perturbations.filter((p) => p.dimensions.includes(id));
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type Metric = {
  key: "loss" | "graderRecall";
  name: string;
  /** What the number counts. */
  definition: string;
  /** The failure mode reporting it alone would hide. */
  aloneItHides: string;
};

/*
 * Two numbers per error type, never one, and the second is about the grader
 * rather than about the model. A loss rate on its own is a claim the scorer may
 * not be entitled to make: a check that cannot see an error will report every
 * model as clean of it.
 */
export const metrics: Metric[] = [
  {
    key: "loss",
    name: "Loss rate",
    definition:
      "Of the items a model retold, the share where the reviewer found this error in what the model wrote.",
    aloneItHides:
      "A model can read as flawless on an error type simply because the check for it is blind, which is a fact about the reviewer and not about the model.",
  },
  {
    key: "graderRecall",
    name: "Grader recall",
    definition:
      "The share of this error the reviewer catches when the error is planted deliberately and the answer is known in advance.",
    aloneItHides:
      "A reviewer with excellent recall says nothing at all about how often models actually commit the error it is able to see.",
  },
];

/**
 * The design constraints carried in from the literature, each one a thing that
 * has already gone wrong for somebody else. Sourced from the reading recorded in
 * RESUMEN_SESION_legible.md section 9.
 */
export type DesignConstraint = { id: string; rule: string; because: string };

export const designConstraints: DesignConstraint[] = [
  {
    id: "hard-edits",
    rule: "The perturbations have to be hard, and a model cannot be trusted to write them alone.",
    because:
      "The planted error benchmarks that came before, the SummEdits family, found that edits generated by a model come out trivial, and a trivial edit measures nothing.",
  },
  {
    id: "grader-before-graded",
    rule: "No error type is reported until the reviewer's recall on it has been measured.",
    because:
      "A grader that cannot see an error reports every model as innocent of it. Measured on the previous judge, softening a severity was caught every time over five hundred cases while inflating one was caught in none over four hundred, so a benchmark run in that state would have ranked a model that inflates every finding as perfect.",
  },
  {
    id: "judge-bias",
    rule: "No model is treated as a reliable grader of another, including of itself.",
    because:
      "The surveys of model judges document verbosity bias, position bias, self enhancement and deference to claimed authority. This is also why the planted error is known in advance: the ground truth is the edit, not another model's opinion of it.",
  },
];

// ---------------------------------------------------------------------------
// State: what has to happen before a run
// ---------------------------------------------------------------------------

/**
 * The order given in MASTER_GUIDE.md section 7. The run is last on purpose: each
 * step ahead of it is something that would make the resulting numbers mean less
 * than they appear to.
 */
export type Prerequisite = { id: string; step: string; why: string };

export const prerequisites: Prerequisite[] = [
  {
    id: "grader-recall",
    step: "Re-run mutation testing against the eleven checks that now do the scoring.",
    why: "The published per check figures describe a judge that no longer runs. A benchmark whose grader's limits are unmeasured reports its grader's blind spots as model virtues. It costs nothing, because the harness is regex and calls no model.",
  },
  {
    id: "calibrate-weights",
    step: "Score thirty pairs of the project's own dataset by hand against the rubric.",
    why: "The weights are a first reasoned calibration from the corpus and have never been checked against how real pairs behave. A weight decides what fails a text and what only advises.",
  },
  {
    id: "operational-lists",
    step: "Compile the per genre lists the rubric depends on: the questions each genre must answer, the jargon each audience forbids.",
    why: "Two dimensions rest on lists that exist as evidence in the corpus and have not been reduced to something a check can run against.",
  },
  {
    id: "human-verification",
    step: "Verify the frozen test split and the out of distribution sets by hand.",
    why: "Alignment in the dataset was verified by models. A benchmark of models scored on items that models aligned would be measuring its own reflection.",
  },
];

/** Where the items come from. The count is read from the dataset, not written. */
export const itemSource = {
  splitKey: "test",
  label: "the frozen test split",
  /** Pairs available in that split, before any are selected for the run. */
  get pairs(): number {
    return SPLITS.find((s) => s.key === "test")?.n ?? 0;
  },
  note: "The finding a model is asked to retell is verbatim from a published document and is never generated, so the input to every item stays inspectable and the model always writes from real material.",
} as const;
