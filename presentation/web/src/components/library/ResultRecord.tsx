"use client";

import { motion, useReducedMotion } from "motion/react";
import type { LibraryHit, LibraryPair, MatchSignal } from "@/lib/librarySearch";
import { EvidenceLedger, type EvidenceItem } from "@/components/try/evidence";
import { EASE } from "@/components/try/gate";
import { findingSearch as copy } from "@/content/copy/library";

/* One hit, as a record.
 *
 * A search result on this page has to carry two things a normal result list
 * does not: what the pair is, and WHY it is here. The second one is the point.
 * A ranking a reader cannot audit is a ranking they have to trust, and this
 * project's whole argument is that a claim owes its evidence, so every hit
 * prints the signals that produced it and an exact identifier match says so in
 * as many words.
 *
 * The pair itself is rendered by `EvidenceLedger`, unmodified, in its `ledger`
 * variant: the technical world on the left, the sentence that shipped on the
 * right, straddling the seam the whole instrument is built on. It is mounted
 * one hit per instance rather than one ledger for the whole result set, for
 * two reasons: the signals belong to a single pair and have to sit against it,
 * and a per instance ledger keeps its own open state, so expanding one result
 * no longer collapses the one a reader was already reading.
 *
 * The corpus is live ammunition. Every string below, pair text and query text
 * alike, is rendered as a React text node. Nothing on this surface builds
 * markup out of data.
 */

/* Identifier signals are a different kind of evidence from word overlap, so
   they are toned apart: cobalt for the identifiers a machine can check, rust
   for the fields the corpus records, and a plain outline for words. */
const SIGNAL_TONE: Record<MatchSignal["kind"], { ink: string; soft: string; line: string }> = {
  cve: { ink: "var(--color-accent-ink)", soft: "var(--color-accent-soft)", line: "var(--color-accent-line)" },
  cwe: { ink: "var(--color-accent-ink)", soft: "var(--color-accent-soft)", line: "var(--color-accent-line)" },
  severity: { ink: "var(--color-tech-ink)", soft: "var(--color-tech-soft)", line: "var(--color-tech-line)" },
  vulnClass: { ink: "var(--color-tech-ink)", soft: "var(--color-tech-soft)", line: "var(--color-tech-line)" },
  term: { ink: "var(--color-muted)", soft: "transparent", line: "var(--color-line)" },
};

/** Reading order inside one hit: the identifiers first, the words last. */
const SIGNAL_RANK: Record<MatchSignal["kind"], number> = {
  cve: 0,
  cwe: 1,
  severity: 2,
  vulnClass: 3,
  term: 4,
};

/* The index may report the same signal twice (an identifier that appears in
   both texts, a term repeated). A chip is a fact about the match, not a count,
   so duplicates collapse. */
function orderedSignals(signals: MatchSignal[]): MatchSignal[] {
  const seen = new Set<string>();
  const unique: MatchSignal[] = [];
  for (const s of signals) {
    const key = `${s.kind}:${s.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }
  return unique.sort((a, b) => SIGNAL_RANK[a.kind] - SIGNAL_RANK[b.kind]);
}

function SignalChip({ signal }: { signal: MatchSignal }) {
  const tone = SIGNAL_TONE[signal.kind];
  return (
    <li
      className="mono inline-flex max-w-full items-baseline gap-1.5 rounded-md px-2 py-1 text-[11px] leading-[1.5]"
      style={{ color: tone.ink, background: tone.soft, border: `1px solid ${tone.line}` }}
    >
      <span className="uppercase tracking-[0.08em] text-[9.5px] opacity-80">
        {copy.results.signalKinds[signal.kind]}
      </span>
      <span className="break-words">{signal.value}</span>
    </li>
  );
}

/** The facts about the pair that the ledger's own record line does not print. */
function Facts({ pair }: { pair: LibraryPair }) {
  const parts = [pair.orgType, pair.vulnClass, pair.license].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <span className="mono text-[10.5px]" style={{ color: "var(--color-muted)" }}>
      {parts.join(" · ")}
    </span>
  );
}

function toItem(pair: LibraryPair): EvidenceItem {
  return {
    id: pair.id,
    org: pair.org,
    year: pair.year == null ? null : String(pair.year),
    severity: pair.severity,
    /* The index carries no register, and the ledger prints this field
       verbatim as `register=...`, so it is left empty rather than filled with
       a field that happens to be nearby. */
    register: null,
    tech: pair.tech,
    exec: pair.exec,
    url: pair.url,
  };
}

/* A long paste shares dozens of common words with a long finding, and rendering
   all of them turns the reason for the match into wallpaper. Identifiers and
   field values always show, because they are the high precision signals and
   there are never many. Word overlap is cut to the strongest few and the rest
   are counted, so the chip row stays readable and the total stays honest. */
const WORD_CHIPS = 6;

export function ResultRecord({ hit, rank }: { hit: LibraryHit; rank: number }) {
  const reduce = useReducedMotion();
  const all = orderedSignals(hit.signals);
  const strong = all.filter((s) => s.kind !== "term");
  const words = all.filter((s) => s.kind === "term");
  const signals = [...strong, ...words.slice(0, WORD_CHIPS)];
  const moreWords = words.length - Math.min(words.length, WORD_CHIPS);
  const truncations = [
    hit.pair.techTruncated ? copy.results.truncatedTech : null,
    hit.pair.execTruncated ? copy.results.truncatedExec : null,
  ].filter(Boolean) as string[];

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: reduce ? 0 : Math.min(rank, 6) * 0.05 }}
      className="rounded-[12px] border p-4 sm:p-5"
      style={{
        borderColor: hit.exact ? "var(--color-accent-line)" : "var(--color-line)",
        background: "var(--color-surface)",
      }}
    >
      {/* why this one, before what it is */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <span className="mono num text-[11px]" style={{ color: "var(--color-muted)" }}>
          {rank + 1}
        </span>
        {hit.exact ? (
          <span
            className="mono inline-flex items-center rounded-md px-2 py-1 text-[10.5px]"
            style={{
              color: "var(--color-accent-ink)",
              background: "var(--color-accent-soft)",
              border: "1px solid var(--color-accent-line)",
            }}
          >
            {copy.results.exactBadge}
          </span>
        ) : null}
        <Facts pair={hit.pair} />
      </div>

      {signals.length ? (
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
          <span
            className="mono text-[10.5px] uppercase tracking-[0.08em]"
            style={{ color: "var(--color-muted)" }}
          >
            {copy.results.matchedLabel}
          </span>
          <ul className="flex flex-wrap gap-1.5">
            {signals.map((s) => (
              <SignalChip key={`${s.kind}:${s.value}`} signal={s} />
            ))}
          </ul>
          {moreWords > 0 ? (
            <span className="mono num text-[11px]" style={{ color: "var(--color-muted)" }}>
              {copy.results.moreWords(moreWords)}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* the pair, on the shared evidence surface */}
      <div className="mt-4">
        <EvidenceLedger items={[toItem(hit.pair)]} variant="ledger" />
      </div>

      {/* the index shortens long texts; a shortened text says so under itself */}
      {truncations.length ? (
        <p className="mono mt-2 text-[10.5px]" style={{ color: "var(--color-muted)" }}>
          {truncations.join(" · ")}
        </p>
      ) : null}
    </motion.article>
  );
}
