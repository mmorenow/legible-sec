"use client";

import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react";
import { modelAccess as M } from "@/content/system";
import { Reveal } from "./primitives";

/* ModelRunIt (MODEL-05/06, v4.1 de-carded): the page's closing beat.
   No card around the section. The quickstart sits loose: only the code
   block keeps its surface-2 fill, because the code IS the object. Then two
   large loose door-lines carry the visitor onward off the page (try first),
   and a single quiet mono line states that the weights are not published. */

export function ModelRunIt() {
  return (
    <div>
      {/* run it locally - loose; only the code block is a surface */}
      <Reveal>
        <p className="mono text-[12px]" style={{ color: "var(--color-muted)" }}>{M.runIt.label}</p>
        <p className="mt-4 max-w-[52ch] text-[14px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
          {M.runIt.lede}
        </p>
        <div
          className="mono mt-5 flex max-w-[640px] flex-col gap-2 rounded-[10px] p-4 text-[12px] leading-relaxed"
          style={{ background: "var(--color-surface-2)", color: "var(--color-ink-2)" }}
        >
          {M.runIt.quickstart.map((c) => (
            <span key={c}>$ {c}</span>
          ))}
        </div>
      </Reveal>

      {/* the doors onward: two large loose door-lines, hairline above each */}
      <div className="mt-12 md:mt-16">
        {M.doors.map((d) => (
          <Reveal key={d.href}>
            <Link
              href={d.href}
              className="hov hov-fg group flex items-center justify-between gap-6 py-7 md:py-8"
              style={{ borderTop: "1px solid var(--color-line-2)", color: "var(--color-ink)", ["--hv-fg" as string]: "var(--color-accent-ink)" }}
            >
              <span className="text-[clamp(20px,2.4vw,24px)] font-semibold tracking-[-0.02em]">{d.label}</span>
              <ArrowUpRight
                size={22}
                weight="bold"
                className="flex-none transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                style={{ color: "var(--color-muted)" }}
              />
            </Link>
          </Reveal>
        ))}
      </div>

      {/* quiet weights line - plain text, not a link: nothing is published on
          Hugging Face, and meta.access.huggingface is still a placeholder */}
      <Reveal>
        <p className="mono mt-8 inline-block text-[12px]" style={{ color: "var(--color-muted)" }}>
          {M.hfNote}
        </p>
      </Reveal>
    </div>
  );
}
