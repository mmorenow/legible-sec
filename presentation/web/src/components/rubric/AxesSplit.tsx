"use client";

import { SplitCanvas } from "@/components/try/seam";
import { axes, axisOrder } from "@/content/rubric";

/* The two axes, staged on the instrument's own split canvas.
 *
 * The bisected canvas is not decoration borrowed for this page. It is the
 * vocabulary /try already uses for "two worlds that must both hold": the
 * technical reality on the left, the legible one on the right, a live filament
 * between them. Fidelity is what the retelling owes the source, so it stands in
 * the technical world. Utility is what it owes the reader, so it stands in the
 * legible one. Putting the axes here means the page inherits the argument
 * instead of inventing a second picture for the same idea.
 *
 * The canvas stays in its `idle` state: nothing is crossing, because this
 * section is a definition and not a run.
 */

/* The axis name is the content of this section, so it is set at display size.
   An earlier version put a headline above the canvas and left Fidelity and
   Utility at label size underneath it, which inverted the hierarchy: the reader
   saw a sentence about the axes before seeing the axes. */
function AxisPanel({ world, id }: { world: "tech" | "legible"; id: "F" | "U" }) {
  const axis = axes[id];
  const ink = world === "tech" ? "var(--color-tech-ink)" : "var(--color-accent-ink)";
  const right = world === "legible";
  return (
    <div className={`mx-auto max-w-[34ch] ${right ? "lg:mr-auto lg:ml-8 lg:text-left" : "lg:ml-auto lg:mr-8 lg:text-right"}`}>
      <p className="mono text-[12.5px] uppercase tracking-[0.14em]" style={{ color: ink }}>
        Axis {axis.id} · {right ? "owed to the reader" : "owed to the source"}
      </p>
      <h3
        className="mt-2 font-semibold"
        style={{
          fontSize: "clamp(1.9rem, 3.4vw, 2.9rem)",
          lineHeight: 1.05,
          letterSpacing: "-0.028em",
          color: ink,
        }}
      >
        {axis.name}
      </h3>
      <p
        className={`mt-4 text-[16px] leading-[1.6] ${right ? "lg:ml-auto" : ""}`}
        style={{ color: "var(--color-ink-2)" }}
      >
        {axis.definition}
      </p>
    </div>
  );
}

export function AxesSplit() {
  return (
    <SplitCanvas
      state="idle"
      left={<AxisPanel world="tech" id={axisOrder[0]} />}
      right={<AxisPanel world="legible" id={axisOrder[1]} />}
    />
  );
}
