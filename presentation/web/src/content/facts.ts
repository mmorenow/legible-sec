// The site's single source of numeric truth about the dataset.
//
// WHY THIS FILE THROWS
//
// An earlier version of the site shipped distributions that did not reconcile
// to the total the same page stated: a severity chart that added up to less
// than the headline pair count, because a blank bucket had been quietly
// dropped. Nobody noticed, because nothing checked. Catching that class of bug
// cannot depend on a human remembering to add up a chart.
//
// So the invariants run at module scope. If any distribution stops summing to
// PAIRS, importing this module throws, `next build` fails, and the broken
// numbers never reach a reader. A loud build failure is the cheap outcome; a
// published page whose own figures contradict each other is the expensive one.
//
// Raw counts live in facts.generated.ts and come from the dataset. Derived and
// formatted values live here. Nothing on the site should hardcode a number that
// belongs to either.

import {
  ALIGNMENT_METHODS,
  DOC_TYPES,
  LICENSES,
  ORGANIZATIONS,
  ORG_TYPES,
  OTHER_ORGS,
  PAIRS,
  REGISTERS,
  SEVERITY,
  SPLITS,
  TOP_ORGS,
  VULN_CLASS,
  type FactRow,
} from "./facts.generated";

export * from "./facts.generated";

/**
 * Throws unless the rows account for exactly `expected` items.
 *
 * The error names the distribution, what it got and what it owed, so a build
 * failure points straight at the offending list instead of a bare assertion.
 */
export function assertSums(name: string, rows: FactRow[], expected: number): void {
  const sum = rows.reduce((total, row) => total + row.n, 0);
  if (sum !== expected) {
    throw new Error(
      `facts: distribution "${name}" sums to ${sum} but the dataset has ${expected} pairs ` +
        `(off by ${sum - expected}). Every pair must land in exactly one bucket. ` +
        `Fix the grouping in scripts/gen_site_facts.py and regenerate; do not edit facts.generated.ts.`
    );
  }
}

// Run at import time, so a contradiction fails the build rather than shipping.
assertSums("severity", SEVERITY, PAIRS);
assertSums("vulnClass", VULN_CLASS, PAIRS);
assertSums("registers", REGISTERS, PAIRS);
assertSums("licenses", LICENSES, PAIRS);
assertSums("splits", SPLITS, PAIRS);
assertSums("alignmentMethods", ALIGNMENT_METHODS, PAIRS);
assertSums("orgTypes", ORG_TYPES, PAIRS);

// Not in the required set, but they reconcile too, so hold them to it.
assertSums("docTypes", DOC_TYPES, PAIRS);
assertSums("topOrgs + other", [...TOP_ORGS, { key: "other", n: OTHER_ORGS }], PAIRS);

// ---------------------------------------------------------------------------
// Derived values. Counts stay upstream; shaping and formatting happen here.
// ---------------------------------------------------------------------------

/** Share of the dataset a bucket represents, as a 0-100 number. */
export function pct(n: number, total: number = PAIRS): number {
  if (total === 0) return 0;
  return (n / total) * 100;
}

/** Percentage for display, e.g. formatPct(453) -> "12%". */
export function formatPct(n: number, total: number = PAIRS, decimals = 0): string {
  return `${pct(n, total).toFixed(decimals)}%`;
}

/** Thousands separators, e.g. 3727 -> "3,727". */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** A distribution row with its share of the total already worked out. */
export type FactShare = FactRow & { pct: number };

export function withShares(rows: FactRow[], total: number = PAIRS): FactShare[] {
  return rows.map((row) => ({ ...row, pct: pct(row.n, total) }));
}

/** How many organizations fall outside TOP_ORGS, for an "and N more" line. */
export const OTHER_ORG_COUNT = ORGANIZATIONS - TOP_ORGS.length;

/**
 * The top contributors plus the tail, ready to render.
 *
 * `remainderPairs` is how many pairs the listed organizations do not cover;
 * `remainderOrgs` is how many organizations those pairs come from.
 */
export const topOrgsWithRemainder = {
  rows: withShares(TOP_ORGS),
  remainderPairs: OTHER_ORGS,
  remainderOrgs: OTHER_ORG_COUNT,
  label: `and ${formatCount(OTHER_ORG_COUNT)} more organizations`,
};
