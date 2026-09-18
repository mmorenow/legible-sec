"use client";

import { motion, useReducedMotion } from "motion/react";
import { Warning, X } from "@phosphor-icons/react";
import { resultLabels as labels, results } from "@/content/copy/review";
import { axisLabel, dimensionsById, weightFor, type SituationId } from "@/content/rubric";
import type { Flag } from "@/lib/judge";
import { CHECK_DIMENSION } from "@/lib/reviewModel";
import { EASE, TONE_INK, TONE_SOFT } from "../gate";

/* What fired, most severe first.
 *
 * The evidence is the point of this project, so it is rendered open. A check
 * may only fail by showing the exact strings that made it fail, and a string
 * behind a disclosure is a claim, not evidence. Nothing here collapses.
 *
 * Copy law for this surface: a clean list is a NON DETECTION. It says no check
 * fired, never that the draft is right. Tone comes from ../gate (TONE_INK /
 * TONE_SOFT), the same two ramps the rail and the flag rows already use.
 *
 * The corpus is live ammunition: evidence strings carry real payloads, quoted
 * verbatim from findings. They are rendered as text nodes, never as markup.
 */

/* Copy not yet in content/copy/review.ts. Structural labels only: each one
   names a state or counts something. Lift them into the copy module if the
   page wants to own them. */
/* The advisory note opens with the sentence that carries the claim, then the
   mined note behind it, which on some genres runs to a paragraph. Both are
   rendered: the first sets the hierarchy, the rest is the argument. */
function splitLede(note: string): { lede: string; rest: string } {
  const i = note.indexOf(". ");
  if (i < 0) return { lede: note, rest: "" };
  return { lede: note.slice(0, i + 1), rest: note.slice(i + 2).trim() };
}

/** "... Required by the ICO." is attribution the genre lists put in the message. */
const REQUIRED_BY = /\s*Required by\s+(.+?)\.?\s*$/;

function splitAttribution(message: string): { text: string; source: string | null } {
  const m = REQUIRED_BY.exec(message);
  if (!m) return { text: message, source: null };
  return { text: message.slice(0, m.index).trim(), source: m[1].trim() };
}

function weightOf(flag: Flag, situation: SituationId): number {
  const dim = CHECK_DIMENSION[flag.check];
  return dim ? weightFor(dim, situation) : 1;
}

/** Fails before warns, and inside each, the heavier weight first. */
function severityRank(flag: Flag, situation: SituationId): number {
  return (flag.level === "fail" ? 0 : 100) + (3 - weightOf(flag, situation));
}

function Entry({ flag, index }: { flag: Flag; index: number }) {
  const reduce = useReducedMotion();
  const tone = flag.level === "warn" ? "warn" : "fail";
  const ink = TONE_INK[tone];
  const soft = TONE_SOFT[tone];
  const dim = CHECK_DIMENSION[flag.check];
  const { text, source } = splitAttribution(flag.message);

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: reduce ? 0 : index * 0.04 }}
      className="pl-3.5"
      style={{ borderLeft: `2px solid ${ink}` }}
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="mono text-[11.5px]" style={{ color: ink }}>
          {flag.check}
        </span>
        {dim ? (
          <span className="mono text-[10.5px]" style={{ color: "var(--color-muted)" }}>
            {dim} {dimensionsById[dim].shortName} · {axisLabel(dimensionsById[dim].axes)}
          </span>
        ) : null}
      </div>

      <p className="mt-1 max-w-[68ch] text-[13.5px] leading-relaxed" style={{ color: "var(--color-ink)" }}>
        {text}
      </p>

      {source ? (
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--color-ink-2)" }}>
          <span className="mono text-[10.5px] uppercase tracking-[0.08em]" style={{ color: "var(--color-muted)" }}>
            {results.sourceLabel}
          </span>{" "}
          {source}
        </p>
      ) : null}

      <div className="mt-2.5">
        <p className="mono text-[10.5px] uppercase tracking-[0.08em]" style={{ color: "var(--color-muted)" }}>
          {results.evidenceLabel}
        </p>
        {flag.evidence.length === 0 ? (
          <p className="mono mt-1 text-[11.5px]" style={{ color: "var(--color-muted)" }}>
            {labels.noEvidence}
          </p>
        ) : (
          /* wrapping row: short tokens sit together, a long quoted string takes
             the line it needs. Nothing is truncated. */
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {flag.evidence.map((e, i) => (
              <li
                key={i}
                className="mono max-w-full whitespace-pre-wrap break-words rounded-md px-2 py-1.5 text-[11.5px] leading-[1.55]"
                style={{
                  color: ink,
                  background: soft,
                  border: `1px solid color-mix(in oklch, ${ink} 30%, transparent)`,
                }}
              >
                {e}
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.li>
  );
}

function Group({
  heading,
  tone,
  flags,
  offset,
}: {
  heading: string;
  tone: "fail" | "warn";
  flags: Flag[];
  offset: number;
}) {
  if (flags.length === 0) return null;
  const ink = TONE_INK[tone];
  const Icon = tone === "fail" ? X : Warning;
  return (
    <section className="mt-6 first:mt-0">
      <h4 className="flex items-center gap-2 text-[13px] font-semibold tracking-[-0.008em]" style={{ color: ink }}>
        <Icon size={14} weight="bold" aria-hidden />
        {heading}
        <span className="mono num text-[11.5px]" style={{ color: "var(--color-muted)" }}>
          {flags.length}
        </span>
      </h4>
      <ul className="mt-3.5 flex flex-col gap-4">
        {flags.map((f, i) => (
          <Entry key={`${f.check}-${i}-${f.evidence[0] ?? ""}`} flag={f} index={offset + i} />
        ))}
      </ul>
    </section>
  );
}

export function ResultList({
  flags,
  ranCount,
  situation,
  advisoryNote = null,
  className = "",
}: {
  flags: Flag[];
  /** How many distinct checks ran, so a clean list can say what it means. */
  ranCount: number;
  /** Sets the weight each check carries, which is the order they are read in. */
  situation: SituationId;
  /** Present when the genre has no published norm. Rendered whenever it is set. */
  advisoryNote?: string | null;
  className?: string;
}) {
  const ordered = [...flags].sort((a, b) => severityRank(a, situation) - severityRank(b, situation));
  const fails = ordered.filter((f) => f.level === "fail");
  const warns = ordered.filter((f) => f.level === "warn");

  return (
    <section
      aria-label={fails.length || warns.length ? results.failHeading : results.cleanHeading}
      className={`rounded-[12px] border p-5 sm:p-6 ${className}`}
      style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
    >
      {advisoryNote ? (
        <div
          className="mb-5 rounded-[10px] px-3.5 py-3"
          style={{ background: TONE_SOFT.warn, border: `1px solid color-mix(in oklch, ${TONE_INK.warn} 26%, transparent)` }}
        >
          <p className="mono text-[10.5px] uppercase tracking-[0.08em]" style={{ color: TONE_INK.warn }}>
            {labels.advisoryLabel}
          </p>
          <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed" style={{ color: "var(--color-ink)" }}>
            {splitLede(advisoryNote).lede}
          </p>
          {splitLede(advisoryNote).rest ? (
            <p className="mt-2 max-w-[74ch] text-[12px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
              {splitLede(advisoryNote).rest}
            </p>
          ) : null}
        </div>
      ) : null}

      {flags.length === 0 ? (
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className="mono inline-flex items-center rounded-md px-2 py-1 text-[10.5px]"
              style={{ color: TONE_INK.warn, background: TONE_SOFT.warn }}
            >
              {labels.cleanChip}
            </span>
            <h3 className="text-[15.5px] font-semibold tracking-[-0.012em]" style={{ color: "var(--color-ink)" }}>
              {results.cleanHeading}
            </h3>
          </div>
          <p className="mt-2.5 max-w-[64ch] text-[13.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
            {results.cleanNote}
          </p>
          <p className="mono num mt-3 text-[11.5px]" style={{ color: "var(--color-muted)" }}>
            {labels.ranNote(ranCount)}
          </p>
        </div>
      ) : (
        <>
          <Group heading={results.failHeading} tone="fail" flags={fails} offset={0} />
          <Group heading={results.warnHeading} tone="warn" flags={warns} offset={fails.length} />
        </>
      )}
    </section>
  );
}
