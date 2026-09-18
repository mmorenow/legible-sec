"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, ArrowDown } from "@phosphor-icons/react";
import { keyFacts } from "@/content/data";
import * as home from "@/content/copy/home";
import { Counter } from "./primitives";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const reduce = useReducedMotion();
  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-8 md:pt-32">
      {/* soft accent glow only (the ruled measurement lines were retired by owner request) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          background: "radial-gradient(1200px 420px at 70% -8%, var(--color-accent-soft), transparent 70%)",
          maskImage: "linear-gradient(180deg, black, transparent 84%)",
        }}
      />
      {/* `initial={false}` and NOT `initial={undefined}` under reduced motion.
          The server renders with `reduce` falsy, so the HTML ships with
          opacity 0; after hydration `reduce` is true and an `undefined`
          `animate` never moves it back, leaving the whole hero blank. `false`
          tells motion to start AT the animate value, which is the only form
          that survives the server-to-client flip. The h1 of the site was
          invisible to every visitor who asks for less motion. */}
      <div className="wrap-wide relative">
        <motion.p
          className="kicker mb-4"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          {/* `home.hero.kickerPrefix` was read here and the copy module defines
              `kicker`, so this did not compile. The version is not lost: the nav
              wordmark and the footer both carry it. */}
          {home.hero.kicker}
        </motion.p>

        <motion.h1
          className="max-w-[18ch] font-extrabold"
          style={{ fontSize: "clamp(2.3rem, 5.4vw, 3.9rem)", lineHeight: 1.02, letterSpacing: "-0.032em", color: "var(--color-ink)" }}
          initial={reduce ? false : { opacity: 0, y: "0.2em" }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
        >
          {home.hero.headline}
        </motion.h1>

        {/* The finding-to-translation animation stood here. It is in
            src/components/_archive/HeroMerge.tsx: LEGIBLE does not translate
            anything for now, so the hero no longer opens by showing it. */}

        <motion.div
          className="mt-10 flex flex-wrap items-center gap-3"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
        >
          {/* A filled "Load the dataset" button stood here, pointing at the literal
              string "#placeholder". The corpus is not published; see /#access for
              where each part of the project actually stands. */}
          <a
            href={home.hero.cta.href}
            className="inline-flex items-center gap-2 rounded-full border px-5 py-3 text-[15px] font-medium transition-colors hover:bg-[color:var(--color-surface-2)]"
            style={{ borderColor: "var(--color-line-2)", color: "var(--color-ink)" }}
          >
            {home.hero.cta.label}
            <ArrowDown size={16} weight="bold" />
          </a>
        </motion.div>
      </div>

      {/* -------- key facts band -------- */}
      <div className="wrap-wide mt-16 md:mt-20">
        {/* One column per fact. The grid used to ask for six against four facts,
            which left two cells empty and, because the hairline grid is drawn by
            a background showing through a 1px gap, they rendered as a grey slab
            on the right of the band. Column count follows the data. */}
        <div
          className="grid grid-cols-2 gap-px overflow-hidden sm:grid-cols-4"
          style={{ background: "var(--color-line)", borderRadius: "var(--radius-card)", border: "1px solid var(--color-line)" }}
        >
          {keyFacts.map((f) => (
            <div key={f.label} className="px-5 py-6" style={{ background: "var(--color-bg)" }}>
              <div className="num text-[30px] font-bold leading-none tracking-[-0.03em]" style={{ color: "var(--color-ink)" }}>
                <Counter value={f.value} />
              </div>
              <div className="mt-2 text-[13px]" style={{ color: "var(--color-muted)" }}>{f.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
