"use client";

import { findingSearch as copy } from "@/content/copy/library";
import { INDEX_URL } from "@/lib/librarySearch";

/* The states the box can be in that are not a result.
 *
 * Ported from the retired `_archive/try/BrowseMode.tsx`, which got the shape of
 * these right even though it got its own headline wrong: an empty prompt that
 * offers real probes, a skeleton for the first response, a no result panel
 * that refuses to invent one, and an error panel that names the failure.
 *
 * Two states are new here and neither is decoration. `IndexMissing` exists
 * because the index is generated from a private corpus and is gitignored, so a
 * clean checkout will 404 on it, and the honest answer to that is a sentence,
 * not a stack trace and not a baked sample. `IndexLoading` exists because the
 * fetch is deferred to the first keystroke, so the wait is real and belongs on
 * screen.
 */

const PANEL = { borderTop: "1px solid var(--color-line)" };

function Heading({ children }: { children: string }) {
  return (
    <p className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: "var(--color-ink)" }}>
      {children}
    </p>
  );
}

function Body({ children }: { children: string }) {
  return (
    <p className="mt-2 max-w-[62ch] text-[13.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
      {children}
    </p>
  );
}

/* Nothing typed yet. The bars are the same three-rung mark the archived Browse
   used: a corpus narrowing to a match, drawn rather than described. */
export function EmptyPrompt({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="pt-4" style={PANEL}>
      <div className="flex flex-col gap-2" aria-hidden>
        <span className="h-[3px] w-24 rounded-full" style={{ background: "var(--color-accent)", opacity: 0.75 }} />
        <span className="h-[3px] w-14 rounded-full" style={{ background: "var(--color-accent)", opacity: 0.35 }} />
        <span className="h-[3px] w-8 rounded-full" style={{ background: "var(--color-accent)", opacity: 0.16 }} />
      </div>

      <Body>{copy.empty.note}</Body>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <span className="mono text-[10.5px] uppercase tracking-[0.08em]" style={{ color: "var(--color-muted)" }}>
          {copy.empty.tryLabel}
        </span>
        {copy.empty.suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="hov hov-bc hov-fg mono rounded-full px-3 py-1.5 text-[12px] active:translate-y-px"
            style={{
              color: "var(--color-ink-2)",
              border: "1px solid var(--color-line-2)",
              ["--hv-bc" as string]: "var(--color-accent-line)",
              ["--hv-fg" as string]: "var(--color-ink)",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* The box takes a whole finding, so one of the offers is a whole
          finding. It is labelled as written for this box, because a synthetic
          example sitting next to a corpus of verbatim records has to say which
          of the two it is. */}
      <button
        type="button"
        onClick={() => onPick(copy.empty.example)}
        className="hov hov-bc mt-3 block w-full max-w-[72ch] rounded-[10px] border p-3 text-left active:translate-y-px"
        style={{
          borderColor: "var(--color-line)",
          background: "var(--color-surface-2)",
          ["--hv-bc" as string]: "var(--color-accent-line)",
        }}
      >
        <span className="mono text-[10.5px] uppercase tracking-[0.08em]" style={{ color: "var(--color-muted)" }}>
          {copy.empty.exampleLabel}
        </span>
        <span className="mono mt-1.5 block text-[11.5px] leading-[1.7]" style={{ color: "var(--color-ink-2)" }}>
          {copy.empty.example}
        </span>
      </button>
    </div>
  );
}

/* Skeleton, shared by the index fetch and the first match. Two columns,
   because that is the shape the answer arrives in. */
function Skeleton() {
  return (
    <div className="mt-4 flex flex-col gap-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid gap-y-2 md:grid-cols-2 md:gap-x-12">
          <div className="skeleton-shimmer h-10 rounded-[6px]" style={{ background: "var(--color-surface-2)" }} />
          <div className="skeleton-shimmer h-10 rounded-[6px]" style={{ background: "var(--color-surface-2)" }} />
        </div>
      ))}
    </div>
  );
}

/** The index is in flight. It is fetched once, on first interaction. */
export function IndexLoading() {
  return (
    <div className="pt-4" style={PANEL}>
      <p className="mono text-[11px]" style={{ color: "var(--color-accent-ink)" }}>
        {copy.loading.note}
      </p>
      <Body>{copy.loading.detail}</Body>
      <Skeleton />
    </div>
  );
}

/** A query is settling. The index is already local, so this is brief. */
export function Searching() {
  return (
    <div className="pt-4" style={PANEL}>
      <p className="mono text-[11px]" style={{ color: "var(--color-accent-ink)" }}>
        {copy.searching.note}
      </p>
      <Skeleton />
    </div>
  );
}

/* A long paste would run the whole finding through this panel, so the echoed
   query is cut for display only. The cut is visible, and the box still holds
   the full text. */
const ECHO_LIMIT = 140;

function echo(query: string): string {
  const q = query.trim().replace(/\s+/g, " ");
  return q.length > ECHO_LIMIT ? `${q.slice(0, ECHO_LIMIT)}...` : q;
}

/** Nothing matched. The one thing this panel may never do is invent a pair. */
export function NoResults({ query }: { query: string }) {
  return (
    <div className="pt-4" style={PANEL}>
      <Heading>{copy.noResults.heading}</Heading>
      <Body>{copy.noResults.body}</Body>
      <p className="mono mt-3 max-w-[72ch] text-[11px] leading-[1.7]" style={{ color: "var(--color-muted)" }}>
        <span className="uppercase tracking-[0.08em]">{copy.noResults.queryLabel}</span>{" "}
        <span style={{ color: "var(--color-ink-2)" }}>{echo(query)}</span>
      </p>
    </div>
  );
}

/** The index file is not in this build. Gitignored, generated, often absent. */
export function IndexMissing() {
  return (
    <div className="pt-4" style={PANEL}>
      <Heading>{copy.indexMissing.heading}</Heading>
      <Body>{copy.indexMissing.body}</Body>
      <p className="mono mt-3 text-[11px]" style={{ color: "var(--color-muted)" }}>
        <span className="uppercase tracking-[0.08em]">{copy.indexMissing.pathLabel}</span>{" "}
        <span style={{ color: "var(--color-ink-2)" }}>{INDEX_URL}</span>
      </p>
    </div>
  );
}

/** The fetch failed for a reason that is not a missing file. */
export function ErrorState({ message }: { message: string }) {
  return (
    <div className="pt-4" style={PANEL}>
      <Heading>{copy.error.heading}</Heading>
      <Body>{copy.error.body}</Body>
      <p role="alert" className="mono mt-3 max-w-[72ch] break-words text-[11.5px]" style={{ color: "var(--color-bad-ink)" }}>
        <span className="uppercase tracking-[0.08em]" style={{ color: "var(--color-muted)" }}>
          {copy.error.detailLabel}
        </span>{" "}
        {message}
      </p>
    </div>
  );
}
