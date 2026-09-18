"use client";

import type { ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { CircleNotch } from "@phosphor-icons/react";

/* The SEAM: the signature of the /try instrument. Every mode is the same act,
   crossing from the technical world into the legible one, so every mode is
   staged on the same bisected canvas: a living two-tone filament (1px rust
   kissing 1px cobalt) with the technical reality on its left and the legible
   reality on its right. The seam breathes when idle (glint), streams packets
   while the motor thinks, and flashes once when a result crosses. The primary
   action of a mode is mounted ON the membrane. Below 1024px the split rotates:
   worlds stack, the seam runs horizontal, the crossing goes top to bottom.
   All seam choreography is CSS (globals.css), transform/opacity only. */

export type SeamState = "idle" | "loading" | "crossed";

/* Masthead of a world. tech = square glyph, mono, tracked caps (the machine);
   legible = round glyph, grotesk (the human). Pass htmlFor to render it as the
   real <label> of the field it names. */
export function WorldLabel({
  world,
  title,
  sub,
  htmlFor,
}: {
  world: "tech" | "legible";
  title: string;
  sub?: string;
  htmlFor?: string;
}) {
  const cls =
    world === "tech"
      ? "mono flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[11px] uppercase tracking-[0.16em]"
      : "flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[13.5px] font-[640] tracking-[-0.01em]";
  const style = { color: world === "tech" ? "var(--color-tech-ink)" : "var(--color-accent-ink)" };
  const inner = (
    <>
      <span
        aria-hidden
        className={`inline-block h-[7px] w-[7px] shrink-0 self-center ${world === "legible" ? "rounded-full" : ""}`}
        style={{ background: world === "tech" ? "var(--color-tech)" : "var(--color-accent)" }}
      />
      <span>{title}</span>
      {sub ? (
        <span className="mono text-[10.5px] font-normal normal-case tracking-normal" style={{ color: "var(--color-muted)" }}>
          · {sub}
        </span>
      ) : null}
    </>
  );
  return htmlFor ? (
    <label htmlFor={htmlFor} className={cls} style={style}>
      {inner}
    </label>
  ) : (
    <p className={cls} style={style}>
      {inner}
    </p>
  );
}

/* The action on the membrane: one circular trigger per mode, sitting on the
   filament itself. Firing it is firing the crossing. */
export function SeamButton({
  label,
  icon,
  onClick,
  disabled,
  busy,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const live = !disabled;
  return (
    <div className="seam-action">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-busy={busy || undefined}
        aria-label={label}
        className="hov hov-bg inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white active:translate-y-px"
        style={{
          background: live ? "var(--color-accent)" : "var(--color-line-2)",
          boxShadow: live ? "0 10px 24px -10px color-mix(in oklch, var(--color-accent) 60%, transparent)" : "none",
          cursor: live ? "pointer" : "default",
          ["--hv-bg" as string]: live ? "color-mix(in oklch, var(--color-accent) 88%, black)" : "var(--color-line-2)",
        }}
      >
        {busy ? <CircleNotch size={20} weight="bold" className="animate-spin" aria-hidden /> : icon}
      </button>
      <span
        aria-hidden
        className="mono rounded-full px-2 py-0.5 text-[11px] tracking-[0.08em]"
        style={{
          color: live ? "var(--color-accent-ink)" : "var(--color-muted)",
          background: "var(--color-bg)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* The bisected canvas. Full-bleed: the worlds run to the viewport edges and
   their washes concentrate at the seam. `state` drives the membrane: idle
   breathes, loading streams packets, crossed fires the flash (re-keyed by
   crossKey so a fresh result replays it). */
export function SplitCanvas({
  state = "idle",
  crossKey,
  left,
  seam,
  right,
  below,
}: {
  state?: SeamState;
  crossKey?: string | number;
  left: ReactNode;
  seam?: ReactNode;
  right: ReactNode;
  below?: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="try-canvas" data-state={state}>
      <div className="wrap-wide">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)]">
          <div className="pt-7 lg:py-9 lg:pr-8">{left}</div>
          <div className="seam-zone">
            <span className="seam-filament" aria-hidden>
              {!reduce ? <span className="seam-glint" /> : null}
            </span>
            {!reduce && state === "loading" ? (
              <span className="seam-packets" aria-hidden>
                <span className="seam-packet" style={{ top: "30%" }} />
                <span className="seam-packet" style={{ top: "48%", animationDelay: "0.5s" }} />
                <span className="seam-packet" style={{ top: "66%", animationDelay: "1s" }} />
              </span>
            ) : null}
            {!reduce && state === "crossed" && crossKey !== undefined ? (
              <span key={crossKey} className="seam-cross" aria-hidden />
            ) : null}
            {seam}
          </div>
          <div className="pb-8 pt-2 lg:py-9 lg:pl-8">{right}</div>
        </div>
        {below ? <div className="pb-10">{below}</div> : null}
      </div>
    </div>
  );
}
