"use client";

import { ArrowUpRight } from "@phosphor-icons/react";
import { goDeeper as G } from "@/content/system";
import { Reveal } from "./primitives";

/* GoDeeper (v3 §4.6): one wide door + two slim doors routing off the home to
   the deep pages. White plates, hover lifts, no dark surfaces. */

function Door({ href, title, note, wide = false, bleed = false, children }: { href: string; title: string; note?: string; wide?: boolean; bleed?: boolean; children?: React.ReactNode }) {
  return (
    <a
      href={href}
      className="group hov hov-lift hov-bc relative flex flex-col justify-between overflow-hidden rounded-[16px] border p-6"
      style={{ borderColor: "var(--color-line)", background: "var(--color-surface)", boxShadow: "var(--shadow-plate)", minHeight: wide ? 200 : 92, ["--hv-bc" as string]: "var(--color-accent-line)" }}
    >
      {bleed && (
        <img
          src="/img/v3/corpus-shelf.webp" alt="" width={1536} height={1024} loading="lazy"
          className="pointer-events-none absolute inset-y-0 right-0 h-full"
          style={{ width: "42%", objectFit: "cover", objectPosition: "left", opacity: 0.5, WebkitMaskImage: "linear-gradient(to right, transparent, black 60%)", maskImage: "linear-gradient(to right, transparent, black 60%)" }}
        />
      )}
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <h3 className={`font-semibold ${wide ? "text-[19px]" : "text-[15px]"}`} style={{ color: "var(--color-ink)", maxWidth: wide ? "16ch" : undefined }}>{title}</h3>
          <ArrowUpRight size={16} weight="bold" style={{ color: "var(--color-muted)" }} />
        </div>
        {children}
      </div>
      {note ? <p className="mono relative mt-3 text-[11px]" style={{ color: "var(--color-muted)" }}>{note}</p> : null}
    </a>
  );
}

export function GoDeeper() {
  return (
    <Reveal>
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Door href={G.wide.href} title={G.wide.title} wide bleed>
          <p className="relative mt-2 max-w-[34ch] text-[13.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>{G.wide.line}</p>
        </Door>
        <div className="grid gap-4">
          {G.slim.map((s) => (
            <Door key={s.href} href={s.href} title={s.title} note={s.note} />
          ))}
        </div>
      </div>
    </Reveal>
  );
}
