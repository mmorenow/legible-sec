"use client";

import { evidenceTeaser } from "@/content/copy/home";
import { behaviour } from "@/content/behaviour";
import { BarList } from "../charts";
import { Reveal } from "../primitives";

/* RETIRED 2026-08-31, kept per the no-deletion rule.
 *
 * The adherence bars. The measurement is real and it is in content/behaviour.ts
 * with its population and method, but on the home page it was a chart arguing
 * about methodology to a reader who had just arrived. Same class of error as the
 * availability plate and the provenance block: the project reasoning about
 * itself, shipped as content.
 *
 * Original note follows.
 *
 * One measurement, and the reason the project exists.
 *
 * Adherence bars for the eight conventional rules, measured across the corpus.
 * The bars are the argument: the advice everyone gives sits at the bottom. Tone
 * is deliberately NOT semantic here (no red for low adherence) because low
 * adherence is not a failure, it is a finding. `behaviourReading.caution` says so
 * in words and the flat accent tone says so in colour. */

export function EvidenceTeaser() {
  /* BarList scales to the largest value in the set, which here is the rule at
     100 percent, so the bars read as a share of the whole without needing a max. */
  const items = behaviour.map((row) => ({
    label: row.rule,
    n: Math.round(row.adherence * 100),
    tone: "accent" as const,
  }));

  return (
    <section className="border-t py-20 md:py-28" style={{ borderColor: "var(--color-line)" }}>
      <div className="wrap-wide">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <Reveal>
              <p className="mono mb-4 text-[12px]" style={{ color: "var(--color-muted)" }}>
                {evidenceTeaser.kicker}
              </p>
              <h2 className="h2 max-w-[16ch]" style={{ color: "var(--color-ink)" }}>
                {evidenceTeaser.heading}
              </h2>
            </Reveal>
            <Reveal delay={0.06}>
              <p
                className="mt-6 max-w-[60ch] text-[15.5px] leading-[1.7]"
                style={{ color: "var(--color-ink-2)" }}
              >
                {evidenceTeaser.body}
              </p>
            </Reveal>
            <Reveal delay={0.12}>
              <p
                className="mt-5 max-w-[60ch] text-[15.5px] leading-[1.7]"
                style={{ color: "var(--color-ink)" }}
              >
                {evidenceTeaser.reading}
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <p className="mono mt-6 text-[11.5px]" style={{ color: "var(--color-muted)" }}>
                {evidenceTeaser.provenance}
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div
              className="rounded-[14px] border p-6 md:p-8"
              style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
            >
              <h3 className="text-[14px] font-semibold" style={{ color: "var(--color-ink)" }}>
                {evidenceTeaser.chartHeading}
              </h3>
              <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--color-muted)" }}>
                {evidenceTeaser.chartNote}
              </p>
              <div className="mt-6">
                <BarList items={items} format={(n) => `${n}%`} />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
