"use client";

import { motion, useReducedMotion } from "motion/react";
import { provenEvidence } from "@/content/data";
import * as f from "@/content/facts";
import { provenance } from "@/content/status";
import { proven } from "@/content/copy/library";
import { Reveal, Counter, useReveal } from "./primitives";

const EASE = [0.22, 1, 0.36, 1] as const;

/* Pairs whose source document states no severity, and pairs with no recorded
   source URL. Both are large, and both belong next to the verification story. */
const NOT_STATED = f.SEVERITY.find((r) => r.key === "not stated")?.n ?? 0;
const NO_SOURCE_URL = f.PAIRS - f.WITH_SOURCE_URL;

/* Every count in the docket was measured at the v0.3 build, so the tag is
   rendered beside the number itself. The body strings carry the same tag as a
   closing sentence; when they do, it is dropped here so the reader sees it once
   rather than twice. */
function withoutBuildTag(body: string): string {
  const suffix = `${provenance.buildTag}.`;
  return body.endsWith(suffix) ? body.slice(0, -suffix.length).trimEnd() : body;
}

/* ==================================================================
   Proven: what the corpus was checked for, and what it was not.
   Evidence docket on the left, an animated judgement card on the
   right (three passes land, then the label). The counts in the docket
   were measured at the v0.3 build and are labelled that way.
   ================================================================== */

function VerdictCard() {
  const reduce = useReducedMotion();
  const { ref, shown } = useReveal();
  const on = reduce || shown;

  return (
    <div ref={ref as React.Ref<HTMLDivElement>} className="plate relative flex h-full min-h-[320px] flex-col items-center justify-center overflow-hidden p-8">
      {/* the pair under test */}
      <div className="relative w-[210px] rounded-[10px] p-4" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}>
        <span className="mono text-[9.5px] tracking-[0.14em]" style={{ color: "var(--color-muted)" }}>PAIR #s7-f8</span>
        <div className="mt-2.5 flex flex-col gap-[6px]">
          <span className="block h-[4px] w-[88%] rounded-[2px]" style={{ background: "var(--color-line-2)" }} />
          <span className="block h-[4px] w-[72%] rounded-[2px]" style={{ background: "var(--color-line-2)" }} />
          <span className="mt-1 block h-[4px] w-[80%] rounded-[2px]" style={{ background: "var(--color-accent)", opacity: 0.85 }} />
          <span className="block h-[4px] w-[58%] rounded-[2px]" style={{ background: "var(--color-accent)", opacity: 0.85 }} />
        </div>

        {/* three stamps land on the card */}
        <div className="mt-4 flex items-center gap-2.5">
          {["pass 1", "pass 2", "pass 3"].map((label, k) => (
            <motion.span
              key={label}
              className="mono inline-flex items-center gap-1 rounded-[6px] px-1.5 py-[3px] text-[8.5px]"
              style={{ color: "var(--color-ok)", border: "1px solid color-mix(in oklch, var(--color-ok) 50%, transparent)", background: "color-mix(in oklch, var(--color-ok) 10%, transparent)" }}
              initial={false}
              animate={on ? { opacity: 1, scale: 1, rotate: k % 2 ? 2 : -2 } : { opacity: 0, scale: 1.7, rotate: -10 }}
              transition={{ type: "spring", stiffness: 320, damping: 17, delay: reduce ? 0 : 0.3 + k * 0.35 }}
            >
              ✓ {label}
            </motion.span>
          ))}
        </div>
      </div>

      {/* the verdict seal */}
      <motion.div
        className="mono absolute right-[9%] top-[13%] flex h-[86px] w-[86px] rotate-12 items-center justify-center rounded-full text-center text-[10px] leading-tight"
        style={{
          color: "var(--color-accent-ink)",
          border: "2px solid color-mix(in oklch, var(--color-accent) 70%, transparent)",
          boxShadow: "0 0 0 4px color-mix(in oklch, var(--color-accent) 12%, transparent)",
        }}
        initial={false}
        animate={on ? { opacity: 1, scale: 1, rotate: 12 } : { opacity: 0, scale: 1.6, rotate: 30 }}
        transition={{ type: "spring", stiffness: 260, damping: 15, delay: reduce ? 0 : 1.5 }}
      >
        ALIGNED
        <br />· 0.99 ·
      </motion.div>

      <p className="mono mt-6 text-[10.5px]" style={{ color: "var(--color-muted)" }}>
        every pair carries its alignment method and label; the numeric confidence
        exists only where a judge produced one
      </p>
    </div>
  );
}

export function Proven() {
  return (
    <section className="border-t py-20 md:py-28" style={{ borderColor: "var(--color-line)", background: "var(--color-bg-2)" }}>
      <div className="wrap-wide">
        <Reveal>
          <h2 className="h2 max-w-[20ch]" style={{ color: "var(--color-ink)" }}>
            {proven.heading}
          </h2>
          <p className="lede mt-4 max-w-[62ch]">
            {proven.lede(f.formatPct(NOT_STATED), f.formatPct(NO_SOURCE_URL))}
          </p>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          {/* evidence docket */}
          <div className="flex flex-col">
            {provenEvidence.map((e, i) => (
              <Reveal key={e.title} delay={i * 0.06}>
                <div
                  className="grid grid-cols-[minmax(124px,auto)_1fr] items-start gap-x-6 py-6 md:grid-cols-[185px_1fr]"
                  style={{ borderTop: "1px solid var(--color-line-2)" }}
                >
                  <div>
                    <div className="num text-[48px] font-bold leading-none tracking-[-0.03em] md:text-[56px]" style={{ color: "var(--color-accent-ink)" }}>
                      <Counter value={e.stat} />
                    </div>
                    <p className="mono mt-2 text-[11px] leading-snug" style={{ color: "var(--color-muted)" }}>
                      {provenance.buildTag}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-[15.5px] font-semibold" style={{ color: "var(--color-ink)" }}>{e.title}</h3>
                    <p className="mt-1.5 max-w-[58ch] text-[14px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>{withoutBuildTag(e.body)}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* the verdict card */}
          <Reveal delay={0.1}>
            <VerdictCard />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
