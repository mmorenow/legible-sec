"use client";

import { useState } from "react";
import { dimensions, layers, type Dimension, type LayerId } from "@/content/rubric";
import { dimensionsSection as copy } from "@/content/copy/rubric";
import { DimensionIcon } from "./DimensionIcons";
import { Reveal } from "../primitives";

/* The eight dimensions as a grid of tiles.
 *
 * The first version gave each dimension a full width card carrying its question,
 * every check, the scale and the required evidence. Eight of those is a page of
 * its own, and the reader could not see the set. A tile shows what a dimension
 * IS: its mark, its name, the question it asks, and the checks that decide it.
 * What each check demands arrives on hover, in a reserved strip at the foot of
 * the tile, so the grid never reflows while it is being read.
 */

const LAYER_STYLE: Record<LayerId, { ink: string; bg: string }> = {
  L0: { ink: "var(--color-ok-ink)", bg: "var(--color-ok-soft)" },
  L1: { ink: "var(--color-warn-ink)", bg: "var(--color-warn-soft)" },
  L2: { ink: "var(--color-accent-ink)", bg: "var(--color-accent-soft)" },
  H: { ink: "var(--color-muted)", bg: "var(--color-surface-2)" },
};

function Tile({ d }: { d: Dimension }) {
  const [active, setActive] = useState<string | null>(null);
  const check = d.checks.find((c) => c.id === active) ?? null;
  const isF = d.axes.includes("F");
  const ink = isF ? "var(--color-tech-ink)" : "var(--color-accent-ink)";
  const soft = isF ? "var(--color-tech-soft)" : "var(--color-accent-soft)";

  return (
    <div
      className="flex h-full flex-col items-center rounded-[14px] border p-6 text-center"
      style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
    >
      {/* the mark leads the tile and is the reason a reader can find a dimension
          without reading eight headings, so it gets the room to be an engraving
          rather than a glyph */}
      <span
        className="flex h-[152px] w-[152px] flex-none items-center justify-center rounded-[16px]"
        style={{ background: soft }}
      >
        <DimensionIcon id={d.id} size={128} />
      </span>

      <span className="mt-4 flex items-center gap-2">
        <span className="mono num text-[12px]" style={{ color: "var(--color-muted)" }}>
          {String(d.number).padStart(2, "0")}
        </span>
        {d.bidirectional ? (
          <span
            className="mono cursor-help text-[11px]"
            style={{ color: ink }}
            title={`${copy.bidirectionalGlyphLabel}. ${copy.bidirectionalNote}`}
          >
            {"\u2195"}
            <span className="sr-only">{copy.bidirectionalGlyphLabel}</span>
          </span>
        ) : null}
      </span>

      <h3
        className="mt-1.5 text-[17.5px] font-semibold tracking-[-0.015em]"
        style={{ color: "var(--color-ink)" }}
      >
        {d.name}
      </h3>
      <p className="mt-2.5 grow text-[14.5px] leading-[1.55]" style={{ color: "var(--color-ink-2)" }}>
        {d.question}
      </p>

      {/* the checks: hovering one says what it demands, in the strip below */}
      <div className="mt-5 flex flex-wrap justify-center gap-1.5">
        {d.checks.map((c) => (
          <button
            key={c.id}
            type="button"
            className="mono flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] transition-colors"
            style={{
              color: active === c.id ? "var(--color-ink)" : "var(--color-muted)",
              background: active === c.id ? "var(--color-surface-2)" : "transparent",
              border: `1px solid ${active === c.id ? "var(--color-line-2)" : "var(--color-line)"}`,
            }}
            onMouseEnter={() => setActive(c.id)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(c.id)}
            onBlur={() => setActive(null)}
            aria-describedby={`${d.id}-demand`}
          >
            {c.id}
            {c.layers.map((l) => (
              <span
                key={l}
                className="rounded px-1 text-[10.5px]"
                style={{ color: LAYER_STYLE[l].ink, background: LAYER_STYLE[l].bg }}
                title={`${layers[l].name}. ${layers[l].mayConclude}`}
              >
                {l}
              </span>
            ))}
          </button>
        ))}
      </div>

      <div
        id={`${d.id}-demand`}
        aria-live="polite"
        className="mt-4 w-full border-t pt-3.5 text-[13.5px] leading-[1.5]"
        style={{ borderColor: "var(--color-line)", color: check ? "var(--color-ink-2)" : "var(--color-muted)", minHeight: 66 }}
      >
        {check ? check.text : copy.hoverHint}
      </div>
    </div>
  );
}

export function DimensionGrid() {
  return (
    <>
      <p className="mt-6 text-[14.5px] leading-[1.6]" style={{ color: "var(--color-muted)" }}>
        {copy.idScheme}
      </p>
      <div className="mt-8 grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dimensions.map((d, i) => (
          <Reveal key={d.id} delay={0.03 * i} className="h-full">
            <Tile d={d} />
          </Reveal>
        ))}
      </div>
    </>
  );
}
