import { MOTOR_JUDGE_CHECKS } from "@/content/system";
/* Retired 2026-08-31, not deleted.
 *
 * Six exports from system.ts that no component imported. They describe the
 * project as a translator with a judge attached, which is the framing the site
 * has moved away from: the centre is now the rubric and the instruments built on
 * it. Their numbers were corrected during the truth pass before they were moved,
 * so nothing false is preserved here, only something no longer true of the
 * project.
 *
 * playbookSection is the one worth explaining. Its five myth rows were real
 * measurements, not opinions, but they were rendered as bare percentages with no
 * population and no method, which is the failure the rubric's D2 names. They have
 * been re-derived against v0.4 and now live in content/behaviour.ts, each carrying
 * what it counted and how many pairs it applies to. Its twelve prompt rules are
 * generation-side and belong to the archived translator.
 */

import * as f from "../facts";
import { BROWSER_GATE_CHECKS as GATE_CHECK_COUNT } from "../system";

// The Station and MythRow types travelled with these sections and are declared below.


// ============================================================
// §5.2 Hero evolution (content only; Hero.tsx itself is Phase 2)
// ============================================================
// Not rendered: no route imports this. It is kept accurate anyway, because a
// stale hero is the easiest false number on the site to wire back up by
// accident.
export const heroV2 = {
  kicker: `Dataset and system · ${f.DATASET_VERSION}, not published`,
  // "executive sentence" renders in cobalt ink, "finding" in rust ink,
  // "checks them" in --color-ok ink (the finding / sentence / checked triad).
  statement: {
    pre: "The ",
    cobalt: "executive sentence",
    mid1: ", paired to the ",
    rust: "finding",
    mid2: " it came from. And the system that drafts new ones, then ",
    ok: "checks them",
    end: ".",
  },
  ctaPrimary: { label: "See the system", href: "#system" },
  ctaSecondary: { label: "Try it in your browser", href: "/try/" },
  facts: [
    { value: f.formatCount(f.PAIRS), label: "aligned pairs" },
    { value: "573", label: "curated 1:1 core" },
    { value: String(f.REGISTERS.length), label: "registers" },
    { value: "12", label: "playbook rules" },
    { value: String(GATE_CHECK_COUNT), label: "deterministic checks" },
    { value: "9B", label: "the local model, unpublished" },
  ],
};

// ============================================================
// §5.3 #system : the living schematic
// ============================================================
export type Station = {
  key: string;
  label: string;
  detail: string;
  linkLabel: string;
  href: string;
  secondaryLinkLabel?: string;
  secondaryHref?: string;
};


export const systemSection = {
  kicker: "The system",
  h2: "How it works, end to end.",
  lede: "Real professional translations become rules, evidence, and a judge. A small local model learns the moves. Every output has to survive the checks.",
  stations: [
    {
      key: "finding",
      label: "FINDING",
      detail: "rust chip, paste-in",
      linkLabel: "the dataset",
      href: "#dataset",
    },
    {
      key: "evidence",
      label: "EVIDENCE",
      detail: "corpus tray: dot field + 4 rising chips",
      linkLabel: `${f.formatCount(f.PAIRS)} pairs`,
      href: "#dataset",
    },
    {
      key: "prompt",
      label: "PROMPT",
      detail: "playbook page chip + 4 exemplar chips + finding chip merge into one",
      linkLabel: "12 rules",
      href: "#playbook",
      secondaryLinkLabel: "evidence panel",
      secondaryHref: "#evidence",
    },
    {
      key: "translator",
      label: "TRANSLATOR",
      detail: "two model chips: cloud and local · LoRA (local highlighted)",
      linkLabel: "LoRA on a laptop",
      href: "/model/",
    },
    {
      key: "judge",
      label: "JUDGE",
      detail: "eight gate lights in a vertical rail",
      linkLabel: "9 checks",
      href: "#judge",
    },
    {
      key: "output",
      label: "OUTPUT",
      detail: "cobalt sentence chip + green badge row docking right",
      linkLabel: "try it",
      href: "/try/",
    },
  ] satisfies Station[],
  failureBeat: {
    label: "rejected, with evidence",
    detail: "a second output chip takes the gate rail every other idle pulse; light #3 (severity) flips red and the chip drops into this tray",
  },
};

// ============================================================
// v3 §4.3 #workflow : the icon-rich workflow rail (replaces SystemSchematic)
// ============================================================


// ============================================================
// §5.4 #dataset : dataset, condensed
// ============================================================
export const datasetSection = {
  h2: `Built on ${f.formatCount(f.PAIRS)} real translations.`,
  lede: `Findings and the executive prose professionals actually wrote about them, in the same documents. ${f.formatCount(f.DOCUMENTS)} documents, ${f.ORGANIZATIONS} organizations. A report year is recorded on ${f.formatCount(f.YEAR_KNOWN)} of the pairs, and those run from ${f.YEAR_MIN} to ${f.YEAR_MAX}. Never generated.`,
  // PairSpecimen reuses examplePairs[0] (the PyPI access-control pair) from data.ts.
  specimen: {
    exampleIndex: 0,
    chips: [
      { label: "severity", value: "High" },
      { label: "alignment", value: "aligned · 0.99" },
      { label: "license", value: "CC-BY-SA-4.0" },
    ],
  },
  curationFunnel: {
    // 994 finding-level 1:1 pool → auto-triage → 925 candidates → 4 LLM
    // reviewers (~231 each) → Opus adjudication of disagreements → 573.
    intake: { n: 994, label: "finding-level 1:1 pool" },
    stages: [
      {
        key: "auto-triage",
        label: "auto-triage",
        n: 925,
        dropped: 69,
        droppedLabel: "table spans, verbatim copies",
      },
      {
        key: "reviewers",
        label: "4 LLM reviewers",
        n: 925,
        sublabel: "independent verdicts, disagreements escalated",
      },
      {
        key: "adjudication",
        label: "Opus adjudication",
        n: 573,
        sublabel: "curated 1:1 core",
      },
    ],
    output: { n: 573, label: "curated 1:1 core" },
    difficultySplit: [
      { key: "hard", n: 370, label: "hard" },
      { key: "easy", n: 202, label: "easy" },
      { key: "medium", n: 1, label: "medium" },
    ],
  },
  cta: { label: "Explore the full dataset", href: "/dataset/" },
  ctaNote: "composition, registers, method, schema, licensing",
};

// ============================================================
// §5.5 #playbook : myth vs measurement
// ============================================================
export type MythRow = {
  rule: string;
  value: string;
  valueLabel: string;
  verdict: "Replaced" | "Refined" | "Confirmed";
  tone: "bad" | "warn" | "ok";
  footnote: string;
};


export const playbookSection = {
  h2: "The rules were mined, not assumed.",
  lede: "Twelve operative rules distilled from the corpus, injected verbatim into the system prompt. Measured against what professionals actually write, three of the five canonical rules of executive security communication did not survive.",
  chartTitle: "Five canonical rules, measured",
  mythRows: [
    {
      rule: "Lead with the business impact",
      value: "1%",
      valueLabel: "business vocabulary in exec spans",
      verdict: "Replaced",
      tone: "bad",
      footnote: "professionals lead with attacker capability",
    },
    {
      rule: "Keep every number",
      value: "22%",
      valueLabel: "of number-bearing findings keep even one",
      verdict: "Replaced",
      tone: "bad",
      footnote: "numbers survive by decision-value",
    },
    {
      rule: "Preserve the caveats",
      value: "1-2%",
      valueLabel: "caveat clauses survive",
      verdict: "Replaced",
      tone: "bad",
      footnote: "32% fold into the actor phrase instead",
    },
    {
      rule: "Avoid jargon with executives",
      value: "34%",
      valueLabel: "of exec spans carry technical vocabulary",
      verdict: "Refined",
      tone: "warn",
      footnote: "instance jargon rises to its risk class",
    },
    {
      rule: "Never lead with the mechanism",
      value: "~0%",
      valueLabel: "mechanism-first translations",
      verdict: "Confirmed",
      tone: "ok",
      footnote: "",
    },
  ] satisfies MythRow[],
  receipt: {
    quote: "a static nonce is used for AES-GCM encryption of cloud backups",
    caption: "an executive summary, unglossed: vocabulary altitude is register-dependent",
  },
  rulesLedgerGroups: [
    {
      group: "The core move",
      rules: [
        { n: 1, text: "Re-anchor: from artifact to who can do what" },
        { n: 2, text: "Fold preconditions into the actor phrase, not a caveat" },
        { n: 3, text: "Compress hard: one sentence per finding, group by root cause" },
        { n: 4, text: "Scale consequence language to severity, never uniform temperature" },
      ],
    },
    {
      group: "Fidelity discipline",
      rules: [
        { n: 5, text: "Severity words are exact or absent" },
        { n: 6, text: "Calibrate, never downgrade: state difficulty, keep the band" },
        { n: 7, text: "Numbers survive by decision-value, not by count" },
        { n: 8, text: "Bounded assurance: confirmed, believed, or under investigation, stated" },
        { n: 9, text: "Never invent; every fact traces to the finding" },
      ],
    },
    {
      group: "Register and format",
      rules: [
        { n: 10, text: "Match the audience's rung; translate jargon to its risk class" },
        { n: 11, text: "Document-level output opens with a scoped verdict" },
        { n: 12, text: "Standalone artifacts carry severity, precondition, and one scoped action" },
      ],
    },
  ],
  closingStat: "compression measured at roughly 19:1 · the target: one sentence per finding, about 25 words",
};

// ============================================================
// §5.7 #judge : what the deterministic layer can and cannot establish
// ============================================================


// ============================================================
// §5.11 #try teaser
// ============================================================
export const tryTeaserSection = {
  kicker: "Local demo",
  h2: "Your finding, translated on your machine.",
  lede: "Paste a finding, pick the reader, and get the sentence, the judge's report, and the human precedents. Local retrieval, local judge, optionally a fully local model.",
  commands: ["uvicorn app.server:app --port 8787", "npm run dev"],
  cta: { label: "Open the instrument", href: "/try/" },
  replayCaption: "recorded session · the live instrument runs on localhost",
};


// ============================================================
// §5.12 #access : additions to the existing Access component
// ============================================================


export const accessLinks = [
  { label: "Dataset in depth", href: "/dataset/" },
  { label: "Run it locally", href: "/try/" },
];

/* Retired 2026-09-01, from src/content/data.ts, where they were dead exports.
 *
 * Both describe a published dataset. It is not published: `status.ts` records
 * `datasetPublic` as withheld and `huggingface` as planned. Nothing rendered
 * them, so nothing on the site was making the claim, but a load call and a
 * BibTeX entry sitting in the live content module are an invitation to wire
 * them up, and the moment somebody did the site would be advertising a URL
 * that returns nothing.
 *
 * They come back the day the corpus ships, with the real namespace in them. */
export const loadSnippet = `from datasets import load_dataset

ds = load_dataset("legible-sec/legible-pairs", split="train")
ds[0]["technical_text"], ds[0]["executive_text"]`;

export const citation = `@dataset{legible2026,
  title  = {LEGIBLE: Paired Technical-to-Executive
            Security Translations},
  author = {legible-sec},
  year   = {2026},
  url    = {https://huggingface.co/datasets/
            legible-sec/legible-pairs}
}`;

/* Retired 2026-09-01 from content/system.ts: the Workflow and RagFlow
   narration, orphaned when those diagrams were archived in the site
   restructure. Kept because they are the record of how the generation
   pipeline was described, not because anything renders them. */
export const workflowSection = {
  h2: "One finding in. One sentence out, with its checks.",
  lede: "Paste a raw finding. The system retrieves real human precedent, assembles the prompt, drafts a sentence, and reports what the deterministic checks found in it.",
  stations: [
    {
      key: "finding",
      name: "Finding",
      ink: "tech" as const,
      icon: "FileMagnifyingGlass",
      satellites: ["UserCircle", "Bug"],
      caption: "Your security finding.",
      anchorLabel: "the dataset",
      href: "/dataset/",
    },
    {
      key: "evidence",
      name: "Evidence",
      ink: "accent" as const,
      icon: "Database",
      satellites: ["MagnifyingGlass", "Files"],
      caption: `Precedents drawn from the LEGIBLE ${f.DATASET_VERSION} dataset.`,
      anchorLabel: "how retrieval works",
      href: "#retrieval",
    },
    {
      key: "prompt",
      name: "Prompt",
      ink: "accent" as const,
      icon: "Article",
      satellites: ["Bug", "BookOpenText", "Quotes"],
      caption: "Finding, playbook, and evidence merge into one prompt.",
      anchorLabel: "the 12 rules",
      href: "/dataset/#playbook",
    },
    {
      key: "translator",
      name: "Translator",
      ink: "accent" as const,
      icon: "Cpu",
      satellites: ["Laptop", "WifiSlash"],
      caption: "plaintext-9b wrote the drafts shown here, offline on a laptop. The weights are not published.",
      anchorLabel: "the model",
      href: "/model/",
    },
    {
      key: "judge",
      name: "Judge",
      ink: "ok" as const,
      icon: "Scales",
      satellites: [],
      caption: `Every draft goes through ${MOTOR_JUDGE_CHECKS} deterministic checks, each showing the strings it matched.`,
      anchorLabel: "see the judge run",
      href: "/try/#judge",
    },
    {
      key: "output",
      name: "Output",
      ink: "accent" as const,
      icon: "ChatCircleText",
      satellites: ["SealCheck"],
      caption: "The draft comes back with the precedents it was given and whatever the checks flagged.",
      anchorLabel: "try it",
      href: "/try/",
    },
  ],
  rejectedLabel: "rejected, with evidence",
};

// ============================================================
// v3 §4.4 #retrieval : the precedent engine (diagram 1)
// ============================================================
export const retrievalSection = {
  h2: "How the system finds a precedent.",
  lede: "Once, every pair is embedded into a searchable index. Then each finding you paste flows through the same path: embed, retrieve its nearest human precedents, assemble the prompt, draft the sentence, and run the checks over it.",
  anatomy: [
    { glyphs: ["UserCircle", "LinkSimple"], label: "attacker supplies a URL" },
    { glyphs: ["HardDrives"], label: "the server fetches it from inside" },
    { glyphs: ["LockSimpleOpen", "ShieldWarning"], label: "internal endpoints answer" },
  ],
  anatomyClose: "The server can be told to fetch any address. Whoever picks the address borrows the server's position inside the network.",
  clusters: ["injection", "access control", "crypto"],
  receiptsLabel: "what professionals wrote",
  closingLabel: "the draft, with the precedents it drew on",
};

// ============================================================
// v3 §4.5 #model : the LoRA diagram (diagram 2)
// ============================================================

/* Retired 2026-09-12 (D64), not deleted. The §5.10 benchmark section carried the
   dead five-conditions design: a laptop model against frontier across A/B/C0/C/D,
   scored on five averaged dimensions by a cross-family judge panel. Nothing
   imported it. It is kept because it compiled and read as current, which is how a
   stale artifact does its damage. Live benchmark content: `src/content/benchmarkDesign.ts`. */

// ============================================================
// §5.10 #benchmark : "How well do LLMs speak CFO?" (designed absence)
// ============================================================
export const benchmarkSectionRetired = {
  kicker: "The benchmark · pre-registered",
  headline: "How well do LLMs speak CFO?",
  lede: "Five conditions, five dimensions, a cross-family judge panel, pre-registered before the first run. Results land exactly here.",
  lanes: [
    {
      key: "frontier",
      label: "frontier",
      conditions: [
        { key: "A", label: "A · plain prompt" },
        { key: "B", label: "B · + retrieval" },
      ],
    },
    {
      key: "laptop",
      label: "laptop",
      conditions: [
        { key: "C0", label: "C0 · base 9B" },
        { key: "C", label: "C · + LoRA" },
        { key: "D", label: "D · + LoRA + retrieval" },
      ],
    },
  ],
  deltas: [
    { pair: "B vs A", label: "what retrieval buys" },
    { pair: "C vs C0", label: "what the LoRA buys" },
    { pair: "D vs A", label: "the thesis, laptop against frontier" },
  ],
  instrumentRow: {
    dimensions: {
      title: "5 dimensions, scored 1 to 5",
      items: ["Fidelity", "Business framing", "Audience calibration", "Concision", "Actionability"],
    },
    judges: {
      title: "3 judges, no self-grading",
      footnote: "cross-family panel, per-dimension median; no judge ever scores its own family's output; plus human validation on 100 items",
    },
  },
  resultsPlaceholder: {
    centerText: "results land here · A B C0 C D",
    sideSlots: ["fidelity flag rate per condition", "cost per 1,000 translations"],
    // planned, not yet run (research/13 §3): label explicitly as "planned"
    itemsPlanned: "~75 hard + 25 easy (planned), ≥50% post-cutoff",
  },
  closingLine: "Contamination is handled by construction: half the items post-date model cutoffs, and generator families are disjoint from the judge panel.",
};
