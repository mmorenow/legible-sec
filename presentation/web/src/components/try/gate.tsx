"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, X, Warning } from "@phosphor-icons/react";
import { GATE_CHECKS } from "@/lib/judge";

/* Shared vocabulary of the /try instrument: the gate rail (status chips that
   stamp in), the evidence highlighter, and the status tone maps. Status color
   is RESERVED for pair state (site law); every status carries a glyph. */

export const EASE = [0.22, 1, 0.36, 1] as const;
export const SPRING = { type: "spring" as const, stiffness: 300, damping: 16 };

export type Status = "pass" | "fail" | "warn" | "idle";

export const TONE_INK: Record<Exclude<Status, "idle">, string> = {
  pass: "var(--color-ok-ink)",
  fail: "var(--color-bad-ink)",
  warn: "var(--color-warn-ink)",
};
export const TONE_SOFT: Record<Exclude<Status, "idle">, string> = {
  pass: "var(--color-ok-soft)",
  fail: "var(--color-bad-soft)",
  warn: "var(--color-warn-soft)",
};

/* Structural report shape shared by the in-tab gate (judge.ts GateReport)
   and the live motor's judge payload (legibleApi JudgeReport). null = idle:
   the rail renders dimmed placeholder chips instead of verdicts. */
export type RailFlag = { check: string; level: string; message: string; evidence: string[] };
export type RailReport = { passed: string[]; flags: RailFlag[] } | null;

export function statusFor(report: RailReport, check: string): Status {
  if (!report) return "idle";
  if (report.passed.includes(check)) return "pass";
  const f = report.flags.find((x) => x.check === check);
  if (!f) return "pass";
  return f.level === "warn" ? "warn" : "fail";
}

export function GateRail({
  report,
  checks = GATE_CHECKS,
  selected,
  onSelect,
  stampKey,
  center,
}: {
  report: RailReport;
  /** which checks this rail shows; defaults to the in-tab gate's eight */
  checks?: readonly string[];
  selected?: string | null;
  onSelect?: (check: string) => void;
  /** change to replay the stamp choreography (e.g. a fresh audit) */
  stampKey?: string | number;
  /** center the chips on the seam axis (the split-world below-band) */
  center?: boolean;
}) {
  const reduce = useReducedMotion();
  const idle = report == null;
  return (
    <div className={`flex flex-wrap gap-2 ${center ? "justify-center" : ""}`}>
      {checks.map((c, i) => {
        const st = statusFor(report, c);
        const ink = st === "idle" ? "var(--color-muted)" : TONE_INK[st];
        const soft = st === "idle" ? "var(--color-surface-2)" : TONE_SOFT[st];
        const Icon = st === "pass" ? Check : st === "warn" ? Warning : st === "fail" ? X : null;
        const interactive = Boolean(onSelect) && !idle;
        const on = selected === c;
        const Tag = interactive ? motion.button : motion.span;
        return (
          <Tag
            key={`${c}-${stampKey ?? ""}`}
            {...(interactive
              ? { onClick: () => onSelect!(c), "aria-pressed": on, type: "button" as const }
              : {})}
            aria-label={`${c}: ${st}`}
            className={`mono relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] ${
              interactive ? "hov-c hov-bc before:absolute before:inset-x-0 before:-top-2 before:-bottom-2 before:content-['']" : ""
            }`}
            style={{
              color: ink,
              background: soft,
              border: `1px solid ${on ? ink : "transparent"}`,
              ...(interactive ? { ["--hv-bc" as string]: ink } : {}),
            }}
            initial={reduce || idle ? false : { opacity: 0, scale: 0.6, rotate: -4 }}
            animate={{ opacity: idle ? 0.65 : 1, scale: 1, rotate: 0 }}
            whileTap={interactive && !reduce ? { scale: 0.96 } : undefined}
            transition={{ ...SPRING, delay: reduce || idle ? 0 : 0.12 + i * 0.06 }}
          >
            {Icon ? <Icon size={13} weight="bold" /> : <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: ink }} />}
            {c}
          </Tag>
        );
      })}
    </div>
  );
}

/* Light up exact matched substrings inside a text (the only way a check is
   allowed to justify itself). */
export function Highlighted({
  text,
  targets,
  tone = "fail",
}: {
  text: string;
  targets: string[];
  tone?: "fail" | "warn";
}): ReactNode {
  const esc = targets.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean);
  if (!esc.length) return text;
  const splitter = new RegExp(`(${esc.join("|")})`, "ig");
  const exact = new RegExp(`^(?:${esc.join("|")})$`, "i");
  const ink = tone === "warn" ? "var(--color-warn-ink)" : "var(--color-bad-ink)";
  const soft = tone === "warn" ? "var(--color-warn-soft)" : "var(--color-bad-soft)";
  return text.split(splitter).map((p, i) =>
    exact.test(p) ? (
      <mark key={i} style={{ background: soft, color: ink, borderRadius: 3, padding: "0 2px" }}>
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

/* The reading sweep: a cobalt hairline that travels down a panel when the
   gate reads it. Transform-only; skipped under reduced motion. */
export function GateSweep({ playKey, height = 220 }: { playKey: string | number; height?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.span
      key={playKey}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-px"
      style={{ background: "linear-gradient(90deg, transparent, var(--color-accent), transparent)" }}
      initial={{ y: 0, opacity: 0.9 }}
      animate={{ y: height, opacity: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
    />
  );
}

/* One flag row: check name, reason, and its exact evidence chips. */
export function FlagRow({ flag, first }: { flag: RailFlag; first: boolean }) {
  const ink = flag.level === "warn" ? "var(--color-warn-ink)" : "var(--color-bad-ink)";
  return (
    <div className="py-2.5" style={{ borderTop: first ? "none" : "1px solid var(--color-line)" }}>
      <p className="text-[12.5px]" style={{ color: "var(--color-ink-2)" }}>
        <span className="mono" style={{ color: ink }}>
          {flag.check}
        </span>{" "}
        {flag.message}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {flag.evidence.map((e, j) => (
          <span
            key={j}
            className="mono rounded px-1.5 py-0.5 text-[10.5px]"
            style={{ color: ink, background: "var(--color-surface-2)", border: `1px solid color-mix(in oklch, ${ink} 30%, transparent)` }}
          >
            {e}
          </span>
        ))}
      </div>
    </div>
  );
}
