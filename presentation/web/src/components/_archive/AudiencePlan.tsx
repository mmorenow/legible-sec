"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Plus, X } from "@phosphor-icons/react";
import { audiences, type Audience } from "@/content/data";
import { Reveal, Stagger, StaggerItem } from "../primitives";

const EASE = [0.22, 1, 0.36, 1] as const;

/* AudiencePlan v4.2 — the flip. Resting card = persona image + name, nothing
   else. Hover or tap turns the card around completely; the back carries the
   full, calm description (owner call 2026-07-12). Reduced motion swaps faces
   instantly instead of rotating. */

function tierLine(a: Audience) {
  return a.tier === "core" ? "core · trains the model" : "retrieval · reached at answer time";
}

function FlipCard({ a, open, onOpen, onClose, onToggle }: {
  a: Audience;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="h-full" style={{ perspective: 1200 }} onMouseEnter={onOpen} onMouseLeave={onClose}>
      <motion.div
        className="relative h-full"
        style={{ transformStyle: "preserve-3d" }}
        initial={false}
        animate={{ rotateY: open ? 180 : 0 }}
        transition={{ duration: reduce ? 0 : 0.55, ease: EASE }}
      >
        {/* front: image + name, nothing else */}
        <div
          className="flex h-full flex-col overflow-hidden rounded-[14px] border"
          style={{ borderColor: "var(--color-line)", background: "var(--color-surface)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          <div className="relative aspect-square overflow-hidden" style={{ background: "var(--color-bg-2)" }}>
            {a.vid && !reduce ? (
              <video
                src={a.vid}
                poster={a.poster ?? a.img}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                aria-label={a.who}
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={a.poster ?? a.img}
                alt={a.who}
                width={1024}
                height={1024}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <button
            type="button"
            aria-expanded={open}
            onClick={onToggle}
            className="flex w-full flex-1 items-center justify-between gap-2 px-4 py-3 text-left"
            style={{ borderTop: "1px solid var(--color-line)" }}
          >
            <h3 className="text-[14.5px] font-semibold leading-tight" style={{ color: "var(--color-ink)" }}>{a.name}</h3>
            <Plus size={13} weight="bold" className="flex-none" style={{ color: "var(--color-muted)" }} />
          </button>
        </div>

        {/* back: the whole story, calm */}
        <div
          className="absolute inset-0 flex flex-col overflow-hidden rounded-[14px] border p-4 md:p-5"
          style={{
            borderColor: "var(--color-line)",
            background: "var(--color-surface)",
            transform: "rotateY(180deg)",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--color-muted)" }}>{a.name}</p>
            <button
              type="button"
              aria-label={`Close ${a.name} details`}
              onClick={onToggle}
              className="-mr-1 -mt-1 flex h-7 w-7 flex-none items-center justify-center rounded-full"
              style={{ color: "var(--color-muted)" }}
            >
              <X size={13} weight="bold" />
            </button>
          </div>
          <p className="mt-2 flex-1 text-[12.5px] leading-[1.55] md:text-[13px]" style={{ color: "var(--color-ink-2)" }}>
            {a.detail}
          </p>
          <p className="mono mt-3 text-[10.5px]" style={{ color: a.tier === "core" ? "var(--color-accent-ink)" : "var(--color-ink-2)" }}>
            {tierLine(a)}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export function AudiencePlan() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="audiences" className="border-t py-20 md:py-28" style={{ borderColor: "var(--color-line)", background: "var(--color-bg-2)" }}>
      <div className="wrap-wide">
        <Reveal>
          <h2 className="h2" style={{ color: "var(--color-ink)" }}>
            Available Translations
          </h2>
        </Reveal>

        <Stagger className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-4 lg:grid-cols-5" step={0.07}>
          {audiences.map((a, i) => (
            <StaggerItem key={a.name}>
              <FlipCard
                a={a}
                open={open === i}
                onOpen={() => setOpen(i)}
                onClose={() => setOpen((cur) => (cur === i ? null : cur))}
                onToggle={() => setOpen((cur) => (cur === i ? null : i))}
              />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
