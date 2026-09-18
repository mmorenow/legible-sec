"use client";

import { Check, Warning, Minus, User } from "@phosphor-icons/react";
import { TONE_INK, TONE_SOFT } from "@/components/try/gate";
import { layerOrder, layers, measurementContract, type LayerId } from "@/content/rubric";
import { contractSection } from "@/content/copy/rubric";

/* The measurement contract, as four rungs.
 *
 * The chip is the checker's chip: same mono face, same radius, same padding,
 * same tone tokens out of `try/gate.tsx`, because the rubric and the checker are
 * the same object seen twice. An L0 chip here has to be the L0 chip there.
 *
 * Tone is assigned by what the layer may CONCLUDE, which is the one thing the
 * contract is about:
 *   L0 concludes a fact, so it carries the tone the checker gives a settled
 *      verdict.
 *   L1 reports a score, never a verdict, so it carries the advisory tone.
 *   L2 is an opinion marked as an opinion. It gets the checker's idle
 *      treatment: present, legible, and holding no verdict.
 *   H  concludes nothing automatic at all, so it gets the idle treatment with
 *      a dashed edge: the rung exists and nothing runs on it.
 * Colour drains as the ladder climbs away from certainty. That is the argument.
 */

type Rung = {
  chipInk: string;
  chipSoft: string;
  border: string;
  icon: React.ComponentType<{ size?: number; weight?: "bold"; "aria-hidden"?: boolean }>;
  /** Filled segments out of three, matching what the layer may conclude. */
  authority: number;
};

const RUNGS: Record<LayerId, Rung> = {
  L0: { chipInk: TONE_INK.pass, chipSoft: TONE_SOFT.pass, border: "transparent", icon: Check, authority: 3 },
  L1: { chipInk: TONE_INK.warn, chipSoft: TONE_SOFT.warn, border: "transparent", icon: Warning, authority: 2 },
  L2: { chipInk: "var(--color-muted)", chipSoft: "var(--color-surface-2)", border: "transparent", icon: Minus, authority: 1 },
  H: { chipInk: "var(--color-muted)", chipSoft: "transparent", border: "var(--color-line-2)", icon: User, authority: 0 },
};

function AuthorityMeter({ filled, ink }: { filled: number; ink: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-[3px] w-4 rounded-full"
          style={{ background: i < filled ? ink : "var(--color-line)" }}
        />
      ))}
    </span>
  );
}

function LayerChip({ id }: { id: LayerId }) {
  const rung = RUNGS[id];
  const Icon = rung.icon;
  return (
    <span
      className="mono inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px]"
      style={{
        color: rung.chipInk,
        background: rung.chipSoft,
        border: rung.border === "transparent" ? "1px solid transparent" : `1px dashed ${rung.border}`,
      }}
    >
      <Icon size={13} weight="bold" aria-hidden />
      {id}
    </span>
  );
}

function Field({
  label,
  value,
  hideLabelOnDesktop = false,
}: {
  label: string;
  value: string;
  hideLabelOnDesktop?: boolean;
}) {
  return (
    <div>
      <dt
        className={`mono text-[12px] uppercase tracking-[0.13em] ${hideLabelOnDesktop ? "md:sr-only" : ""}`}
        style={{ color: "var(--color-muted)" }}
      >
        {label}
      </dt>
      <dd className="mt-1.5 md:mt-0 text-[15.5px] leading-[1.6]" style={{ color: "var(--color-ink-2)" }}>
        {value}
      </dd>
    </div>
  );
}

export function MeasurementLadder() {
  return (
    <div>
      <div
        className="rounded-[14px] border p-5 sm:p-6"
        style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
      >
        <p className="mono text-[12.5px] uppercase tracking-[0.14em]" style={{ color: "var(--color-accent-ink)" }}>
          {measurementContract.name} · {measurementContract.subtitle}
        </p>
        <p className="mt-3 text-[17px] leading-[1.6]" style={{ color: "var(--color-ink)" }}>
          {measurementContract.escalation}
        </p>
      </div>

      {/* The three column labels used to repeat on every rung: twelve labels for
          three columns. They are stated once here and the rows carry only values. */}
      <div
        className="mt-9 hidden grid-cols-[auto_minmax(0,1fr)] gap-x-4 pb-2 sm:gap-x-6 md:grid"
        style={{ borderBottom: "1px solid var(--color-line)" }}
      >
        <span aria-hidden className="w-[46px]" />
        <dl className="grid gap-4 sm:gap-x-8 md:grid-cols-3">
          {[contractSection.columns.definition, contractSection.columns.mayConclude, contractSection.columns.evidenceRule].map(
            (label) => (
              <dt key={label} className="mono text-[12px] uppercase tracking-[0.13em]" style={{ color: "var(--color-muted)" }}>
                {label}
              </dt>
            ),
          )}
        </dl>
      </div>

      <ol className="mt-5">
        {layerOrder.map((id, i) => {
          const layer = layers[id];
          const rung = RUNGS[id];
          const last = i === layerOrder.length - 1;
          return (
            <li key={id} className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 sm:gap-x-6">
              {/* the ladder rail: a hairline between one rung and the next */}
              <div className="flex flex-col items-center">
                <LayerChip id={id} />
                {!last ? (
                  <span
                    aria-hidden
                    className="mt-1.5 w-px flex-1"
                    style={{ background: "var(--color-line)" }}
                  />
                ) : null}
              </div>

              <div className={last ? "pb-1" : "pb-9"}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-[16px] font-semibold tracking-[-0.012em]" style={{ color: "var(--color-ink)" }}>
                    {layer.name}
                  </h3>
                  <span className="flex items-center gap-2">
                    <AuthorityMeter filled={rung.authority} ink={rung.chipInk} />
                    <span className="mono text-[12px] uppercase tracking-[0.13em]" style={{ color: "var(--color-muted)" }}>
                      {contractSection.authorityLabel}
                    </span>
                  </span>
                </div>
                <dl className="mt-3.5 grid gap-4 sm:gap-x-8 md:grid-cols-3">
                  <Field label={contractSection.columns.definition} value={layer.definition} hideLabelOnDesktop />
                  <Field label={contractSection.columns.mayConclude} value={layer.mayConclude} hideLabelOnDesktop />
                  <Field label={contractSection.columns.evidenceRule} value={layer.evidenceRule} hideLabelOnDesktop />
                </dl>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-2 text-[14px]" style={{ color: "var(--color-muted)" }}>
        {contractSection.authorityNote}
      </p>
    </div>
  );
}
