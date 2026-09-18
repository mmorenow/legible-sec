// Single source of truth for the v2 site's system-narrative sections (home
// page §5 of DESIGN-PLAN.md: the schematic, the condensed dataset story, the
// playbook, evidence, judge, model, integrity, benchmark and try-it teaser).
// `data.ts` remains the source of truth for the /dataset deep view and the
// current (Phase-0/1-unchanged) Hero; this file is additive, prepared in
// Phase 0 for the section builds of Phases 2-10. Zero em-dashes (see
// AGENTS.md / repo pre-flight checklist): use middle dots, colons or commas.
//
// NUMBERS: every count comes from `facts.ts`, which is generated from the
// dataset and asserts at build time that the distributions reconcile. Do not
// type a dataset number here as a literal; interpolate it. An earlier revision
// of this file quoted 4,513 pairs and 3,050 documents long after both had
// stopped being true, in copy that shipped on the home page.
//
// CLAIMS: what a visitor can actually reach lives in `status.ts`. Nothing here
// may promise an artifact that ledger marks as anything other than `shipped`.

import * as f from "@/content/facts";
import { provenance } from "@/content/status";

/* The browser gate runs eight checks. The list of record is GATE_CHECKS in
   src/lib/judge.ts; this constant exists so no string here has to count them.
   The site said "six" for months, because six was typed in four places. */
/* There are two judges, and they do not run the same list. The BROWSER gate
   (src/lib/judge.ts) runs eight checks and is what /try Review executes in the
   page. The MOTOR judge (src/legible/judge.py run_deterministic) runs those same
   eight plus format_lint, because a format contract needs the audience key that
   only the motor holds. The site claimed six for a long time, inherited from a
   docstring that stopped being true three checks ago. Anything counting by hand
   drifts, so nothing counts by hand. */
export const BROWSER_GATE_CHECKS = 8;
export const MOTOR_JUDGE_CHECKS = 9;

/** @deprecated name kept only until the remaining call sites pick a judge. */
export const GATE_CHECK_COUNT = BROWSER_GATE_CHECKS;

/* `workflowSection` and `retrievalSection` moved to content/_archive on
   2026-09-01. They described the Workflow and RagFlow diagrams, both archived
   with the rest of the generation side, and nothing has rendered them since.
   One of them still carried a link to /dataset/#playbook, which is a redirect
   stub with no such anchor: dead copy quietly rotting into a broken link. */

export const loraSection = {
  modelName: "plaintext-9b",
  h2: "The playbook, learned into the weights.",
  lede: "A thin adapter on a frozen 9-billion-parameter model. It writes the way the corpus taught it to, runs offline on a 16-gigabyte laptop, and client findings never leave the machine.",
  beats: [
    { key: "what", caption: "rank 16 · about 0.2% of weights train · bf16" },
    { key: "where", caption: "adapters attach to the softmax attention layers; the linear-attention backbone stays frozen" },
    { key: "lives", caption: "4-bit MLX quantization · Apple silicon · offline" },
  ],
  measurement: {
    title: "Mean words per translation, 30 held-out findings.",
    max: 120,
    rows: [
      { label: "base model, plain prompt", value: 112.7, tone: "tech" },
      { label: "base + playbook in the prompt", value: 28.9, tone: "graphite" },
      { label: "LoRA, no playbook in the prompt", value: 25.5, tone: "accent", emphasis: true },
      { label: "what professionals wrote", value: 24.2, tone: "ok", reference: true },
    ],
    claim: "The LoRA reproduces the playbook's compression with no playbook in the prompt. The measure is length, not quality.",
    footnote: "mean words per translation, 30 held-out findings · data/finetune/experiment_results.json",
  },
  specLedger: [
    { k: "model", v: "plaintext-9b" },
    { k: "base", v: "Qwen3.5-9B" },
    { k: "method", v: "bf16 LoRA, r=16, alpha=32" },
    { k: "data", v: "573-pair crisp core + grouped and doc shapes" },
    { k: "supervised tokens", v: "about 170k per epoch" },
    { k: "artifact", v: "4-bit MLX quantization" },
    { k: "hardware", v: "16GB MacBook, M4" },
  ],
  verifiedToken: "runs offline · MLX",
};

// ============================================================
// v4.1 /model completion : nameplate device, CTA row, run-it
// snippet, and the loose door-lines off the page (MODEL-04/05/06).
// De-carded: the closing is two large door-lines + a quiet HF line,
// no cards (owner law).
// ============================================================
export const modelNameplate = {
  // the plaintext/ciphertext pun, shown rather than told: the model's own
  // name, encoded as hex, struck through and resolving into the h1 below.
  hex: "70 6c 61 69 6e 74 65 78 74 2d 39 62",
};

export const modelAccess = {
  /* The one thing this page has to say before anything else.
   *
   * `status.ts` records `loraModel` as archived and the footer link says so,
   * but the page itself described the model in the present tense from top to
   * bottom, which read as the project's current direction. It is not: the
   * project moved from generating the text to measuring it, and this page
   * documents what that move left behind. Saying it once, at the top, is the
   * difference between a record and a claim. */
  archivedNote:
    "This page documents an archived artifact. The project used to generate the executive text; it now measures it, and the model below is kept because it worked, not because it is where the work is going.",
  // no CTA and no one-line command: the weights are not published, so any
  // button or `run` line here would promise something nobody can do yet.
  weightsNote: "The weights are not published yet.",
  runIt: {
    label: "Run it",
    /* These three commands work, but only from a checkout of the repository, and
       the repository is private. Stating that is the whole fix: the commands are
       kept because they are true, and framed so nobody tries to follow them. */
    lede: "From a checkout of the repository, three commands bring up retrieval, the judge and the model together. The repository is private, so this is a description of how the local instrument runs rather than something you can follow today.",
    quickstart: [
      ".venv/bin/pip install -r requirements-app.txt",
      "LEGIBLE_EMBED_DEVICE=cpu .venv/bin/uvicorn app.server:app --port 8787",
      "cd presentation/web && npm run dev",
    ],
  },
  /* Closing doors off the page.
   *
   * These used to read "Try it on a real finding" and "How it scores: the
   * benchmark", and both had stopped being true. /try no longer translates
   * anything: it reviews a draft somebody else wrote, so an invitation to paste
   * a finding and get a translation is a promise the page cannot keep. And the
   * benchmark now measures whether a model can DETECT the failures the rubric
   * names, which is not a score for this model at all. Both doors now say where
   * they actually go. */
  doors: [
    { href: "/try/", label: "The checker that replaced it" },
    { href: "/benchmark/", label: "What the benchmark measures now" },
  ],
  hfNote: "The weights are not published yet, on Hugging Face or anywhere else.",
};

// ============================================================
// v3 §4.6 #access : go deeper doors
// ============================================================
export const goDeeper = {
  wide: {
    href: "/library/",
    title: "The dataset, in depth",
    line: `${f.formatCount(f.PAIRS)} aligned pairs, 12 playbook rules, and the agent pipeline that assembled them.`,
  },
  slim: [
    { href: "/model/", title: "plaintext-9b, the laptop model.", note: "9B · LoRA · ran offline · weights not published" },
    { href: "/benchmark/", title: "Lost in Translation? Benchmarking LLM fidelity.", note: "pre-registered · never run · the design, and what it is blocked on" },
    { href: "/try/", title: "Run the checks in your browser.", note: `${GATE_CHECK_COUNT} deterministic checks · nothing you paste leaves the page` },
  ],
};

export const judgeSection = {
  h2: "The judge cannot invent its evidence.",
  lede: `The gate runs ${GATE_CHECK_COUNT} deterministic checks on every draft, and a check may only fail by showing the exact strings it matched. It misses things: caveat recall is below the 85 percent bar set for it. The layers above this one, entailment and judgement, are specified in the rubric and are not wired in.`,
  /* Mirrors GATE_CHECKS in src/lib/judge.ts, which is the list of record.
     format_lint (D6) needs the audience contract of the local motor and is not
     part of the in-tab gate, so it does not appear here either. */
  checks: [
    { key: "id_parity", label: "id_parity" },
    { key: "numeric_parity", label: "numeric_parity" },
    { key: "severity_drift", label: "severity_drift" },
    { key: "entity_check", label: "entity_check" },
    { key: "caveat_parity", label: "caveat_parity" },
    { key: "claim_inflation", label: "claim_inflation" },
    { key: "status_drift", label: "status_drift" },
    { key: "negation_flip", label: "negation_flip" },
  ],
  // Real precomputed JudgeReports live in src/content/judgeDemo.json
  // (scripts/gen_judge_demo.py, run on data/pairs/core_1to1_curated.jsonl
  // pair "2025-01-zetachain-solana-gateway-security-review#s7-f1").
  caseTabs: [
    { key: "faithful", label: "faithful" },
    { key: "softened", label: "softened" },
    { key: "embellished", label: "embellished" },
  ],
  llmLayerChip: {
    label: "Judgement layer",
    sublabel: "L2 · specified, not built",
    tooltip: "The rubric names four layers: L0 deterministic, L1 entailment, L2 judgement, H human. Only L0 runs here. L2 would weigh what paraphrase hides, severity softened into synonyms, claims without support, omissions that were justified, and by the rubric's own contract it would advise rather than decide.",
  },
  passCopy: "no check fired: nothing this layer can see was dropped, altered or added",
  closingCaption: "a pass is a non-detection, not a verification. A fail shows its proof.",
};

// ============================================================
// §5.9 #integrity : how the corpus was assembled, and what is quoted
// ============================================================
/* The old headline read "Built by agents. Quoted, never rewritten." How the
   corpus was assembled is a method note, not a credential, and leading with the
   method as a boast was the promotional register the site is trying to leave.
   The claim that survives is the one about the text: it is quoted. */
export const integritySection = {
  h2: "The pair text is quoted from the source document.",
  lede: `Harvesting, curation, and checking ran as specialized subagents. Pair text is quoted from the parsed source document and is never paraphrased. Character-for-character checking against an archived snapshot of the live source covers the pairs that carry a source URL: ${f.formatCount(f.WITH_SOURCE_URL)} of ${f.formatCount(f.PAIRS)}. Recovering the rest is a gate on publication.`,
  scenes: [
    {
      key: "harvest",
      title: "Harvest",
      body: `Subagents fetched and parsed ${f.formatCount(f.DOCUMENTS)} public documents: PDFs through Docling with OCR fallback, advisories through custom parsers.`,
      stat: `${f.formatCount(f.DOCUMENTS)} docs · ${f.ORG_TYPES.length} organization types`,
    },
    {
      key: "curate",
      title: "Curate",
      body: "Four independent LLM reviewers judged every crisp-core candidate; disagreements went to a stronger adjudicator.",
      stat: "994 candidates in · 573 kept",
    },
    {
      key: "verify",
      title: "Verify",
      body: "Where a source URL is recorded, the verifier renders that page, archives a text snapshot, and asserts the quote is verbatim against it. A blind audit then read a sample by hand.",
      stat: `${provenance.blindAudit.fabricated} fabricated in ${provenance.blindAudit.checked} audited`,
    },
  ],
  closingLine: `three-pass alignment agreement ${(provenance.agreementRate * 100).toFixed(1)}%, ${provenance.buildTag} · alignment was checked by three cross-family model passes and a blind audit, never by exhaustive human reading, so human_verified is false on all ${f.formatCount(f.PAIRS)} rows`,
};


