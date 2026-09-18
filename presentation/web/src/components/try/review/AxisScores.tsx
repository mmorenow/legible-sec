"use client";

import { motion, useReducedMotion } from "motion/react";
import { X } from "@phosphor-icons/react";
import { axisLabels as labels, results } from "@/content/copy/review";
import {
  aggregationRules,
  axes as rubricAxes,
  axisOrder,
  weightLegend,
  type AxisId,
  type SituationId,
} from "@/content/rubric";
import type { AxisResult, DimensionResult } from "@/lib/reviewModel";
import { EASE, TONE_INK, TONE_SOFT } from "../gate";

/* The two axes, side by side, and this component's whole job is to refuse to
 * average them.
 *
 * Aggregation rule 5 says the report always separates a fidelity result from a
 * utility result and never mixes them into one number, because a gain on one
 * would hide a failure on the other. There is therefore no total here, no mean,
 * no grade and no percentage: what is rendered is what happened, which is how
 * many checks fired on the axis and at what weight for this situation.
 *
 * Weight 3 is not "most important". It is a claim about consequence, and the
 * rubric says so in its own words, which is why the callout quotes the legend
 * rather than paraphrasing it.
 */

/* Copy not yet in content/copy/review.ts. State labels and count formats. */
const RULE_5 = aggregationRules.find((r) => r.emphasis)!;

function fired(d: DimensionResult): number {
  return d.fails.length + d.warns.length;
}

function DimensionRow({ d }: { d: DimensionResult }) {
  const failing = d.fails.length > 0;
  const warning = !failing && d.warns.length > 0;
  const invalidating = failing && d.weight === 3;
  const ink = failing ? TONE_INK.fail : warning ? TONE_INK.warn : d.unexamined ? "var(--color-muted)" : TONE_INK.pass;

  return (
    /* Wraps rather than squeezes. The weight chip and the verdict are both
       shrink-0, so every pixel of the squeeze landed on the dimension name,
       which is the one part a reader actually has to read. Below sm the verdict
       drops to its own line and the name gets the full width. */
    <li
      className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 py-2"
      style={{ borderTop: "1px solid var(--color-line)" }}
    >
      <span
        className="mono num shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px]"
        style={{
          color: invalidating ? TONE_INK.fail : "var(--color-ink-2)",
          background: invalidating ? TONE_SOFT.fail : "var(--color-surface-2)",
        }}
        title={weightLegend[d.weight].meaning}
      >
        {labels.weightWord(d.weight)} {weightLegend[d.weight].label.toLowerCase()}
      </span>
      <span
        className="min-w-[14ch] flex-1 text-[13px] leading-snug"
        style={{ color: d.unexamined ? "var(--color-muted)" : "var(--color-ink)" }}
      >
        {d.id} {d.name}
      </span>
      <span
        className="mono shrink-0 whitespace-nowrap text-[11px]"
        style={{
          color: ink,
          ...(d.unexamined
            ? { border: "1px dashed var(--color-line-2)", borderRadius: 6, padding: "1px 6px" }
            : {}),
        }}
      >
        {d.unexamined
          ? labels.unexamined
          : failing
            ? labels.failedCount(d.fails.length) + (d.warns.length ? `, ${labels.warnedCount(d.warns.length)}` : "")
            : warning
              ? labels.warnedCount(d.warns.length)
              : labels.quiet}
      </span>
    </li>
  );
}

function AxisCard({ axis, result, index }: { axis: AxisId; result: AxisResult; index: number }) {
  const reduce = useReducedMotion();
  const meta = rubricAxes[axis];
  const firedChecks = result.dimensions.reduce((n, d) => n + fired(d), 0);
  const failedChecks = result.dimensions.reduce((n, d) => n + d.fails.length, 0);
  const warnedChecks = result.dimensions.reduce((n, d) => n + d.warns.length, 0);
  const examined = result.dimensions.length - result.unexamined.length;
  const worst = result.invalidating.length ? "fail" : failedChecks ? "fail" : warnedChecks ? "warn" : "pass";
  const ink = TONE_INK[worst as "fail" | "warn" | "pass"];

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : 0.06 * index }}
      className="flex flex-col rounded-[10px] border p-4 sm:p-5"
      style={{ borderColor: "var(--color-line)", background: "var(--color-bg)" }}
      aria-label={meta.name}
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <span className="mono text-[11px]" style={{ color: "var(--color-muted)" }}>
          {axis}
        </span>
        <h4 className="text-[15px] font-semibold tracking-[-0.012em]" style={{ color: "var(--color-ink)" }}>
          {meta.name}
        </h4>
      </div>
      <p className="mt-2 max-w-[46ch] text-[12.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
        {meta.definition}
      </p>

      {/* What happened on this axis. Counts, not a score. */}
      <p className="mono num mt-4 text-[12.5px]" style={{ color: ink }}>
        {firedChecks === 0 ? labels.noneFired : `${labels.fired(firedChecks)} · ${labels.split(failedChecks, warnedChecks)}`}
      </p>
      <p className="mono num mt-1 text-[11px]" style={{ color: "var(--color-muted)" }}>
        {labels.coverage(examined, result.dimensions.length, result.unexamined.length)}
      </p>

      {result.invalidating.length > 0 ? (
        <div
          className="mt-4 rounded-[8px] p-3.5"
          style={{ background: TONE_SOFT.fail, border: `1.5px solid ${TONE_INK.fail}` }}
        >
          <p className="mono flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em]" style={{ color: TONE_INK.fail }}>
            <X size={12} weight="bold" aria-hidden />
            {labels.invalidatingLabel}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--color-ink)" }}>
            {result.invalidating.map((d) => `${d.id} ${d.name}`).join(" · ")}
          </p>
          {/* What weight 3 means here. The general point about what weight 3 is
              belongs to the section, not to each axis, or an invalidating
              failure on both prints the same paragraph twice. */}
          <p className="mt-2 max-w-[46ch] text-[12.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
            {weightLegend[3].meaning}
          </p>
        </div>
      ) : null}

      <ul className="mt-4 flex flex-col">
        {result.dimensions.map((d) => (
          <DimensionRow key={d.id} d={d} />
        ))}
      </ul>

      {result.unexamined.length > 0 ? (
        <p className="mt-3 max-w-[46ch] text-[12px] leading-relaxed" style={{ color: "var(--color-muted)" }}>
          {labels.unexaminedWhy}
        </p>
      ) : null}
    </motion.article>
  );
}

export function AxisScores({
  axes,
  situation,
  className = "",
}: {
  /** One result per axis. They are rendered apart and never combined. */
  axes: Record<AxisId, AxisResult>;
  /** Only used to state which situation set the weights being shown. */
  situation: SituationId;
  className?: string;
}) {
  return (
    <section
      aria-label={results.axisHeading}
      data-situation={situation}
      className={`rounded-[12px] border p-5 sm:p-6 ${className}`}
      style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
    >
      <h3 className="text-[15.5px] font-semibold tracking-[-0.012em]" style={{ color: "var(--color-ink)" }}>
        {results.axisHeading}
      </h3>
      <p className="mt-2.5 max-w-[70ch] text-[13.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
        {results.axisNote}
      </p>
      {/* Said once, and only when a weight 3 failure is actually on screen. */}
      {axes.F.invalidating.length + axes.U.invalidating.length > 0 ? (
        <p className="mt-2 max-w-[70ch] text-[12.5px] leading-relaxed" style={{ color: "var(--color-muted)" }}>
          {weightLegend[3].contrast}
        </p>
      ) : null}

      {/* lg, not sm. Side by side from 640px halved an already tight row and
          squeezed the dimension name to 18px at 768: "D6 Register and
          specificity by audience" came out as a six line ladder of single
          words, in both cards at once. The two axes are reported apart, which
          is about them never being averaged, not about them being adjacent. */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {axisOrder.map((a, i) => (
          <AxisCard key={a} axis={a} result={axes[a]} index={i} />
        ))}
      </div>

      <p
        className="mono mt-6 max-w-[76ch] pt-4 text-[11.5px] leading-relaxed"
        style={{ color: "var(--color-muted)", borderTop: "1px solid var(--color-line)" }}
      >
        aggregation rule {RULE_5.n} · {RULE_5.text}
      </p>
    </section>
  );
}
