// Copy and structured content for the site.
//
// Numbers do NOT live here any more. They are derived from the dataset itself by
// scripts/gen_site_facts.py and imported from ./facts, which asserts at build time
// that every distribution reconciles to the total. This file previously claimed to
// be the single source of truth for every number and string, and shipped six
// figures that disagreed with the dataset and with each other.
import * as f from "./facts";
import { provenance } from "./status";

export const meta = {
  name: "LEGIBLE",
  version: f.DATASET_VERSION,
  oneLiner: "An open corpus of security findings paired with the executive prose that a professional wrote about them.",
  sub: "Real technical findings from public security reports, aligned to the summary prose a professional wrote about them. Most often both halves sit in the same document, but the unit is the pair, not the document. The executive side is always human written.",
};

// `verified` was the old label on the first tile. Alignment was checked by three
// cross-family LLM passes plus a blind audit, never by exhaustive human reading:
// human_verified is false on all 3,727 records. The honest word is `aligned`.
export const keyFacts = [
  { value: f.formatCount(f.PAIRS), label: "aligned pairs" },
  { value: f.formatCount(f.DOCUMENTS), label: "source documents" },
  { value: f.formatCount(f.ORGANIZATIONS), label: "organizations" },
  { value: String(f.FIELDS), label: "fields per pair" },
];

export type PairField = { k: string; v: string; tone?: "ok" | "high" };
export type ExamplePair = {
  tab: string;
  technical: string;
  executive: string;
  source: string;
  badge: string;
  fields: PairField[];
};

/* Four real records, checked field by field against legible-pairs-v0.4.jsonl:
   verbatim text, trimmed at a sentence boundary and unescaped for display. The
   badge quotes alignment_confidence, an LLM adjudication score rather than a
   human verification: human_verified is false on these records as on all the
   others. */
export const examplePairs: ExamplePair[] = [
  {
    tab: "PyPI · access control",
    technical:
      "The manage_organization_roles view handles both GET and POST requests under a single @view_config decorator with permission=Permissions.OrganizationsRead. On POST, _send_organization_invitation is called, creating an invitation with the attacker-chosen role_name, including Owner.",
    executive:
      "In the highest-severity case, any organization member can invite new owners by submitting a POST request to a view that only requires read permission.",
    source: "Trail of Bits · PyPI Warehouse security review · 2026",
    badge: "aligned · LLM confidence 1.00",
    fields: [
      { k: "source_org", v: "trailofbits" },
      { k: "severity_original", v: "High", tone: "high" },
      { k: "vuln_class", v: "web" },
      { k: "alignment_method", v: "id_anchor" },
      { k: "alignment_label", v: "aligned", tone: "ok" },
      { k: "alignment_confidence", v: "1.00" },
      { k: "audience_observed", v: "technical_leadership" },
      { k: "license", v: "cc-by-sa-4.0" },
    ],
  },
  {
    tab: "zkTrie · crypto",
    technical:
      "Merkle trees are nested tree data structures in which the hash of each branch node depends upon the hashes of its children. The hash of each node is then assumed to uniquely represent the subtree of which that node is a root. However, that assumption may be false if a leaf node can have the same hash as a branch node.",
    executive:
      "Flaws in domain separation and the way that the nodes and leaves are hashed allow an attacker to convince a verifier that a key is simultaneously present in the tree and not present in the tree (TOB-ZKTRIE-1).",
    source: "Trail of Bits · Scroll zkTrie security review · 2023",
    badge: "aligned · LLM confidence 1.00",
    fields: [
      { k: "source_org", v: "trailofbits" },
      { k: "severity_original", v: "High", tone: "high" },
      { k: "vuln_class", v: "crypto" },
      { k: "alignment_method", v: "id_anchor" },
      { k: "alignment_label", v: "aligned", tone: "ok" },
      { k: "alignment_confidence", v: "1.00" },
      { k: "audience_observed", v: "technical_leadership" },
      { k: "license", v: "cc-by-sa-4.0" },
    ],
  },
  {
    tab: "Worldcoin Orb · hardening",
    technical:
      "The Orb's kernel configuration and runtime parameters can be improved to increase the overall security of the device and its applications and to decrease the potential attack surface. The following table shows the runtime parameters that can be hardened.",
    executive:
      "The kernel could be further hardened by implementing the recommendations provided in TOB-ORB-8.",
    source: "Trail of Bits · Worldcoin Orb security review · 2023",
    badge: "aligned · LLM confidence 1.00",
    fields: [
      { k: "source_org", v: "trailofbits" },
      { k: "severity_original", v: "Informational" },
      { k: "vuln_class", v: "network" },
      { k: "alignment_method", v: "id_anchor" },
      { k: "alignment_label", v: "aligned", tone: "ok" },
      { k: "alignment_confidence", v: "1.00" },
      { k: "audience_observed", v: "technical_leadership" },
      { k: "license", v: "cc-by-sa-4.0" },
    ],
  },
  {
    tab: "CISA · ICS advisory",
    technical:
      "Johnson Controls reports that the following versions of Illustra Essentials Gen 4 IP camera are affected: all versions up to Illustra.Ess4.01.02.10.5982. Under certain circumstances the web interface will accept characters unrelated to the expected input. CVE-2024-32755 has been assigned to this vulnerability. A CVSS v3.1 base score of 9.1 has been calculated.",
    executive:
      "CVSS v3 9.1. ATTENTION: Exploitable remotely / low attack complexity. Vendor: Johnson Controls, Inc. Equipment: Illustra Essentials Gen 4. Vulnerability: Improper Input Validation. Successful exploitation of this vulnerability could allow an attacker to inject commands.",
    source: "CISA · ICS advisory ICSA-24-179-04 · 2024",
    badge: "structural · by construction",
    fields: [
      { k: "source_org", v: "cisa" },
      { k: "cve_ids", v: "CVE-2024-32755", tone: "high" },
      { k: "vuln_class", v: "network" },
      { k: "alignment_method", v: "same_section_1to1" },
      { k: "alignment_label", v: "structural_doclevel", tone: "ok" },
      { k: "audience_observed", v: "practitioner" },
      { k: "license", v: "public-domain-us-gov" },
    ],
  },
];

/* SourcesStrip's wordmark band: named contributors rendered as unified
   typographic wordmarks, plus the rollup count for everyone else, derived from
   f.ORGANIZATIONS. Every name here is checked against source_org in the
   dataset. Assetnote and Zero Day Initiative were listed until 2026-08-31 and
   contribute no pairs at all; they are replaced by two organizations that do.
   Pair counts, for the record: Trail of Bits 1,237 · CISA 836 · Cure53 368 ·
   GAO 198 · OSTIF 114 · FTC 94 · NCC Group 21. */
export const sourceWordmarks: string[] = [
  "Trail of Bits",
  "Cure53",
  "OSTIF",
  "CISA",
  "NCC Group",
  "GAO",
  "FTC",
];
export const sourceWordmarksMore = `and ${f.ORGANIZATIONS - sourceWordmarks.length} more organizations`;

/* How the executive side of a pair was tied to its finding. Ten methods, derived
   from the corpus. This array previously carried v0.2 counts for seven methods,
   with id_anchor at 1,275 against a real 733. */
export const METHOD_NOTES: Record<string, string> = {
  same_section_1to1: "structural: one summary paragraph beside one technical section",
  id_anchor: "the executive text cites the finding ID, then an LLM judged the match",
  doc_level_structural: "the whole executive summary against the whole findings list",
  "embed+llm": "an embedding shortlist, then an LLM adjudicated which finding it meant",
  board_extract: "board and oversight prose pulled from government audit reports",
  llm_selected: "an LLM pointed at the exact quotes, verified verbatim in code",
  thematic: "claim against finding by keyword overlap, then judged",
  ghsa_impact: "the impact paragraph of a GitHub security advisory",
  writeup_summary: "a researcher's own summary of the writeup below it",
  event_anchor: "an 8-K disclosure and the technical writeup of the same incident",
};

export const distMethod = f.ALIGNMENT_METHODS.map((r) => ({
  key: r.key,
  n: r.n,
  desc: METHOD_NOTES[r.key] ?? "",
}));

/* The `registers` array and its Register type lived here until 2026-07-23. Its
   only consumer was Registers.tsx (archived, never mounted) and its image paths
   pointed at files that had already moved. See archive/web-dead-ui/. */

/* AudiencePlan: the five audiences the project works with, with their real
   coverage. The corpus records ten observed registers (f.REGISTERS); these five
   are what the product targets, not the whole taxonomy, and the other five
   (management, regulatory, customer, developer, investor) have no persona here.
   Every count is read from the dataset rather than typed.

   Two provenance tiers: a same-document verbatim CORE that trains the model,
   and a RETRIEVAL tier for material the corpus does not carry. */
export type AudienceTier = "core" | "retrieval";
export type AudienceStatus = "have" | "building";
// img: a generated persona scene (owner law 2026-07-12: persona IMAGES beat
// icon medallions here; this set is the v2 cohesive batch, style-locked to the
// palette and shipped as WebP).
// vid/poster: an animated persona (Higgsfield, 2026-07-22). When present the
// flip-card front loops the video and falls back to `img` (or the poster under
// reduced motion).
export type Audience = { name: string; who: string; tier: AudienceTier; status: AudienceStatus; n?: string; note: string; img: string; vid?: string; poster?: string; detail: string };

/** Pairs carrying an observed register, straight from the dataset. */
const registerCount = (key: string) => f.REGISTERS.find((r) => r.key === key)?.n ?? 0;

const TOTAL = f.formatCount(f.PAIRS);

// resting card = image + name only; hover/tap FLIPS the card (owner law
// 2026-07-12) and the back carries a full, calm description. Plain language,
// no pitch.
export const audiences: Audience[] = [
  {
    name: "Technical leadership", who: "the CTO or client decision-maker", tier: "core", status: "have", n: f.formatCount(registerCount("technical_leadership")), note: "consultancy and pentest reports", img: "/img/register/technical-leadership.webp", vid: "/media/persona-technical-leadership.mp4", poster: "/media/persona-technical-leadership.jpg",
    detail: `The person who signs off on the fix: a CTO or the client's decision maker. ${f.formatCount(registerCount("technical_leadership"))} of the ${TOTAL} pairs carry this register, all of them from consultancy security reviews and pentest reports. It is the largest of the ${f.REGISTERS.length} registers the corpus records.`,
  },
  {
    name: "Practitioner", who: "the engineer who patches", tier: "core", status: "have", n: f.formatCount(registerCount("practitioner")), note: "CISA advisories", img: "/img/register/practitioner.webp", vid: "/media/persona-practitioner.mp4", poster: "/media/persona-practitioner.jpg",
    detail: `The engineer who patches the finding. ${f.formatCount(registerCount("practitioner"))} pairs carry this register, almost all of them CISA advisories. They hold the technical voice in the corpus, as the contrast to the executive one.`,
  },
  {
    name: "Board / oversight", who: "directors and overseers", tier: "core", status: "have", n: f.formatCount(registerCount("board")), note: "GAO, OIG, CSRB", img: "/img/register/board.webp", vid: "/media/persona-board.mp4", poster: "/media/persona-board.jpg",
    detail: `Directors and overseers who need the risk, not the exploit. ${f.formatCount(registerCount("board"))} pairs carry this register today, from GAO reports, Inspector General audits and CSRB reviews. Collection is still open, so this one is the smallest of the three trained registers.`,
  },
  {
    name: "Public", who: "affected users and laypeople", tier: "core", status: "have", n: f.formatCount(registerCount("public") + registerCount("lay")), note: "OSTIF audits, Wikipedia", img: "/img/register/public.webp", vid: "/media/persona-public.mp4", poster: "/media/persona-public.jpg",
    detail: `People affected by an incident, with no security background assumed. ${f.formatCount(registerCount("public"))} pairs carry a public register, all from OSTIF audit summaries, and ${f.formatCount(registerCount("lay"))} more carry a lay register from Wikipedia incident articles. Broader explainer material from MITRE, NIST and OWASP is not in the corpus.`,
  },
  {
    name: "Analogy", who: "a mode for any audience", tier: "retrieval", status: "building", note: "talks and books", img: "/img/register/analogy.webp", vid: "/media/persona-analogy.mp4", poster: "/media/persona-analogy.jpg",
    detail: "A mode rather than an audience: any finding explained through a familiar comparison. No pair in the corpus carries it, so it is planned as retrieval over curated talks and books, never as training data.",
  },
];

/* Severity as the corpus actually records it. The largest bucket is absence:
   2,357 of 3,727 pairs come from sources that use no severity scale at all.
   The old version of this array omitted that bucket entirely and summed to
   2,910 against a stated total of 4,513. */
export const distSeverity = f.SEVERITY;

export const distVuln = f.VULN_CLASS;

/* Method (v3): how ONE pair is made, told as five mini-scenes. Scene
   components stay local to Method.tsx; only the copy lives here. */
export const methodStages: { title: string; detail: string }[] = [
  { title: "A public report", detail: "A real review or advisory, parsed page by page into structured text." },
  { title: "Sections, found", detail: "Per-firm heading profiles locate the executive summary and the findings." },
  { title: "The pair, linked", detail: "An exec sentence is matched to its finding: by cited ID, by structure, or by embeddings + LLM." },
  { title: "The link, tested", detail: "Three passes of a cross-family LLM judge every match; weak links are rejected and labeled." },
  { title: "A dataset record", detail: `${f.FIELDS} fields with provenance, labels, and a per-pair license. One of ${f.formatCount(f.PAIRS)}.` },
];

/* Report-level splits, never pair-level, since pairs from one report share an
   executive summary. Counts and percentages both derive from the dataset. */
export const SPLIT_NOTES: Record<string, string> = {
  train: "report-level 80/10/10, never pair-level, since pairs from one report share an executive summary",
  val: "held-out reports",
  test: "held-out reports",
  test_ood_temporal: "2026 reports plus new-template ICS advisories, after model cutoffs. The contamination hedge.",
  test_ood_style: "held out by writing style rather than by firm",
  test_ood_firm: "whole firms held out. Tests translation against house-style memorization.",
};

export const splits = f.withShares(f.SPLITS).map((r) => ({
  key: r.key,
  pct: Math.round(r.pct),
  n: f.formatCount(r.n),
  desc: SPLIT_NOTES[r.key] ?? "",
}));

/* Proven's evidence docket (v3): the three-stat case that the pairs are
   tested, not assumed good. Ground truth: data/dataset/build_stats.json
   "dropped" (252+121+123+119+26+18=659; 373 of those are verifier rejects). */
/* The evidence docket. Every count here comes from data/dataset/build_stats.json
   via content/status.ts, and every count carries its build tag: those numbers were
   measured at the v0.3 build, and v0.4 is that build with 1,596 redundant rows
   removed. The rates survive the de-duplication; the counts belong to the earlier
   build and say so. The previous version of this array reported 659 dropped and
   242 duplicates. The build stats record 711 and 119. */
export const provenEvidence: { stat: string; title: string; body: string }[] = [
  {
    stat: `${Math.round(provenance.agreementRate * 1000) / 10}%`,
    title: "Judged three times, by a family that does not compete",
    body:
      `Every candidate pair was judged three times by an LLM from a family disjoint from anything the companion benchmark scores. The passes agreed ${Math.round(provenance.agreementRate * 1000) / 10} percent of the time. ${provenance.buildTag}.`,
  },
  {
    stat: `${provenance.blindAudit.fabricated} / ${provenance.blindAudit.checked}`,
    title: "A blind audit looked for invented pairs",
    body:
      `Independent agents re-extracted pairs from held-out reports with no access to the pipeline, and the results were compared. No fabricated pair was found in ${provenance.blindAudit.checked} checked. Every gap was missing coverage rather than invention. ${provenance.buildTag}.`,
  },
  {
    stat: String(provenance.verification.droppedTotal),
    title: "What was discarded is on the record",
    body:
      `${provenance.verification.verifierUnaligned} pairs rejected by the verifiers, ${provenance.verification.duplicateId} duplicate identifiers, ${provenance.verification.thematicLowConfidence} below the thematic confidence bar, ${provenance.verification.nearDuplicate} near duplicates, and ${provenance.verification.unverifiedPending + provenance.verification.doclevelPositionalRejected + provenance.verification.minhashNearDuplicate} others. Each discarded stage is kept and labelled so the failure modes can be studied. ${provenance.buildTag}.`,
  },
];

/* The schema panel's field map. It listed 27 fields until 2026-08-31 while the
   records carried 30: exec_span_kind, notes and alignment_label were missing,
   so the panel's own headline number was short by three. The assertion below
   holds the list to what the dataset actually has, the same way facts.ts holds
   the distributions to the pair total. */
export const schemaGroups: { group: string; fields: string[] }[] = [
  { group: "identity", fields: ["pair_id", "source_doc_id", "source_org", "source_org_type", "source_url"] },
  { group: "provenance", fields: ["doc_type", "report_year", "executive_text_provenance", "license", "notes"] },
  { group: "text", fields: ["technical_text", "technical_context", "executive_text", "exec_span_kind"] },
  { group: "labels", fields: ["audience_observed", "audience_label", "format_label", "severity_original", "severity_conveyed", "vuln_class"] },
  { group: "extracted", fields: ["cve_ids", "cwe_ids", "numeric_facts"] },
  { group: "alignment", fields: ["alignment_method", "alignment_type", "alignment_label", "alignment_confidence"] },
  { group: "quality", fields: ["human_verified", "pii_scrubbed", "split"] },
];

export const SCHEMA_FIELD_COUNT = schemaGroups.reduce((total, g) => total + g.fields.length, 0);

if (SCHEMA_FIELD_COUNT !== f.FIELDS) {
  throw new Error(
    `data: schemaGroups lists ${SCHEMA_FIELD_COUNT} fields but a record in the dataset has ${f.FIELDS}. ` +
      `Add the missing field to the group it belongs to, or drop the one the records no longer carry.`
  );
}

/* Licence buckets, derived. The previous version described a 3,382 / 1,131 split
   that summed to the v0.3 total. What matters downstream is which pairs may be
   redistributed, so the split is drawn on that line. */
const licenceCount = (key: string) => f.LICENSES.find((r) => r.key === key)?.n ?? 0;

export const REDISTRIBUTABLE =
  licenceCount("cc-by-sa-4.0") + licenceCount("public-domain-us-gov") + licenceCount("cc-by-4.0") + licenceCount("edgar-public-filing");
export const RESTRICTED = f.PAIRS - REDISTRIBUTABLE;

export const licensing = {
  core: {
    title: "Redistributable",
    pairs: `${f.formatCount(REDISTRIBUTABLE)} pairs`,
    body:
      "Trail of Bits and Wikipedia under CC BY-SA 4.0, where derived pairs inherit ShareAlike, plus United States government works in the public domain under 17 U.S.C. section 105: CISA advisories, Inspector General audits, and FTC and SEC enforcement complaints. Redistributable with attribution.",
    rows: [
      { name: "Trail of Bits · Wikipedia", tag: "CC BY-SA 4.0" },
      { name: "CISA · agency OIGs · FTC · SEC", tag: "public domain" },
    ],
  },
  quotation: {
    title: "Quotation and unverified",
    pairs: `${f.formatCount(RESTRICTED)} pairs`,
    body:
      "Cure53, OSTIF, the long tail of firms, incident postmortems and contracted government audits carry firm copyright or rights that have not been checked one by one. They are included as short excerpts under a research-quotation rationale, with per-pair attribution and an honoured takedown process, and they are not redistributed from this site.",
    rows: [
      { name: "Cure53 · OSTIF · postmortems", tag: "non-commercial" },
      { name: "contracted audits · long tail", tag: "attribution + takedown" },
    ],
  },
};

export const limitations = [
  { h: "Coverage is not exhaustive", b: "An exec summary only discusses the top findings, so most technical findings have no natural translation and are not paired." },
  { h: "Register ≠ business role", b: "The corpus supplies observed registers (practitioner / technical leadership / management / public). The board / CFO / IT role axis lives in the prompt layer, not the natural data." },
  { h: "Contamination is likely", b: "Every source is public and probably in frontier pretraining data. Use the temporal OOD split for contamination-sensitive evaluation." },
  { h: "LLM-verified, not fully hand-annotated", b: "Alignment is verified by Gemini (3-pass) plus a blind audit and human spot-checks, not exhaustively human-annotated at v0.1." },
  { h: "English, and uneven", b: "English only; over-represents web / crypto findings and a few prolific firms' house styles." },
];

export const relatedWork = [
  { name: "CTISum", year: 2024, diff: "CTI analyst→analyst summaries. No audience shift, no fidelity annotation." },
  { name: "PERCS", year: 2025, diff: "Biomedical, 4 personas. Targets are LLM-generated-then-corrected, not naturally occurring." },
  { name: "Aalto CVE simplification", year: 2026, diff: "40 CVEs, lay audience. Validates the meaning-preservation failure mode." },
  { name: "Dave (QLoRA 70B)", year: 2026, diff: "Report drafting, not aligned translation pairs. No judge, no benchmark." },
];

/* `loadSnippet` and `citation` moved to content/_archive/system-sections.ts on
   2026-09-01. They describe a published dataset and the dataset is withheld, so
   they were an invitation to advertise a URL that returns nothing. They come
   back with the real namespace on the day it ships. */
