"use client";

/* ------------------------------------------------------------------------- */
/* WeightsMatrix — the rubric's 8 dimensions by 11 situations, as a picture.  */
/*                                                                            */
/* Two rules from the rubric itself are enforced by this component and are    */
/* not negotiable presentation choices:                                       */
/*                                                                            */
/*  1. No row and no column is ever summed or averaged. The rubric's fifth    */
/*     aggregation rule keeps fidelity and utility apart and never reports a  */
/*     single average that mixes them; a per dimension total or a per         */
/*     situation mean would do exactly that. There is deliberately no         */
/*     aggregate anywhere in this file, and the <caption> says so out loud.   */
/*  2. Weight 3 is rendered as "a failure here invalidates the text", never   */
/*     as "most important". That claim lives in weightLegend[3].contrast and  */
/*     it is printed verbatim in the legend.                                  */
/*                                                                            */
/* The cells are density glyphs rather than bare digits because the argument  */
/* is the shape: some dimensions are dark across the whole row, others have   */
/* light patches, and that is visible before a single number is read. The     */
/* digit stays in the cell text, so the weight is never carried by fill alone.*/
/* ------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  dimensions,
  dimensionsById,
  situations,
  situationsById,
  weights,
  weightFor,
  weightLegend,
  weightNotes,
  type DimensionId,
  type SituationId,
  type SituationTier,
  type Weight,
} from "@/content/rubric";
import { weightsMatrix } from "@/content/copy/rubric";
import { BarList, type BarItem } from "@/components/charts";
import { Reveal } from "@/components/primitives";

/* ---------------------------------------------------------------- tokens */

/* The three step density ramp: 12%, 45% and 100% of the cobalt accent,
   mixed against the card surface so the light steps stay opaque. */
const FILL: Record<Weight, string> = {
  1: "color-mix(in oklch, var(--color-accent) 12%, var(--color-surface))",
  2: "color-mix(in oklch, var(--color-accent) 45%, var(--color-surface))",
  3: "var(--color-accent)",
};

/* Ink chosen per step so the digit stays legible against its own fill. */
const GLYPH_INK: Record<Weight, string> = {
  1: "var(--color-ink-2)",
  2: "var(--color-ink)",
  3: "#fff",
};

const TIER_LABEL: Record<SituationTier, string> = {
  formal: "Formal",
  managerial: "Managerial",
  operational: "Operational",
  bridge: "Bridge",
  stress: "Stress",
};

const LEGEND_ORDER: Weight[] = [3, 2, 1];

/* The site nav is fixed at 66px, so that is where a sticky header row lands. */
const NAV_H = 66;

/* ------------------------------------------------------------- derived */

type CellRef = { d: DimensionId; s: SituationId };

type TierRun = { tier: SituationTier; span: number; key: string };

/* The tiers are not contiguous in canonical 01 to 11 order, so the rail is
   built as runs of adjacent same tier columns rather than one band per tier.
   Reordering the columns to make the families contiguous would break the
   numbering the rubric and the reading notes both refer to. */
function tierRuns(): TierRun[] {
  const runs: TierRun[] = [];
  for (const s of situations) {
    const last = runs[runs.length - 1];
    if (last && last.tier === s.tier) last.span += 1;
    else runs.push({ tier: s.tier, span: 1, key: s.id });
  }
  return runs;
}

/* A short label like "Advisory/CVE" has to be allowed to wrap, but only at
   the slash. A zero width space there beats overflow-wrap: anywhere, which
   happily splits a word into "Advisory/CV" and "E". */
function breakable(label: string): string {
  return label.replace(/\//g, "/\u200B");
}

function noteFor(s: SituationId): string | undefined {
  return weightNotes.find((n) => n.situation === s)?.text;
}

function weightWord(w: Weight): string {
  return `${w} ${weightLegend[w].label}`;
}

/* -------------------------------------------------------------- glyph */

function DensityGlyph({
  weight,
  size = 32,
  dim,
  active,
  reduce,
}: {
  weight: Weight;
  size?: number;
  dim?: boolean;
  active?: boolean;
  reduce: boolean;
}) {
  return (
    <span
      aria-hidden
      className="num inline-flex items-center justify-center font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: 9,
        background: FILL[weight],
        color: GLYPH_INK[weight],
        fontSize: 13,
        lineHeight: 1,
        border: weight === 1 ? "1px solid var(--color-accent-line)" : "1px solid transparent",
        opacity: dim ? 0.2 : 1,
        boxShadow: active ? "0 0 0 2px var(--color-accent), 0 0 0 5px var(--color-accent-soft)" : "none",
        transition: reduce ? "none" : "opacity 150ms ease-out, box-shadow 150ms ease-out",
      }}
    >
      {weight}
    </span>
  );
}

/* ------------------------------------------------------------- desktop */

function MatrixTable({ reduce }: { reduce: boolean }) {
  const runs = useMemo(() => tierRuns(), []);

  const [pointer, setPointer] = useState<CellRef | null>(null);
  const [focused, setFocused] = useState<CellRef | null>(null);
  const [pinned, setPinned] = useState<CellRef | null>(null);
  /* roving tabindex: exactly one cell is in the tab order at a time */
  const [rover, setRover] = useState<CellRef>({ d: "D1", s: "S01" });

  const cells = useRef(new Map<string, HTMLButtonElement | null>());
  const key = (d: DimensionId, s: SituationId) => `${d}:${s}`;

  const active = pointer ?? focused ?? pinned;

  const move = useCallback(
    (di: number, si: number) => {
      const d = dimensions[Math.max(0, Math.min(dimensions.length - 1, di))].id;
      const s = situations[Math.max(0, Math.min(situations.length - 1, si))].id;
      setRover({ d, s });
      cells.current.get(key(d, s))?.focus();
    },
    []
  );

  const onKeyDown = (e: React.KeyboardEvent, di: number, si: number) => {
    switch (e.key) {
      case "ArrowRight": e.preventDefault(); move(di, si + 1); break;
      case "ArrowLeft": e.preventDefault(); move(di, si - 1); break;
      case "ArrowDown": e.preventDefault(); move(di + 1, si); break;
      case "ArrowUp": e.preventDefault(); move(di - 1, si); break;
      case "Home": e.preventDefault(); move(e.ctrlKey ? 0 : di, 0); break;
      case "End": e.preventDefault(); move(e.ctrlKey ? dimensions.length - 1 : di, situations.length - 1); break;
      case "Escape": if (pinned) { e.preventDefault(); setPinned(null); } break;
      default: break;
    }
  };

  const dimmed = (d: DimensionId, s: SituationId) =>
    !!active && active.d !== d && active.s !== s;
  const onAxis = (d: DimensionId, s: SituationId) =>
    !!active && (active.d === d || active.s === s);

  const headCell: React.CSSProperties = {
    position: "sticky",
    top: NAV_H,
    zIndex: 3,
    background: "var(--color-surface)",
    verticalAlign: "bottom",
  };
  const rowHeadCell: React.CSSProperties = {
    position: "sticky",
    left: 0,
    zIndex: 2,
    background: "var(--color-surface)",
  };

  /* the running read-out under the table */
  let readout: React.ReactNode = <>{weightsMatrix.readoutIdle}</>;
  if (active) {
    const d = dimensionsById[active.d];
    const s = situationsById[active.s];
    const w = weightFor(active.d, active.s);
    const note = noteFor(active.s);
    readout = (
      <>
        <span style={{ color: "var(--color-ink)" }}>
          <span className="mono">{d.id}</span> {d.shortName}
        </span>
        <span aria-hidden style={{ color: "var(--color-muted)" }}> · </span>
        <span style={{ color: "var(--color-ink)" }}>
          <span className="mono num">{s.number}</span> {s.name}
        </span>
        <span aria-hidden style={{ color: "var(--color-muted)" }}> · </span>
        <span style={{ color: "var(--color-accent-ink)" }}>{weightWord(w)}</span>
        <span>: {weightLegend[w].meaning}</span>
        {note ? <span className="mt-1 block" style={{ color: "var(--color-muted)" }}>{note}</span> : null}
      </>
    );
  }

  return (
    <div>
      {/* tabIndex for the same reason as the benchmark diagram: the table is
          850px wide inside a 691px box below lg, and without this a keyboard
          only visitor cannot pan across the eleven situations.

          min-w-0 and max-w-full are belt and braces, not a fix. An audit read
          documentElement.scrollWidth as 896 against a 768 client here and
          suspected this table. Measured: the wrapper is 691px with overflow-x
          auto and correctly contains the 850px table, `scrollTo(400, 0)` leaves
          scrollX at 0, and nothing is clipped. The 896 only appears under
          Chrome's mobile emulation flag. Worth one look on real hardware before
          anyone goes hunting for it again. */}
      <div tabIndex={0} className="plate min-w-0 max-w-full overflow-x-auto p-4 md:p-6 lg:overflow-x-visible">
        <table
          className="w-full border-collapse text-left"
          style={{ tableLayout: "fixed", minWidth: 850 }}
          onMouseLeave={() => setPointer(null)}
        >
          <caption
            className="mb-5 text-left text-[15.5px]"
            style={{ color: "var(--color-muted)", captionSide: "top", textWrap: "pretty" }}
          >
            <span className="kicker block">{weightsMatrix.caption}</span>
          </caption>

          <colgroup>
            <col style={{ width: 176 }} />
            {situations.map((s) => (
              <col key={s.id} />
            ))}
          </colgroup>

          <thead>
            {/* the grouping rail: the only family structure the 11 columns have */}
            <tr>
              <td style={{ ...rowHeadCell, ...headCell, zIndex: 4 }} />
              {runs.map((r) => (
                <th
                  key={r.key}
                  scope="colgroup"
                  colSpan={r.span}
                  className="pb-1 align-bottom font-normal"
                  style={headCell}
                >
                  <span
                    className="block whitespace-nowrap text-center text-[11.5px]"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {TIER_LABEL[r.tier]}
                  </span>
                  <span
                    aria-hidden
                    className="mt-1 block"
                    style={{
                      height: 5,
                      marginInline: 4,
                      borderBottom: "1px solid var(--color-line-2)",
                      borderLeft: "1px solid var(--color-line-2)",
                      borderRight: "1px solid var(--color-line-2)",
                      borderRadius: "0 0 4px 4px",
                    }}
                  />
                </th>
              ))}
            </tr>

            {/* column heads: number over short label, two lines, never rotated */}
            <tr>
              <th
                scope="col"
                className="pb-3 pr-3 align-bottom text-[12.5px] font-normal uppercase"
                style={{ ...rowHeadCell, ...headCell, zIndex: 4, letterSpacing: "0.1em", color: "var(--color-muted)" }}
              >
                <span className="mono">Dimension</span>
              </th>
              {situations.map((s) => {
                const off = !!active && active.s !== s.id;
                return (
                  <th
                    key={s.id}
                    scope="col"
                    className="px-1 pb-3 align-bottom"
                    style={{
                      ...headCell,
                      opacity: off ? 0.32 : 1,
                      transition: reduce ? "none" : "opacity 150ms ease-out",
                    }}
                  >
                    <span
                      className="mono num block text-center text-[12px]"
                      style={{ color: active?.s === s.id ? "var(--color-accent-ink)" : "var(--color-muted)" }}
                    >
                      {s.number}
                    </span>
                    <span
                      className="block text-center text-[12px] leading-[1.25] font-semibold"
                      style={{ color: "var(--color-ink-2)", hyphens: "none", overflowWrap: "normal" }}
                    >
                      {breakable(s.shortLabel)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {dimensions.map((d, di) => {
              const rowOff = !!active && active.d !== d.id;
              return (
                <tr key={d.id}>
                  <th
                    scope="row"
                    className="py-1 pr-3 align-middle text-[14px] font-normal"
                    style={{
                      ...rowHeadCell,
                      borderTop: "1px solid var(--color-line)",
                      opacity: rowOff ? 0.32 : 1,
                      transition: reduce ? "none" : "opacity 150ms ease-out",
                    }}
                  >
                    <span className="flex items-baseline gap-2">
                      <span
                        className="mono text-[12.5px]"
                        style={{ color: active?.d === d.id ? "var(--color-accent-ink)" : "var(--color-muted)" }}
                      >
                        {d.id}
                      </span>
                      <span style={{ color: "var(--color-ink-2)" }}>{d.shortName}</span>
                      <span className="mono text-[11.5px]" style={{ color: "var(--color-line-2)" }}>
                        {d.axes.join("/")}
                      </span>
                    </span>
                  </th>

                  {situations.map((s, si) => {
                    const w = weightFor(d.id, s.id);
                    const isActive = active?.d === d.id && active?.s === s.id;
                    const isRover = rover.d === d.id && rover.s === s.id;
                    return (
                      <td
                        key={s.id}
                        className="p-0 text-center"
                        style={{
                          borderTop: "1px solid var(--color-line)",
                          background:
                            onAxis(d.id, s.id) && !isActive
                              ? "color-mix(in oklch, var(--color-accent) 5%, transparent)"
                              : "transparent",
                          transition: reduce ? "none" : "background-color 150ms ease-out",
                        }}
                        onMouseEnter={() => setPointer({ d: d.id, s: s.id })}
                      >
                        <button
                          type="button"
                          ref={(el) => {
                            cells.current.set(key(d.id, s.id), el);
                          }}
                          tabIndex={isRover ? 0 : -1}
                          aria-pressed={pinned?.d === d.id && pinned?.s === s.id}
                          onFocus={() => setFocused({ d: d.id, s: s.id })}
                          onBlur={() => setFocused(null)}
                          onKeyDown={(e) => onKeyDown(e, di, si)}
                          onClick={() =>
                            setPinned((p) => (p && p.d === d.id && p.s === s.id ? null : { d: d.id, s: s.id }))
                          }
                          className="flex w-full items-center justify-center py-1.5"
                          style={{ cursor: "pointer" }}
                        >
                          <DensityGlyph
                            weight={w}
                            dim={dimmed(d.id, s.id)}
                            active={!!isActive}
                            reduce={reduce}
                          />
                          <span className="sr-only">
                            {`${d.id} ${d.shortName}, situation ${s.number} ${s.name}: weight ${w}, ${weightLegend[w].label}. ${weightLegend[w].meaning}`}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* the read-out: names what is highlighted, and the reading note when the
          situation has one. Reserved height so the table never jumps. */}
      <p
        role="status"
        aria-live="polite"
        className="mt-4 min-h-[3.4rem] text-[15.5px] leading-[1.5]"
        style={{ color: "var(--color-ink-2)", textWrap: "pretty" }}
      >
        {readout}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- mobile */

type SliceMode = "situation" | "dimension";

function Chips({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { id: string; head: string; sub: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const refs = useRef(new Map<string, HTMLDivElement | null>());
  const railRef = useRef<HTMLDivElement>(null);

  /* scroll the chip rail only. scrollIntoView would be allowed to move the
     page vertically as well, which is the wrong thing to do to a reader who
     is only stepping sideways through a list. */
  const keepVisible = useCallback((el: HTMLDivElement | null | undefined) => {
    const rail = railRef.current;
    if (!el || !rail) return;
    const left = el.offsetLeft - 20;
    const right = el.offsetLeft + el.offsetWidth + 20 - rail.clientWidth;
    if (left < rail.scrollLeft) rail.scrollLeft = left;
    else if (right > rail.scrollLeft) rail.scrollLeft = right;
  }, []);

  /* keep the selected chip on screen when the slice is switched */
  useEffect(() => {
    keepVisible(refs.current.get(selected));
  }, [selected, keepVisible]);

  const step = (delta: number) => {
    const i = options.findIndex((o) => o.id === selected);
    const next = options[Math.max(0, Math.min(options.length - 1, i + delta))];
    if (!next) return;
    onSelect(next.id);
    const el = refs.current.get(next.id);
    el?.focus({ preventScroll: true });
    keepVisible(el);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowRight": case "ArrowDown": e.preventDefault(); step(1); break;
      case "ArrowLeft": case "ArrowUp": e.preventDefault(); step(-1); break;
      case "Home": e.preventDefault(); step(-options.length); break;
      case "End": e.preventDefault(); step(options.length); break;
      default: break;
    }
  };

  return (
    <div
      role="listbox"
      aria-label={label}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      ref={railRef}
      className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1"
      style={{ scrollbarWidth: "thin" }}
    >
      {options.map((o) => {
        const on = o.id === selected;
        return (
          <div
            key={o.id}
            role="option"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            ref={(el) => {
              refs.current.set(o.id, el);
            }}
            onClick={() => onSelect(o.id)}
            className="hov hov-bc flex-none cursor-pointer rounded-[10px] px-3 py-2"
            style={{
              background: on ? "var(--color-accent-soft)" : "var(--color-surface)",
              border: `1px solid ${on ? "var(--color-accent-line)" : "var(--color-line)"}`,
              ["--hv-bc" as string]: "var(--color-accent-line)",
            }}
          >
            <span
              className="mono num block text-[11.5px]"
              style={{ color: on ? "var(--color-accent-ink)" : "var(--color-muted)" }}
            >
              {o.head}
            </span>
            <span
              className="block whitespace-nowrap text-[14px] font-semibold"
              style={{ color: on ? "var(--color-accent-ink)" : "var(--color-ink-2)" }}
            >
              {o.sub}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MatrixSlices() {
  const [mode, setMode] = useState<SliceMode>("situation");
  const [sit, setSit] = useState<SituationId>("S01");
  const [dim, setDim] = useState<DimensionId>("D1");

  /* Both slices read the same `weights` object, so the small screen view
     cannot drift from the table. Neither slice totals anything. */
  const items: BarItem[] = useMemo(() => {
    if (mode === "situation") {
      return dimensions
        .map((d) => ({ label: d.shortName, n: weights[d.id][sit] as number, tone: "accent" as const }))
        .sort((a, b) => b.n - a.n);
    }
    return situations
      .map((s) => ({ label: `${s.number} ${s.shortLabel}`, n: weights[dim][s.id] as number, tone: "accent" as const }))
      .sort((a, b) => b.n - a.n);
  }, [mode, sit, dim]);

  const s = situationsById[sit];
  const d = dimensionsById[dim];
  const note = noteFor(sit);

  const tabId = (m: SliceMode) => `wm-tab-${m}`;

  return (
    <div>
      {/* segmented control */}
      <div
        role="tablist"
        aria-label="How to slice the weights"
        className="inline-flex rounded-full p-1"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}
      >
        {(["situation", "dimension"] as SliceMode[]).map((m) => {
          const on = mode === m;
          return (
            <button
              key={m}
              id={tabId(m)}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls="wm-slice-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setMode(m)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  setMode(m === "situation" ? "dimension" : "situation");
                }
              }}
              className="hov rounded-full px-4 py-2 text-[15px]"
              style={{
                background: on ? "var(--color-accent)" : "transparent",
                color: on ? "#fff" : "var(--color-muted)",
                fontWeight: on ? 600 : 400,
              }}
            >
              {m === "situation" ? "By situation" : "By dimension"}
            </button>
          );
        })}
      </div>

      <div
        id="wm-slice-panel"
        role="tabpanel"
        aria-labelledby={tabId(mode)}
        tabIndex={-1}
        className="mt-4"
      >
        {mode === "situation" ? (
          <>
            <Chips
              label="Situations"
              selected={sit}
              onSelect={(id) => setSit(id as SituationId)}
              options={situations.map((x) => ({ id: x.id, head: x.number, sub: x.shortLabel }))}
            />
            <p className="mt-4 text-[16.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
              {s.name}
            </p>
            <p className="mt-1 text-[15px]" style={{ color: "var(--color-muted)" }}>
              {TIER_LABEL[s.tier]} situation. What the eight dimensions are worth
              when you are writing this text, heaviest first.
            </p>
            {note ? (
              <p className="mt-2 text-[15px]" style={{ color: "var(--color-muted)", textWrap: "pretty" }}>
                {note}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <Chips
              label="Dimensions"
              selected={dim}
              onSelect={(id) => setDim(id as DimensionId)}
              options={dimensions.map((x) => ({ id: x.id, head: x.id, sub: x.shortName }))}
            />
            <p className="mt-4 text-[16.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
              {d.name}
            </p>
            <p className="mt-1 text-[15px]" style={{ color: "var(--color-muted)", textWrap: "pretty" }}>
              {d.question}
            </p>
          </>
        )}

        <div
          className="mt-5 rounded-[14px] p-4"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
          aria-label={
            mode === "situation"
              ? `Dimension weights for situation ${s.number}, ${s.name}`
              : `Situation weights for dimension ${d.id}, ${d.name}`
          }
        >
          <BarList items={items} format={(n) => weightWord(n as Weight)} />
        </div>

        <p className="mt-3 text-[14px]" style={{ color: "var(--color-muted)", textWrap: "pretty" }}>
          {weightsMatrix.sliceNote(mode === "situation" ? "situation" : "dimension")}
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- legend */

function Legend() {
  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-3">
      {LEGEND_ORDER.map((w) => {
        const l = weightLegend[w];
        return (
          <li
            key={w}
            className="rounded-[14px] p-4"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
          >
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="num inline-flex items-center justify-center font-semibold"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: FILL[w],
                  color: GLYPH_INK[w],
                  fontSize: 12.5,
                  border: w === 1 ? "1px solid var(--color-accent-line)" : "1px solid transparent",
                }}
              >
                {w}
              </span>
              <span className="text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>
                {l.label}
              </span>
            </span>
            <p className="mt-2.5 text-[15px] leading-[1.5]" style={{ color: "var(--color-ink-2)", textWrap: "pretty" }}>
              {l.meaning}
            </p>
            {/* the rubric's stronger claim: 3 is about consequence, not rank */}
            {l.contrast ? (
              <p
                className="mt-2.5 border-t pt-2.5 text-[14px] leading-[1.5]"
                style={{ borderColor: "var(--color-line)", color: "var(--color-accent-ink)", textWrap: "pretty" }}
              >
                {l.contrast}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/* ----------------------------------------------------------------- root */

export function WeightsMatrix({
  heading = "What weighs what, and where",
  lede = "The same eight dimensions apply everywhere, but they do not carry the same weight everywhere. The picture is the point: read a row across and you see which dimensions almost never let go, read a column down and you see what a single genre demands.",
  kicker = "Rubric v0.1 · Weights",
}: {
  heading?: string;
  lede?: string;
  kicker?: string;
} = {}) {
  const reduce = useReducedMotion() ?? false;

  return (
    <section id="weights" className="pb-20 md:pb-28">
      <div className="wrap-wide">
        {/* the full matrix: 768px and up, page level sticky head at 1024 and up
            where the table no longer needs its own horizontal scroll */}
        <Reveal delay={0.06}>
          <div className="hidden md:block">
            <MatrixTable reduce={reduce} />
          </div>
        </Reveal>

        {/* under 768px: two one dimensional slices of the same object, never a
            transposed table and never a sideways scrolling grid */}
        <Reveal delay={0.06}>
          <div className="mt-8 md:hidden">
            <MatrixSlices />
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <Legend />
        </Reveal>
      </div>
    </section>
  );
}

export default WeightsMatrix;
