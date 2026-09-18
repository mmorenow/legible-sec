// Copy for the library page.
//
// The route was /dataset until 2026-08-31 and is /library now. This module was
// already named for the destination, so the move was a rename of routes only,
// with no copy to chase. /dataset survives as a stub that points here.

export const meta = {
  title: "LEGIBLE · the library",
  /* "related work" was dropped from this claim: the page covers licensing (in
     the Access block) but ships no related-work comparison, so the description
     should not promise one (DATA-09). */
  /* The search became the page's primary function on 2026-09-01 and the
     description still described only the reference material under it. */
  description:
    "Paste a security finding and see the pairs it matches: the technical text as it was written, beside the executive sentence somebody shipped from it. Then the corpus in depth: the pair unit, composition, sources, method, verification, schema and licensing.",
  canonical: "/library/",
};

export const hero = {
  heading: "The library, in depth.",
  lede: "Everything behind the numbers on the home page: the pair unit, composition, method, verification, and the agent workforce that built it.",
};

/* The licensing split. `label` rather than `kicker`: this page is already at
   its two-kicker budget (DATA-02), so the band renders a plain mono label.
   The two buckets themselves live in `@/content/data`,
   derived from the licence counts, because which pairs may be redistributed is
   a fact about the corpus and not a sentence someone wrote. */
export const licensingBlock = {
  label: "Licensing",
  heading: "Two buckets, drawn on one line: what may be redistributed.",
  lede: "Every pair carries the licence of the document it came from. The split below is the one that matters downstream, because it decides what could leave this project and what could only ever be quoted.",
};

/* Limitations. These have been written in `@/content/data` since v0.1 and were
   never rendered anywhere, which is the wrong way round for a project whose
   subject is what a text leaves out. */
export const limitationsBlock = {
  label: "Limits",
  heading: "What this corpus is not.",
  lede: "Each of these is a reason a result measured on the library might not hold outside it. They are listed here rather than in a paper nobody has written yet.",
};

/* The /dataset stub. A static export cannot issue a 301, so the old route
   stays alive as one card and a meta refresh: about a kilobyte, and it never
   404s on a link somebody already shared. */
export const moved = {
  meta: {
    title: "LEGIBLE · this page moved",
    description: "The dataset page is now the library. This route redirects to /library/.",
    canonical: "/library/",
  },
  to: "/library/",
  label: "This page moved",
  heading: "The dataset page is now the library.",
  body: "Same corpus, same numbers, a name that says what it is. If your browser does not take you there on its own, follow the link.",
  linkLabel: "Go to the library",
};

// ---------------------------------------------------------------------------
// The finding search
//
// The paste box at the top of the page. Two copy laws govern this block.
//
// 1. The method is named for what it is. The retired Browse control (see
//    `src/components/_archive/try/BrowseMode.tsx`) headlined itself as full
//    retrieval by meaning while serving six baked rows with its motor offline.
//    This path does not read for meaning: it compares identifiers, field
//    values and words, and it says so. A control that overstates its own
//    method is the failure this project was built to name, and it is not going
//    back on the page under a new heading.
//
// 2. The coverage is stated as a number, not implied. The index carries only
//    the pairs whose licence permits redistribution, so the count on this page
//    is smaller than the count everywhere else on it. That gap is published
//    with its reason rather than left for a reader to notice.
//
// Numbers are interpolated from the index's own meta block, never written
// here, for the same reason `@/content/facts` exists.
// ---------------------------------------------------------------------------

export const findingSearch = {
  label: "Search",
  heading: "A finding you already have, against the sentences already written.",
  lede: "The box takes a whole security finding, pasted as it was filed. What comes back is real pairs: the technical text as it was written, beside the executive sentence somebody actually shipped from it.",

  fieldLabel: "The finding",
  fieldHint:
    "Paste it whole. Identifiers, severity and the vulnerability class are all matched on, so a trimmed finding matches on less.",
  placeholder: "The technical finding, as filed",
  clear: "Clear",
  countUnit: { one: "character", many: "characters" },

  /* The method label. Read requirement 1 above before editing this string. */
  method:
    "Lexical match, run in this browser. Identifiers, field values and words in the pasted text are compared against the same in every browsable pair. Nothing here reads for meaning, so a pair that says the same thing in different words does not surface.",
  privacy:
    "The pasted text stays on this machine. The index is a static file and there is no server behind this page to send it to.",

  /* Coverage. The first line holds until the index resolves and the counts
     become real; the second states them. */
  coveragePending:
    "The index carries only the pairs whose licence permits redistribution, which is fewer than the corpus holds. The counts arrive with it.",
  coverage: (searchable: string, total: string, withheld: string) =>
    `${searchable} of ${total} pairs are searchable here. The other ${withheld} are withheld, and the index states why:`,
  stamp: (buildTag: string, generatedAt: string) => `index ${buildTag} · generated ${generatedAt}`,

  empty: {
    note: "The box takes a concept, an identifier such as a CVE or CWE number, or a whole finding pasted out of a report. Every result is a pair that already exists in the corpus, never one written here.",
    tryLabel: "Try one",
    /* Probes, not results. Short enough to show the shape of a query without
       standing in for a finding. */
    suggestions: ["CVE-2021-44228", "CWE-79", "server side request forgery", "hardcoded credentials", "weak password hashing"],
    exampleLabel: "an example finding",
    /* Written for this box, from a textbook vulnerability class. It is an
       example query and not a record from the corpus, and it says so. */
    example:
      "The application fetches a user supplied URL server side without validating the host, which allows requests to the cloud metadata service at 169.254.169.254 and disclosure of the instance credentials. CWE-918. Severity: high.",
  },

  results: {
      /* The chip row shows the identifiers and field values in full and only
       the strongest few shared words, because a long paste shares dozens with a
       long finding. The remainder is counted rather than hidden. */
    moreWords: (n: number) => (n === 1 ? "and 1 more word" : `and ${n} more words`),
  matchedLabel: "Matched on",
    exactBadge: "exact identifier match",
    /* Says why the order is the order. An exact CVE or CWE hit is a different
       kind of evidence from word overlap, so it is ranked and labelled apart. */
    rankNote: "Exact identifier matches rank first. Everything under them ranked on shared fields and shared words, and each result prints which.",
    countLabel: (n: string, one: boolean) => (one ? `${n} pair matched` : `${n} pairs matched`),
    truncatedTech: "technical text truncated in the browsable index",
    truncatedExec: "executive text truncated in the browsable index",
    /* What each signal kind is. The chip prints the value beside it. */
    signalKinds: {
      cve: "CVE",
      cwe: "CWE",
      severity: "severity",
      vulnClass: "class",
      term: "word",
    },
  },

  loading: {
    note: "loading the index",
    detail: "The index is fetched once, on the first keystroke, and searched here after that.",
  },

  searching: { note: "matching against the browsable pairs" },

  noResults: {
    heading: "No browsable pair shares enough with that text.",
    /* The line the retired Browse component got right. */
    body: "LEGIBLE never fabricates one. A lexical match needs a shared identifier or shared words, so a finding phrased unusually can miss a pair that is really in the corpus.",
    queryLabel: "searched for",
  },

  indexMissing: {
    heading: "The search index is not in this build.",
    body: "The index is generated from the corpus, which is private, and it is not committed. A checkout without it serves this page with the box inert rather than with a baked sample under a live control. Everything below on this page is unaffected.",
    pathLabel: "expected at",
  },

  error: {
    heading: "The index did not load.",
    body: "The failure is reported rather than covered with a sample. A control that keeps answering after its data source is gone is the exact behaviour this project exists to catch.",
    detailLabel: "reported",
  },
} as const;

// ---------------------------------------------------------------------------
// The blocks the page composes out of components
//
// Every string below was written inline in the component that renders it,
// which is how one sentence ends up in two files carrying two different
// numbers. The components keep their layout, their motion and their data; they
// no longer keep their words. Nothing here was reworded on the way across.
// ---------------------------------------------------------------------------

/* PairExample: the pair unit. The heading names the three things one record
   holds, in the order the panel below it shows them. */
export const pairExample = {
  heading: "One finding. Two registers. One judged link.",
};

/* SourcesStrip: the wordmark band. A plain mono label rather than a kicker,
   because this page is already at its two-kicker budget (DATA-02). */
export const sourcesStrip = {
  label: "Drawn from public reports by",
};

/* Proven: what the corpus was checked for, and what it was not. The lede takes
   its two percentages as arguments because both are derived in the component
   from `@/content/facts`, and a share written out here by hand is a share that
   drifts away from the build it describes. */
export const proven = {
  heading: "What was checked, and what was not.",
  lede: (noSeverityPct: string, noSourceUrlPct: string) =>
    `The links are tested rather than assumed: three independent judge passes on every pair, and a blind audit that re-extracted held-out reports with no access to the pipeline. What that does not cover is on the record too. No pair was verified by a human reading it end to end, ${noSeverityPct} of pairs come from documents that state no severity at all, and ${noSourceUrlPct} carry no source URL.`,
};

/* AgentsStrip: how the corpus was built. `ledeIntro` opens the paragraph that
   `integritySection.lede` in `@/content/system` closes. The two halves stay
   apart because the second one is a statement about the pipeline and is
   maintained next to it. */
export const agentsStrip = {
  heading: "How the corpus was harvested, curated and checked.",
  ledeIntro:
    "This is the story of how the dataset was built, separate from the fidelity judge that checks every translation the product writes.",
};

/* Schema: the field list, and the notes that read the state of the corpus off
   it. The field names stay in the component: `source_url` and `source_doc_id`
   are identifiers out of the schema, not prose, and they render in mono.
   `sourceUrlNote` is therefore stored as the two halves of one sentence that
   the markup wraps around the second name. Read end to end it is:
   "source_url is recorded on N records, P of the corpus. The rest identify
   their document by source_doc_id alone, and recovering the missing links is a
   gate on publishing." */
export const schema = {
  heading: "Every pair, fully described.",
  sourceUrlNote: {
    lead: (records: string, pct: string) =>
      `is recorded on ${records} records, ${pct} of the corpus. The rest identify their document by`,
    tail: "alone, and recovering the missing links is a gate on publishing.",
  },
};
