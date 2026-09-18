"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Snowflake, LockSimple, Laptop, WifiSlash, SealCheck, Plus } from "@phosphor-icons/react";
import { loraSection as L } from "@/content/system";
import { lora } from "@/content/copy/model";
import { DotScale, type DotRow } from "./charts";
import { Reveal, useReveal } from "./primitives";

/* LoraDiagram (v4.1 de-carded §4.5): the whole idea shown as a size contrast
   (a huge frozen base plus a tiny adapter equals the model that writes), then
   three plain-language explainers as an OPEN docket (hairline per column, no
   boxes), then, separated below, the held-out measurement. The mechanism sits
   loose on the page: the only surfaces left are the equation's three boxes
   (they depict objects), the MLX chip, and the code-free spec table's rules.

   Motion (Wave C, plays once on view then settles): the equation reveals left
   to right and the adapter slabs slide in; the three docket columns cascade
   0.15s apart; the "LoRA" chip spring-stamps onto its attention row; the MLX
   chip slides toward the laptop. One IntersectionObserver (useReveal) drives
   every beat, so the whole scene choreographs as one and never loops. */

const EASE = [0.22, 1, 0.36, 1] as const;
const STAMP = { type: "spring" as const, stiffness: 300, damping: 16 };

/* §4.5 verbatim, on the role="img" size-contrast equation (MODEL-02) */
const ARIA =
  "A LoRA adapter attaches to the attention layers of a frozen 9B model, is quantized to 4-bit MLX, and runs offline on Apple silicon; on 30 held-out findings it writes 25.5 words per translation on average, against 24.2 for the professionals who wrote the originals.";

const ROWS = L.measurement.rows as DotRow[];

/* the size-contrast equation: big frozen base + tiny adapter = the model.
   `on` gates the staged entrance; each cell eases in left to right, and the
   adapter cell slides in (the "A/B slabs" beat). */
function SizeEquation({ on }: { on: boolean }) {
  const cell = (d: number, extra: Record<string, number> = {}) => ({
    initial: false as const,
    animate: on ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, ...extra },
    transition: { duration: 0.5, ease: EASE, delay: on ? d : 0 },
  });
  return (
    // stacked column below sm: wrap-dependent flex shattered the equation
    // into orphaned operators at 375px (MODEL-01)
    <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:gap-4">
      {/* frozen base, deliberately large */}
      <motion.div {...cell(0.1)} className="relative flex min-h-[112px] flex-[3] flex-col items-center justify-center rounded-[14px] px-6 py-5 text-center" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)", minWidth: 220 }}>
        <div className="absolute left-3 top-3 flex gap-1"><Snowflake size={15} weight="duotone" style={{ color: "var(--color-muted)" }} /><LockSimple size={13} style={{ color: "var(--color-muted)" }} /></div>
        <span className="text-[16px] font-semibold" style={{ color: "var(--color-ink-2)" }}>Frozen base</span>
        <span className="mono mt-1 text-[11px]" style={{ color: "var(--color-muted)" }}>Qwen3.5-9B</span>
        <span className="mono mt-0.5 text-[10px]" style={{ color: "var(--color-muted)" }}>{lora.baseWeights}</span>
      </motion.div>
      <motion.div {...cell(0.15)} className="flex items-center justify-center"><Plus size={18} weight="bold" style={{ color: "var(--color-muted)" }} /></motion.div>
      {/* the adapter, deliberately tiny - slides in */}
      <motion.div {...cell(0.2, { x: -8 })} className="flex min-h-[112px] flex-[1] flex-col items-center justify-center rounded-[14px] px-3 py-5 text-center" style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-accent)", minWidth: 120 }}>
        <span className="text-[13px] font-semibold" style={{ color: "var(--color-accent-ink)" }}>Adapter</span>
        <span className="mono mt-1 text-[10.5px]" style={{ color: "var(--color-accent-ink)" }}>rank 16</span>
        <span className="mono mt-0.5 text-[9.5px]" style={{ color: "var(--color-accent-ink)", opacity: 0.8 }}>~0.2% · trains</span>
      </motion.div>
      <motion.div {...cell(0.25)} className="flex items-center justify-center"><span className="text-[18px] font-semibold" style={{ color: "var(--color-muted)" }}>=</span></motion.div>
      {/* the resulting model - pops */}
      <motion.div {...cell(0.3, { scale: 0.96 })} className="flex min-h-[112px] flex-[1.4] flex-col items-center justify-center rounded-[14px] px-4 py-5 text-center" style={{ background: "color-mix(in oklch, var(--color-accent) 14%, white)", border: "1px solid var(--color-accent)", minWidth: 150 }}>
        <span className="mono text-[16px] font-bold" style={{ color: "var(--color-accent-ink)", letterSpacing: "-0.01em" }}>{L.modelName}</span>
        <span className="mt-1 text-[10.5px]" style={{ color: "var(--color-accent-ink)", opacity: 0.85 }}>the model that writes</span>
      </motion.div>
    </div>
  );
}

/* tiny glyph: two thin matrices A x B (the low-rank trick) */
function LowRankGlyph() {
  return (
    <div aria-hidden="true" className="flex items-center gap-1.5">
      <span className="rounded-[3px]" style={{ width: 10, height: 34, background: "var(--color-accent)" }} />
      <span className="mono text-[11px]" style={{ color: "var(--color-muted)" }}>×</span>
      <span className="rounded-[3px]" style={{ width: 34, height: 10, background: "var(--color-accent)" }} />
    </div>
  );
}

function PairGlyph() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-[5px]">
      <span className="rounded-full" style={{ width: 40, height: 4, background: "var(--color-tech)" }} />
      <span className="rounded-full" style={{ width: 28, height: 4, background: "var(--color-accent)" }} />
    </div>
  );
}

/* compact mini-stack: two frozen bars + one attention bar carrying the adapter.
   The "LoRA" chip spring-stamps once the card has settled. */
function AttentionGlyph({ on }: { on: boolean }) {
  const rows: ("gdn" | "attn")[] = ["gdn", "attn", "gdn"];
  return (
    <div aria-hidden="true" className="flex w-full max-w-[128px] flex-col gap-[3px]">
      {rows.map((k, i) => {
        const attn = k === "attn";
        return (
          <div key={i} className="flex items-center gap-1">
            <span className="h-[8px] flex-1 rounded-[3px]" style={{ background: attn ? "var(--color-accent-soft)" : "var(--color-surface-2)", border: `1px solid ${attn ? "var(--color-accent-line)" : "var(--color-line)"}` }} />
            {attn && (
              <motion.span
                className="mono flex-none rounded-[3px] px-1 py-[1px] text-[7px] font-semibold"
                style={{ background: "var(--color-accent)", color: "white" }}
                initial={false}
                animate={on ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.6, rotate: -4 }}
                transition={{ ...STAMP, delay: on ? 0.85 : 0 }}
              >
                LoRA
              </motion.span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* an open docket column: hairline on top (no box, no fill), the glyph, a
   semibold title, the body. Same cascade as before (opacity + y, staggered). */
function Docket({ title, body, delay, on, children }: { title: string; body: React.ReactNode; delay: number; on: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      className="flex flex-col pt-5"
      style={{ borderTop: "1px solid var(--color-line-2)" }}
      initial={false}
      animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      transition={{ duration: 0.5, ease: EASE, delay: on ? delay : 0 }}
    >
      <div className="flex h-[40px] items-center">{children}</div>
      <h4 className="mt-3.5 text-[14px] font-semibold" style={{ color: "var(--color-ink)" }}>{title}</h4>
      <p className="mt-2 max-w-[34ch] text-[13px] leading-normal" style={{ color: "var(--color-ink-2)" }}>{body}</p>
    </motion.div>
  );
}

export function LoraDiagram() {
  const reduce = useReducedMotion();
  const { ref, shown } = useReveal();
  const on = reduce || shown;

  return (
    <div>
      <Reveal>
        {/* plain mono label, not a kicker: "The model" already spends /model's kicker budget (MODEL-14) */}
        <p className="mono text-[12px]" style={{ color: "var(--color-muted)" }}>Under the hood · how {L.modelName} was built</p>
        <h2 className="h2 mt-4 max-w-[20ch] leading-[1.12]" style={{ color: "var(--color-ink)" }}>{L.h2}</h2>
        <p className="lede mt-5 max-w-[68ch]">{L.lede}</p>
      </Reveal>

      {/* the whole idea, taught - loose on the page, choreographed once
          (MODEL-02, MODEL-03). The ref (useReveal) rides the loose mechanism
          block so the cascade still fires on scroll. role="img" is scoped to
          the size-contrast equation only: it's the one purely decorative
          diagram here. The docket below carries real prose and a real link
          (the "playbook" anchor), so it stays out of the img boundary: WAI-
          ARIA disallows focusable/informative content inside role="img"
          (it collapses to a single opaque node for AT). */}
      <div ref={ref as React.Ref<HTMLDivElement>} className="mt-8">
        <motion.p
          className="text-[15px] leading-relaxed"
          style={{ color: "var(--color-ink)" }}
          initial={false}
          animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {lora.intro}
        </motion.p>
        <div className="mt-6" role="img" aria-label={ARIA}>
          <SizeEquation on={on} />
        </div>

        {/* three plain-language explainers - open docket, cascade 0.15s apart.
            Each column carries its own top hairline; on mobile they stack and
            keep the same rules. */}
        <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-3 md:gap-y-0">
          <Docket on={on} delay={0.4} title="Why it stays tiny" body="The adapter is two thin matrices multiplied together (rank 16). Only about 0.2% of the weights ever train, so it fits and runs on a laptop.">
            <LowRankGlyph />
          </Docket>
          <Docket
            on={on}
            delay={0.55}
            title="How it learned"
            body={
              <>
                {/* The link used to point at /dataset/#playbook. /dataset is now a
                    redirect stub and no `playbook` anchor exists anywhere in the
                    site, so the link landed on a stub and the anchor resolved to
                    nothing. The sentence is true without it. */}
                573 curated finding-to-translation pairs taught it the moves: the
                playbook, demonstrated in examples rather than written as rules.
              </>
            }
          >
            <PairGlyph />
          </Docket>
          <Docket on={on} delay={0.7} title="Where it attaches" body="The adapters sit only on the softmax attention layers; the linear-attention backbone (GatedDeltaNet) stays frozen.">
            <AttentionGlyph on={on} />
          </Docket>
        </div>

        {/* where it lives + specs, both loose
            stacked through md (not just sm): at 768 an auto/1fr grid left
            the ledger's dd column too cramped, wrapping "plaintext-9b" on
            its own hyphen (MODEL-08) - stack one column later, to lg */}
        <motion.div
          className="mt-10 grid items-start gap-8 lg:grid-cols-[auto_1fr] lg:gap-14"
          initial={false}
          animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.5, ease: EASE, delay: on ? 0.8 : 0 }}
        >
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>Where it lives</p>
            <div className="mt-3 flex items-center gap-3">
              {/* MLX chip (a pill, the object) slides along the hairline toward the laptop */}
              <motion.span
                className="mono flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: "var(--color-accent-soft)", color: "var(--color-accent-ink)", border: "1px solid var(--color-accent-line)" }}
                initial={false}
                animate={on ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                transition={{ duration: 0.5, ease: EASE, delay: on ? 0.92 : 0 }}
              >
                MLX 4-bit
              </motion.span>
              <div className="h-px w-6" style={{ background: "var(--color-line-2)" }} />
              <div className="flex items-center gap-2">
                <Laptop size={38} weight="duotone" style={{ color: "var(--color-ink-2)" }} />
                <WifiSlash size={16} style={{ color: "var(--color-muted)" }} />
              </div>
            </div>
            <p className="mono mt-3 text-[11px]" style={{ color: "var(--color-muted)" }}>{lora.runsOn}</p>
          </div>
          {/* open spec table: mono key/value rows on hairlines, no container box */}
          <dl>
            {L.specLedger.map((row) => (
              <div key={row.k} className="flex items-baseline justify-between gap-4 py-3" style={{ borderBottom: "1px solid var(--color-line)" }}>
                <dt className="mono text-[11px]" style={{ color: "var(--color-muted)" }}>{row.k}</dt>
                <dd className="mono text-right text-[11.5px]" style={{ color: "var(--color-ink)" }}>{row.v}</dd>
              </div>
            ))}
          </dl>
        </motion.div>
      </div>

      {/* what we measured: the held-out length statistic, loose under ONE hairline
          that separates it from the mechanism. DotScale (charts.tsx) already
          draws its own leader lines, dots, and the dashed gold reference on
          view - the §4.5 "measurement rows" beat. */}
      <Reveal delay={0.05}>
        <div className="mt-12 pt-10 md:mt-16 md:pt-12" style={{ borderTop: "1px solid var(--color-line-2)" }}>
          {/* plain mono label, not a kicker: "The model" already spends /model's kicker budget (MODEL-14) */}
          <p className="mono text-[12px]" style={{ color: "var(--color-muted)" }}>What we measured</p>
          <h3 className="mt-4 text-[clamp(18px,2.2vw,24px)] font-semibold" style={{ color: "var(--color-ink)" }}>{L.measurement.title}</h3>
          <div className="mt-6 max-w-[760px]">
            <DotScale rows={ROWS} max={L.measurement.max} />
          </div>
          <p className="mt-6 max-w-[70ch] text-[16px] font-medium leading-relaxed" style={{ color: "var(--color-ink)" }}>{L.measurement.claim}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="mono text-[11px]" style={{ color: "var(--color-muted)" }}>{L.measurement.footnote}</p>
            <span className="inline-flex items-center gap-2">
              <SealCheck size={16} weight="fill" style={{ color: "var(--color-ok)" }} />
              <span className="mono text-[12px]" style={{ color: "var(--color-ok-ink)" }}>{L.verifiedToken}</span>
            </span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
