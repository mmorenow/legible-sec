"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "@phosphor-icons/react";
import {
  aggregationRules,
  axes,
  axisOrder,
  dimensions,
  dimensionsById,
  layers,
  type AxisId,
  type Dimension,
  type LayerId,
} from "@/content/rubric";
import {
  axesFor,
  checksFor,
  designConstraints,
  isSeeded,
  itemSource,
  metrics,
  perturbations,
  prerequisites,
  seededDimensionIds,
  type Perturbation,
} from "@/content/benchmarkDesign";
import { status, linkFor } from "@/content/status";
import {
  closing,
  coverageSection,
  header,
  matrixSection,
  resultsSection,
  scene,
  scoringSection,
  stateSection,
} from "@/content/copy/benchmark";
import { TONE_INK, TONE_SOFT } from "./try/gate";
import { Reveal, useReveal } from "./primitives";

const EASE = [0.22, 1, 0.36, 1] as const;

/* /benchmark : the pre-registered design for "can a model detect the failures
   the rubric names".
 *
 * REWRITTEN 2026-09-01. What stood here rendered five prompting conditions in
 * two lanes, frontier against laptop, and one radar with five axes of writing
 * quality. That is the pre-repositioning design, and every part of it is now
 * false: the thesis was a laptop model competing with frontier models, the
 * dimensions were not the rubric's, and a single radar is exactly the merged
 * score aggregation rule 5 forbids. The `BenchmarkGaugeScene` figure that came
 * with it is no longer imported for the same reason: its five track labels are
 * the old dimension names, burned into a file this rewrite does not own.
 *
 * Nothing on this page states a dimension, an axis, a layer or a check by hand.
 * They are read from `@/content/rubric` through `@/content/benchmarkDesign`, so
 * a change to the rubric moves the page with it and cannot leave it behind. The
 * two instruments are empty and stay empty: `status.benchmarkRun` is the only
 * thing allowed to say whether a run has happened. */

/* ------------------------------------------------------------------ */
/* Shared chips                                                        */
/* ------------------------------------------------------------------ */

/* The layer chip is the checker's chip and the rubric's chip, down to the tone
   token: an L0 here has to be the same object as an L0 in /try and on /rubric,
   because it is the same claim about how much a verdict is worth. Tone follows
   what the layer may conclude, which is the mapping MeasurementLadder set. */
const LAYER_TONE: Record<LayerId, { ink: string; bg: string; dashed: boolean }> = {
  L0: { ink: TONE_INK.pass, bg: TONE_SOFT.pass, dashed: false },
  L1: { ink: TONE_INK.warn, bg: TONE_SOFT.warn, dashed: false },
  L2: { ink: "var(--color-muted)", bg: "var(--color-surface-2)", dashed: false },
  H: { ink: "var(--color-muted)", bg: "transparent", dashed: true },
};

function LayerChip({ id }: { id: LayerId }) {
  const tone = LAYER_TONE[id];
  return (
    <span
      className="mono inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px]"
      style={{
        color: tone.ink,
        background: tone.bg,
        border: tone.dashed ? "1px dashed var(--color-line-2)" : "1px solid transparent",
      }}
      title={`${layers[id].name}. ${layers[id].mayConclude}`}
    >
      {id}
    </span>
  );
}

/* Axis colour is the site's, not this page's: what holds the source is rust,
   what serves the reader is cobalt. The rubric grid already reads that way. */
function axisInk(id: AxisId): string {
  return id === "F" ? "var(--color-tech-ink)" : "var(--color-accent-ink)";
}
function axisSoft(id: AxisId): string {
  return id === "F" ? "var(--color-tech-soft)" : "var(--color-accent-soft)";
}

function AxisChip({ id }: { id: AxisId }) {
  return (
    <span
      className="mono inline-flex items-center rounded px-1.5 py-0.5 text-[11px]"
      style={{ color: axisInk(id), background: axisSoft(id) }}
      title={axes[id].definition}
    >
      {id} · {axes[id].name}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* fig. 1 : one item, end to end                                       */
/* ------------------------------------------------------------------ */

/* The instrument, drawn rather than photographed (owner law: AI art is
   reference only, never a cropped band). It carries the whole method in one
   line: a verbatim pair goes in, one error of a known type is stamped into the
   retelling, the model under test reads it, and the answer leaves as one of
   three outcomes. The three counters are empty boxes and there is no code path
   that fills them, which is the honest form of a benchmark with no run. */

const RAIL_Y = 88;
const CHIP_X = 700;
const CHIP_W = 236;
const CHIP_YS = [30, 71, 112];

function PlantedErrorScene() {
  const reduce = useReducedMotion();
  const { ref, shown } = useReveal();
  const on = reduce || shown;
  const draw = (delay: number) => ({
    duration: reduce ? 0 : 0.5,
    ease: EASE,
    delay: reduce ? 0 : delay,
  });

  return (
    /* The diagram has four stations and cannot be stacked without becoming a
       different picture, so on a narrow screen it scrolls inside its own box
       rather than shrinking its labels past reading size. */
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      role="img"
      aria-label={scene.ariaLabel}
      /* tabIndex 0: the diagram scrolls sideways below md, and without this a
         sighted keyboard-only visitor cannot pan to the Caught, Missed and
         Manufactured outcomes at the end of it. Screen reader users already
         have the aria-label; this is for the people the label does not help. */
      tabIndex={0}
      className="overflow-x-auto"
    >
      <svg viewBox="0 0 960 172" width="100%" style={{ display: "block", overflow: "visible", minWidth: 700 }}>
        {/* stage 1 : the verbatim pair, source in rust, retelling in cobalt */}
        <motion.g
          initial={false}
          animate={{ opacity: on ? 1 : 0 }}
          transition={draw(0)}
        >
          {[
            { x: 36, stroke: "var(--color-tech-line)" },
            { x: 122, stroke: "var(--color-accent-line)" },
          ].map((doc) => (
            <g key={doc.x}>
              <rect
                x={doc.x}
                y={56}
                width={76}
                height={64}
                rx={7}
                fill="var(--color-surface)"
                stroke={doc.stroke}
                strokeWidth={1.25}
              />
              {[74, 88, 102].map((y, i) => (
                <line
                  key={y}
                  x1={doc.x + 11}
                  y1={y}
                  x2={doc.x + 76 - (i === 2 ? 24 : 11)}
                  y2={y}
                  stroke="var(--color-line-2)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              ))}
            </g>
          ))}
          {/* the two are one record, so they are tied rather than merely adjacent */}
          <line x1={112} y1={RAIL_Y} x2={122} y2={RAIL_Y} stroke="var(--color-line-2)" strokeWidth={1.25} />
        </motion.g>

        {/* rail 1 */}
        <motion.line
          x1={206}
          y1={RAIL_Y}
          x2={286}
          y2={RAIL_Y}
          stroke="var(--color-line-2)"
          strokeWidth={1.25}
          strokeDasharray="4 4"
          initial={false}
          animate={{ pathLength: on ? 1 : 0 }}
          transition={draw(0.16)}
        />

        {/* stage 2 : the same retelling with one line taken out of it */}
        <motion.g
          initial={false}
          animate={{ opacity: on ? 1 : 0 }}
          transition={draw(0.28)}
        >
          <rect
            x={290}
            y={48}
            width={96}
            height={80}
            rx={7}
            fill="var(--color-surface)"
            stroke="var(--color-accent-line)"
            strokeWidth={1.25}
          />
          {[68, 84, 100, 116].map((y, i) => (
            <line
              key={y}
              x1={301}
              y1={y}
              x2={i === 2 ? 341 : 375 - (i === 3 ? 22 : 0)}
              y2={y}
              stroke={i === 2 ? "var(--color-tech)" : "var(--color-line-2)"}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          ))}
        </motion.g>

        {/* the stamp: the one place on this page where something is asserted to
            have happened, so it is the one thing that keeps moving */}
        <motion.g
          initial={false}
          animate={on ? { scale: 1, opacity: 1 } : { scale: reduce ? 1 : 0.4, opacity: reduce ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 16, delay: 0.5 }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          {!reduce && (
            <motion.circle
              cx={386}
              cy={100}
              r={9}
              fill="none"
              stroke="var(--color-tech)"
              strokeWidth={1.25}
              animate={{ scale: [1, 1.9], opacity: [0.45, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          )}
          <circle cx={386} cy={100} r={9} fill="var(--color-surface)" stroke="var(--color-tech)" strokeWidth={2} />
          <line x1={382} y1={100} x2={390} y2={100} stroke="var(--color-tech-ink)" strokeWidth={2} strokeLinecap="round" />
        </motion.g>

        {/* rail 2 */}
        <motion.line
          x1={404}
          y1={RAIL_Y}
          x2={470}
          y2={RAIL_Y}
          stroke="var(--color-line-2)"
          strokeWidth={1.25}
          strokeDasharray="4 4"
          initial={false}
          animate={{ pathLength: on ? 1 : 0 }}
          transition={draw(0.62)}
        />

        {/* stage 3 : the model under test, reading once */}
        <motion.g initial={false} animate={{ opacity: on ? 1 : 0 }} transition={draw(0.7)}>
          <rect
            x={474}
            y={52}
            width={160}
            height={72}
            rx={12}
            fill="var(--color-bg-2)"
            stroke="var(--color-line)"
            strokeWidth={1.25}
          />
          <rect
            x={488}
            y={66}
            width={132}
            height={44}
            rx={7}
            fill="none"
            stroke="var(--color-line-2)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          {/* a single reading pass, not a loop: the model is asked once */}
          {!reduce && (
            <motion.line
              x1={488}
              y1={66}
              x2={620}
              y2={66}
              stroke="var(--color-accent)"
              strokeWidth={1.25}
              initial={false}
              animate={on ? { y: [0, 44, 44], opacity: [0.9, 0.9, 0] } : { opacity: 0 }}
              transition={{ duration: 1.1, ease: "easeInOut", delay: 0.9 }}
            />
          )}
        </motion.g>

        {/* the fork: three outcomes, and only three */}
        {CHIP_YS.map((y, i) => (
          <motion.path
            key={y}
            d={`M 634 ${RAIL_Y} C 664 ${RAIL_Y}, 670 ${y + 17}, ${CHIP_X} ${y + 17}`}
            fill="none"
            stroke="var(--color-line-2)"
            strokeWidth={1.25}
            strokeDasharray="4 4"
            initial={false}
            animate={{ pathLength: on ? 1 : 0 }}
            transition={draw(1.05 + i * 0.06)}
          />
        ))}

        {scene.outcomes.map((o, i) => (
          <motion.g
            key={o.key}
            initial={false}
            animate={{ opacity: on ? 1 : 0 }}
            transition={draw(1.2 + i * 0.07)}
          >
            <rect
              x={CHIP_X}
              y={CHIP_YS[i]}
              width={CHIP_W}
              height={34}
              rx={9}
              fill="var(--color-surface)"
              stroke="var(--color-line)"
              strokeWidth={1.25}
            />
            <text
              x={CHIP_X + 14}
              y={CHIP_YS[i] + 22}
              fontSize={12}
              className="mono"
              fill="var(--color-ink-2)"
            >
              {o.label}
            </text>
            {/* the counter slot, dashed and empty, with nothing that can fill it */}
            <rect
              x={CHIP_X + CHIP_W - 52}
              y={CHIP_YS[i] + 8}
              width={38}
              height={18}
              rx={5}
              fill="none"
              stroke="var(--color-line-2)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          </motion.g>
        ))}

        {/* stage labels, last in, so the diagram is read before it is named */}
        {[117, 338, 554].map((x, i) => (
          <motion.text
            key={x}
            x={x}
            y={150}
            fontSize={11}
            className="mono"
            fill="var(--color-muted)"
            textAnchor="middle"
            initial={false}
            animate={{ opacity: on ? 1 : 0 }}
            transition={draw(0.85 + i * 0.06)}
          >
            {scene.stages[i]}
          </motion.text>
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The perturbation matrix                                             */
/* ------------------------------------------------------------------ */

/* Every row is its own grid, so the tracks have to be sized independently of
   what is in them. Content-sized minima made each row resolve its own column
   widths and the table came out ragged: the row with two dimensions in it
   pulled its neighbours out of line with the header. `minmax(0, …fr)` and two
   fixed columns give every row the same ruler. */
const MATRIX_COLS =
  "lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.9fr)_minmax(0,1fr)_172px_132px]";

/* Below lg the row stops being a table row and becomes a record, so every cell
   carries its own label and only shows it when the header row is gone. */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span
        className="mono block text-[10.5px] uppercase tracking-[0.13em] lg:hidden"
        style={{ color: "var(--color-muted)" }}
      >
        {label}
      </span>
      <div className="mt-1 lg:mt-0">{children}</div>
    </div>
  );
}

function MatrixRow({ p, first }: { p: Perturbation; first: boolean }) {
  const cols = matrixSection.columns;
  const checks = checksFor(p);
  const direction = p.direction;
  return (
    <div
      className={`grid gap-x-5 gap-y-3 py-5 ${MATRIX_COLS}`}
      style={{ borderTop: first ? "none" : "1px solid var(--color-line)" }}
    >
      <Cell label={cols.error}>
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-semibold leading-[1.35]" style={{ color: "var(--color-ink)" }}>
            {p.name}
          </p>
          {direction ? (
            <p className="mono text-[11px]" style={{ color: "var(--color-tech-ink)" }}>
              {"\u2195"} {matrixSection.directionLabel[direction]}
            </p>
          ) : null}
        </div>
      </Cell>

      <Cell label={cols.edit}>
        <p className="text-[14px] leading-[1.6]" style={{ color: "var(--color-ink-2)" }}>
          {p.edit}
        </p>
      </Cell>

      <Cell label={cols.dimension}>
        <ul className="flex flex-col gap-1">
          {p.dimensions.map((id) => (
            <li key={id} className="text-[13.5px] leading-[1.4]" style={{ color: "var(--color-ink-2)" }}>
              <span className="mono text-[11.5px]" style={{ color: "var(--color-muted)" }}>
                {id}
              </span>{" "}
              {dimensionsById[id].shortName}
            </li>
          ))}
        </ul>
      </Cell>

      <Cell label={cols.axis}>
        <div className="flex flex-wrap gap-1.5">
          {axesFor(p).map((a) => (
            <AxisChip key={a} id={a} />
          ))}
        </div>
      </Cell>

      <Cell label={cols.caughtBy}>
        <ul className="flex flex-col gap-1.5">
          {checks.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5" title={c.text}>
              <span className="mono text-[11.5px]" style={{ color: "var(--color-ink-2)" }}>
                {c.id}
              </span>
              {c.layers.map((l) => (
                <LayerChip key={l} id={l} />
              ))}
            </li>
          ))}
        </ul>
      </Cell>

      {p.note ? (
        <div className="lg:col-span-5">
          <p
            className="rounded-[10px] px-3.5 py-2.5 text-[13px] leading-[1.55]"
            style={{ background: "var(--color-bg-2)", color: "var(--color-muted)" }}
          >
            <span className="mono" style={{ color: "var(--color-ink-2)" }}>
              {matrixSection.noteLabel}.
            </span>{" "}
            {p.note}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function PerturbationMatrix() {
  const cols = matrixSection.columns;
  return (
    <div className="plate p-6 md:p-8" style={{ background: "var(--color-bg-2)" }}>
      <div
        className={`hidden gap-x-5 pb-3 lg:grid ${MATRIX_COLS}`}
        style={{ borderBottom: "1px solid var(--color-line-2)" }}
      >
        {[cols.error, cols.edit, cols.dimension, cols.axis, cols.caughtBy].map((c) => (
          <span key={c} className="mono text-[10.5px] uppercase tracking-[0.13em]" style={{ color: "var(--color-muted)" }}>
            {c}
          </span>
        ))}
      </div>
      {perturbations.map((p, i) => (
        <MatrixRow key={p.id} p={p} first={i === 0} />
      ))}
      <div className="mt-2 pt-4" style={{ borderTop: "1px solid var(--color-line)" }}>
        <p className="text-[13.5px] leading-[1.6]" style={{ color: "var(--color-muted)" }}>
          {matrixSection.bidirectionalNote}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Coverage: which dimensions the seed set actually reaches            */
/* ------------------------------------------------------------------ */

function CoverageStrip() {
  return (
    <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {dimensions.map((d) => {
        const seeded = isSeeded(d.id);
        const ink = seeded ? axisInk(d.axes[0]) : "var(--color-muted)";
        return (
          <div
            key={d.id}
            className="rounded-[12px] px-3.5 py-3"
            style={{
              background: seeded ? "var(--color-surface)" : "transparent",
              border: seeded ? "1px solid var(--color-line)" : "1px dashed var(--color-line-2)",
            }}
          >
            <div className="flex items-baseline gap-2">
              <span className="mono text-[11.5px]" style={{ color: ink }}>
                {d.id}
              </span>
              <span
                className="text-[13.5px] leading-[1.35]"
                style={{ color: seeded ? "var(--color-ink-2)" : "var(--color-muted)" }}
              >
                {d.shortName}
              </span>
            </div>
            <span className="mono mt-1.5 block text-[10.5px]" style={{ color: "var(--color-muted)" }}>
              {seeded ? coverageSection.seededLabel : coverageSection.unseededLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The two instruments                                                 */
/* ------------------------------------------------------------------ */

/* Two shapes, never one. Aggregation rule 5 forbids the average, so it also
   forbids the single radar that used to sit here: a merged polygon IS the
   average, drawn.
 *
 * The geometry is derived, not typed. The fidelity axis carries four dimensions
 * and the utility axis five, and one dimension sits on both, so the two figures
 * are a diamond and a pentagon of different vertex counts. Hardcoding five
 * angles is what let the old radar keep drawing after its dimensions changed. */

const R = 74;
const CX = 108;
const CY = 104;

function vertex(k: number, n: number, frac: number) {
  const rad = ((-90 + (k * 360) / n) * Math.PI) / 180;
  return [CX + R * frac * Math.cos(rad), CY + R * frac * Math.sin(rad)] as const;
}
function ringPath(n: number, frac: number) {
  return Array.from({ length: n }, (_, k) => vertex(k, n, frac).join(",")).join(" ");
}

function AxisRadar({ id }: { id: AxisId }) {
  const reduce = useReducedMotion();
  const { ref, shown } = useReveal();
  const on = reduce || shown;
  const axis = axes[id];
  const dims: Dimension[] = dimensions.filter((d) => d.axes.includes(id));
  const n = dims.length;
  const ink = axisInk(id);

  return (
    <div
      className="h-full rounded-[14px] border p-6"
      style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
    >
      <p className="mono text-[12px] uppercase tracking-[0.13em]" style={{ color: ink }}>
        {resultsSection.axisLabel(axis.id, axis.name)}
      </p>

      <div className="mt-4 flex justify-center">
        <svg
          ref={ref as unknown as React.Ref<SVGSVGElement>}
          viewBox="0 0 216 208"
          width="100%"
          style={{ maxWidth: 244, overflow: "visible" }}
          role="img"
          aria-label={`${axis.name} axis instrument, with one vertex per dimension: ${dims
            .map((d) => d.shortName)
            .join(", ")}. It is empty because no run has happened.`}
        >
          {/* the frame arrives as one object; a dashed outline resists a
              pathLength draw, so the entrance is opacity and a small scale */}
          <motion.g
            initial={false}
            animate={on ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            {[0.25, 0.5, 0.75].map((f) => (
              <polygon
                key={f}
                points={ringPath(n, f)}
                fill="none"
                stroke="var(--color-line-2)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            ))}
            {dims.map((_, k) => {
              const [x, y] = vertex(k, n, 1);
              return (
                <line
                  key={k}
                  x1={CX}
                  y1={CY}
                  x2={x}
                  y2={y}
                  stroke="var(--color-line-2)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              );
            })}
            {/* the only idle motion permitted on this page's instruments: the
                outline breathing, which reads as waiting rather than as data */}
            <motion.polygon
              points={ringPath(n, 1)}
              fill="none"
              stroke={ink}
              strokeWidth={1.25}
              strokeDasharray="4 4"
              initial={{ opacity: 0.5 }}
              animate={reduce ? { opacity: 0.6 } : { opacity: [0.45, 0.8, 0.45] }}
              transition={reduce ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.g>

          {dims.map((d, k) => {
            const [vx, vy] = vertex(k, n, 1);
            const [lx, ly] = vertex(k, n, 1.22);
            const seeded = isSeeded(d.id);
            const anchor = Math.abs(lx - CX) < 8 ? "middle" : lx > CX ? "start" : "end";
            return (
              <motion.g
                key={d.id}
                initial={false}
                animate={{ opacity: on ? 1 : 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: on && !reduce ? 0.45 + k * 0.06 : 0 }}
              >
                {/* a filled vertex can take a value once the run happens; an
                    outlined one has no perturbation written against it yet */}
                <circle
                  cx={vx}
                  cy={vy}
                  r={3.5}
                  fill={seeded ? ink : "var(--color-surface)"}
                  stroke={seeded ? ink : "var(--color-line-2)"}
                  strokeWidth={1.25}
                />
                {/* 10.5, not 9.5. Everything else on this page bottoms out at
                    10.5px mono and these nine labels name the axes, which is
                    the part of a radar a reader has to be able to read. */}
                <text
                  x={lx}
                  y={ly}
                  fontSize={10.5}
                  className="mono"
                  fill={seeded ? "var(--color-ink-2)" : "var(--color-muted)"}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                >
                  {d.id}
                </text>
              </motion.g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2">
        <p className="mono text-center text-[10.5px]" style={{ color: "var(--color-muted)" }}>
          {resultsSection.emptyLabel}
        </p>
      </div>

      {/* the legend carries the names, so no label has to be truncated to fit a
          vertex, and it is where the seeded state is stated in words */}
      <ul className="mt-5 flex flex-col gap-1.5" style={{ borderTop: "1px solid var(--color-line)", paddingTop: 14 }}>
        {dims.map((d) => {
          const seeded = isSeeded(d.id);
          return (
            <li key={d.id} className="flex items-baseline justify-between gap-3">
              <span className="text-[13.5px] leading-[1.4]" style={{ color: seeded ? "var(--color-ink-2)" : "var(--color-muted)" }}>
                <span className="mono text-[11.5px]" style={{ color: "var(--color-muted)" }}>
                  {d.id}
                </span>{" "}
                {d.shortName}
              </span>
              {!seeded ? (
                <span className="mono flex-none text-[10.5px]" style={{ color: "var(--color-muted)" }}>
                  {coverageSection.unseededLabel}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/* Rule 5 is quoted from the rubric rather than restated, because the sentence
   that forbids the single number is the load-bearing one on this page. */
const AXIS_RULE = aggregationRules.find((r) => r.emphasis);

function Scoring() {
  return (
    <>
      <div className="grid gap-5 md:grid-cols-2">
        {metrics.map((m) => (
          <Reveal key={m.key}>
            <div
              className="h-full rounded-[14px] border p-6"
              style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
            >
              <div className="flex flex-col gap-3">
                <p className="mono text-[12px] uppercase tracking-[0.13em]" style={{ color: "var(--color-muted)" }}>
                  {m.name}
                </p>
                <p className="text-[15.5px] leading-[1.6]" style={{ color: "var(--color-ink)" }}>
                  {m.definition}
                </p>
              </div>
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-line)" }}>
                <p className="text-[13.5px] leading-[1.6]" style={{ color: "var(--color-muted)" }}>
                  <span className="mono" style={{ color: "var(--color-ink-2)" }}>
                    {scoringSection.aloneLabel}.
                  </span>{" "}
                  {m.aloneItHides}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {AXIS_RULE ? (
        <Reveal delay={0.05}>
          <div
            className="mt-5 rounded-[14px] p-6 md:p-7"
            style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-accent-line)" }}
          >
            <div className="flex flex-col gap-3">
              <p className="mono text-[12px] uppercase tracking-[0.13em]" style={{ color: "var(--color-accent-ink)" }}>
                {scoringSection.ruleLabel} {AXIS_RULE.n}
              </p>
              <p className="text-[17px] leading-[1.6]" style={{ color: "var(--color-ink)" }}>
                {AXIS_RULE.text}
              </p>
              <p className="max-w-[72ch] text-[14.5px] leading-[1.65]" style={{ color: "var(--color-ink-2)" }}>
                {scoringSection.ruleReason}
              </p>
            </div>
          </div>
        </Reveal>
      ) : null}

      <Reveal delay={0.05}>
        <div className="mt-9">
          <p className="mono text-[12px] uppercase tracking-[0.13em]" style={{ color: "var(--color-muted)" }}>
            {scoringSection.constraintsLabel}
          </p>
        </div>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {designConstraints.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2.5 rounded-[12px] p-5"
              style={{ background: "var(--color-bg-2)", border: "1px solid var(--color-line)" }}
            >
              <p className="text-[14.5px] leading-[1.55]" style={{ color: "var(--color-ink)" }}>
                {c.rule}
              </p>
              <p className="text-[13px] leading-[1.6]" style={{ color: "var(--color-muted)" }}>
                {c.because}
              </p>
            </li>
          ))}
        </ul>
      </Reveal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* State: the ledger says whether a run happened, and nothing else does */
/* ------------------------------------------------------------------ */

function RunState() {
  const claim = status.benchmarkRun;
  const href = linkFor("benchmarkRun");
  return (
    <div className="plate p-7 md:p-10">
      <div className="grid gap-2 sm:grid-cols-[176px_1fr] sm:gap-6">
        <div className="mono text-[12.5px]" style={{ color: "var(--color-ink-2)" }}>
          {stateSection.claimLabel}
          <span className="mt-1 block text-[11px]" style={{ color: "var(--color-muted)" }}>
            {claim.state}
          </span>
        </div>
        <p className="text-[16px] leading-[1.65]" style={{ color: "var(--color-ink)" }}>
          {/* `linkFor` returns null for anything not shipped, which is the whole
              mechanism: there is no placeholder for a link to point at. */}
          {href ? (
            <a href={href} style={{ color: "var(--color-accent-ink)" }}>
              {claim.note}
            </a>
          ) : (
            claim.note
          )}
        </p>
      </div>

      <div className="mt-9">
        <p className="mono text-[12px] uppercase tracking-[0.13em]" style={{ color: "var(--color-muted)" }}>
          {stateSection.prerequisitesLabel}
        </p>
      </div>
      <ol className="mt-4">
        {prerequisites.map((p, i) => (
          <li
            key={p.id}
            className="grid gap-1.5 py-4 sm:grid-cols-[40px_1fr] sm:gap-6"
            style={{ borderTop: "1px solid var(--color-line)" }}
          >
            <span className="mono num text-[12.5px]" style={{ color: "var(--color-muted)" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex flex-col gap-1.5">
              <p className="text-[15.5px] leading-[1.55]" style={{ color: "var(--color-ink)" }}>
                {p.step}
              </p>
              <p className="max-w-[68ch] text-[13.5px] leading-[1.6]" style={{ color: "var(--color-muted)" }}>
                {p.why}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div
        className="mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pt-5"
        style={{ borderTop: "1px solid var(--color-line)" }}
      >
        <p className="text-[13.5px] leading-[1.6]" style={{ color: "var(--color-muted)" }}>
          <span className="mono" style={{ color: "var(--color-ink-2)" }}>
            {stateSection.itemsLabel}.
          </span>{" "}
          {stateSection.itemsTemplate(itemSource.pairs, itemSource.label)} {itemSource.note}
        </p>
        <a
          href={stateSection.rubricLinkHref}
          className="mono hov hov-fg inline-flex flex-none items-center gap-1.5 text-[12.5px]"
          style={{ color: "var(--color-accent-ink)", ["--hv-fg" as string]: "var(--color-ink)" }}
        >
          {stateSection.rubricLinkLabel}
          <ArrowRight size={12} />
        </a>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

function SectionHead({ eyebrow, heading, lede }: { eyebrow: string; heading: string; lede: string }) {
  return (
    <Reveal>
      <div className="flex flex-col gap-3">
        <p className="mono text-[12px] uppercase tracking-[0.13em]" style={{ color: "var(--color-muted)" }}>
          {eyebrow}
        </p>
        <h2 className="h2" style={{ color: "var(--color-ink)" }}>
          {heading}
        </h2>
        <p className="max-w-[74ch] pt-1 text-[16.5px] leading-[1.7]" style={{ color: "var(--color-ink-2)" }}>
          {lede}
        </p>
      </div>
    </Reveal>
  );
}

export function Benchmark() {
  return (
    <div>
      {/* ---- header ---- */}
      {/* Site rule, worth stating because it is invisible until it bites:
          globals.css resets the margin on p and on h1 to h4 outside a cascade
          layer, so an unlayered rule beats the utility and a `mt-*` class on one
          of those elements does nothing. Every vertical gap on this page comes
          from a flex gap or from a wrapper, never from a margin on the element
          that needs it. */}
      <Reveal>
        <div className="flex flex-col gap-3">
          <p className="kicker">{header.kicker}</p>
          <h1 className="display" style={{ color: "var(--color-ink)" }}>
            {header.headline}
          </h1>
          <p className="lede max-w-[68ch] pt-1">{header.lede}</p>
        </div>
      </Reveal>

      {/* the two things a reader arrives suspecting: that this is a writing
          contest, and that an existing benchmark would have done */}
      <Reveal delay={0.04}>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {[
            { label: header.supersededLabel, body: header.superseded },
            { label: header.gapLabel, body: header.gap },
          ].map((n) => (
            <div
              key={n.label}
              className="flex flex-col gap-2.5 rounded-[14px] p-5"
              style={{ background: "var(--color-bg-2)", border: "1px solid var(--color-line)" }}
            >
              <p className="mono text-[11.5px] uppercase tracking-[0.13em]" style={{ color: "var(--color-muted)" }}>
                {n.label}
              </p>
              <p className="text-[14.5px] leading-[1.65]" style={{ color: "var(--color-ink-2)" }}>
                {n.body}
              </p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ---- fig. 1 : one item, end to end ---- */}
      <Reveal delay={0.05}>
        <figure className="mt-12">
          <PlantedErrorScene />
          <figcaption className="mt-6 max-w-[74ch] text-[14px] leading-[1.65]" style={{ color: "var(--color-ink-2)" }}>
            {scene.caption}
          </figcaption>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5">
            {scene.outcomes.map((o) => (
              <li key={o.key} className="text-[13px]" style={{ color: "var(--color-muted)" }}>
                <span className="mono" style={{ color: "var(--color-ink-2)" }}>
                  {o.label}
                </span>{" "}
                {o.note}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <p className="mono text-[11px]" style={{ color: "var(--color-muted)" }}>
              {scene.emptyNote}
            </p>
          </div>
        </figure>
      </Reveal>

      {/* ---- the perturbation matrix ---- */}
      <div className="mt-16">
        <SectionHead eyebrow={matrixSection.eyebrow} heading={matrixSection.heading} lede={matrixSection.lede} />
        <Reveal delay={0.05}>
          <div className="mt-7">
            <PerturbationMatrix />
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-9 flex flex-col gap-2.5">
            <h3 className="text-[17.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
              {coverageSection.heading}
            </h3>
            <p className="max-w-[74ch] text-[14.5px] leading-[1.65]" style={{ color: "var(--color-ink-2)" }}>
              {/* the count is worked out from the data, so the sentence cannot
                  drift away from the matrix above it */}
              {coverageSection.countTemplate(seededDimensionIds.length, dimensions.length)}{" "}
              {coverageSection.lede}
            </p>
            <CoverageStrip />
          </div>
        </Reveal>
      </div>

      {/* ---- scoring ---- */}
      <div className="mt-16">
        <SectionHead eyebrow={scoringSection.eyebrow} heading={scoringSection.heading} lede={scoringSection.lede} />
        <div className="mt-7">
          <Scoring />
        </div>
      </div>

      {/* ---- where the results land ---- */}
      <div className="mt-16">
        <SectionHead eyebrow={resultsSection.eyebrow} heading={resultsSection.heading} lede={resultsSection.lede} />
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {axisOrder.map((id, i) => (
            <Reveal key={id} delay={i * 0.05} className="h-full">
              <AxisRadar id={id} />
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.05}>
          <div className="mt-4">
            <p className="max-w-[74ch] text-[13.5px] leading-[1.6]" style={{ color: "var(--color-muted)" }}>
              {resultsSection.vertexNote}
            </p>
          </div>
        </Reveal>
      </div>

      {/* ---- state ---- */}
      <div className="mt-16">
        <SectionHead eyebrow={stateSection.eyebrow} heading={stateSection.heading} lede={stateSection.lede} />
        <Reveal delay={0.05}>
          <div className="mt-7">
            <RunState />
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.05}>
        <div className="mt-12">
          <p className="max-w-[74ch] text-[14.5px] leading-[1.7]" style={{ color: "var(--color-ink-2)" }}>
            {closing}
          </p>
        </div>
      </Reveal>
    </div>
  );
}
