"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ArrowDown } from "@phosphor-icons/react";
import { methodStages } from "@/content/data";
import { Reveal, useReveal } from "./primitives";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ==================================================================
   Method — how ONE pair is made, told as five animated mini-scenes:
   report → sections found → pair linked → link tested → JSON record.
   Each scene plays once when it scrolls into view (robust reveal).
   ================================================================== */

/* ---------- shared bits ---------- */

function SceneShell({
  step,
  title,
  detail,
  children,
  extraDelay = 0,
}: {
  step: number;
  title: string;
  detail: string;
  children: (on: boolean, d: number) => React.ReactNode;
  extraDelay?: number;
}) {
  const reduce = useReducedMotion();
  const { ref, shown } = useReveal();
  const on = reduce || shown;
  const d = reduce ? 0 : extraDelay;
  return (
    <div ref={ref as React.Ref<HTMLDivElement>} className="flex min-w-0 flex-col items-center text-center">
      <div className="flex h-[168px] w-full items-center justify-center">{children(on, d)}</div>
      <div className="mt-4 flex items-center gap-2">
        <span className="mono text-[10.5px]" style={{ color: "var(--color-accent-ink)" }}>
          {String(step).padStart(2, "0")}
        </span>
        <h3 className="text-[14.5px] font-semibold" style={{ color: "var(--color-ink)" }}>{title}</h3>
      </div>
      <p className="mt-1.5 max-w-[24ch] text-[12px] leading-snug" style={{ color: "var(--color-muted)" }}>
        {detail}
      </p>
    </div>
  );
}

const LINE_W = [88, 72, 80, 60, 84, 68, 76];

function DocLines({ from, count, on, d, tint }: { from: number; count: number; on: boolean; d: number; tint?: string }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.span
          key={from + i}
          className="block rounded-[2px]"
          style={{ height: 3.5, width: `${LINE_W[(from + i) % LINE_W.length]}%`, background: tint ?? "var(--color-line-2)" }}
          initial={false}
          animate={on ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
          transition={{ duration: 0.4, ease: EASE, delay: d + 0.08 * (from + i) }}
        />
      ))}
    </>
  );
}

function DocCard({ children, w = 116 }: { children: React.ReactNode; w?: number }) {
  return (
    <div
      className="relative flex flex-col gap-[7px] rounded-[9px] p-3.5 pt-3"
      style={{ width: w, background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}
    >
      <span className="mb-1 block h-[5px] w-[55%] rounded-[2px]" style={{ background: "var(--color-ink)", opacity: 0.5 }} />
      {children}
    </div>
  );
}

/* ---------- scenes ---------- */

function SceneReport({ on, d }: { on: boolean; d: number }) {
  return (
    <div className="relative">
      <DocCard>
        <DocLines from={0} count={7} on={on} d={d} />
      </DocCard>
      <motion.span
        className="mono absolute -right-3 -top-2 rounded-[5px] px-1.5 py-0.5 text-[9px]"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)", color: "var(--color-muted)" }}
        initial={false}
        animate={on ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
        transition={{ duration: 0.35, delay: d + 0.5 }}
      >
        PDF
      </motion.span>
    </div>
  );
}

function SceneSections({ on, d }: { on: boolean; d: number }) {
  return (
    <div className="relative">
      <DocCard>
        {/* exec region */}
        <motion.div
          className="relative -mx-1.5 flex flex-col gap-[7px] rounded-[5px] px-1.5 py-1.5"
          initial={false}
          animate={on ? { background: "color-mix(in oklch, var(--color-accent) 14%, transparent)", outline: "1px solid color-mix(in oklch, var(--color-accent) 55%, transparent)" } : { background: "color-mix(in oklch, var(--color-accent) 0%, transparent)", outline: "1px solid color-mix(in oklch, var(--color-accent) 0%, transparent)" }}
          transition={{ duration: 0.5, ease: EASE, delay: d + 0.35 }}
        >
          <DocLines from={0} count={2} on={on} d={d} />
        </motion.div>
        {/* findings region */}
        <motion.div
          className="relative -mx-1.5 flex flex-col gap-[7px] rounded-[5px] px-1.5 py-1.5"
          initial={false}
          animate={on ? { outline: "1px dashed color-mix(in oklch, var(--color-ink-2) 30%, transparent)" } : { outline: "1px dashed color-mix(in oklch, var(--color-ink-2) 0%, transparent)" }}
          transition={{ duration: 0.5, ease: EASE, delay: d + 0.55 }}
        >
          <DocLines from={2} count={4} on={on} d={d} />
        </motion.div>
      </DocCard>
      <motion.span
        className="mono absolute -right-14 top-[16%] hidden text-[9px] sm:block"
        style={{ color: "var(--color-accent-ink)" }}
        initial={false}
        animate={on ? { opacity: 1, x: 0 } : { opacity: 0, x: -5 }}
        transition={{ duration: 0.4, delay: d + 0.55 }}
      >
        exec<br />summary
      </motion.span>
      <motion.span
        className="mono absolute -right-14 bottom-[14%] hidden text-[9px] sm:block"
        style={{ color: "var(--color-muted)" }}
        initial={false}
        animate={on ? { opacity: 1, x: 0 } : { opacity: 0, x: -5 }}
        transition={{ duration: 0.4, delay: d + 0.75 }}
      >
        findings
      </motion.span>
    </div>
  );
}

function SceneLink({ on, d }: { on: boolean; d: number }) {
  return (
    <div className="relative flex flex-col items-center gap-2">
      {/* exec sentence chip */}
      <motion.div
        className="flex w-[128px] flex-col gap-[6px] rounded-[8px] px-3 py-2.5"
        style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-accent-line)" }}
        initial={false}
        animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: -14 }}
        transition={{ duration: 0.5, ease: EASE, delay: d + 0.15 }}
      >
        <span className="block h-[3.5px] w-[85%] rounded-[2px]" style={{ background: "var(--color-accent)", opacity: 0.9 }} />
        <span className="block h-[3.5px] w-[62%] rounded-[2px]" style={{ background: "var(--color-accent)", opacity: 0.9 }} />
      </motion.div>
      {/* thread + ID */}
      <motion.div
        className="flex flex-col items-center"
        initial={false}
        animate={on ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 0 }}
        style={{ transformOrigin: "top" }}
        transition={{ duration: 0.4, ease: EASE, delay: d + 0.55 }}
      >
        <span className="block h-3 w-px" style={{ background: "var(--color-accent)" }} />
        <span className="mono rounded-full px-2 py-[2px] text-[9px]" style={{ color: "var(--color-accent-ink)", border: "1px solid color-mix(in oklch, var(--color-accent) 50%, transparent)" }}>
          TOB-…-8
        </span>
        <span className="block h-3 w-px" style={{ background: "var(--color-accent)" }} />
      </motion.div>
      {/* finding chip */}
      <motion.div
        className="flex w-[128px] flex-col gap-[6px] rounded-[8px] px-3 py-2.5"
        style={{ background: "var(--color-tech-soft)", border: "1px solid var(--color-tech-line)" }}
        initial={false}
        animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
        transition={{ duration: 0.5, ease: EASE, delay: d + 0.3 }}
      >
        <span className="block h-[3.5px] w-[88%] rounded-[2px]" style={{ background: "var(--color-tech)", opacity: 0.55 }} />
        <span className="block h-[3.5px] w-[70%] rounded-[2px]" style={{ background: "var(--color-tech)", opacity: 0.55 }} />
        <span className="block h-[3.5px] w-[80%] rounded-[2px]" style={{ background: "var(--color-tech)", opacity: 0.55 }} />
      </motion.div>
    </div>
  );
}

function SceneVerify({ on, d }: { on: boolean; d: number }) {
  return (
    <div className="flex flex-col items-center gap-3.5">
      {/* three sequential passes */}
      <div className="flex items-center gap-3">
        {[0, 1, 2].map((k) => (
          <motion.span
            key={k}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold"
            style={{ border: "1px solid color-mix(in oklch, var(--color-ok) 50%, transparent)", color: "var(--color-ok)" }}
            initial={false}
            animate={on ? { opacity: 1, scale: 1, background: "color-mix(in oklch, var(--color-ok) 14%, transparent)" } : { opacity: 0.25, scale: 0.7, background: "color-mix(in oklch, var(--color-ok) 0%, transparent)" }}
            transition={{ duration: 0.4, ease: EASE, delay: d + 0.25 + k * 0.3 }}
          >
            ✓
          </motion.span>
        ))}
      </div>
      {/* the pair card getting its verdict */}
      <motion.div
        className="flex w-[130px] flex-col gap-[6px] rounded-[9px] px-3 py-3"
        style={{ background: "var(--color-surface-2)" }}
        initial={false}
        animate={on ? { border: "1px solid color-mix(in oklch, var(--color-ok) 60%, transparent)" } : { border: "1px solid var(--color-line)" }}
        transition={{ duration: 0.5, delay: d + 1.2 }}
      >
        <span className="block h-[3.5px] w-[82%] rounded-[2px]" style={{ background: "var(--color-accent)", opacity: 0.85 }} />
        <span className="block h-[3.5px] w-[64%] rounded-[2px]" style={{ background: "var(--color-line-2)" }} />
        <motion.span
          className="mono mt-1 self-start rounded-full px-2 py-[2px] text-[9px]"
          style={{ color: "var(--color-ok)", border: "1px solid color-mix(in oklch, var(--color-ok) 45%, transparent)" }}
          initial={false}
          animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 5 }}
          transition={{ duration: 0.4, delay: d + 1.35 }}
        >
          aligned · 0.99
        </motion.span>
      </motion.div>
    </div>
  );
}

function SceneRecord({ on, d }: { on: boolean; d: number }) {
  const lines: { text: string; color: string; pad?: boolean }[] = [
    { text: "{", color: "var(--color-muted)" },
    { text: '"technical_text": "The manage_org…"', color: "var(--color-ink)", pad: true },
    { text: '"executive_text": "Any member can…"', color: "var(--color-accent-ink)", pad: true },
    { text: '"alignment_label": "aligned"', color: "var(--color-ok)", pad: true },
    { text: '"license": "cc-by-sa-4.0"', color: "var(--color-muted)", pad: true },
    { text: "}", color: "var(--color-muted)" },
  ];
  return (
    <div className="w-[188px] rounded-[9px] px-3.5 py-3" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}>
      {lines.map((l, i) => (
        <motion.div
          key={i}
          className="mono truncate text-left text-[9.5px] leading-[1.75]"
          style={{ color: l.color, paddingLeft: l.pad ? 10 : 0 }}
          initial={false}
          animate={on ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
          transition={{ duration: 0.35, ease: EASE, delay: d + 0.15 + i * 0.14 }}
        >
          {l.text}
        </motion.div>
      ))}
    </div>
  );
}

/* ---------- section ---------- */

// Copy lives in @/content/data (methodStages); scene components stay local.
const SCENES = [SceneReport, SceneSections, SceneLink, SceneVerify, SceneRecord];
const STAGES = methodStages.map((s, i) => ({ ...s, Scene: SCENES[i] }));

/* The keyword `transparent` is not an animatable value: motion logs "You are
   trying to animate background from color-mix(...) to transparent" and snaps
   instead of animating. A 0% color-mix is the same paint and does interpolate,
   so the off state is written that way rather than as the keyword. */
export function Method() {
  return (
    <section id="method" className="py-20 md:py-28">
      <div className="wrap-wide">
        <Reveal>
          <h2 className="h2" style={{ color: "var(--color-ink)" }}>
            Extraction Pipeline
          </h2>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="plate relative mt-10 overflow-hidden px-5 py-10 md:px-8 md:py-12">
            {/* desktop: 5 scenes with flow arrows */}
            <div className="hidden lg:grid lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-start lg:gap-x-2">
              {STAGES.map(({ title, detail, Scene }, i) => (
                <div key={title} className="contents">
                  {i > 0 && (
                    <div className="flex h-[168px] items-center" aria-hidden>
                      <ArrowRight size={17} weight="bold" style={{ color: "var(--color-accent-ink)", opacity: 0.85 }} />
                    </div>
                  )}
                  <SceneShell step={i + 1} title={title} detail={detail} extraDelay={i * 0.12}>
                    {(on, d) => <Scene on={on} d={d} />}
                  </SceneShell>
                </div>
              ))}
            </div>

            {/* mobile / tablet: vertical story */}
            <div className="flex flex-col items-center gap-7 lg:hidden">
              {STAGES.map(({ title, detail, Scene }, i) => (
                <div key={title} className="flex w-full flex-col items-center">
                  {i > 0 && (
                    <ArrowDown size={16} weight="bold" className="mb-6" style={{ color: "var(--color-accent-ink)", opacity: 0.85 }} aria-hidden />
                  )}
                  <SceneShell step={i + 1} title={title} detail={detail}>
                    {(on, d) => <Scene on={on} d={d} />}
                  </SceneShell>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
