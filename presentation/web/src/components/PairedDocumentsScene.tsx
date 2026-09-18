"use client";

import { motion, useReducedMotion } from "motion/react";
import { useReveal } from "./primitives";

const EASE = [0.22, 1, 0.36, 1] as const;

/* PairedDocumentsScene — the product story as a crafted, animated SVG
   (replaces the cropped paired-documents.webp fig band; the AI art is the
   visual REFERENCE, per owner law: AI images support, never cropped bands).
   Left: a dense technical document (rust + graphite dashes). Right: the calm
   executive translation (three cobalt lines) sealed with a green mark. Thin
   archival threads tie specific dashes to the lines they became. Plays once
   on view, settles; reduced motion renders resolved. */

// deterministic dash rows for the technical doc (no Math.random: SSR-safe)
const ROWS: Array<Array<{ w: number; tone: "tech" | "ink" }>> = [
  [{ w: 62, tone: "tech" }, { w: 38, tone: "ink" }, { w: 50, tone: "ink" }],
  [{ w: 44, tone: "ink" }, { w: 58, tone: "tech" }, { w: 30, tone: "ink" }],
  [{ w: 70, tone: "ink" }, { w: 26, tone: "tech" }, { w: 44, tone: "ink" }],
  [{ w: 36, tone: "tech" }, { w: 52, tone: "ink" }, { w: 40, tone: "tech" }],
  [{ w: 56, tone: "ink" }, { w: 34, tone: "ink" }, { w: 48, tone: "tech" }],
  [{ w: 42, tone: "tech" }, { w: 64, tone: "ink" }, { w: 24, tone: "ink" }],
  [{ w: 50, tone: "ink" }, { w: 40, tone: "tech" }, { w: 52, tone: "ink" }],
  [{ w: 66, tone: "ink" }, { w: 30, tone: "ink" }, { w: 38, tone: "tech" }],
];

// which rows thread across to which executive line (row index -> line index)
const THREADS: Array<{ row: number; line: number }> = [
  { row: 1, line: 0 },
  { row: 3, line: 0 },
  { row: 4, line: 1 },
  { row: 6, line: 2 },
];

const DOC_L = { x: 96, y: 26, w: 268, h: 268 };
const DOC_R = { x: 536, y: 26, w: 268, h: 268 };
const LINE_Y = [92, 138, 196]; // executive line centers (svg y)

function rowY(i: number) {
  return DOC_L.y + 34 + i * 29;
}

export function PairedDocumentsScene() {
  const reduce = useReducedMotion();
  const { ref, shown } = useReveal();
  const on = reduce || shown;

  const doc = (delay: number) =>
    reduce
      ? {}
      : {
          initial: false as const,
          animate: on ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
          transition: { duration: 0.55, ease: EASE, delay },
        };

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      role="img"
      aria-label="A dense technical document on the left; thin archival threads link specific lines to a calm three-line executive translation on the right, sealed with a green verification mark. Faint sibling documents recede behind them: thousands more pairs."
    >
      <svg viewBox="0 0 900 320" width="100%" style={{ display: "block", overflow: "visible" }}>
        {/* faint sibling pairs receding at the edges */}
        {[
          { x: 14, y: 66 },
          { x: 846, y: 66 },
        ].map((g, i) => (
          <g key={i} opacity={0.35}>
            <rect x={g.x} y={g.y} width={40} height={56} rx={6} fill="none" stroke="var(--color-line-2)" strokeWidth={1.5} />
            <rect x={g.x + 8} y={g.y + 12} width={22} height={3.5} rx={1.75} fill="var(--color-line-2)" />
            <rect x={g.x + 8} y={g.y + 22} width={16} height={3.5} rx={1.75} fill="var(--color-line-2)" />
          </g>
        ))}

        {/* the technical document */}
        <motion.g {...doc(0)}>
          <rect x={DOC_L.x} y={DOC_L.y} width={DOC_L.w} height={DOC_L.h} rx={14} fill="var(--color-surface)" stroke="var(--color-tech)" strokeWidth={2} />
          {ROWS.map((row, i) => {
            let x = DOC_L.x + 22;
            return (
              <motion.g
                key={i}
                initial={false}
                animate={{ opacity: on ? 1 : 0 }}
                transition={{ duration: 0.3, ease: EASE, delay: reduce ? 0 : 0.25 + i * 0.05 }}
              >
                {row.map((d, j) => {
                  const el = (
                    <rect
                      key={j}
                      x={x}
                      y={rowY(i) - 3}
                      width={d.w}
                      height={6}
                      rx={3}
                      fill={d.tone === "tech" ? "var(--color-tech)" : "var(--color-ink-2)"}
                      opacity={d.tone === "tech" ? 0.9 : 0.55}
                    />
                  );
                  x += d.w + 12;
                  return el;
                })}
              </motion.g>
            );
          })}
        </motion.g>

        {/* the archival threads (draw once the docs are in) */}
        {THREADS.map((t, i) => {
          const y1 = rowY(t.row);
          const y2 = LINE_Y[t.line];
          const x1 = DOC_L.x + DOC_L.w;
          const x2 = DOC_R.x;
          const d = `M ${x1} ${y1} C ${x1 + 70} ${y1}, ${x2 - 70} ${y2}, ${x2} ${y2}`;
          return (
            <motion.path
              key={i}
              d={d}
              fill="none"
              stroke="var(--color-ink-2)"
              strokeWidth={1.5}
              strokeLinecap="round"
              opacity={0.55}
              initial={false}
              animate={reduce ? { pathLength: 1 } : { pathLength: on ? 1 : 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: reduce ? 0 : 0.55 + i * 0.12 }}
            />
          );
        })}

        {/* the executive translation */}
        <motion.g {...doc(0.15)}>
          <rect x={DOC_R.x} y={DOC_R.y} width={DOC_R.w} height={DOC_R.h} rx={14} fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth={2} />
          {LINE_Y.map((y, i) => (
            <motion.rect
              key={i}
              x={DOC_R.x + 24}
              y={y - 4}
              width={i === 2 ? 130 : 190 - i * 24}
              height={8}
              rx={4}
              fill="var(--color-accent)"
              opacity={0.9}
              initial={false}
              animate={{ opacity: on ? 0.9 : 0 }}
              transition={{ duration: 0.35, ease: EASE, delay: reduce ? 0 : 0.7 + i * 0.1 }}
            />
          ))}
          {/* the verification mark stamps last */}
          <motion.circle
            cx={DOC_R.x + DOC_R.w - 34}
            cy={DOC_R.y + DOC_R.h - 34}
            r={9}
            fill="var(--color-ok)"
            initial={false}
            animate={on ? { scale: 1, opacity: 1 } : { scale: reduce ? 1 : 1.8, opacity: reduce ? 1 : 0 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 16, delay: 1.15 }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        </motion.g>
      </svg>
    </div>
  );
}
