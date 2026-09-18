"use client";

import { motion, useReducedMotion } from "motion/react";
import { useReveal } from "./primitives";

const EASE = [0.22, 1, 0.36, 1] as const;

export type BarItem = { label: string; n: number; note?: string; tone?: "accent" | "ok" | "warn" | "bad" | "neutral" | "mid" };

function barColor(tone: BarItem["tone"]) {
  switch (tone) {
    case "ok": return "var(--color-ok)";
    case "warn": return "var(--color-warn)";
    case "bad": return "var(--color-bad)";
    case "neutral": return "var(--color-line-2)";
    case "mid": return "var(--color-muted)"; // a genuine mid-gray, never cobalt (DATA-07)
    default: return "var(--color-accent)";
  }
}

// a small-but-important value shouldn't render as an invisible sliver next
// to a much larger one on a linear scale (DATA-11): floor the visible
// fraction so every bar with n>0 stays legible.
const MIN_VISIBLE_FRACTION = 0.035;

/* A single bar that grows in when scrolled into view. Robust: renders at
   its final width by default (visible for crawlers / no-JS / headless),
   and only replays the grow when it enters from below the fold. */
export function GrowBar({
  fraction,
  color,
  track = "var(--color-surface-2)",
  height = 10,
  className,
  delay = 0,
}: {
  fraction: number;
  color: string;
  track?: string;
  height?: number;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const { ref, shown } = useReveal();
  return (
    <span
      ref={ref as React.Ref<HTMLSpanElement>}
      className={`relative block overflow-hidden rounded-full ${className ?? ""}`}
      style={{ height, background: track }}
    >
      <motion.span
        className="absolute inset-y-0 left-0 w-full rounded-full"
        style={{ background: color, transformOrigin: "left" }}
        initial={false}
        animate={{ scaleX: reduce ? fraction : shown ? fraction : 0 }}
        transition={{ duration: 0.9, ease: EASE, delay }}
      />
    </span>
  );
}

/* Horizontal labelled bars. */
export function BarList({ items, format, dark = false }: { items: BarItem[]; format?: (n: number) => string; dark?: boolean }) {
  const max = Math.max(...items.map((i) => i.n));
  const labelC = dark ? "var(--color-ink-2)" : "var(--color-ink-2)";
  const valueC = dark ? "var(--color-muted)" : "var(--color-muted)";
  const track = dark ? "var(--color-surface-2)" : "var(--color-surface-2)";
  return (
    <div className="flex flex-col gap-3.5">
      {items.map((it, idx) => (
        <div key={it.label} className="grid grid-cols-[minmax(96px,auto)_1fr_auto] items-center gap-3">
          <span className="text-[13.5px]" style={{ color: labelC }}>{it.label}</span>
          <GrowBar fraction={it.n > 0 ? Math.max(it.n / max, MIN_VISIBLE_FRACTION) : 0} color={barColor(it.tone)} track={track} height={10} delay={idx * 0.04} />
          <span className="num text-right text-[13px] tabular-nums" style={{ color: valueC, minWidth: 52 }}>
            {format ? format(it.n) : it.n.toLocaleString("en-US")}
          </span>
        </div>
      ))}
    </div>
  );
}

/* A single stacked proportional bar (used for the splits). */
export function StackedBar({ segments }: { segments: { key: string; pct: number; tone: string }[] }) {
  const reduce = useReducedMotion();
  const { ref, shown } = useReveal();
  return (
    <div ref={ref as React.Ref<HTMLDivElement>} className="flex h-4 w-full overflow-hidden rounded-full" style={{ background: "var(--color-surface-2)" }}>
      {segments.map((s, i) => (
        <motion.div
          key={s.key}
          style={{ background: s.tone, width: `${s.pct}%`, transformOrigin: "left" }}
          className="h-full"
          initial={false}
          animate={{ scaleX: reduce ? 1 : shown ? 1 : 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.08 }}
        />
      ))}
    </div>
  );
}

export type DotRow = { label: string; value: number; tone: "tech" | "graphite" | "accent" | "ok"; emphasis?: boolean; reference?: boolean };
const DOT_COLOR: Record<DotRow["tone"], string> = {
  tech: "var(--color-tech)",
  graphite: "var(--color-ink-2)",
  accent: "var(--color-accent)",
  ok: "var(--color-ok)",
};
const DOT_INK: Record<DotRow["tone"], string> = {
  tech: "var(--color-tech-ink)",
  graphite: "var(--color-ink-2)",
  accent: "var(--color-accent-ink)",
  ok: "var(--color-ok-ink)",
};

/* DotScale (v3 §4.5): a horizontal word-count scale. Each row places a dot at
   its value with a leader line from zero; the reference row (human gold) draws
   a full-height dashed line. The picture is the argument: three dots cluster on
   the green line, one sits far right. */
export function DotScale({ rows, max = 120, tickStep = 20 }: { rows: DotRow[]; max?: number; tickStep?: number }) {
  const reduce = useReducedMotion();
  const { ref, shown } = useReveal();
  const on = reduce || shown;
  const ticks = [];
  for (let t = 0; t <= max; t += tickStep) ticks.push(t);

  return (
    <div ref={ref as React.Ref<HTMLDivElement>}>
      {/* axis */}
      <div className="relative ml-[var(--lbl)] h-4" style={{ ["--lbl" as string]: "clamp(150px, 34%, 220px)" }}>
        {ticks.map((t) => (
          <span key={t} className="num mono absolute text-[10px]" style={{ left: `${(t / max) * 100}%`, transform: "translateX(-50%)", color: "var(--color-muted)" }}>
            {t}
          </span>
        ))}
      </div>
      <div className="relative flex flex-col gap-2.5">
        {rows.map((r, i) => {
          const pct = (r.value / max) * 100;
          const color = DOT_COLOR[r.tone];
          const ink = DOT_INK[r.tone];
          const dot = r.emphasis ? 12 : 8;
          return (
            <div
              key={r.label}
              className="grid items-center gap-3 rounded-[10px] py-1.5"
              style={{ gridTemplateColumns: "var(--lbl) 1fr", ["--lbl" as string]: "clamp(150px, 34%, 220px)", background: r.emphasis ? "var(--color-accent-soft)" : "transparent", paddingInline: r.emphasis ? 10 : 0 }}
            >
              <span className={`text-[13px] ${r.emphasis ? "font-semibold" : ""}`} style={{ color: r.emphasis ? ink : "var(--color-ink-2)" }}>
                {r.label}
              </span>
              <div className="relative h-5">
                {/* dashed reference marker on the gold row, extending up through the cluster */}
                {r.reference && (
                  <span aria-hidden className="absolute" style={{ left: `${pct}%`, top: -128, height: 150, borderLeft: "1px dashed var(--color-ok)" }} />
                )}
                {/* leader line */}
                <motion.span
                  className="absolute top-1/2 left-0 h-px"
                  style={{ background: color, opacity: r.tone === "tech" ? 0.5 : 0.7, transformOrigin: "left" }}
                  initial={false}
                  animate={{ width: `${pct}%`, scaleX: on ? 1 : 0 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.08 }}
                />
                {/* the dot */}
                <motion.span
                  className="absolute top-1/2 rounded-full"
                  style={{ left: `${pct}%`, height: dot, width: dot, marginLeft: -dot / 2, marginTop: -dot / 2, background: color, boxShadow: r.emphasis ? `0 0 0 4px color-mix(in oklch, ${color} 18%, transparent)` : "none" }}
                  initial={false}
                  animate={{ scale: on ? 1 : 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 18, delay: on ? 0.3 + i * 0.08 : 0 }}
                />
                {/* value label */}
                <span className="num mono absolute top-1/2 text-[11px]" style={{ left: `${pct}%`, transform: "translate(8px, -50%)", color: ink }}>
                  {r.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
