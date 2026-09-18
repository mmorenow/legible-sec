"use client";

import { useId, type ReactNode } from "react";
import { inputs as copy } from "@/content/copy/review";
import { SplitCanvas, WorldLabel, type SeamState } from "../seam";

/* The two texts, staged on the instrument's own split. Left is the technical
   world in rust, right is the reader's world in cobalt, and the seam between
   them is where the crossing gets judged. SplitCanvas already stacks the
   worlds below 1024px and turns the seam horizontal, which is exactly the
   responsive rule this surface needs, so it is reused rather than re-cut.

   The finding's helper text is load bearing: the checks read severity,
   identifiers, versions, dates and caveats out of the source, so a trimmed
   finding silently produces a thinner review. It is stated, not softened. */

/* COPY GAP: the unit on the quiet counter. Every other string on this surface
   comes from copy/review.ts. Words, not characters, because the format
   constants D8 checks are stated in words. */
const COUNT_UNIT = { one: "word", many: "words" };

const WORD = /[A-Za-z0-9][A-Za-z0-9'’-]*/g;

function wordCount(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

function Counter({ value }: { value: string }) {
  const n = wordCount(value);
  return (
    <span className="mono num text-[11px]" style={{ color: "var(--color-muted)" }}>
      {n.toLocaleString("en-US")} {n === 1 ? COUNT_UNIT.one : COUNT_UNIT.many}
    </span>
  );
}

function ClearButton({
  target,
  onClick,
  disabled,
  world,
}: {
  /** Named so the control says which panel it empties, not just "clear". */
  target: string;
  onClick: () => void;
  disabled?: boolean;
  world: "tech" | "legible";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${copy.clear}: ${target}`}
      className="hov hov-bc hov-fg mono rounded-full px-2.5 py-0.5 text-[11px] lowercase active:translate-y-px"
      style={{
        color: "var(--color-muted)",
        border: "1px solid var(--color-line)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
        ["--hv-bc" as string]:
          world === "tech" ? "var(--color-tech-line)" : "var(--color-accent-line)",
        ["--hv-fg" as string]: "var(--color-ink)",
      }}
    >
      {copy.clear}
    </button>
  );
}

function Panel({
  world,
  id,
  label,
  hint,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  world: "tech" | "legible";
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const hintId = `${id}-hint`;
  const tech = world === "tech";
  const line = tech ? "var(--color-tech-line)" : "var(--color-accent-line)";
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <WorldLabel world={world} title={label} htmlFor={id} />
        <div className="flex items-center gap-2.5">
          <Counter value={value} />
          {value ? (
            <ClearButton target={label} world={world} onClick={() => onChange("")} disabled={disabled} />
          ) : null}
        </div>
      </div>

      <p
        id={hintId}
        className="mt-2 max-w-[62ch] text-[12.5px] leading-relaxed"
        style={{ color: "var(--color-ink-2)" }}
      >
        {hint}
      </p>

      <textarea
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-describedby={hintId}
        rows={14}
        spellCheck={!tech}
        placeholder={placeholder}
        className={`${tech ? "mono " : ""}mt-3 w-full resize-y rounded-[10px] border p-3 ${
          tech ? "text-[12.5px] leading-[1.7]" : "text-[13.5px] leading-relaxed"
        }`}
        style={{
          borderColor: line,
          background: "var(--color-surface)",
          color: "var(--color-ink)",
          opacity: disabled ? 0.6 : 1,
        }}
      />
    </div>
  );
}

export function SourceInputs({
  source,
  draft,
  onSourceChange,
  onDraftChange,
  disabled,
  seam,
  below,
  state = "idle",
  crossKey,
}: {
  source: string;
  draft: string;
  onSourceChange: (next: string) => void;
  onDraftChange: (next: string) => void;
  /** Locks both fields while a run is in flight. */
  disabled?: boolean;
  /** Mounted on the membrane: the run control belongs to the composer. */
  seam?: ReactNode;
  /** Hangs under the split: the results surface. */
  below?: ReactNode;
  state?: SeamState;
  crossKey?: string | number;
}) {
  const uid = useId();
  return (
    <SplitCanvas
      state={state}
      crossKey={crossKey}
      seam={seam}
      below={below}
      left={
        <Panel
          world="tech"
          id={`${uid}-source`}
          label={copy.sourceLabel}
          hint={copy.sourceHint}
          placeholder={copy.sourcePlaceholder}
          value={source}
          onChange={onSourceChange}
          disabled={disabled}
        />
      }
      right={
        <Panel
          world="legible"
          id={`${uid}-draft`}
          label={copy.draftLabel}
          hint={copy.draftHint}
          placeholder={copy.draftPlaceholder}
          value={draft}
          onChange={onDraftChange}
          disabled={disabled}
        />
      }
    />
  );
}
