/* The claim ledger.
 *
 * This site is about fidelity, so a false statement on it is the most expensive
 * bug it can carry. Before this file existed, the site advertised a dataset that
 * was not published, behind a filled call to action pointing at the literal
 * string "#placeholder", and described a model artifact that was never built.
 * Those were not copy mistakes. They were a missing data structure.
 *
 * Every claim the site makes about something existing lives here with a state.
 * Components read the state and decide what they are allowed to render. The
 * rule is short: anything that is not `shipped` renders as text with its note,
 * never as a link and never as a call to action. A button is a claim too.
 */

export type ClaimState =
  | "shipped" // exists, works, a visitor can use it today
  | "in-progress" // partially built; say which part
  | "planned" // designed, not built; say what it is blocked on
  | "archived" // was built, no longer the direction, kept and reachable
  | "withheld"; // exists but is deliberately not public

export type Claim = {
  state: ClaimState;
  /* One sentence, in plain language, that a visitor can act on. When the state
     is not `shipped`, this is what gets rendered in place of the link. */
  note: string;
  /* Only ever set when state is `shipped`. The type does not enforce this;
     `linkFor` below does. */
  href?: string;
};

export const status = {
  datasetPublic: {
    state: "withheld",
    note: "The corpus is not published. Publishing it is a separate decision that has not been made.",
  },
  huggingface: {
    state: "planned",
    note: "Nothing is on Hugging Face yet. Publication is blocked on human verification of the test and out-of-distribution splits, and on recovering source URLs, which are recorded for 453 of 3,727 pairs.",
  },
  sourceCode: {
    state: "withheld",
    note: "The repository is private.",
  },
  paper: {
    state: "planned",
    note: "Not written.",
  },
  /* v0.1 of the rubric is written and is the thing this project is now organized
     around, but it has no page on this site yet, so it is not `shipped` here. The
     ledger describes what a visitor can reach, not what exists in the repository. */
  rubric: {
    state: "in-progress",
    note: "Version 0.1 is written: eight dimensions over two axes that are never averaged. It is derived from what practitioners say about this work, and the other half of the method, what they actually do across the corpus, is still pending. It does not have a page here yet.",
  },
  benchmarkRun: {
    state: "planned",
    note: "The design is pre-registered and no run has happened. It is blocked on calibrating the rubric weights against real pairs, and on human verification of the test split.",
  },
  checkerDeterministic: {
    state: "shipped",
    note: "Eleven deterministic checks, running in your browser: eight that read the two texts against each other, and three that read the draft against what its genre requires. Nothing you paste leaves the page.",
    href: "/try/",
  },
  checkerNli: {
    state: "in-progress",
    note: "The entailment layer exists offline but is not wired into this page. Its caveat recall is below the 85 percent bar set for it, which is an open problem rather than a tuning detail.",
  },
  checkerLlm: {
    state: "shipped",
    /* Shipped, with the qualification that makes the claim true: it runs on a
       key the visitor supplies, so it is off by default and off for anyone who
       does not bring one. Saying "shipped" without that would be the same class
       of overclaim the ledger exists to prevent. */
    note: "The judgement layer runs on a key you supply, against your own provider. Every quote it returns is checked back against the text by literal match before it is shown, and a quote that is not there is marked rather than dropped. By the rubric's own contract it advises, never decides.",
    href: "/try/",
  },
  localMotor: {
    state: "in-progress",
    note: "A local service that adds retrieval over the full corpus. It runs on your own machine and is not part of this site.",
  },
  loraModel: {
    state: "archived",
    note: "A LoRA adapter that ran offline on a laptop. It is no longer where the project is going, and it is kept because it worked.",
    href: "/model/",
  },
  translate: {
    state: "archived",
    note: "Generating the translation is the part that frontier models keep getting better at. The project measures instead.",
  },
} as const satisfies Record<string, Claim>;

export type ClaimKey = keyof typeof status;

/* Returns an href only when the claim is actually shipped. Everywhere else it
   returns null and the caller must render `status[key].note` as text. This is
   the mechanism that makes "#placeholder" behind a call to action impossible to
   reintroduce: there is no placeholder to point at. */
export function linkFor(key: ClaimKey): string | null {
  const claim = status[key];
  return claim.state === "shipped" && "href" in claim ? claim.href : null;
}

export function isShipped(key: ClaimKey): boolean {
  return status[key].state === "shipped";
}

/* Build provenance.
 *
 * The verification statistics this site quotes were measured at the v0.3 build.
 * v0.4 is that build with 1,596 rows removed: executive sentences that a grouped
 * pair already covered, kept alongside it by an expansion bug. Every pair in
 * v0.4 is present in v0.3 and went through the same verification, so the rates
 * still describe this corpus, but the counts belong to the earlier build and are
 * labelled that way rather than silently carried forward.
 *
 * Any component rendering a number from `verification` must render `buildTag`
 * beside it. */
export const provenance = {
  buildTag: "measured at the v0.3 build",
  buildNote:
    "v0.4 removes 1,596 redundant rows from the v0.3 build. Every remaining pair went through the verification described here.",
  verification: {
    droppedTotal: 711,
    verifierUnaligned: 287,
    duplicateId: 123,
    thematicLowConfidence: 121,
    nearDuplicate: 119,
    unverifiedPending: 26,
    doclevelPositionalRejected: 18,
    minhashNearDuplicate: 17,
  },
  /* Kept separate because it is a rate, not a count, and rates survive the
     de-duplication that counts do not. */
  agreementRate: 0.936,
  blindAudit: { fabricated: 0, checked: 57 },
} as const;
