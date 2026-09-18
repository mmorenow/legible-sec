"use client";

import { useState, type CSSProperties } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { GateSweep } from "./gate";
import { WorldLabel } from "./seam";

/* The evidence surface: ONE visual grammar for "a real pair, on the record",
   shared by Translate's evidence band and the Precedents ledger (and any
   future Review citation). A row is a pair: the technical world (mono) and
   the executive world (sans) joined at the pair glyph, a two-tone rust→cobalt
   mark that fills while the row is open. In the wide "ledger" variant the two
   worlds straddle the SEAM itself: one continuous rust|cobalt filament runs
   the full height of the ledger and every pair sits on it as a node, because
   every real pair IS a crossing that already happened. */

export const REGISTERS = [
  "technical_leadership",
  "practitioner",
  "management",
  "customer",
  "regulatory",
  "public",
] as const;
export type RegisterKey = (typeof REGISTERS)[number];

/* tryDemo.json predates the register schema; map its legacy audience keys
   onto the registers the dataset actually uses. A key that is already a
   register passes through. */
const LEGACY_AUDIENCE: Record<string, RegisterKey> = {
  board: "management",
  executive: "technical_leadership",
  customer: "customer",
  regulator: "regulatory",
  developer: "practitioner",
};

export function toRegister(key: string): RegisterKey | null {
  if ((REGISTERS as readonly string[]).includes(key)) return key as RegisterKey;
  return LEGACY_AUDIENCE[key] ?? null;
}

export type EvidenceItem = {
  id: string;
  org: string;
  year?: string | null;
  severity?: string | null;
  /** a register key (or raw retrieval filter) shown verbatim as register=… */
  register?: string | null;
  tech: string;
  exec: string;
  url?: string | null;
};

/* The pair glyph: both worlds as one mark. Hollow when closed, filled
   rust→cobalt when the pair is open. */
export function PairGlyph({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block h-[7px] w-[7px] shrink-0 self-center rounded-full"
      style={
        on
          ? { background: "linear-gradient(90deg, var(--color-tech), var(--color-accent))" }
          : { border: "1px solid var(--color-line-2)" }
      }
    />
  );
}

const clamp = (lines: number): CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

/* Shown only while the two halves are stacked, which is exactly when the column
   header above them has gone. A dot in the world's own colour plus four words,
   because at 390px the space is worth more than a second copy of the word
   "technical". */
function StackedLabel({ world, text }: { world: "tech" | "legible"; text: string }) {
  const tech = world === "tech";
  return (
    <span
      className="mono mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] md:hidden"
      style={{ color: "var(--color-muted)" }}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: tech ? "var(--color-tech)" : "var(--color-accent)" }}
      />
      {text}
    </span>
  );
}

function EvidenceRowView({
  item,
  ledger,
  first,
  open,
  onToggle,
}: {
  item: EvidenceItem;
  ledger: boolean;
  first: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const facts = [item.year, item.severity ? `severity: ${item.severity}` : null].filter(Boolean).join(" · ");
  return (
    <div className="relative" style={{ borderTop: ledger || !first ? "1px solid var(--color-line)" : undefined }}>
      {/* ledger: this pair's node on the seam. Hollow until opened; opening
          fills it rust→cobalt (the crossing, acknowledged). */}
      {ledger ? (
        <span
          aria-hidden
          className="absolute left-1/2 top-[17px] z-[1] hidden h-[9px] w-[9px] -translate-x-1/2 rounded-full md:block"
          style={
            open
              ? { background: "linear-gradient(90deg, var(--color-tech), var(--color-accent))" }
              : { background: "var(--color-bg)", border: "1px solid var(--color-line-2)" }
          }
        />
      ) : null}
      {/* the record line: who, when, how bad, which register, where. Lives
          outside the expand button so the source link stays real HTML. */}
      <div className="mono flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-3 text-[10.5px]" style={{ color: "var(--color-muted)" }}>
        <span className="inline-flex items-center gap-2">
          <span className={ledger ? "inline-flex md:hidden" : "inline-flex"}>
            <PairGlyph on={open} />
          </span>
          <span className="text-[11.5px] font-medium" style={{ color: "var(--color-ink)" }}>
            {item.org}
          </span>
        </span>
        {facts ? <span>{facts}</span> : null}
        <span className="ml-auto inline-flex items-baseline gap-x-3">
          {item.register ? <span>register={item.register}</span> : null}
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener"
              className="hov-c hov-fg inline-flex items-center gap-0.5"
              style={{ color: "var(--color-accent-ink)", ["--hv-fg" as string]: "var(--color-ink)" }}
            >
              source <ArrowUpRight size={10} weight="bold" />
            </a>
          ) : null}
        </span>
      </div>

      {/* the pair itself: click or ↵ toggles the full excerpt */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`hov hov-bg relative -mx-2 mt-1 w-[calc(100%+16px)] overflow-hidden rounded-[8px] px-2 pb-3.5 pt-1.5 text-left ${
          ledger ? "grid items-start gap-y-2 md:grid-cols-2 md:gap-x-12" : "flex flex-col gap-1.5"
        }`}
        style={{
          background: open ? "color-mix(in oklch, var(--color-accent) 3%, transparent)" : "transparent",
          ["--hv-bg" as string]: "color-mix(in oklch, var(--color-accent) 4.5%, transparent)",
        }}
      >
        {open ? <GateSweep playKey={item.id} height={ledger ? 180 : 120} /> : null}
        {/* `overflow-wrap: anywhere`, and it is not cosmetic. The parent button
            is overflow-hidden, so an unbreakable token does not scroll the page,
            it gets swallowed: measured on /library at 390px, 4 of 8 result cards
            lost 50 to 64px of finding text off the right edge with no ellipsis
            and no way to reach it. The index holds 979 tokens longer than 55
            characters, the longest 308: markdown table rules, GitHub raw URLs,
            oversight.gov paths. On a project whose claim is that the text is
            verbatim, silently eating the end of it is the worst option
            available; an ugly wrap is the right one. */}
        <div className="min-w-0">
          {ledger ? <StackedLabel world="tech" text="the finding said this" /> : null}
          <p
            className={`mono whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere] ${ledger ? "text-[11.5px]" : "text-[11px]"}`}
            style={{ color: "var(--color-ink-2)", ...(open ? {} : clamp(ledger ? 3 : 2)) }}
          >
            {item.tech}
          </p>
        </div>
        <div className="min-w-0">
          {ledger ? <StackedLabel world="legible" text="so they wrote this" /> : null}
          <p
            className={`leading-relaxed [overflow-wrap:anywhere] ${ledger ? "text-[13.5px]" : "text-[12.5px]"}`}
            style={{ color: "var(--color-ink)", ...(open ? {} : clamp(ledger ? 3 : 2)) }}
          >
            {item.exec}
          </p>
        </div>
      </button>
    </div>
  );
}

export function EvidenceLedger({
  items,
  variant = "ledger",
}: {
  items: EvidenceItem[];
  /** ledger: the two worlds across the crossing; panel: compact stack for a result column */
  variant?: "ledger" | "panel";
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const ledger = variant === "ledger";
  return (
    <div>
      {/* A column header, so it belongs to the columns and goes away with them.
          What replaced it below md is a per paragraph label inside each row,
          because a stacked header names nothing: see EvidenceRowView. */}
      {ledger ? (
        <div className="hidden pb-3 md:grid md:grid-cols-2 md:gap-x-12">
          <WorldLabel world="tech" title="technical" sub="the finding said this" />
          <WorldLabel world="legible" title="legible" sub="so they wrote this" />
        </div>
      ) : null}
      <div className="relative flex flex-col">
        {ledger ? <span aria-hidden className="ledger-seam hidden md:block" /> : null}
        {items.map((it, i) => (
          <EvidenceRowView
            key={it.id}
            item={it}
            ledger={ledger}
            first={i === 0}
            open={openId === it.id}
            onToggle={() => setOpenId(openId === it.id ? null : it.id)}
          />
        ))}
      </div>
    </div>
  );
}
