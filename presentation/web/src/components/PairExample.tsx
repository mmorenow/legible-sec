"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, ShieldCheck } from "@phosphor-icons/react";
import { examplePairs } from "@/content/data";
import { pairExample } from "@/content/copy/library";
import { Reveal, Beam } from "./primitives";

const EASE = [0.22, 1, 0.36, 1] as const;

function toneStyle(tone?: "ok" | "high") {
  // text uses the AA-safe *-ink tokens (globals.css: "AA text on light");
  // the saturated base tones are for fills/borders only
  if (tone === "ok") return { color: "var(--color-ok-ink)", border: "color-mix(in oklch, var(--color-ok) 40%, transparent)" };
  if (tone === "high") return { color: "var(--color-warn-ink)", border: "color-mix(in oklch, var(--color-warn) 45%, transparent)" };
  return { color: "var(--color-muted)", border: "var(--color-line-2)" };
}

export function PairExample() {
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const pair = examplePairs[idx];

  return (
    <section id="pair" className="py-20 md:py-28">
      <div className="wrap-wide">
        <Reveal>
          <p className="kicker mb-4">The unit of the dataset</p>
          <h2 className="h2 max-w-[18ch]" style={{ color: "var(--color-ink)" }}>
            {pairExample.heading}
          </h2>
          <p className="lede mt-4">
            Every pair keeps the verbatim technical text and its executive equivalent as they appear in the
            same document. Neither side is generated: a person wrote both, in the report itself. The link
            between them is judged by an LLM, not by a human reader, and the badge on each record below is
            that judge&rsquo;s confidence rather than a verification. Four real records:
          </p>
        </Reveal>

        {/* ---- example switcher ---- */}
        <Reveal delay={0.05}>
          <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Example pairs">
            {examplePairs.map((p, i) => (
              <button
                key={p.tab}
                role="tab"
                aria-selected={i === idx}
                onClick={() => setIdx(i)}
                className="hov hov-bc hov-fg mono rounded-full px-3.5 py-2.5 text-[12px] active:translate-y-px sm:py-2"
                style={
                  i === idx
                    ? { background: "var(--color-accent)", color: "#fff", border: "1px solid var(--color-accent)", ["--hv-bc" as string]: "var(--color-accent)", ["--hv-fg" as string]: "#fff" }
                    : { background: "transparent", color: "var(--color-muted)", border: "1px solid var(--color-line-2)", ["--hv-bc" as string]: "var(--color-accent-line)", ["--hv-fg" as string]: "var(--color-ink-2)" }
                }
              >
                {p.tab}
              </button>
            ))}
          </div>
        </Reveal>

        {/* ---- the instrument panel ---- */}
        <Reveal delay={0.08}>
          <div className="plate relative mt-5 overflow-hidden">
            {/* header strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 md:px-7" style={{ borderBottom: "1px solid var(--color-line)" }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={idx + "-src"}
                  className="mono text-[12px]"
                  style={{ color: "var(--color-muted)" }}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduce ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {pair.source}
                </motion.span>
              </AnimatePresence>
              <span
                className="mono inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
                style={{ color: "var(--color-ok-ink)", border: "1px solid color-mix(in oklch, var(--color-ok) 40%, transparent)" }}
              >
                <ShieldCheck size={13} weight="bold" /> {pair.badge}
              </span>
            </div>

            {/* two registers, crossfading between examples */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={idx}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.32, ease: EASE }}
              >
                <div className="grid gap-0 md:grid-cols-[1fr_auto_1fr]">
                  {/* technical */}
                  <div className="px-5 py-7 md:px-7 md:py-9" style={{ background: "var(--color-tech-soft)", borderTop: "2px solid var(--color-tech)" }}>
                    <span className="mono text-[11px] tracking-[0.14em]" style={{ color: "var(--color-tech-ink)" }}>RAW · TECHNICAL</span>
                    <p className="mono mt-4 text-[13.5px] leading-[1.7]" style={{ color: "var(--color-ink)" }}>
                      {pair.technical}
                    </p>
                  </div>

                  {/* beam */}
                  <div className="relative flex items-center justify-center px-6 py-1 md:w-28 md:px-0" aria-hidden>
                    <div className="hidden w-full items-center gap-2 md:flex">
                      <Beam className="flex-1" />
                      <ArrowRight size={18} weight="bold" style={{ color: "var(--color-accent-ink)" }} />
                    </div>
                    <div className="flex h-10 w-full items-center justify-center md:hidden">
                      <div style={{ width: 2, height: "100%" }}><Beam vertical /></div>
                    </div>
                  </div>

                  {/* executive */}
                  <div
                    className="px-5 py-7 md:px-7 md:py-9"
                    style={{ background: "var(--color-accent-soft)", borderTop: "2px solid var(--color-accent)", borderLeft: "1px solid var(--color-line)" }}
                  >
                    <span className="mono text-[11px] tracking-[0.14em]" style={{ color: "var(--color-accent-ink)" }}>LEGIBLE · EXECUTIVE</span>
                    <p className="mt-4 text-[18px] font-medium leading-[1.5]" style={{ color: "var(--color-ink)" }}>
                      {pair.executive}
                    </p>
                  </div>
                </div>

                {/* metadata chips */}
                <div className="flex flex-wrap gap-2 px-5 py-5 md:px-7" style={{ borderTop: "1px solid var(--color-line)" }}>
                  {pair.fields.map((f) => {
                    const s = toneStyle(f.tone);
                    return (
                      <span
                        key={f.k}
                        className="mono inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px]"
                        style={{ border: `1px solid ${s.border}` }}
                      >
                        <span style={{ color: "var(--color-muted)" }}>{f.k}</span>
                        <span style={{ color: s.color }}>{f.v}</span>
                      </span>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
