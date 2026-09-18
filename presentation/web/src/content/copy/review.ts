/* Copy for Review.
 *
 * Register: instrument, not article. Every string here is read while somebody is
 * mid task, so nothing is here to reassure or to frame. A label names a control,
 * a message says what is wrong and who says so. If a line only sets a tone, it
 * was cut.
 */

export const intro = {
  heading: "Review a draft against its source",
  /* The one sentence that has to land, because it is what makes this different
     from a grammar checker: the comparison is against the finding, not against
     English. */
  lede: "Paste the technical finding and the summary somebody wrote about it. The checks read the summary against the finding, not against style.",
};

export const inputs = {
  sourceLabel: "The finding",
  sourceHint: "Paste it whole. Severity, affected systems, versions, conditions and caveats all feed checks, so a trimmed finding produces a thinner review.",
  sourcePlaceholder: "The technical finding, as filed",
  draftLabel: "The draft",
  draftHint: "The summary, notice, ticket or slide written from that finding.",
  draftPlaceholder: "The text you want checked",
  situationLabel: "What is being written",
  situationHint: "This sets which checks apply and how much each one weighs. A breach notice and a SOC handover are not judged alike.",
  jurisdictionLabel: "Jurisdiction",
  /* Situation 06 is the only one where two authorities require opposite things,
     so it is the only one that asks. See research/genre-lists/06.json. */
  jurisdictionHint: "Breach notices are governed differently by jurisdiction, and two of the rules in this corpus contradict each other, so the applicable set has to be chosen.",
  run: "Run the checks",
  clear: "Clear",
};

/* The strip the situation picker reveals once a choice is made. These say what
   the choice just did to the checks, which is the only reason to state them. */
export const strip = {
  readerLabel: "Who reads it",
  published: "A named body publishes a checklist for this genre, so a failed check decides.",
  conventional: "No body publishes a checklist for this genre, so the checks advise rather than decide.",
  countUnit: { one: "word", many: "words" },
};

/* Situation 06 only. The corpus holds two authorities that require opposite
   things, so the set has to be chosen before the checks can mean anything. */
export const jurisdictions = [
  { id: "uk-eu", label: "UK and EU, under GDPR" },
  { id: "massachusetts", label: "Massachusetts" },
  { id: "california", label: "California" },
] as const;

export const layers = {
  heading: "What ran",
  deterministic: {
    label: "Deterministic",
    state: "Running",
    note: "Reads strings. Fails only by showing the text that made it fail.",
  },
  withKey: {
    label: "Entailment and judgement",
    stateOff: "Needs a key",
    stateOn: "Running",
    note: "Sentence support and the qualitative calls no rule can make. Reported as opinion.",
  },
};

export const results = {
  cleanHeading: "No check fired",
  cleanNote: "That means nothing was detected, not that nothing is wrong. The list below is what went unexamined.",
  failHeading: "Checks failed",
  warnHeading: "Checks warned",
  evidenceLabel: "Matched",
  sourceLabel: "Required by",
  undecidedHeading: "Not decidable by rule",
  undecidedNote: "These need judgement. With a key they are sent to the model and come back marked as opinion.",
  axisHeading: "Two scores, kept apart",
  axisNote: "Fidelity is owed to the finding. Utility is owed to the reader. They are never averaged, because a gain on one would hide a failure on the other.",
};

export const empty = {
  heading: "Nothing to check yet",
  note: "The checks run as you type. Paste a finding and a draft written from it.",
};

/* The panel that states coverage. It is not a disclaimer: the measurement
   contract says a property a layer cannot decide gets declared instead of
   quietly passed, so publishing the gaps is the instrument working. */
export const gaps = {
  heading: "What this does not check",
  note: "A clean result means these went unexamined, not that they went well.",
};

/* The panel that publishes what the rules could not settle.
 *
 * Two different things live in it. An undecided item is something a rule looked
 * at and could not settle. A declared item is something true of the genre that
 * the checker states and deliberately does not enforce, such as a 72 hour
 * deadline, which is a property of the process and not of the text.
 *
 * On the formal genres each list runs to dozens of items. The counts and the
 * reasons stay on screen because they are the disclosure; the items themselves
 * fold, so the panel that reports non detection cannot bury the panel that
 * reports a failure.
 */
export const undecidedPanel = {
  chip: "not decided",
  itemsLabel: (n: number) => (n === 1 ? "1 item" : `${n} items`),
  declaredHeading: "Stated, not judged",
  declaredNote:
    "These rules hold for this genre and the checker enforces none of them. Each group says why.",
  sourceFileLabel: "from",
  kindWhy: {
    clock: "A deadline is a property of the process. No reading of the text can say when it was sent.",
    template: "A controlled template needs structure this checker does not read.",
    length: "The limit is counted in pages, slides or minutes, which belong to a rendered artifact and not to text.",
    fields: "The rule names no sections, so there is nothing in it to match against.",
  },
};

/* The layers above the rule layer, and the one thing that has to be true of
   every string in here: none of them may read as a verdict.
 *
 * A rule fails by showing the string that made it fail, so a rule may decide. A
 * model produces a fluent sentence whether or not it read the text correctly,
 * so a model may only report. Every quote it returns is anchored back into the
 * text by literal substring match before it reaches this panel, and the count
 * of quotes that failed to anchor is published beside the result, because a
 * model that cannot point at the text is telling you something about the answer.
 */
export const judgement = {
  heading: "What needed judgement",
  lede: "The rules above settle what a string can settle. These are the parts they cannot reach: claims that are paraphrases rather than literals, questions with no keyword, and language that is banned as a class rather than as a word.",
  run: "Run the judgement layer",
  rerun: "Run again",
  running: "Reading both texts",
  cancel: "Cancel",
  needsKey: "This layer needs a key. The deterministic checks above are unaffected and have already run.",
  opinionChip: "opinion",
  modelLine: (model: string, provider: string) => `${model}, at ${provider}, answering with quotes`,

  /* The anchoring contract, stated where the reader sees the result. */
  anchoredLabel: "Quoted from the text",
  unanchoredChip: "quote not found",
  unanchoredWhy:
    "The model returned words it said were in the text, and they are not there. The judgement is shown because hiding it would be worse, and it is marked because an unfound quote is evidence about the answer.",
  unanchoredCount: (n: number) =>
    n === 1
      ? "1 quote the model returned is not in the text it named."
      : `${n} quotes the model returned are not in the text it named.`,

  claimsHeading: "Claims the draft makes",
  claimsNote: "Each claim read against the finding. Supported means the finding states or entails it, not that it is true.",
  support: {
    supported: "supported by the finding",
    contradicted: "contradicted by the finding",
    absent: "not in the finding",
  },
  requiredBy: "required by",
  sourceSpanLabel: "In the finding",
  draftSpanLabel: "In the draft",

  questionsHeading: "Questions this reader is entitled to",
  questionsNote: "Taken from published guidance for this genre. The model judged whether the draft answers each one in substance.",
  answered: "answered",
  unanswered: "not answered",

  jargonHeading: "Language this genre bans",
  jargonNote: "Each entry bans a kind of language rather than a fixed string, which is why no rule could settle it.",
  jargonPresent: "present",
  jargonAbsent: "not detected",

  advisory:
    "No named body publishes a checklist for this genre, so nothing on this panel decides anything. It is one reading, reported as one reading.",
  nothingFound:
    "The model flagged nothing here. That is a non detection and not a verification: it read the same two texts you did, and it can miss.",
  omitted: (n: number) => `${n} further items were not sent, to keep one request one request. They stay listed as undecided above.`,

  errors: {
    auth: "The provider rejected the key.",
    quota: "The account behind that key has no credit left.",
    rateLimit: "The provider is rate limiting. Wait and run it again.",
    network: "The browser never reached the provider.",
    response: "A reply arrived but it was not the answer that was asked for.",
    generic: "The judgement layer did not run.",
  },
};

/* Labels on the results list. These are chips and counters rather than prose,
   but they still say things the project has to mean: a clean run is stamped
   "non detection" and never "pass", and a flag with no string behind it is
   reported as a contract violation rather than rendered as an empty row. */
export const resultLabels = {
  advisoryLabel: "advisory",
  cleanChip: "non detection",
  ranNote: (n: number) => `${n} checks ran`,
  noEvidence: "this check reported no string, which its own contract forbids",
};

/* Labels on the two axis cards. "unexamined" and "ran, nothing fired" are the
   two states a passing checker usually collapses into one, and keeping them
   apart is most of what this panel is for. */
export const axisLabels = {
  unexamined: "unexamined",
  unexaminedWhy: "No check reaches this dimension. It went unexamined, which is not the same as passing.",
  quiet: "ran, nothing fired",
  invalidatingLabel: "weight 3 failure",
  weightWord: (w: number) => `weight ${w}`,
  fired: (n: number) => (n === 1 ? "1 check fired" : `${n} checks fired`),
  noneFired: "no check fired on this axis",
  split: (failed: number, warned: number) =>
    [failed ? `${failed} failed` : null, warned ? `${warned} warned` : null].filter(Boolean).join(", "),
  coverage: (examined: number, total: number, unexamined: number) =>
    `${examined} of ${total} dimensions examined${unexamined ? `, ${unexamined} unexamined` : ""}`,
  failedCount: (n: number) => (n === 1 ? "1 failed" : `${n} failed`),
  warnedCount: (n: number) => (n === 1 ? "1 warned" : `${n} warned`),
};
