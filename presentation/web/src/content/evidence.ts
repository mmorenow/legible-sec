// The provenance of the rubric: which named sources each dimension rests on,
// and the objections the method has to answer.
//
// WHY THIS FILE EXISTS
//
// The rubric is the shared core of the three products (benchmark, checker,
// library). A rubric invented by one person is an opinion. This one was derived
// from what experts SAY: the 237 document corpus in research/expert-corpus, in
// which the field teaches, templates and criticises how security gets
// communicated. What converged across independent sources became a dimension.
// The 3,727 human written pairs are the second movement, not the origin: they
// are what the rubric is tested and improved against, and they keep growing.
// This module carries the documentary half, source by source, so a reader can
// check the claim instead of trusting it.
//
// WHY THIS FILE THROWS
//
// A dead link on the provenance page of a project whose subject is fidelity is a
// self inflicted wound. So the checks run at module scope: a source recorded as
// dead, a verified flag that disagrees with its own check, a duplicate id or an
// em dash in user facing copy all fail the build rather than reach a reader.
//
// Every URL below was requested with
//   curl -sS -o /dev/null -w "%{http_code}" -L --max-time 25 <url>
// on the date in URL_CHECK_DATE. Status meanings are in CheckStatus.

/** Date every URL in this file was last requested. */
export const URL_CHECK_DATE = "2026-08-31";

/* ------------------------------------------------------------------ *
 * Source standing
 * ------------------------------------------------------------------ */

// The strength of evidence differs enormously between a regulator and a vendor
// blog. The site shows the difference instead of flattening it: a CISA question
// set and a company blog post are both citable, but they are not the same claim.
export type SourceKind =
  | "regulator"
  | "standards-body"
  | "governance-body"
  | "peer-reviewed"
  | "academic"
  | "trade-press"
  | "practitioner"
  | "vendor";

export const sourceKindMeta: Record<
  SourceKind,
  { label: string; standing: string }
> = {
  regulator: {
    label: "Regulator",
    standing: "Carries force of law or official government guidance. The strongest evidence available.",
  },
  "standards-body": {
    label: "Standards body",
    standing: "Normative text an ecosystem already agreed to follow.",
  },
  "governance-body": {
    label: "Governance body",
    standing: "Guidance written for directors by the institutions that convene them.",
  },
  "peer-reviewed": {
    label: "Peer reviewed",
    standing: "Published research that passed external review.",
  },
  academic: {
    label: "Academic",
    standing: "Research grade work without formal peer review at this URL: preprints, national laboratory reports, journal interviews.",
  },
  "trade-press": {
    label: "Trade press",
    standing: "Reported journalism. Edited, attributed, and independent of the subject.",
  },
  practitioner: {
    label: "Practitioner",
    standing: "A named person writing from the seat: CISOs, responders, analysts, consultants.",
  },
  vendor: {
    label: "Vendor",
    standing: "Published by a company with something to sell. Useful when specific, weakest when general.",
  },
};

// The corpus taxonomy, kept alongside the publisher kind because the two answer
// different questions. Kind says who is speaking. Type says what kind of
// evidence the document is, and therefore whether it can be cited or only
// inferred from.
export type CorpusType = "A" | "B" | "C" | "D" | "E" | "T";

export const corpusTypeMeta: Record<CorpusType, { label: string; note: string }> = {
  A: { label: "Guidance", note: "The expert teaching explicitly. Citable." },
  B: { label: "Specimen or template", note: "The artifact itself. Which fields exist is a statement about what matters." },
  C: { label: "Receiver voice", note: "The person who READS saying what they need. The scarcest and most valuable type." },
  D: { label: "Critique or teardown", note: "The definition of bad, which a checker needs as much as the definition of good." },
  E: { label: "Expert specimen", note: "An expert communicating well without discussing communication. Inferred evidence." },
  T: { label: "Testimony", note: "A practitioner describing the difficulty. Where there is declared pain there is a hidden dimension." },
};

/* ------------------------------------------------------------------ *
 * URL verification
 * ------------------------------------------------------------------ */

export type CheckStatus =
  // The request returned 2xx.
  | "reachable"
  // The host exists and answered, but refuses automated requests (403, 429).
  // The document is in the local corpus, captured at collection time.
  | "blocked"
  // Nothing at that URL: 404, DNS failure, or timeout. Never allowed to ship.
  | "dead";

export type UrlCheck = {
  status: CheckStatus;
  /** HTTP code returned by the check. 0 means the request never completed. */
  httpStatus: number;
};

export type EvidenceSource = {
  id: string;
  /** Publisher or author as it should be shown. */
  publisher: string;
  /** Named human behind the claim, where the source names one. */
  author?: string;
  title: string;
  url: string;
  kind: SourceKind;
  /** Corpus source types recorded in research/expert-corpus/_manifest.csv. */
  corpusTypes: CorpusType[];
  /** Communication situation this document was collected under, 01 to 11. */
  situation: string;
  /** What this source contributes to THIS dimension, in one line. */
  contributes: string;
  /** False only when the check found nothing at the URL. See UrlCheck. */
  verified: boolean;
  check: UrlCheck;
  /** Present in research/expert-corpus/_manifest.csv. */
  inCorpus: boolean;
  corpusFile?: string;
};

const OK: UrlCheck = { status: "reachable", httpStatus: 200 };
const BLOCKED_403: UrlCheck = { status: "blocked", httpStatus: 403 };

/* ------------------------------------------------------------------ *
 * Evidence per rubric dimension
 * ------------------------------------------------------------------ */

export type DimensionId =
  | "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8" | "analogies";

export type DimensionEvidence = {
  id: DimensionId;
  name: string;
  /** The question the dimension asks of a text. */
  question: string;
  sources: EvidenceSource[];
};

export const evidence: DimensionEvidence[] = [
  {
    id: "D1",
    name: "Reader contract",
    question: "Does the text answer the fixed questions its reader has, in the order they have them?",
    sources: [
      {
        id: "D1-draxis",
        publisher: "Draxis",
        title: "The CISO and the Board: What Directors Want",
        url: "https://draxis.ai/resources/ciso-board-relationship",
        kind: "vendor",
        corpusTypes: ["A", "C"],
        situation: "02",
        contributes: "States the four questions a board asks every time, and separates simplification from translation.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "02-ciso-board/the-ciso-and-the-board-what-directors-want-draxis-ai.md",
      },
      {
        id: "D1-bugcrowd",
        publisher: "Bugcrowd",
        title: "Tips to building better board decks for CISOs",
        url: "https://www.bugcrowd.com/blog/tips-to-building-better-board-decks-for-cisos/",
        kind: "vendor",
        corpusTypes: ["A"],
        situation: "02",
        contributes: "Reduces the board deck to three questions: what do I need to know, why do I care, what do you need from me.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "02-ciso-board/tips-to-building-better-board-decks-for-cisos.md",
      },
      {
        id: "D1-cisa",
        publisher: "CISA",
        title: "Questions Every CEO Should Ask About Cyber Risks",
        url: "https://www.cisa.gov/news-events/news/questions-every-ceo-should-ask-about-cyber-risks",
        kind: "regulator",
        corpusTypes: ["A", "B"],
        situation: "02",
        contributes: "The executive's question set written by the government itself, in the public domain.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "02-ciso-board/questions-every-ceo-should-ask-about-cyber-risks-cisa.md",
      },
      {
        id: "D1-ico",
        publisher: "UK Information Commissioner's Office",
        title: "Personal data breaches: a guide",
        url: "https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/personal-data-breaches-a-guide",
        kind: "regulator",
        corpusTypes: ["A", "B"],
        situation: "05",
        contributes: "The regulator's checklist: what a breach report must contain, enumerated and binding.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "05-regulatory-notification/personal-data-breaches-a-guide-ico.md",
      },
      {
        id: "D1-autonoma",
        publisher: "Autonoma",
        title: "Bug Report Template: The 7 Fields That Decide Triage",
        url: "https://getautonoma.com/blog/bug-report-template",
        kind: "vendor",
        corpusTypes: ["A", "B"],
        situation: "08",
        contributes: "The triager's contract: the seven fields whose presence or absence decides whether a report moves.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "08-engineering-tickets/bug-report-template-the-7-fields-that-decide-triage-autonoma-ai.md",
      },
    ],
  },
  {
    id: "D2",
    name: "Facts surviving with their frame",
    question: "Do the material facts survive together with the context that makes them interpretable?",
    sources: [
      {
        id: "D2-nacd",
        publisher: "NACD",
        author: "Gregory Touhill",
        title: "Example Cybersecurity Board Reporting",
        url: "https://www.nacdonline.org/all-governance/governance-resources/governance-research/director-handbooks/2026-cyber-risk-oversight/cyber-risk-handbook-toolkit-2026/cybersecurity-board-reporting/",
        kind: "governance-body",
        corpusTypes: ["B", "A"],
        situation: "02",
        contributes: "A board report artifact where every metric ships with an explicit target, for example MFA above 98 percent.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "02-ciso-board/example-cybersecurity-board-reporting-nacd.md",
      },
      {
        id: "D2-draxis",
        publisher: "Draxis",
        title: "The CISO and the Board: What Directors Want",
        url: "https://draxis.ai/resources/ciso-board-relationship",
        kind: "vendor",
        corpusTypes: ["A", "C"],
        situation: "02",
        contributes: "Makes trend the first question a number has to answer: better or worse than last quarter.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "02-ciso-board/the-ciso-and-the-board-what-directors-want-draxis-ai.md",
      },
      {
        id: "D2-securityweek",
        publisher: "SecurityWeek",
        title: "Beyond the Hype: Questioning FUD in Cybersecurity Marketing",
        url: "https://www.securityweek.com/beyond-the-hype-questioning-fud-in-cybersecurity-marketing",
        kind: "trade-press",
        corpusTypes: ["D"],
        situation: "10",
        contributes: "The test a quoted number fails: how was it calculated. Provenance is part of the fact.",
        verified: true,
        check: BLOCKED_403,
        inCorpus: true,
        corpusFile: "10-risk-acceptance-budget/beyond-the-hype-questioning-fud-in-cybersecurity.md",
      },
      {
        id: "D2-fair",
        publisher: "FAIR Institute",
        author: "James Lam and panel, FAIRCON22",
        title: "3 Tips for a Successful CISO Board Presentation",
        url: "https://www.fairinstitute.org/blog/3-tips-for-successful-ciso-board-presentation-faircon22",
        kind: "practitioner",
        corpusTypes: ["A", "C"],
        situation: "02",
        contributes: "A veteran director on the dumb math of heat maps: a colour is not a frame of reference.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "02-ciso-board/3-tips-for-a-successful-ciso-board-presentation-faircon22-panel.md",
      },
    ],
  },
  {
    id: "D3",
    name: "Bidirectional severity calibration",
    question: "Does the severity transmitted match the original, without softening AND without inflating?",
    sources: [
      {
        id: "D3-debevoise",
        publisher: "NYU Law, Program on Corporate Compliance and Enforcement",
        author: "Debevoise and Plimpton",
        title: "Lessons Learned: One Year of Form 8-K Item 1.05",
        url: "https://wp.nyu.edu/compliance_enforcement/2025/03/25/lessons-learned-one-year-of-form-8-k-material-cybersecurity-incident-reporting",
        kind: "practitioner",
        corpusTypes: ["D", "A"],
        situation: "05",
        contributes: "The downside of softening, priced: SEC comment letters and the SolarWinds case.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "05-regulatory-notification/one-year-of-form-8-k-material-cybersecurity-incident.md",
      },
      {
        id: "D3-blackkite",
        publisher: "Black Kite",
        title: "4 Common Mistakes CISOs Make When Presenting to the Board",
        url: "https://blackkite.com/blog/4-common-mistakes-cisos-make-when-presenting-to-the-board",
        kind: "vendor",
        corpusTypes: ["D"],
        situation: "02",
        contributes: "The upward failure named: the security leader who cried wolf, and the credibility that does not come back.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "02-ciso-board/4-common-mistakes-in-a-ciso-board-presentation-black-kite.md",
      },
      {
        id: "D3-lwn",
        publisher: "LWN.net",
        title: "The bogus CVE problem",
        url: "https://lwn.net/Articles/944209",
        kind: "trade-press",
        corpusTypes: ["D"],
        situation: "07",
        contributes: "Inflation as a documented case: CVE-2020-19909 scored critical by third parties over the curl maintainer's own analysis.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "07-vendor-advisory-cve/the-bogus-cve-problem-lwn-net.md",
      },
      {
        id: "D3-autonoma",
        publisher: "Autonoma",
        title: "Bug Report Template: The 7 Fields That Decide Triage",
        url: "https://getautonoma.com/blog/bug-report-template",
        kind: "vendor",
        corpusTypes: ["A", "B"],
        situation: "08",
        contributes: "Carries the IEEE 1044 distinction into practice: severity is not priority, and merging them is an error.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "08-engineering-tickets/bug-report-template-the-7-fields-that-decide-triage-autonoma-ai.md",
      },
    ],
  },
  {
    id: "D4",
    name: "Declared uncertainty and temporal contract",
    question: "Is what is not known declared as unknown, and does the text honour the clock of its genre?",
    sources: [
      {
        id: "D4-mitre",
        publisher: "MITRE, CVE Project",
        author: "Jonathan Evans",
        title: "CVE Key Details Phrasing",
        url: "https://cveproject.github.io/docs/content/key-details-phrasing.pdf",
        kind: "standards-body",
        corpusTypes: ["B"],
        situation: "07",
        contributes: "A standard vocabulary for the unknown, so that missing information reads as missing rather than absent.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "07-vendor-advisory-cve/cve-key-details-phrasing.md",
      },
      {
        id: "D4-debevoise",
        publisher: "NYU Law, Program on Corporate Compliance and Enforcement",
        author: "Debevoise and Plimpton",
        title: "Lessons Learned: One Year of Form 8-K Item 1.05",
        url: "https://wp.nyu.edu/compliance_enforcement/2025/03/25/lessons-learned-one-year-of-form-8-k-material-cybersecurity-incident-reporting",
        kind: "practitioner",
        corpusTypes: ["D", "A"],
        situation: "05",
        contributes: "Disclose now and amend later, and the finding that uncertainty boilerplate is what draws comment letters.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "05-regulatory-notification/one-year-of-form-8-k-material-cybersecurity-incident.md",
      },
      {
        id: "D4-ico",
        publisher: "UK Information Commissioner's Office",
        title: "Personal data breaches: a guide",
        url: "https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/personal-data-breaches-a-guide",
        kind: "regulator",
        corpusTypes: ["A", "B"],
        situation: "05",
        contributes: "Puts the 72 hour clock above completeness: report even without all the details yet.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "05-regulatory-notification/personal-data-breaches-a-guide-ico.md",
      },
      {
        id: "D4-instructure",
        publisher: "Instructure",
        author: "Steve Daly, CEO",
        title: "Security Incident Update and FAQs",
        url: "https://www.instructure.com/incident_update",
        kind: "practitioner",
        corpusTypes: ["T", "C"],
        situation: "03",
        contributes: "A first party admission of the failure mode: we focused on verifying facts and went quiet while you needed consistent updates.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "03-incident-sitrep/t2-03-steve-daly-instructure-com.md",
      },
      {
        id: "D4-cloudflare",
        publisher: "Cloudflare",
        title: "Code Orange: fail small, fail complete",
        url: "https://blog.cloudflare.com/code-orange-fail-small-complete/",
        kind: "practitioner",
        corpusTypes: ["T", "C"],
        situation: "03",
        contributes: "Predictable cadence even when there is nothing new, with a comms team moving in lockstep with the responders.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "03-incident-sitrep/t2-03-cloudflare-incident-response-and-executi-blog-cloudflare-com.md",
      },
      {
        id: "D4-fbi-farshchi",
        publisher: "FBI, Ahead of the Threat podcast",
        author: "Jamil Farshchi, CISO",
        title: "Cyber incident response and crisis management",
        url: "https://www.fbi.gov/video-repository/ahead-of-the-threat-podcast-s1-e3-chris-cwalina/view",
        kind: "practitioner",
        corpusTypes: ["C"],
        situation: "03",
        contributes: "Calibration of upward assurances: a tabletop is not equivalent to a live test of recovery.",
        verified: true,
        check: BLOCKED_403,
        inCorpus: true,
        corpusFile: "03-incident-sitrep/c-voices-03-cyber-incident-response-and-crisis-manag-fbi-gov.md",
      },
    ],
  },
  {
    id: "D5",
    name: "Density and selection by materiality",
    question: "Does the text carry what is material, and only what is material, for its reader?",
    sources: [
      {
        id: "D5-decryptiondigest",
        publisher: "Decryption Digest",
        title: "SOC Shift Handoff: writing notes that preserve investigation context",
        url: "https://www.decryptiondigest.com/blog/soc-shift-handoff-investigation-context",
        kind: "practitioner",
        corpusTypes: ["C"],
        situation: "09",
        contributes: "Both mirror failures in one seat: the keep watching one liner and the 800 line dump.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "09-soc-alert-closure-handoff/c-voices-09-cybersecurity-practitioner-soc-operati-decryptiondigest-com.md",
      },
      {
        id: "D5-mitre",
        publisher: "MITRE, CVE Project",
        title: "CVE Key Details Phrasing",
        url: "https://cveproject.github.io/docs/content/key-details-phrasing.pdf",
        kind: "standards-body",
        corpusTypes: ["B"],
        situation: "07",
        contributes: "States the cost on both sides: under reporting breaks matching, over reporting obscures what is distinctive.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "07-vendor-advisory-cve/cve-key-details-phrasing.md",
      },
      {
        id: "D5-darkreading",
        publisher: "Dark Reading",
        author: "Ashley Sawatsky, formerly Shopify",
        title: "The best way to communicate after a data breach",
        url: "https://www.darkreading.com/cybersecurity-operations/best-way-communicate-after-data-breach",
        kind: "trade-press",
        corpusTypes: ["T", "C"],
        situation: "06",
        contributes: "More detail buys more out of context quoting plus overload for an already frightened reader.",
        verified: true,
        check: BLOCKED_403,
        inCorpus: true,
        corpusFile: "06-public-breach-comms/t2-06-ashley-sawatsky-senior-incident-respon-darkreading-com.md",
      },
      {
        id: "D5-nacd",
        publisher: "NACD",
        author: "Gregory Touhill",
        title: "Example Cybersecurity Board Reporting",
        url: "https://www.nacdonline.org/all-governance/governance-resources/governance-research/director-handbooks/2026-cyber-risk-oversight/cyber-risk-handbook-toolkit-2026/cybersecurity-board-reporting/",
        kind: "governance-body",
        corpusTypes: ["B", "A"],
        situation: "02",
        contributes: "The critical few as the selection rule, against the activity report nobody asked for.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "02-ciso-board/example-cybersecurity-board-reporting-nacd.md",
      },
      {
        id: "D5-sec-lee",
        publisher: "U.S. Securities and Exchange Commission",
        author: "Commissioner Allison Herren Lee",
        title: "Remarks at PLI Corporate Governance",
        url: "https://www.sec.gov/newsroom/speeches-statements/lee-remarks-pli-corporate-governance-030422",
        kind: "regulator",
        corpusTypes: ["T", "C"],
        situation: "05",
        contributes: "Materiality treated as a judgment exercised while drafting, not a label applied afterwards.",
        verified: true,
        check: BLOCKED_403,
        inCorpus: true,
        corpusFile: "05-regulatory-notification/t2-05-securities-lawyer-sec-gov.md",
      },
    ],
  },
  {
    id: "D6",
    name: "Register and specificity by audience",
    question: "Do the abstraction level, the jargon and the specificity match the actor who is reading?",
    sources: [
      {
        id: "D6-informs",
        publisher: "INFORMS, Management Science",
        title: "Study of cyber risk briefings with corporate directors",
        url: "https://pubsonline.informs.org/doi/10.1287/mnsc.2023.04147",
        kind: "peer-reviewed",
        corpusTypes: ["C"],
        situation: "02",
        contributes: "Briefings fail at both ends, too abstract or too geeked up, and the observable symptom is perfunctory questions.",
        verified: true,
        check: BLOCKED_403,
        inCorpus: true,
        corpusFile: "02-ciso-board/c-board-voices-expert-corporate-director-pubsonline-informs-org.md",
      },
      {
        id: "D6-hedgehog",
        publisher: "Hedgehog Security",
        title: "Writing Findings That Teams Can Actually Remediate",
        url: "https://www.hedgehogsecurity.co.uk/blog/writing-findings-teams-can-remediate",
        kind: "practitioner",
        corpusTypes: ["A", "D"],
        situation: "01",
        contributes: "The engineer end of the gradient: implement best practices is the most expensive sentence in reporting, and real remediation is the exact GPO path.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "01-pentest-exec-summary/writing-findings-that-teams-can-actually-remediate.md",
      },
      {
        id: "D6-brookings",
        publisher: "Brookings Institution",
        author: "Peter Singer",
        title: "Research chat: cybersecurity and what the media needs to know",
        url: "https://www.brookings.edu/articles/research-chat-peter-singer-on-cybersecurity-and-what-the-media-needs-to-know/",
        kind: "trade-press",
        corpusTypes: ["C"],
        situation: "11",
        contributes: "The public register has two failure poles: excluding jargon and histrionics.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "11-general-public/c-voices-11-cybersecurity-author-and-security-commun-brookings-edu.md",
      },
      {
        id: "D6-ncsc",
        publisher: "NCSC UK",
        title: "Cyber Security Toolkit for Boards: audio transcripts",
        url: "https://www.ncsc.gov.uk/sites/default/files/2026-07/Cyber-security-toolkit-for-boards-audio-transcripts.pdf",
        kind: "governance-body",
        corpusTypes: ["C", "T"],
        situation: "02",
        contributes: "Real directors, verbatim, asking for language everyone in the room can understand.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "02-ciso-board/ncsc-board-toolkit-audio-transcripts.md",
      },
    ],
  },
  {
    id: "D7",
    name: "Actionable ending",
    question: "Does the reader know what is being asked of them, or what happens next?",
    sources: [
      {
        id: "D7-tysonmartin",
        publisher: "Tyson Martin",
        author: "Tyson Martin, CISO",
        title: "How to Translate Cyber Risk Into Business Impact",
        url: "https://medium.com/@tyson.martin/how-to-translate-cyber-risk-into-business-impact-17859d9d41c7",
        kind: "practitioner",
        corpusTypes: ["A"],
        situation: "10",
        contributes: "The ending as three slots: what breaks, what it costs, who owns the next move.",
        verified: true,
        check: BLOCKED_403,
        inCorpus: true,
        corpusFile: "10-risk-acceptance-budget/how-to-translate-cyber-risk-into-business-impact.md",
      },
      {
        id: "D7-blackkite",
        publisher: "Black Kite",
        title: "4 Common Mistakes CISOs Make When Presenting to the Board",
        url: "https://blackkite.com/blog/4-common-mistakes-cisos-make-when-presenting-to-the-board",
        kind: "vendor",
        corpusTypes: ["D"],
        situation: "02",
        contributes: "The board pattern closes on an explicit ask, and its absence is one of the four named mistakes.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "02-ciso-board/4-common-mistakes-in-a-ciso-board-presentation-black-kite.md",
      },
      {
        id: "D7-hedgehog",
        publisher: "Hedgehog Security",
        title: "Writing Findings That Teams Can Actually Remediate",
        url: "https://www.hedgehogsecurity.co.uk/blog/writing-findings-teams-can-remediate",
        kind: "practitioner",
        corpusTypes: ["A", "D"],
        situation: "01",
        contributes: "Remediation is not finished without a verification step the reader can run.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "01-pentest-exec-summary/writing-findings-that-teams-can-actually-remediate.md",
      },
      {
        id: "D7-ico",
        publisher: "UK Information Commissioner's Office",
        title: "Personal data breaches: a guide",
        url: "https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/personal-data-breaches-a-guide",
        kind: "regulator",
        corpusTypes: ["A", "B"],
        situation: "05",
        contributes: "Protective advice to the affected individual is mandatory content, by law, not an editorial choice.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "05-regulatory-notification/personal-data-breaches-a-guide-ico.md",
      },
      {
        id: "D7-hn-vercel",
        publisher: "Hacker News",
        author: "A security incident responder, commenting on the Vercel notice",
        title: "Thread on an initial security incident notice",
        url: "https://news.ycombinator.com/item?id=47825592",
        kind: "practitioner",
        corpusTypes: ["T"],
        situation: "03",
        contributes: "The counterexample from the receiving end: the only advice was review environment variables, and what should a customer do with that.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "03-incident-sitrep/t2-03-security-incident-response-team-member-news-ycombinator-com.md",
      },
    ],
  },
  {
    id: "D8",
    name: "Genre form",
    question: "Does the text respect the format constants its genre has already published?",
    sources: [
      {
        id: "D8-nacd",
        publisher: "NACD",
        author: "Gregory Touhill",
        title: "Example Cybersecurity Board Reporting",
        url: "https://www.nacdonline.org/all-governance/governance-resources/governance-research/director-handbooks/2026-cyber-risk-oversight/cyber-risk-handbook-toolkit-2026/cybersecurity-board-reporting/",
        kind: "governance-body",
        corpusTypes: ["B", "A"],
        situation: "02",
        contributes: "Hard numbers for the board genre: a two page memo plus dashboard, and one page within 24 hours for a material incident.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "02-ciso-board/example-cybersecurity-board-reporting-nacd.md",
      },
      {
        id: "D8-sec-8k",
        publisher: "U.S. Securities and Exchange Commission",
        author: "Erik Gerding, Director, Division of Corporation Finance",
        title: "Disclosure of Cybersecurity Incidents Determined to Be Material",
        url: "https://www.sec.gov/newsroom/speeches-statements/gerding-cybersecurity-incidents-05212024",
        kind: "regulator",
        corpusTypes: ["A", "B"],
        situation: "05",
        contributes: "The four business day clock of Form 8-K Item 1.05, stated by the regulator that enforces it.",
        verified: true,
        check: BLOCKED_403,
        inCorpus: true,
        corpusFile: "05-regulatory-notification/disclosure-of-cybersecurity-incidents-determined-to-be.md",
      },
      {
        id: "D8-ico",
        publisher: "UK Information Commissioner's Office",
        title: "Personal data breaches: a guide",
        url: "https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/personal-data-breaches-a-guide",
        kind: "regulator",
        corpusTypes: ["A", "B"],
        situation: "05",
        contributes: "The 72 hour GDPR deadline as a format constant of the genre, not a target.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "05-regulatory-notification/personal-data-breaches-a-guide-ico.md",
      },
      {
        id: "D8-pagerduty",
        publisher: "PagerDuty",
        title: "Anti-Patterns, Incident Response Documentation",
        url: "https://response.pagerduty.com/resources/anti_patterns",
        kind: "vendor",
        corpusTypes: ["D"],
        situation: "04",
        contributes: "Cadence measured from practice: updates every 5 minutes consume the response, 20 to 30 minutes works.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "04-postmortem/anti-patterns-pagerduty-incident-response-documentation.md",
      },
      {
        id: "D8-tylerwall",
        publisher: "Medium, Cyber NOW Education",
        author: "Tyler Wall",
        title: "What is the SOC analyst method",
        url: "https://cybernoweducation.medium.com/what-is-the-soc-analyst-method-e1ab043d96d3",
        kind: "practitioner",
        corpusTypes: ["A", "T"],
        situation: "09",
        contributes: "The five sections of an alert closure, written by the analyst who fills them.",
        verified: true,
        check: BLOCKED_403,
        inCorpus: true,
        corpusFile: "09-soc-alert-closure-handoff/how-to-do-security-analysis-tyler-wall-medium.md",
      },
      {
        id: "D8-mitre",
        publisher: "MITRE, CVE Project",
        author: "Jonathan Evans",
        title: "CVE Key Details Phrasing",
        url: "https://cveproject.github.io/docs/content/key-details-phrasing.pdf",
        kind: "standards-body",
        corpusTypes: ["B"],
        situation: "07",
        contributes: "The full CVE grammar, including a controlled taxonomy of attacker types.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "07-vendor-advisory-cve/cve-key-details-phrasing.md",
      },
      {
        id: "D8-ucl",
        publisher: "arXiv, University College London",
        title: "Passing the Baton: shift handovers within cybersecurity incident response",
        url: "https://arxiv.org/html/2601.07788v1",
        kind: "academic",
        corpusTypes: ["D", "E"],
        situation: "09",
        contributes: "Handover protocols of 12 or more items pass more information, echoing the healthcare evidence that most serious errors trace to handoff miscommunication.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "09-soc-alert-closure-handoff/shift-handovers-within-cybersecurity-incident-response.md",
      },
    ],
  },
  {
    id: "analogies",
    name: "Analogies annex",
    question: "When the text reaches for a metaphor, does the metaphor carry the risk or replace it?",
    sources: [
      {
        id: "analogies-sandia",
        publisher: "Sandia National Laboratories",
        title: "Metaphors for Cyber Security",
        url: "https://www.osti.gov/servlets/purl/947345",
        kind: "academic",
        corpusTypes: ["A", "E"],
        situation: "11",
        contributes: "52,700 words in the public domain on why metaphor is unavoidable and how the chosen one defines the problem.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "11-general-public/pdf-metaphors-for-cyber-security-osti-gov.md",
      },
      {
        id: "analogies-venables",
        publisher: "Phil Venables",
        author: "Phil Venables, formerly CISO at Goldman Sachs and Google Cloud",
        title: "Are Security Analogies Counterproductive?",
        url: "https://www.philvenables.com/post/are-security-analogies-counterproductive",
        kind: "practitioner",
        corpusTypes: ["A"],
        situation: "11",
        contributes: "A catalogue of the analogies that collapse, and an explicit preference order for explaining without one.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "11-general-public/are-security-analogies-counterproductive.md",
      },
      {
        id: "analogies-wolff",
        publisher: "Georgetown Journal of International Affairs",
        author: "Josephine Wolff",
        title: "Reporting on technical cybersecurity breaches for non technical audiences",
        url: "https://gjia.georgetown.edu/science-technology/reporting-on-technical-cybersecurity-breaches-for-non-technical-audiences/",
        kind: "academic",
        corpusTypes: ["C"],
        situation: "11",
        contributes: "The opposite counsel: avoid metaphor, lead with stakes rather than mechanism.",
        verified: true,
        check: OK,
        inCorpus: true,
        corpusFile: "11-general-public/c-voices-11-cybersecurity-policy-professor-and-craft-gjia-georgetown-edu.md",
      },
      {
        id: "analogies-geant",
        publisher: "GEANT CONNECT",
        author: "Jessica Schumacher, SWITCH",
        title: "Top tips for talking tech to non technical audiences",
        url: "https://connect.geant.org/2022/10/11/top-tips-for-talking-tech-to-non-technical-audiences",
        kind: "practitioner",
        corpusTypes: ["C"],
        situation: "11",
        contributes: "The working compromise: an analogy that fits, with its loss of precision declared out loud.",
        verified: true,
        check: BLOCKED_403,
        inCorpus: true,
        corpusFile: "11-general-public/c-voices-11-security-engineer-and-security-awareness-connect-geant-org.md",
      },
    ],
  },
];

export const evidenceByDimension = Object.fromEntries(
  evidence.map((d) => [d.id, d]),
) as Record<DimensionId, DimensionEvidence>;

/** Every source entry, including the ones cited under more than one dimension. */
export const allEvidenceSources: EvidenceSource[] = evidence.flatMap((d) => d.sources);

/** One entry per distinct URL, for a provenance table that should not repeat itself. */
export const distinctEvidenceSources: EvidenceSource[] = Array.from(
  new Map(allEvidenceSources.map((s) => [s.url, s])).values(),
);

export const evidenceSummary = {
  dimensions: evidence.length,
  citations: allEvidenceSources.length,
  distinctSources: distinctEvidenceSources.length,
  reachable: distinctEvidenceSources.filter((s) => s.check.status === "reachable").length,
  blocked: distinctEvidenceSources.filter((s) => s.check.status === "blocked").length,
  dead: distinctEvidenceSources.filter((s) => s.check.status === "dead").length,
  inCorpus: distinctEvidenceSources.filter((s) => s.inCorpus).length,
  checkedOn: URL_CHECK_DATE,
};

/* ------------------------------------------------------------------ *
 * Anticipated objections
 * ------------------------------------------------------------------ */

// Stated in their sharpest form on purpose. A weak objection convinces nobody,
// and an answer to a weakened objection is worth nothing.
export type Objection = {
  /** Short stable handle, usable as an anchor. */
  handle: string;
  /** The attack, unsoftened. */
  objection: string;
  /** The answer. */
  answer: string;
};

export const objections: Objection[] = [
  {
    handle: "why-these-situations",
    objection: "Why these 11 situations and not others? The list looks like it was drawn to fit the data you happened to have.",
    answer: "They come from an exhaustive map of 36 situations, consolidated by one explicit criterion: same rules of the game, meaning same reader, same clock, same cost of error. The 11 cover the three floors of the industry: formal and legal, managerial, operational. The full map exists and every merge is documented. Adding a new situation does not break the rubric, it adds a column of weights.",
  },
  {
    handle: "why-not-vulnerability-class",
    objection: "Organising by situation is arbitrary. Security has an obvious taxonomy already: the vulnerability class. Use it.",
    answer: "The evidence says the communication rules vary by situation, not by topic. The same XSS is communicated differently in a CVE, a board deck and a ticket, while two unrelated vulnerabilities inside the same genre share the rules. Our own data confirms it: the dataset carries 8 vulnerability classes and the style differences run by audience, not by class.",
  },
  {
    handle: "corpus-is-blogs",
    objection: "The corpus is blog opinion, not ground truth. You are building a measurement instrument on top of consultants' marketing.",
    answer: "Three answers. First, the corpus is not only opinion: it includes regulators with force of law such as the SEC and the ICO, standards such as MITRE, IEEE 1044 and OWASP, peer reviewed papers from INFORMS Management Science and academic work from UCL, and real specimens including breach letters from the California AG registry and 8-K filings from EDGAR. Second, the source types are declared and kept separate, so what is citable never gets mixed with what is inferred. Third, the rubric does not rest on the corpus alone: it is validated against the real behaviour of 3,727 human written pairs.",
  },
  {
    handle: "llm-circularity",
    objection: "You used LLMs to build a benchmark that evaluates LLMs. That is circular, and the circularity flatters exactly the models you are grading.",
    answer: "It is the known risk of the dataset, it is declared rather than hidden, and human_verified is false on every record. The mitigation is in progress: human verification of the frozen test set plus out of distribution sets of roughly 700 pairs before publication, with train labelled honestly as LLM aligned. And the rubric itself does not come from an LLM: it comes from the human corpus and the human written pairs.",
  },
  {
    handle: "why-bidirectional",
    objection: "Why penalise inflation? Every serious fidelity checker only punishes softening. You invented a second failure mode to look original.",
    answer: "The evidence demands both ends, in multiple independent situations. Inflation destroys credibility with boards, the security leader who cried wolf. It contaminates whole ecosystems: curl CVE-2020-19909 was scored critical by third parties on a bug that was not a security bug. And it is the engine of the FUD the industry itself denounces. A checker that punishes only softening is a checker that rewards inflating.",
  },
  {
    handle: "already-summarization-eval",
    objection: "This is summarisation faithfulness evaluation, which already exists. FactCC, SummaC and the rest solved this years ago.",
    answer: "That literature exists and this project inherits it, sentence level NLI and planted errors included. What that same literature shows is that the methods do not generalise across domains: the clinical benchmark TreatFact had to be built because the news trained ones failed in clinic. The security slot is empty, and security adds dimensions no news benchmark measures: severity, exploitability caveats, a regulatory temporal contract, and audiences with a legal checklist.",
  },
  {
    handle: "models-are-good-enough",
    objection: "Frontier models are already very good at this. By the time you publish, the problem will have solved itself.",
    answer: "The better the models get, the more unaudited generated text exists and the more a measuring stick is needed. And the assumption is measurable rather than arguable: recent edit detection benchmarks in the SummEdits and SummExecEdit family show the best models still fail at detection and explanation taken together. Running the frontier models against our own test set turns the doubt into a number.",
  },
  {
    handle: "who-are-you",
    objection: "Who are you to define how security should be communicated? You have no standing to write this rubric.",
    answer: "Nobody, which is exactly why the method carries the weight. The rubric is not an opinion: it is the traceable synthesis of what regulators, standards bodies, interviewed board directors, practitioners with decades in the seat and peer reviewed studies say, cross checked against the behaviour of 179 organisations across 3,727 pairs. Every dimension carries its source list. Attacking the rubric means attacking the evidence, and that is precisely what a good benchmark wants: to be improved with more evidence.",
  },
];

/* ------------------------------------------------------------------ *
 * Build time invariants
 * ------------------------------------------------------------------ */

const EM_DASH = "\u2014";

function assertNoEmDash(label: string, value: string) {
  if (value.includes(EM_DASH)) {
    throw new Error(
      "evidence.ts: em dash in user facing copy at " + label + ". House rule: use a middle dot, a colon or a comma.",
    );
  }
}

const seenIds = new Set<string>();
for (const dimension of evidence) {
  assertNoEmDash(dimension.id + ".name", dimension.name);
  assertNoEmDash(dimension.id + ".question", dimension.question);
  if (dimension.sources.length === 0) {
    throw new Error("evidence.ts: dimension " + dimension.id + " has no sources.");
  }
  for (const source of dimension.sources) {
    if (seenIds.has(source.id)) {
      throw new Error("evidence.ts: duplicate source id " + source.id + ".");
    }
    seenIds.add(source.id);
    if (!source.url.startsWith("https://")) {
      throw new Error("evidence.ts: source " + source.id + " has a non https URL.");
    }
    const isDead = source.check.status === "dead";
    if (source.verified === isDead) {
      throw new Error("evidence.ts: verified flag disagrees with the recorded check on " + source.id + ".");
    }
    if (isDead) {
      throw new Error(
        "evidence.ts: source " + source.id + " points at a dead URL (" + source.url + "). Fix or remove it before shipping.",
      );
    }
    assertNoEmDash(source.id + ".title", source.title);
    assertNoEmDash(source.id + ".contributes", source.contributes);
    assertNoEmDash(source.id + ".publisher", source.publisher);
  }
}

const seenHandles = new Set<string>();
for (const objection of objections) {
  if (seenHandles.has(objection.handle)) {
    throw new Error("evidence.ts: duplicate objection handle " + objection.handle + ".");
  }
  seenHandles.add(objection.handle);
  assertNoEmDash(objection.handle + ".objection", objection.objection);
  assertNoEmDash(objection.handle + ".answer", objection.answer);
}

if (objections.length !== 8) {
  throw new Error("evidence.ts: the guide anticipates 8 objections, this file carries " + objections.length + ".");
}
