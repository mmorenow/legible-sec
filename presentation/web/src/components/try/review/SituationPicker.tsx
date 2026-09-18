"use client";

import { useId, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { situations, type SituationId } from "@/content/rubric";
import { authorityFor, genreFor } from "@/content/genres";
import { inputs as copy } from "@/content/copy/review";
import { EASE } from "../gate";

/* The situation picker: the third input, and the one that is not a preference.
   Choosing a situation chooses which checks apply and what each one weighs, so
   the control has to show what the choice just did. It reveals the genre's
   reader and whether a named body publishes a checklist for it, because on a
   genre with no published norm the same check advises instead of ruling
   (genres.ts authorityFor: published = L0, conventional = L2).

   S06 is the only genre where two authorities require opposite things: the ICO
   requires the notice to describe the nature of the breach and M.G.L. c.93H
   prohibits exactly that. So S06, and only S06, asks for a jurisdiction. */

/* COPY GAP: these three labels are proper names of the jurisdictions the S06
   corpus cites (UK GDPR via the ICO, M.G.L. c.93H via Massachusetts OCABR,
   the California Attorney General filing). copy/review.ts carries the
   jurisdiction label and hint but not the options, so they sit here until the
   owner of that file adds them. */
export const JURISDICTIONS = [
  { id: "uk-eu", label: "UK and EU, under GDPR" },
  { id: "massachusetts", label: "Massachusetts" },
  { id: "california", label: "California" },
] as const;

export type JurisdictionId = (typeof JURISDICTIONS)[number]["id"];

/** The one situation whose authorities contradict each other. */
export const JURISDICTION_SITUATION: SituationId = "S06";

/** What the picker emits. Jurisdiction is null on every situation but S06. */
export type SituationChoice = {
  situation: SituationId;
  jurisdiction: JurisdictionId | null;
};

/* COPY GAP: the strip that states what the choice did. Same note as above,
   these belong in copy/review.ts. The conventional line is the sentence
   genreChecks.ts already puts on advisoryNote, said before the run instead of
   after it. */
const strip = {
  readerLabel: "Who reads it",
  published: "A named body publishes a checklist for this genre, so a failed check decides.",
  conventional:
    "No body publishes a checklist for this genre, so the checks advise rather than decide.",
};

export function SituationPicker({
  situation,
  jurisdiction,
  onChange,
  disabled,
}: {
  /** null until the reader has chosen. Nothing is preselected. */
  situation: SituationId | null;
  jurisdiction: JurisdictionId | null;
  onChange: (choice: SituationChoice) => void;
  disabled?: boolean;
}) {
  const reduce = useReducedMotion();
  const uid = useId();
  const labelId = `${uid}-situation-label`;
  const hintId = `${uid}-situation-hint`;
  const jLabelId = `${uid}-jurisdiction-label`;
  const jHintId = `${uid}-jurisdiction-hint`;
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const jTiles = useRef<(HTMLButtonElement | null)[]>([]);

  const genre = situation ? genreFor(situation) : null;
  const authority = genre ? authorityFor(genre.checklistStatus) : null;
  const published = genre?.checklistStatus === "published";
  const asksJurisdiction = situation === JURISDICTION_SITUATION;

  /* Selecting a different situation drops any jurisdiction with it: the answer
     only exists inside S06, so carrying it out would be carrying a stale fact. */
  function pick(id: SituationId) {
    onChange({
      situation: id,
      jurisdiction: id === JURISDICTION_SITUATION ? jurisdiction : null,
    });
  }

  function move(index: number) {
    const next = (index + situations.length) % situations.length;
    pick(situations[next].id);
    tiles.current[next]?.focus();
  }

  function onTileKeyDown(e: React.KeyboardEvent, index: number) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move(index - 1);
        break;
      case "Home":
        e.preventDefault();
        move(0);
        break;
      case "End":
        e.preventDefault();
        move(situations.length - 1);
        break;
      default:
        break;
    }
  }

  function pickJurisdiction(id: JurisdictionId) {
    onChange({ situation: JURISDICTION_SITUATION, jurisdiction: id });
  }

  function moveJurisdiction(index: number) {
    const next = (index + JURISDICTIONS.length) % JURISDICTIONS.length;
    pickJurisdiction(JURISDICTIONS[next].id);
    jTiles.current[next]?.focus();
  }

  function onJurisdictionKeyDown(e: React.KeyboardEvent, index: number) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        moveJurisdiction(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        moveJurisdiction(index - 1);
        break;
      case "Home":
        e.preventDefault();
        moveJurisdiction(0);
        break;
      case "End":
        e.preventDefault();
        moveJurisdiction(JURISDICTIONS.length - 1);
        break;
      default:
        break;
    }
  }

  /* Roving tabindex: one tile in the tab order. With nothing chosen yet the
     first tile holds it, so the group is reachable by keyboard from empty. */
  const roverIndex = situation ? situations.findIndex((s) => s.id === situation) : 0;

  return (
    <section aria-labelledby={labelId}>
      <h3
        id={labelId}
        className="text-[15.5px] font-semibold tracking-[-0.012em]"
        style={{ color: "var(--color-ink)" }}
      >
        {copy.situationLabel}
      </h3>
      <p
        id={hintId}
        className="mt-1.5 max-w-[66ch] text-[13.5px] leading-relaxed"
        style={{ color: "var(--color-ink-2)" }}
      >
        {copy.situationHint}
      </p>

      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
      >
        {situations.map((s, i) => {
          const on = s.id === situation;
          return (
            <button
              key={s.id}
              ref={(el) => {
                tiles.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={i === roverIndex ? 0 : -1}
              disabled={disabled}
              onClick={() => pick(s.id)}
              onKeyDown={(e) => onTileKeyDown(e, i)}
              className="hov hov-bc hov-bg flex flex-col items-start gap-1 rounded-[10px] border px-3 py-2.5 text-left active:translate-y-px"
              style={{
                borderColor: on ? "var(--color-accent)" : "var(--color-line)",
                background: on ? "var(--color-accent-soft)" : "var(--color-surface)",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.55 : 1,
                ["--hv-bc" as string]: on ? "var(--color-accent)" : "var(--color-accent-line)",
                ["--hv-bg" as string]: on ? "var(--color-accent-soft)" : "var(--color-surface-2)",
              }}
            >
              <span
                className="mono num text-[10.5px] tracking-[0.14em]"
                style={{ color: on ? "var(--color-accent-ink)" : "var(--color-muted)" }}
              >
                {s.number}
              </span>
              <span
                className="text-[13.5px] font-[560] leading-snug tracking-[-0.01em]"
                style={{ color: "var(--color-ink)" }}
              >
                {s.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* What the choice just did. Rendered only once there is a choice. */}
      {genre && authority ? (
        <motion.div
          key={genre.id}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="mt-3 rounded-[10px] border p-3.5"
          style={{
            borderColor: published ? "var(--color-line)" : "var(--color-warn-soft)",
            background: "var(--color-surface)",
          }}
        >
          <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span
              className="mono inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] tracking-[0.1em]"
              style={{
                color: published ? "var(--color-accent-ink)" : "var(--color-warn-ink)",
                background: published ? "var(--color-accent-soft)" : "var(--color-warn-soft)",
              }}
            >
              {authority}
            </span>
            <span className="text-[13px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
              {published ? strip.published : strip.conventional}
            </span>
          </p>

          <p className="mono mt-3 text-[10.5px] uppercase tracking-[0.14em]" style={{ color: "var(--color-muted)" }}>
            {strip.readerLabel}
          </p>
          <p className="mt-1 max-w-[74ch] text-[13px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
            {genre.reader}
          </p>

          {/* S06 only. Absent, never disabled, on every other situation. */}
          {asksJurisdiction ? (
            <div className="mt-4 pt-3.5" style={{ borderTop: "1px solid var(--color-line)" }}>
              <p
                id={jLabelId}
                className="text-[13.5px] font-semibold tracking-[-0.01em]"
                style={{ color: "var(--color-ink)" }}
              >
                {copy.jurisdictionLabel}
              </p>
              <p
                id={jHintId}
                className="mt-1 max-w-[70ch] text-[12.5px] leading-relaxed"
                style={{ color: "var(--color-ink-2)" }}
              >
                {copy.jurisdictionHint}
              </p>
              <div
                role="radiogroup"
                aria-labelledby={jLabelId}
                aria-describedby={jHintId}
                className="mt-2.5 flex flex-wrap gap-1.5"
              >
                {JURISDICTIONS.map((j, i) => {
                  const on = j.id === jurisdiction;
                  const rover = jurisdiction ? on : i === 0;
                  return (
                    <button
                      key={j.id}
                      ref={(el) => {
                        jTiles.current[i] = el;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      tabIndex={rover ? 0 : -1}
                      disabled={disabled}
                      onClick={() => pickJurisdiction(j.id)}
                      onKeyDown={(e) => onJurisdictionKeyDown(e, i)}
                      className="hov hov-bc hov-fg mono rounded-full px-3 py-1 text-[11.5px] active:translate-y-px"
                      style={{
                        color: on ? "var(--color-ink)" : "var(--color-muted)",
                        background: on ? "var(--color-accent-soft)" : "transparent",
                        border: `1px solid ${on ? "var(--color-accent)" : "var(--color-line)"}`,
                        cursor: disabled ? "default" : "pointer",
                        opacity: disabled ? 0.55 : 1,
                        ["--hv-bc" as string]: on ? "var(--color-accent)" : "var(--color-accent-line)",
                        ["--hv-fg" as string]: "var(--color-ink)",
                      }}
                    >
                      {j.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </section>
  );
}
