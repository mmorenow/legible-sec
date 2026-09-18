"use client";

import { Globe, Scales, Browser, Check } from "@phosphor-icons/react";
import { integritySection } from "@/content/system";
import { agentsStrip } from "@/content/copy/library";
import { Reveal } from "./primitives";

/* AgentsStrip (v3 relight, §5.8) : how the corpus was built. Three white
   plates (harvest / curate / verify), each a
   wash-tinted mini-scene + title + two lines + one stat, closing on the
   one-line integrity receipt. */

const INK_2 = "var(--color-ink-2)";
const MUTED = "var(--color-muted)";
const LINE = "var(--color-line)";
const COBALT = "var(--color-accent)";

const TILE_WASH: Record<string, { bg: string; border: string }> = {
  harvest: { bg: "var(--color-tech-soft)", border: "var(--color-tech-line)" },
  curate: { bg: "var(--color-accent-soft)", border: "var(--color-accent-line)" },
  verify: { bg: "var(--color-ok-soft)", border: "color-mix(in oklch, var(--color-ok) 45%, transparent)" },
};

function HarvestMotif() {
  return (
    <div className="flex h-full items-center justify-center gap-3">
      <Globe size={30} weight="duotone" style={{ color: MUTED }} />
      <div className="h-px w-6" style={{ background: LINE }} />
      <div className="flex flex-col gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-2.5 w-9 rounded-sm" style={{ background: "color-mix(in oklch, var(--color-accent) 30%, transparent)" }} />
        ))}
      </div>
    </div>
  );
}

function CurateMotif() {
  return (
    <div className="flex h-full items-center justify-center gap-3">
      <div className="grid grid-cols-2 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex h-5 w-5 items-center justify-center rounded-sm" style={{ border: `1px solid ${LINE}`, background: "var(--color-surface)" }}>
            <Check size={11} weight="bold" style={{ color: "var(--color-ok)" }} />
          </div>
        ))}
      </div>
      <div className="h-px w-5" style={{ background: LINE }} />
      <Scales size={26} weight="duotone" style={{ color: COBALT }} />
    </div>
  );
}

function VerifyMotif() {
  return (
    <div className="flex h-full items-center justify-center gap-3">
      <Browser size={30} weight="duotone" style={{ color: MUTED }} />
      <div className="flex flex-col gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-1">
            <Check size={10} weight="bold" style={{ color: "var(--color-ok)" }} />
            <div className="h-1.5 w-8 rounded-full" style={{ background: "color-mix(in oklch, var(--color-ok) 40%, transparent)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

const MOTIFS: Record<string, () => React.ReactElement> = {
  harvest: HarvestMotif,
  curate: CurateMotif,
  verify: VerifyMotif,
};

export function AgentsStrip() {
  return (
    <div>
      <Reveal>
        <h2 className="h2 max-w-[22ch]" style={{ color: "var(--color-ink)" }}>
          {agentsStrip.heading}
        </h2>
        <p className="lede mt-4 max-w-[70ch]">
          {agentsStrip.ledeIntro} {integritySection.lede}
        </p>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="plate mt-14 overflow-hidden p-0">
          <div className="grid divide-y divide-[var(--color-line)] md:grid-cols-3 md:divide-x md:divide-y-0">
            {integritySection.scenes.map((s) => {
              const wash = TILE_WASH[s.key] ?? { bg: "var(--color-surface-2)", border: "var(--color-line)" };
              const Motif = MOTIFS[s.key];
              return (
                <div
                  key={s.key}
                  className="flex h-full flex-col p-6 md:p-7"
                  style={{ borderColor: "var(--color-line)" }}
                >
                  <div
                    className="mb-5 flex items-center justify-center rounded-[10px] overflow-hidden"
                    style={{ background: wash.bg, border: `1px solid ${wash.border}`, height: 108 }}
                  >
                    {Motif ? <Motif /> : null}
                  </div>
                  <h3 className="text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-snug" style={{ color: INK_2 }}>
                    {s.body}
                  </p>
                  <p className="num mono mt-auto pt-4 text-[12px]" style={{ color: "var(--color-accent-ink)" }}>
                    {s.stat}
                  </p>
                </div>
              );
            })}
          </div>
          <p
            className="mono px-6 py-4 text-[12px] leading-relaxed md:px-7"
            style={{ color: "var(--color-muted)", borderTop: "1px solid var(--color-line)", background: "var(--color-bg-2)" }}
          >
            {integritySection.closingLine}
          </p>
        </div>
      </Reveal>
    </div>
  );
}
