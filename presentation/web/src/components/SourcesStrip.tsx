"use client";

import { sourceWordmarks, sourceWordmarksMore } from "@/content/data";
import { sourcesStrip } from "@/content/copy/library";
import { Reveal } from "./primitives";

/* SourcesStrip (v3): a cohesive typographic "sources" band for /dataset. Raw
   firm favicons render as mismatched styles and broken low-res marks, so the
   sources are shown as unified wordmarks: honest, premium, on the light palette.
   These are the organizations whose public reports the corpus draws from. */

export function SourcesStrip() {
  return (
    <section className="wrap-wide py-14 md:py-20">
      <Reveal>
        <div className="rounded-[14px] border px-6 py-8 md:px-10" style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}>
          {/* plain mono label, not a kicker: /dataset is already at its two-kicker budget (DATA-02) */}
          <p className="mono text-center text-[12px]" style={{ color: "var(--color-muted)" }}>
            {sourcesStrip.label}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 md:gap-x-12">
            {sourceWordmarks.map((name) => (
              <span
                key={name}
                className="text-[clamp(15px,1.7vw,20px)] font-semibold tracking-tight transition-colors"
                style={{ color: "var(--color-ink-2)", letterSpacing: "-0.01em" }}
              >
                {name}
              </span>
            ))}
            <span className="mono self-center text-[13px]" style={{ color: "var(--color-muted)" }}>
              {sourceWordmarksMore}
            </span>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
