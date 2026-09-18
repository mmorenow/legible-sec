/* Copy for the home page.
 *
 * Register: documentary. This is an open source research project, not a product
 * launch, and the previous version of this page read like the latter: a filled
 * call to action above the fold, slogan headlines, and a brand line repeated
 * across three surfaces. There are no calls to action here. Links are named
 * after where they go.
 *
 * Numbers interpolate from @/content/facts and are never written by hand.
 */

import * as f from "@/content/facts";
import { POPULATION } from "@/content/behaviour";

export const meta = {
  canonical: "/",
};

export const hero = {
  kicker: "Open research project",
  headline: "Explaining a security finding is harder than finding it.",
  lede:
    "Whoever has to act on a vulnerability is usually not the person who found it. Somewhere between those two people the finding has to be retold, and the retelling is where it goes wrong: softened past the point of urgency, inflated past the point of belief, or written so that nobody can tell what to do next. LEGIBLE is an attempt to study that retelling instead of guessing at it.",
  cta: { href: "#origin", label: "Where this came from" },
};

/* The key facts band. Four tiles, down from six: "years spanned" was true of
   half the corpus and "source families" was never a defined thing. */
export const facts = {
  caption: `${f.formatCount(f.PAIRS)} pairs from ${f.formatCount(f.DOCUMENTS)} public documents, written by ${f.ORGANIZATIONS} organizations.`,
};

export const origin = {
  id: "origin",
  kicker: "Where this came from",
  heading: "It started by collecting what professionals already write.",
  body: [
    "Security reports usually contain both halves of the problem in the same document. The finding is written for engineers, in the body. A few pages earlier, in the summary, the same firm has already retold that finding for whoever commissioned the report. Two registers, one author, one subject. That is the most common shape, and not the only one: the unit is the pair, so the two halves can also come from two publications about one event, or from a record and the message somebody sent about it.",
    `So the first thing this project did was collect those pairs: ${f.formatCount(f.PAIRS)} of them, out of ${f.formatCount(f.DOCUMENTS)} public documents from ${f.ORGANIZATIONS} organizations, including consultancies, government agencies and open source maintainers. The technical half and the executive half of the same finding, side by side, both written by a person.`,
    "The reason to collect them was simple. Anyone who has to write one of these has no examples to work from, because the good ones are scattered across thousands of PDFs nobody reads twice. Put enough of them in one place and you have something better than advice: you have a record of what people who do this for a living actually do.",
  ],
  note: "The corpus is not published. That is a separate decision, and it has not been made.",
};

/* The three instruments, in the order the owner asked for: Library, Benchmark,
   Analyzer. Each one paragraph, each linking out. The rubric is named as what
   they share rather than presented as a fourth thing. */
export const instruments = {
  kicker: "What is built on it",
  heading: "Three instruments, one definition underneath them.",
  lede:
    "Each of these needs an answer to the same question: what makes a retelling good or bad? That answer is the rubric, and it is the part of the project that everything else depends on.",
  items: [
    {
      key: "library",
      title: "The library",
      href: "/library/",
      linkLabel: "Read the corpus",
      body:
        "The pairs themselves, with what is known about each one: the organization, the severity the source declared, how the two halves were matched, and under what licence. It is the evidence the rest of the project argues from, and the reason it is browsable is the reason it was collected.",
    },
    {
      key: "benchmark",
      title: "The benchmark",
      href: "/benchmark/",
      linkLabel: "Read the design",
      body:
        "A pre-registered test of how well language models perform this retelling, scored against the rubric rather than against a preference. It has not been run. The design is published anyway, including the conditions and the scoring, so that the result cannot be chosen after the fact.",
    },
    {
      key: "analyzer",
      title: "The checker",
      href: "/try/",
      linkLabel: "Run it on a draft",
      body:
        "Paste a finding and a draft summary of it, and the deterministic layer reports what it caught: identifiers dropped, numbers changed, severity moved, conditions lost. It runs in your browser. It also states what it does not check, which on a project about fidelity is the more useful half.",
    },
  ],
  rubric: {
    title: "The rubric",
    href: "/rubric/",
    linkLabel: "Read the rubric",
    body:
      "Eight dimensions across two axes that are never averaged together: whether the retelling is faithful to the finding, and whether it is useful to the person reading it. A text can be entirely faithful and useless, or useful and wrong. Both are failures, and measuring them as one number hides that.",
  },
};

/* The finding that most justifies the project existing. It is behavioural, it is
   measured, and it carries its population, per the rubric's own D2. */
export const evidenceTeaser = {
  kicker: "One measurement",
  heading: "The most repeated advice is the least followed.",
  /* The population was written here by hand while the caption two keys below
     reads it from `behaviour.ts`. Two numbers about the same thing, one of
     which cannot follow the data: exactly the drift this file's own header
     forbids. It now comes from the same place as the caption. */
  body:
    `Across ${POPULATION.pairs.toLocaleString("en-US")} finding-level pairs, professionals open with the business impact 16 percent of the time. They keep at least one number 29 percent of the time. They preserve a stated caveat 4 percent of the time. Six of the eight rules most commonly given as best practice are followed by fewer than half the people who write these documents for a living.`,
  reading:
    "That does not make the advice wrong or the professionals right. It means a rubric cannot be assembled out of received wisdom, and that a checker enforcing conventional advice would flag the professional corpus itself.",
  provenance: "Measured on v0.4, finding-level aligned pairs only. Method and counts: research/10-playbook-mining-v0.4.md",
  /* The bar card beside those paragraphs. Its population comes from
     `@/content/behaviour`, which is where the measurement and its definition
     live, for the same reason the counts above come from `@/content/facts`:
     the number in the sentence and the number in the chart have to be the
     same number. */
  chartHeading: "How often professionals follow each rule",
  chartNote: `Share of applicable pairs, out of ${POPULATION.pairs.toLocaleString("en-US")} finding-level aligned pairs. ${POPULATION.barNote}`,
};
