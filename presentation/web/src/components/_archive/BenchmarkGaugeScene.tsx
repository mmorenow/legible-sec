"use client";

import { motion, useReducedMotion } from "motion/react";
import { useReveal } from "@/components/primitives";

const EASE = [0.22, 1, 0.36, 1] as const;

/* BenchmarkGaugeScene — the "five dimensions, scored 1 to 5" figure as a
   crafted, animated SVG (replaces the cropped benchmark-gauge image band; the
   AI art is reference only, per owner law). Five vertical scoring tracks, one
   per dimension; every marker rests honestly at zero (no fake results, ever);
   a dashed cobalt ceiling marks the top score the run aims at. Plays once on
   view, settles; reduced motion renders resolved. */

const DIMS = ["Fidelity", "Business", "Audience", "Concision", "Actionability"];
const X0 = 120;
const STEP = 165;
const Y_BASE = 196;
const Y_TOP = 52;
const TICKS = 5;

export function BenchmarkGaugeScene() {
  const reduce = useReducedMotion();
  const { ref, shown } = useReveal();
  const on = reduce || shown;

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      role="img"
      aria-label="Five vertical scoring tracks, one per benchmark dimension: fidelity, business framing, audience calibration, concision, actionability. Each is marked one to five with every marker resting at zero; a dashed cobalt line marks the top score. Results populate the tracks once the pre-registered run completes."
    >
      <svg viewBox="0 0 900 250" width="100%" style={{ display: "block", overflow: "visible" }}>
        {/* the aspiration ceiling: score 5, dashed cobalt */}
        <motion.line
          x1={X0 - 40}
          y1={Y_TOP}
          x2={X0 + STEP * 4 + 40}
          y2={Y_TOP}
          stroke="var(--color-accent)"
          strokeWidth={1.25}
          strokeDasharray="5 5"
          opacity={0.6}
          initial={false}
          animate={reduce ? { pathLength: 1 } : { pathLength: on ? 1 : 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: reduce ? 0 : 0.55 }}
        />
        <motion.text
          x={X0 + STEP * 4 + 46}
          y={Y_TOP + 3}
          fontSize={10}
          fill="var(--color-accent-ink)"
          className="mono"
          initial={false}
          animate={{ opacity: on ? 0.9 : 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : 1.0 }}
        >
          5
        </motion.text>

        {DIMS.map((label, k) => {
          const x = X0 + k * STEP;
          return (
            <g key={label}>
              {/* the track grows up from the base */}
              <motion.line
                x1={x}
                y1={Y_BASE}
                x2={x}
                y2={Y_TOP}
                stroke="var(--color-line-2)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                initial={false}
                animate={reduce ? { pathLength: 1 } : { pathLength: on ? 1 : 0 }}
                transition={{ duration: 0.55, ease: EASE, delay: reduce ? 0 : k * 0.08 }}
              />
              {/* score ticks 1..5 */}
              {Array.from({ length: TICKS }, (_, t) => {
                const y = Y_BASE - ((t + 1) * (Y_BASE - Y_TOP)) / TICKS;
                return (
                  <motion.line
                    key={t}
                    x1={x - 6}
                    y1={y}
                    x2={x + 6}
                    y2={y}
                    stroke="var(--color-line-2)"
                    strokeWidth={1.25}
                    initial={false}
                    animate={{ opacity: on ? 1 : 0 }}
                    transition={{ duration: 0.25, ease: EASE, delay: reduce ? 0 : 0.3 + k * 0.08 + t * 0.04 }}
                  />
                );
              })}
              {/* the empty marker, honestly parked at zero */}
              <motion.circle
                cx={x}
                cy={Y_BASE + 14}
                r={7}
                fill="var(--color-surface)"
                stroke="var(--color-accent)"
                strokeWidth={2}
                initial={false}
                animate={on ? { scale: 1, opacity: 1 } : { scale: reduce ? 1 : 0.4, opacity: reduce ? 1 : 0 }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 17, delay: 0.7 + k * 0.07 }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
              {/* dimension label */}
              <motion.text
                x={x}
                y={Y_BASE + 42}
                fontSize={11}
                fill="var(--color-muted)"
                textAnchor="middle"
                className="mono"
                initial={false}
                animate={{ opacity: on ? 1 : 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : 0.5 + k * 0.06 }}
              >
                {label}
              </motion.text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
