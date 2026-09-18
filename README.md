<div align="center">

# LEGIBLE

[![License](https://img.shields.io/badge/license-Apache--2.0-3f77ff?style=for-the-badge&logo=apache&logoColor=white)](LICENSE)
[![Hugging Face](https://img.shields.io/badge/dataset-coming%20soon-FFD21E?style=for-the-badge&logo=huggingface&logoColor=FFD21E)](#corpus)
[![Website](https://img.shields.io/badge/website-coming%20soon-1f4fd8?style=for-the-badge)](#reviewer)
[![Benchmark](https://img.shields.io/badge/benchmark-coming%20soon-e9603f?style=for-the-badge)](#benchmark)

</div>

LEGIBLE is an open source project for measuring what a security finding keeps and
what it loses when it is rewritten for a reader who will not read the technical text.
It provides a corpus of real before-and-after pairs, a rubric that defines what a
good rewrite is, a reviewer that checks a draft against the finding it came from, a
pre-registered benchmark that applies the same measurement to language models, and a
retrieval tool over the corpus.

The rubric was derived from 237 professional guidance documents. The corpus holds
3,727 pairs taken verbatim from published security documents: consultancy reports,
government audits, advisories and incident postmortems. Nothing in the corpus is
generated.

## Components

| | | Status |
|---|---|---|
| [Corpus](#corpus) | 3,727 aligned pairs: a technical finding, and the version of it a professional wrote for a non-technical reader | Built, not published |
| [Rubric](#rubric) | Eight dimensions over two axes, and four measurement layers | v0.1 |
| [Reviewer](#reviewer) | Deterministic checks of a draft against its source finding, in the browser | Works |
| [Benchmark](#benchmark) | The same measurement applied to a model that writes the rewrite | Designed, not run |
| [Retrieval](#retrieval) | Lexical search over the corpus for precedents | Works |

> [!NOTE]
> The benchmark has been designed and pre-registered but not executed, and the corpus
> is built but not released. Both are stated as such everywhere a result would go.

## Corpus

3,727 aligned pairs. Each pair is a technical security finding and the version of it
written for a reader who will not read the technical text. Both halves are verbatim
from published documents.

Sources: Trail of Bits, CISA advisories, Cure53, OSTIF, the public pentest report
archive, federal Inspector General audits, GAO, FTC and SEC complaints, incident
postmortems, GitHub security advisories, CSRB reports.

The unit is the pair, not the document. Both halves inside one report is the most
common shape and not the definition: the corpus also holds two publications about one
event written for different readers, a written record paired with the message sent
about it, and a technical concept paired with the plain-language explanation written
for it.

> [!IMPORTANT]
> Where a language model took part in extraction it acted as a selector and never as
> a writer. The code asserts that every quote is a literal substring of its source,
> and discards the candidate when it is not.

Pairs carry per-record license metadata. The dataset is private until publishing it
is decided as a separate step, and it will be released under its own terms rather
than this repository's license.

## Rubric

The definition the rest of the project depends on. Source document: [`RUBRIC.md`](RUBRIC.md).

**Two axes, reported apart and never averaged.** Fidelity covers what a rewrite may
not lose or distort: numbers, severity, scope, caveats, uncertainty. Decision utility
covers what it owes its reader: answering their questions, ending in an action,
speaking their language. A text can be faithful and useless, or useful and wrong, and
a single averaged score hides both.

The two axes carry **eight dimensions**, weighted differently across eleven
communication situations.

**Four measurement layers:**

| Layer | May conclude | Evidence rule |
|---|---|---|
| L0 rules | A failure is a fact | May only fail by showing the exact string that made it fail |
| L1 entailment | A score, not a verdict | Reports the score next to the sentence it scored |
| L2 model judgement | An opinion, labelled as one | Includes the evidence that motivated it |
| H human | Nothing automatic | Declared rather than assumed |

Every check declares its layer, and the layer fixes how much authority its verdict
carries. Anything a layer cannot decide is escalated or flagged, never passed
silently.

The rubric was derived from what practitioners publish: 237 curated guidance
documents in which the industry teaches, templates and criticises how security gets
communicated. What independent sources of different kinds converged on became a
dimension. The corpus is the second step rather than the origin: it is what the
rubric is tested and improved against, and it keeps growing.

## Reviewer

Takes a technical finding and a draft rewrite of it, and reports what the draft lost.

Eleven checks run on every keystroke. Eight read the two texts against each other:
identifier parity, numeric parity, entity check, severity drift, claim inflation,
caveat parity, status drift, negation flip. Three read the draft against what its
genre requires: reader questions, prohibited jargon, format constants.

```bash
cd presentation/web
npm install
npm run dev
```

Runs entirely in the browser. The site is a static export with no server and no
account, and nothing is transmitted. An optional model layer runs on an API key
supplied by the user and stored in their own browser.

Results report what was checked and what could not be checked with equal prominence,
because a clean run is a non-detection and not a verification.

## Benchmark

**_Lost in Translation? Benchmarking LLM Fidelity in Executive Security Briefs_**

A model is given a real finding and asked to write the rewrite. The reviewer then
scores what the model's version lost against the source. Models are graded as
writers, not as detectors. No model judges another: scoring is deterministic, so
every failure is reported with the exact string that caused it.

| Error type | What is lost |
|---|---|
| Delete a number | A material figure leaves and the sentence closes over the gap |
| Soften a severity | A declared band moves down, or disappears |
| Inflate a severity | A declared band moves up |
| Drop a caveat | A bounded claim becomes unbounded |
| Break the clock | The text loses its position in time |

Results are reported per error type and never as a single number.

> [!WARNING]
> Each rate is published alongside the reviewer's own measured recall for that check.
> A model is not credited for avoiding an error its grader cannot detect. Checks whose
> recall is too low to support a claim are published as guarantees not offered rather
> than counted as zero.

## Retrieval

Takes a finding and returns real pairs from the corpus: comparable findings, and the
rewrites professionals wrote from them.

2,586 pairs indexed at 0.93 MB gzipped; a 3,000 character query searches in 0.35 ms
in the browser. Exact CVE matches rank first and are labelled as such. The method is
lexical, not semantic, and is labelled that way throughout.

It is a precedent lookup and not a set of approved answers. The corpus has not been
audited against the rubric and some of it would not pass.

## Layout

| Path | |
|---|---|
| `src/legible/` | Engine: fidelity judge, retrieval, alignment |
| `scripts/` | Pipeline: harvest, parse, pair extraction, verification, dataset build |
| `eval/` | Evaluation harness: judge mutation testing, blind bake-off |
| `presentation/web/` | Next.js static export; the reviewer and the retrieval run here |
| `RUBRIC.md` | The rubric, source document |
