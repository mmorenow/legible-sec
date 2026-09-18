/* Does the model layer catch a quote the model invented?
 *
 * `judgeLlm.mapAnswer` is the half of the checker that decides whether a
 * sentence from a language model gets rendered as evidence. Everything else in
 * the review surface fails only by showing a string it found; this is the one
 * place where a fluent sentence about a passage that is not in the text could
 * slip through and be presented as proof. It is also the one place a provider
 * is not needed to test it, because the mapping is pure.
 *
 * So it is tested here, against a stubbed answer that deliberately contains
 * quotes of every shape that matters: verbatim, re-wrapped, re-cased, empty
 * where an empty quote is legitimate, and outright fabricated.
 *
 * Run: node scripts/check_judge_mapping.mjs   (from presentation/web)
 */

import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url, { alias: { "@": process.cwd() + "/src" } });
const { mapAnswer } = await jiti.import(process.cwd() + "/src/lib/judgeLlm.ts");

const SOURCE = `FINDING VULN-2024-0417
Severity: High (CVSS 8.1)
Affected:  47 hosts   in the corporate segment.
Status: Not fixed. A vendor patch is available.
Note: No evidence of exploitation was found in the logs available to us.`;
const DRAFT = `We identified a medium severity issue affecting some servers. The issue has been fixed and there is no risk to customer data.`;

const r = mapAnswer({
  raw: {
    claims: [
      { claim: "The issue has been fixed", support: "contradicted", source_quote: "Status: Not fixed.", note: "open in the finding" },
      { claim: "there is no risk to customer data", support: "absent", source_quote: "", note: "not addressed" },
      { claim: "affecting\n  SOME servers", support: "supported", source_quote: "Affected: 47 hosts in the corporate segment", note: "vague quantifier" },
      { claim: "the attacker needs physical access", support: "contradicted", source_quote: "Physical access is required", note: "fabricated on purpose" },
    ],
    questions: [
      { question: "What is the plan?", answered: true, draft_quote: "a roadmap nobody wrote", note: "fabricated on purpose" },
      { question: "What is the impact?", answered: false, draft_quote: "", note: "absent" },
    ],
    jargon: [{ class_name: "absolute assurance", present: true, draft_quote: "there is no risk to customer data", note: "unbounded" }],
  },
  source: SOURCE, draft: DRAFT, situation: "S02", authority: "L0",
  sentQuestions: [{ check: "reader_questions", item: "What is the plan?", reason: "x", source: "CISA" },
                  { check: "reader_questions", item: "What is the impact?", reason: "x", source: "CISA" }],
  sentJargon: [{ check: "prohibited_jargon", item: "absolute assurance", reason: "x", source: "ICO" }],
  dropped: 3,
});

let failed = 0;
const t = (name, got, want) => {
  const ok = got === want;
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name.padEnd(46)} ${JSON.stringify(got)}${ok ? "" : `  expected ${JSON.stringify(want)}`}`);
};
t("unanchored quotes are counted", r.unanchored, 2);
t("a re-wrapped, re-cased quote still anchors", r.claims[2].anchored, true);
t("and returns the real span from the draft", r.claims[2].claimSpan, "affecting some servers");
t("and the real span from the finding", r.claims[2].sourceSpan, "Affected:  47 hosts   in the corporate segment");
t("a fabricated claim quote is marked", r.claims[3].anchored, false);
t("and its source span stays null", r.claims[3].sourceSpan, null);
t("an absent claim owes no source quote", r.claims[1].anchored, true);
t("a fabricated answer quote is marked", r.questions[0].anchored, false);
t("an unanswered question owes no quote", r.questions[1].anchored, true);
t("provenance carries onto the question", r.questions[0].source, "CISA");
t("provenance carries onto the jargon class", r.jargon[0].source, "ICO");
t("omitted items are reported", r.omitted?.count, 3);
t("genre authority is preserved", r.authority, "L0");

console.log(failed === 0 ? "\ncheck:judge  all assertions hold" : `\ncheck:judge  ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
