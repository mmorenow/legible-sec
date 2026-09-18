// MACHINE-GENERATED FILE. DO NOT EDIT BY HAND.
//
// Produced by `scripts/gen_site_facts.py` from the frozen dataset. Any hand edit will be
// overwritten on the next dataset build, and worse, it would let the site quote
// a number the data does not support. To change anything here, change the
// dataset or the script and regenerate:
//
//     python3 scripts/gen_site_facts.py
//
// Import these facts through `facts.ts`, which re-exports them and asserts that
// the distributions reconcile to the stated total.

export type FactRow = { key: string; n: number };

export const DATASET_VERSION = "v0.4";
export const SOURCE_FILE = "legible-pairs-v0.4.jsonl";
export const GENERATED_AT = "2026-08-31";

// Headline counts.
export const PAIRS = 3727;
export const DOCUMENTS = 2059;
export const ORGANIZATIONS = 179;
export const FIELDS = 30;

// Report year is recorded on roughly half the corpus, so the site needs the
// coverage count alongside the range. YEAR_KNOWN counts rows with a plausible
// year (> 1990); the rest are null or a zero sentinel.
export const YEAR_MIN = 2011;
export const YEAR_MAX = 2026;
export const YEAR_KNOWN = 1876;

// Distributions. Each row set covers every pair exactly once, so each sums to
// PAIRS. Sorted descending by n.
//
// Severity carries one normalization: the corpus spells the same band both
// "Info" and "Informational", and they are merged. Pairs whose source document
// never stated a severity appear under "not stated" rather than being
// dropped, because they are the largest bucket in the dataset.
export const SEVERITY: FactRow[] = [
  { key: "not stated", n: 2357 },
  { key: "High", n: 359 },
  { key: "Low", n: 312 },
  { key: "Medium", n: 306 },
  { key: "Informational", n: 280 },
  { key: "Critical", n: 91 },
  { key: "Undetermined", n: 22 },
];

export const VULN_CLASS: FactRow[] = [
  { key: "web", n: 1178 },
  { key: "network", n: 1138 },
  { key: "other", n: 671 },
  { key: "crypto", n: 432 },
  { key: "access_control", n: 159 },
  { key: "cloud", n: 112 },
  { key: "memory", n: 29 },
  { key: "ics", n: 8 },
];

export const REGISTERS: FactRow[] = [
  { key: "technical_leadership", n: 1829 },
  { key: "practitioner", n: 882 },
  { key: "board", n: 309 },
  { key: "management", n: 192 },
  { key: "regulatory", n: 127 },
  { key: "customer", n: 126 },
  { key: "public", n: 114 },
  { key: "developer", n: 98 },
  { key: "lay", n: 44 },
  { key: "investor", n: 6 },
];

export const LICENSES: FactRow[] = [
  { key: "cc-by-sa-4.0", n: 1281 },
  { key: "public-domain-us-gov", n: 1253 },
  { key: "research-quotation-noncommercial", n: 1022 },
  { key: "cc-by-4.0", n: 98 },
  { key: "us-gov-contracted-verify", n: 72 },
  { key: "edgar-public-filing", n: 1 },
];

export const SPLITS: FactRow[] = [
  { key: "train", n: 2585 },
  { key: "val", n: 404 },
  { key: "test", n: 362 },
  { key: "test_ood_temporal", n: 300 },
  { key: "test_ood_style", n: 46 },
  { key: "test_ood_firm", n: 30 },
];

export const ALIGNMENT_METHODS: FactRow[] = [
  { key: "same_section_1to1", n: 943 },
  { key: "id_anchor", n: 733 },
  { key: "doc_level_structural", n: 683 },
  { key: "embed+llm", n: 539 },
  { key: "board_extract", n: 309 },
  { key: "llm_selected", n: 204 },
  { key: "thematic", n: 166 },
  { key: "ghsa_impact", n: 98 },
  { key: "writeup_summary", n: 46 },
  { key: "event_anchor", n: 6 },
];

export const ORG_TYPES: FactRow[] = [
  { key: "consultancy", n: 1887 },
  { key: "government", n: 1452 },
  { key: "vendor", n: 126 },
  { key: "nonprofit", n: 114 },
  { key: "maintainer", n: 98 },
  { key: "encyclopedia", n: 44 },
  { key: "issuer", n: 6 },
];

export const DOC_TYPES: FactRow[] = [
  { key: "security_review", n: 1237 },
  { key: "cisa_ics_advisory", n: 688 },
  { key: "pentest_report", n: 604 },
  { key: "oig_audit", n: 207 },
  { key: "gao_report", n: 198 },
  { key: "cisa_csa_advisory", n: 148 },
  { key: "incident_postmortem", n: 126 },
  { key: "security_audit", n: 114 },
  { key: "ghsa_advisory", n: 98 },
  { key: "ftc_complaint", n: 94 },
  { key: "oig_inspection", n: 70 },
  { key: "researcher_writeup", n: 46 },
  { key: "wikipedia_article", n: 44 },
  { key: "sec_complaint", n: 19 },
  { key: "csrb_report", n: 14 },
  { key: "sec_admin_order", n: 14 },
  { key: "sec_8k_item105", n: 6 },
];

// The 10 largest contributors, plus the tail count for an
// "and N more" line. TOP_ORGS + OTHER_ORGS sums to PAIRS.
export const TOP_ORGS: FactRow[] = [
  { key: "trailofbits", n: 1237 },
  { key: "cisa", n: 836 },
  { key: "cure53", n: 368 },
  { key: "GAO", n: 198 },
  { key: "ostif", n: 114 },
  { key: "GHSA", n: 98 },
  { key: "ftc", n: 94 },
  { key: "wikipedia", n: 44 },
  { key: "CPTC", n: 40 },
  { key: "sec", n: 33 },
];
export const OTHER_ORGS = 665;

// Quality and provenance counters. These are per-pair counts, not percentages;
// formatting is the site's job.
export const WITH_SOURCE_URL = 453;
export const WITH_CVE = 862;
export const HUMAN_VERIFIED = 0;
export const PII_SCRUBBED_TRUE = 3318;
export const PII_SCRUBBED_FALSE = 409;
