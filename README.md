<div align="center">

# LEGIBLE

[![License](https://img.shields.io/badge/license-Apache--2.0-3f77ff?style=for-the-badge)](LICENSE)
[![Hugging Face](https://img.shields.io/badge/dataset-coming%20soon-FFD21E?style=for-the-badge&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5NSIgaGVpZ2h0PSI4OCIgZmlsbD0ibm9uZSI%2BPHBhdGggZmlsbD0iI0ZGRDIxRSIgZD0iTTQ3LjIxIDc2LjVhMzQuNzUgMzQuNzUgMCAxIDAgMC02OS41IDM0Ljc1IDM0Ljc1IDAgMCAwIDAgNjkuNVoiIC8%2BPHBhdGggZmlsbD0iI0ZGOUQwQiIgZD0iTTgxLjk2IDQxLjc1YTM0Ljc1IDM0Ljc1IDAgMSAwLTY5LjUgMCAzNC43NSAzNC43NSAwIDAgMCA2OS41IDBabS03My41IDBhMzguNzUgMzguNzUgMCAxIDEgNzcuNSAwIDM4Ljc1IDM4Ljc1IDAgMCAxLTc3LjUgMFoiIC8%2BPHBhdGggZmlsbD0iIzNBM0I0NSIgZD0iTTU4LjUgMzIuM2MxLjI4LjQ0IDEuNzggMy4wNiAzLjA3IDIuMzhhNSA1IDAgMSAwLTYuNzYtMi4wN2MuNjEgMS4xNSAyLjU1LS43MiAzLjctLjMyWk0zNC45NSAzMi4zYy0xLjI4LjQ0LTEuNzkgMy4wNi0zLjA3IDIuMzhhNSA1IDAgMSAxIDYuNzYtMi4wN2MtLjYxIDEuMTUtMi41Ni0uNzItMy43LS4zMloiIC8%2BPHBhdGggZmlsbD0iI0ZGMzIzRCIgZD0iTTQ2Ljk2IDU2LjI5YzkuODMgMCAxMy04Ljc2IDEzLTEzLjI2IDAtMi4zNC0xLjU3LTEuNi00LjA5LS4zNi0yLjMzIDEuMTUtNS40NiAyLjc0LTguOSAyLjc0LTcuMTkgMC0xMy02Ljg4LTEzLTIuMzhzMy4xNiAxMy4yNiAxMyAxMy4yNloiIC8%2BPHBhdGggZmlsbD0iIzNBM0I0NSIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMzkuNDMgNTRhOC43IDguNyAwIDAgMSA1LjMtNC40OWMuNC0uMTIuODEuNTcgMS4yNCAxLjI4LjQuNjguODIgMS4zNyAxLjI0IDEuMzcuNDUgMCAuOS0uNjggMS4zMy0xLjM1LjQ1LS43Ljg5LTEuMzggMS4zMi0xLjI1YTguNjEgOC42MSAwIDAgMSA1IDQuMTdjMy43My0yLjk0IDUuMS03Ljc0IDUuMS0xMC43IDAtMi4zNC0xLjU3LTEuNi00LjA5LS4zNmwtLjE0LjA3Yy0yLjMxIDEuMTUtNS4zOSAyLjY3LTguNzcgMi42N3MtNi40NS0xLjUyLTguNzctMi42N2MtMi42LTEuMjktNC4yMy0yLjEtNC4yMy4yOSAwIDMuMDUgMS40NiA4LjA2IDUuNDcgMTAuOTdaIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIC8%2BPHBhdGggZmlsbD0iI0ZGOUQwQiIgZD0iTTcwLjcxIDM3YTMuMjUgMy4yNSAwIDEgMCAwLTYuNSAzLjI1IDMuMjUgMCAwIDAgMCA2LjVaTTI0LjIxIDM3YTMuMjUgMy4yNSAwIDEgMCAwLTYuNSAzLjI1IDMuMjUgMCAwIDAgMCA2LjVaTTE3LjUyIDQ4Yy0xLjYyIDAtMy4wNi42Ni00LjA3IDEuODdhNS45NyA1Ljk3IDAgMCAwLTEuMzMgMy43NiA3LjEgNy4xIDAgMCAwLTEuOTQtLjNjLTEuNTUgMC0yLjk1LjU5LTMuOTQgMS42NmE1LjggNS44IDAgMCAwLS44IDcgNS4zIDUuMyAwIDAgMC0xLjc5IDIuODJjLS4yNC45LS40OCAyLjguOCA0Ljc0YTUuMjIgNS4yMiAwIDAgMC0uMzcgNS4wMmMxLjAyIDIuMzIgMy41NyA0LjE0IDguNTIgNi4xIDMuMDcgMS4yMiA1Ljg5IDIgNS45MSAyLjAxYTQ0LjMzIDQ0LjMzIDAgMCAwIDEwLjkzIDEuNmM1Ljg2IDAgMTAuMDUtMS44IDEyLjQ2LTUuMzQgMy44OC01LjY5IDMuMzMtMTAuOS0xLjctMTUuOTItMi43Ny0yLjc4LTQuNjItNi44Ny01LTcuNzctLjc4LTIuNjYtMi44NC01LjYyLTYuMjUtNS42MmE1LjcgNS43IDAgMCAwLTQuNiAyLjQ2Yy0xLTEuMjYtMS45OC0yLjI1LTIuODYtMi44MkE3LjQgNy40IDAgMCAwIDE3LjUyIDQ4Wm0wIDRjLjUxIDAgMS4xNC4yMiAxLjgyLjY1IDIuMTQgMS4zNiA2LjI1IDguNDMgNy43NiAxMS4xOC41LjkyIDEuMzcgMS4zMSAyLjE0IDEuMzEgMS41NSAwIDIuNzUtMS41My4xNS0zLjQ4LTMuOTItMi45My0yLjU1LTcuNzItLjY4LTguMDEuMDgtLjAyLjE3LS4wMi4yNC0uMDIgMS43IDAgMi40NSAyLjkzIDIuNDUgMi45M3MyLjIgNS41MiA1Ljk4IDkuM2MzLjc3IDMuNzcgMy45NyA2LjggMS4yMiAxMC44My0xLjg4IDIuNzUtNS40NyAzLjU4LTkuMTYgMy41OC0zLjgxIDAtNy43My0uOS05LjkyLTEuNDYtLjExLS4wMy0xMy40NS0zLjgtMTEuNzYtNyAuMjgtLjU0Ljc1LS43NiAxLjM0LS43NiAyLjM4IDAgNi43IDMuNTQgOC41NyAzLjU0LjQxIDAgLjctLjE3LjgzLS42Ljc5LTIuODUtMTIuMDYtNC4wNS0xMC45OC04LjE3LjItLjczLjcxLTEuMDIgMS40NC0xLjAyIDMuMTQgMCAxMC4yIDUuNTMgMTEuNjggNS41My4xMSAwIC4yLS4wMy4yNC0uMS43NC0xLjIuMzMtMi4wNC00LjktNS4yLTUuMjEtMy4xNi04Ljg4LTUuMDYtNi44LTcuMzMuMjQtLjI2LjU4LS4zOCAxLS4zOCAzLjE3IDAgMTAuNjYgNi44MiAxMC42NiA2LjgyczIuMDIgMi4xIDMuMjUgMi4xYy4yOCAwIC41Mi0uMS42OC0uMzguODYtMS40Ni04LjA2LTguMjItOC41Ni0xMS4wMS0uMzQtMS45LjI0LTIuODUgMS4zMS0yLjg1WiIgLz48cGF0aCBmaWxsPSIjRkZEMjFFIiBkPSJNMzguNiA3Ni42OWMyLjc1LTQuMDQgMi41NS03LjA3LTEuMjItMTAuODQtMy43OC0zLjc3LTUuOTgtOS4zLTUuOTgtOS4zcy0uODItMy4yLTIuNjktMi45Yy0xLjg3LjMtMy4yNCA1LjA4LjY4IDguMDEgMy45MSAyLjkzLS43OCA0LjkyLTIuMjkgMi4xNy0xLjUtMi43NS01LjYyLTkuODItNy43Ni0xMS4xOC0yLjEzLTEuMzUtMy42My0uNi0zLjEzIDIuMi41IDIuNzkgOS40MyA5LjU1IDguNTYgMTEtLjg3IDEuNDctMy45My0xLjcxLTMuOTMtMS43MXMtOS41Ny04LjcxLTExLjY2LTYuNDRjLTIuMDggMi4yNyAxLjU5IDQuMTcgNi44IDcuMzMgNS4yMyAzLjE2IDUuNjQgNCA0LjkgNS4yLS43NSAxLjItMTIuMjgtOC41My0xMy4zNi00LjQtMS4wOCA0LjExIDExLjc3IDUuMyAxMC45OCA4LjE1LS44IDIuODUtOS4wNi01LjM4LTEwLjc0LTIuMTgtMS43IDMuMjEgMTEuNjUgNi45OCAxMS43NiA3LjAxIDQuMyAxLjEyIDE1LjI1IDMuNDkgMTkuMDgtMi4xMloiIC8%2BPHBhdGggZmlsbD0iI0ZGOUQwQiIgZD0iTTc3LjQgNDhjMS42MiAwIDMuMDcuNjYgNC4wNyAxLjg3YTUuOTcgNS45NyAwIDAgMSAxLjMzIDMuNzYgNy4xIDcuMSAwIDAgMSAxLjk1LS4zYzEuNTUgMCAyLjk1LjU5IDMuOTQgMS42NmE1LjggNS44IDAgMCAxIC44IDcgNS4zIDUuMyAwIDAgMSAxLjc4IDIuODJjLjI0LjkuNDggMi44LS44IDQuNzRhNS4yMiA1LjIyIDAgMCAxIC4zNyA1LjAyYy0xLjAyIDIuMzItMy41NyA0LjE0LTguNTEgNi4xLTMuMDggMS4yMi01LjkgMi01LjkyIDIuMDFhNDQuMzMgNDQuMzMgMCAwIDEtMTAuOTMgMS42Yy01Ljg2IDAtMTAuMDUtMS44LTEyLjQ2LTUuMzQtMy44OC01LjY5LTMuMzMtMTAuOSAxLjctMTUuOTIgMi43OC0yLjc4IDQuNjMtNi44NyA1LjAxLTcuNzcuNzgtMi42NiAyLjgzLTUuNjIgNi4yNC01LjYyYTUuNyA1LjcgMCAwIDEgNC42IDIuNDZjMS0xLjI2IDEuOTgtMi4yNSAyLjg3LTIuODJBNy40IDcuNCAwIDAgMSA3Ny40IDQ4Wm0wIDRjLS41MSAwLTEuMTMuMjItMS44Mi42NS0yLjEzIDEuMzYtNi4yNSA4LjQzLTcuNzYgMTEuMThhMi40MyAyLjQzIDAgMCAxLTIuMTQgMS4zMWMtMS41NCAwLTIuNzUtMS41My0uMTQtMy40OCAzLjkxLTIuOTMgMi41NC03LjcyLjY3LTguMDFhMS41NCAxLjU0IDAgMCAwLS4yNC0uMDJjLTEuNyAwLTIuNDUgMi45My0yLjQ1IDIuOTNzLTIuMiA1LjUyLTUuOTcgOS4zYy0zLjc4IDMuNzctMy45OCA2LjgtMS4yMiAxMC44MyAxLjg3IDIuNzUgNS40NyAzLjU4IDkuMTUgMy41OCAzLjgyIDAgNy43My0uOSA5LjkzLTEuNDYuMS0uMDMgMTMuNDUtMy44IDExLjc2LTctLjI5LS41NC0uNzUtLjc2LTEuMzQtLjc2LTIuMzggMC02LjcxIDMuNTQtOC41NyAzLjU0LS40MiAwLS43MS0uMTctLjgzLS42LS44LTIuODUgMTIuMDUtNC4wNSAxMC45Ny04LjE3LS4xOS0uNzMtLjctMS4wMi0xLjQ0LTEuMDItMy4xNCAwLTEwLjIgNS41My0xMS42OCA1LjUzLS4xIDAtLjE5LS4wMy0uMjMtLjEtLjc0LTEuMi0uMzQtMi4wNCA0Ljg4LTUuMiA1LjIzLTMuMTYgOC45LTUuMDYgNi44LTcuMzMtLjIzLS4yNi0uNTctLjM4LS45OC0uMzgtMy4xOCAwLTEwLjY3IDYuODItMTAuNjcgNi44MnMtMi4wMiAyLjEtMy4yNCAyLjFhLjc0Ljc0IDAgMCAxLS42OC0uMzhjLS44Ny0xLjQ2IDguMDUtOC4yMiA4LjU1LTExLjAxLjM0LTEuOS0uMjQtMi44NS0xLjMxLTIuODVaIiAvPjxwYXRoIGZpbGw9IiNGRkQyMUUiIGQ9Ik01Ni4zMyA3Ni42OWMtMi43NS00LjA0LTIuNTYtNy4wNyAxLjIyLTEwLjg0IDMuNzctMy43NyA1Ljk3LTkuMyA1Ljk3LTkuM3MuODItMy4yIDIuNy0yLjljMS44Ni4zIDMuMjMgNS4wOC0uNjggOC4wMS0zLjkyIDIuOTMuNzggNC45MiAyLjI4IDIuMTcgMS41MS0yLjc1IDUuNjMtOS44MiA3Ljc2LTExLjE4IDIuMTMtMS4zNSAzLjY0LS42IDMuMTMgMi4yLS41IDIuNzktOS40MiA5LjU1LTguNTUgMTEgLjg2IDEuNDcgMy45Mi0xLjcxIDMuOTItMS43MXM5LjU4LTguNzEgMTEuNjYtNi40NGMyLjA4IDIuMjctMS41OCA0LjE3LTYuOCA3LjMzLTUuMjMgMy4xNi01LjYzIDQtNC45IDUuMi43NSAxLjIgMTIuMjgtOC41MyAxMy4zNi00LjQgMS4wOCA0LjExLTExLjc2IDUuMy0xMC45NyA4LjE1LjggMi44NSA5LjA1LTUuMzggMTAuNzQtMi4xOCAxLjY5IDMuMjEtMTEuNjUgNi45OC0xMS43NiA3LjAxLTQuMzEgMS4xMi0xNS4yNiAzLjQ5LTE5LjA4LTIuMTJaIiAvPjwvc3ZnPg%3D%3D)](#corpus)
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
