/* One report out of two check layers.
 *
 * judge.ts runs eight checks that need only the two texts. genreChecks.ts runs
 * three that need to know what is being written. Both return the same Flag, but
 * neither knows which rubric dimension it serves, and the rubric is the thing
 * the reader is being shown. This module is the join.
 *
 * The mapping below is the load bearing part of the whole checker, because it
 * decides which axis a failure lands on, and the two axes are reported apart.
 * A check attributed to the wrong axis would let a fidelity failure show up as
 * a utility problem, which is the one thing aggregation rule 5 exists to stop.
 */

import { GATE_CHECKS, type Flag, type GateReport } from "./judge";
import { GENRE_CHECKS, type DeclaredContext, type GenreReport, type Undecided } from "./genreChecks";
import {
  dimensionsById,
  weightFor,
  type AxisId,
  type DimensionId,
  type SituationId,
  type Weight,
} from "@/content/rubric";

/** Every check this instrument runs, and the dimension it answers to. */
export const CHECK_DIMENSION: Record<string, DimensionId> = {
  // judge.ts, the eight that need only the texts
  id_parity: "D2", // identifiers are material facts
  numeric_parity: "D2",
  entity_check: "D2", // hosts, versions and ports are facts with a frame
  severity_drift: "D3",
  claim_inflation: "D3", // asserting more than the source supports is inflation
  caveat_parity: "D4",
  status_drift: "D4", // fixed or exploited state is a claim about what is known
  negation_flip: "D4",
  // genreChecks.ts, the three that need the genre
  reader_questions: "D1",
  prohibited_jargon: "D6",
  format_constants: "D8",
} as const;

export const ALL_CHECKS = [...GATE_CHECKS, ...GENRE_CHECKS] as const;

/* Dimensions no check reaches. Naming them is not an omission to apologise for:
   the instrument reports them as unexamined, which is the difference between a
   checker and something that implies coverage it does not have. D5 has no
   deterministic check at all, which is a hole in the rubric itself: it carries
   weight 3 in seven situations while aggregation rule 1 only fails on an L0
   violation, so its weight can never fire. D7 needs judgement. */
export const UNREACHED: DimensionId[] = ["D5", "D7"];

export type DimensionResult = {
  id: DimensionId;
  name: string;
  axes: AxisId[];
  weight: Weight;
  /** Checks mapped to this dimension that actually ran. */
  checks: string[];
  fails: Flag[];
  warns: Flag[];
  /** No check reaches this dimension, so it was not examined. Not a pass. */
  unexamined: boolean;
};

export type AxisResult = {
  axis: AxisId;
  dimensions: DimensionResult[];
  failed: DimensionResult[];
  /** A failure at weight 3 invalidates the text regardless of the rest. */
  invalidating: DimensionResult[];
  unexamined: DimensionResult[];
};

export type ReviewReport = {
  situation: SituationId;
  /** L2 means no body publishes a checklist here, so nothing is a verdict. */
  advisoryNote: string | null;
  flags: Flag[];
  fails: Flag[];
  warns: Flag[];
  ranCount: number;
  byDimension: Record<DimensionId, DimensionResult>;
  axes: Record<AxisId, AxisResult>;
  undecided: Undecided[];
  declared: DeclaredContext[];
  /** True when no check fired. It is a non detection, never a verification. */
  clean: boolean;
};

function emptyDimension(id: DimensionId, situation: SituationId): DimensionResult {
  const d = dimensionsById[id];
  return {
    id,
    name: d.name,
    axes: d.axes,
    weight: weightFor(id, situation),
    checks: [],
    fails: [],
    warns: [],
    unexamined: true,
  };
}

/**
 * A dimension on two axes counts on both. That is deliberate: D5 answers to
 * fidelity and to utility, and hiding it from one of them to keep the arithmetic
 * tidy would misreport it.
 */
export function buildReport(
  situation: SituationId,
  gate: GateReport,
  genre: GenreReport,
): ReviewReport {
  const ids = Object.keys(dimensionsById) as DimensionId[];
  const byDimension = Object.fromEntries(
    ids.map((id) => [id, emptyDimension(id, situation)]),
  ) as Record<DimensionId, DimensionResult>;

  // every check that ran marks its dimension as examined, whether or not it fired
  const ran = [...gate.passed, ...gate.flags.map((f) => f.check), ...genre.passed, ...genre.flags.map((f) => f.check)];
  for (const check of new Set(ran)) {
    const dim = CHECK_DIMENSION[check];
    if (!dim) continue;
    byDimension[dim].checks.push(check);
    byDimension[dim].unexamined = false;
  }

  const flags = [...gate.flags, ...genre.flags];
  for (const f of flags) {
    const dim = CHECK_DIMENSION[f.check];
    if (!dim) continue;
    (f.level === "fail" ? byDimension[dim].fails : byDimension[dim].warns).push(f);
  }

  const axes = Object.fromEntries(
    (["F", "U"] as AxisId[]).map((axis) => {
      const dims = ids.map((id) => byDimension[id]).filter((d) => d.axes.includes(axis));
      return [
        axis,
        {
          axis,
          dimensions: dims,
          failed: dims.filter((d) => d.fails.length > 0),
          invalidating: dims.filter((d) => d.fails.length > 0 && d.weight === 3),
          unexamined: dims.filter((d) => d.unexamined),
        } satisfies AxisResult,
      ];
    }),
  ) as Record<AxisId, AxisResult>;

  const fails = flags.filter((f) => f.level === "fail");
  const warns = flags.filter((f) => f.level === "warn");

  return {
    situation,
    advisoryNote: genre.advisoryNote,
    flags,
    fails,
    warns,
    ranCount: new Set(ran).size,
    byDimension,
    axes,
    undecided: genre.undecided,
    declared: genre.declared,
    clean: flags.length === 0,
  };
}
