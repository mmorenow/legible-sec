/* What the professionals actually did.
 *
 * The rubric's method claims two independent sources: what practitioners SAY
 * about this work, gathered from 237 industry documents, and what they DO,
 * measured across the corpus. This file is the second source. Version 0.1 of the
 * rubric was written from the first alone, so these measurements are the half
 * that was still owed.
 *
 * Every row carries its population and its definition, because a bare percentage
 * fails the rubric's own D2: a number has to survive the question "how was this
 * calculated?" and it has to keep its frame. The site previously rendered "22%"
 * with neither, which is the exact failure the project exists to name.
 *
 * Re-derived 2026-08-31 by running scripts/mine_playbook.py against v0.4; the
 * artifact is research/10-playbook-mining-v0.4.md, and the earlier v0.2 pass is
 * kept beside it at research/10-playbook-mining.md.
 */

export type Verdict = "holds" | "weakened" | "not a norm";

export type BehaviourRow = {
  /** The rule as conventional advice states it. */
  rule: string;
  /** Share of applicable pairs where the professional actually followed it. */
  adherence: number;
  /** How many pairs the rule could apply to at all. */
  applicable: number;
  verdict: Verdict;
  /** What the measurement actually counted. Never render the number without it. */
  definition: string;
  /** The same measurement at the previous build, where it differs enough to matter. */
  previous?: { build: string; adherence: number };
  note?: string;
};

/* The population every row below describes. It is NOT the corpus: the script
   restricts to pairs whose alignment was judged `aligned` and whose executive
   span is not document level, because a document-level summary cannot be said to
   follow or break a rule about one finding. */
export const POPULATION = {
  pairs: 1942,
  build: "v0.4",
  definition:
    "finding-level aligned pairs: alignment_label is aligned and the executive span is not document level",
  artifact: "research/10-playbook-mining-v0.4.md",
  graduationBar: 0.7,
  barNote: "A rule graduates as a norm at 70 percent adherence or above.",
} as const;

export const behaviour: BehaviourRow[] = [
  {
    rule: "Never open with the mechanism",
    adherence: 1.0,
    applicable: 1942,
    verdict: "holds",
    definition: "the executive sentence does not begin with how the flaw works",
    previous: { build: "v0.2", adherence: 1.0 },
    note: "The only rule in this set that every professional follows, on both builds.",
  },
  {
    rule: "Compress hard",
    adherence: 0.76,
    applicable: 1942,
    verdict: "holds",
    definition: "the executive text is 40 percent or less of the technical word count",
    previous: { build: "v0.2", adherence: 0.89 },
  },
  {
    rule: "Never soften the severity",
    adherence: 0.69,
    applicable: 205,
    verdict: "weakened",
    definition: "the severity band conveyed is not below the band the source declared",
    previous: { build: "v0.2", adherence: 0.72 },
    note:
      "It cleared the bar on the previous build and sits just under it here. Two readings are open and this pass cannot separate them: professionals may soften more often than the earlier subset suggested, or the detector may be counting severity that was restated rather than lowered. It needs a hand audit before the rubric leans on it.",
  },
  {
    rule: "Cite the finding ID",
    adherence: 0.45,
    applicable: 859,
    verdict: "not a norm",
    definition: "the executive text names the identifier the finding carries",
    previous: { build: "v0.2", adherence: 0.47 },
  },
  {
    rule: "Keep at least one number",
    adherence: 0.29,
    applicable: 1367,
    verdict: "not a norm",
    definition: "at least one number from the finding appears in the executive text",
    previous: { build: "v0.2", adherence: 0.22 },
    note: "Numbers survive by decision value, not by policy.",
  },
  {
    rule: "Lead with the business impact",
    adherence: 0.16,
    applicable: 1942,
    verdict: "not a norm",
    definition: "the executive sentence opens on business consequence rather than attacker capability",
    previous: { build: "v0.2", adherence: 0.16 },
    note: "The most repeated piece of advice in the industry, and the one professionals follow least.",
  },
  {
    rule: "Close with an action",
    adherence: 0.04,
    applicable: 404,
    verdict: "not a norm",
    definition: "the executive text ends on a recommendation, an owner or a next step",
    previous: { build: "v0.2", adherence: 0.03 },
  },
  {
    rule: "Preserve the caveats",
    adherence: 0.04,
    applicable: 116,
    verdict: "not a norm",
    definition: "a hedge or precondition in the finding has a counterpart in the executive text",
    previous: { build: "v0.2", adherence: 0.01 },
  },
];

/* The reading. Kept here rather than in a component so it stays next to the
   numbers it describes and cannot drift away from them. */
export const behaviourReading = {
  headline: "Most of the advice is not what professionals do",
  body:
    "Six of these eight rules are followed less than half the time by the people who write these documents for a living. That does not make the advice wrong, and it does not make the professionals right. It means the rubric cannot be assembled out of received wisdom, and that a checker enforcing conventional advice would flag the professional corpus itself.",
  caution:
    "Adherence is not quality. A rule broken by most professionals may still be worth following, and this measurement cannot tell the difference between a norm and a habit.",
} as const;
