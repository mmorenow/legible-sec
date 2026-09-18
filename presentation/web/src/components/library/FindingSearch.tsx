"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { loadIndex, search, type LibraryHit, type LibraryIndex } from "@/lib/librarySearch";
import { WorldLabel } from "@/components/try/seam";
import { Reveal } from "@/components/primitives";
import { findingSearch as copy } from "@/content/copy/library";
import { ResultRecord } from "./ResultRecord";
import { EmptyPrompt, ErrorState, IndexLoading, IndexMissing, NoResults, Searching } from "./SearchStates";

/* The finding search: paste a finding, get the pairs that were already written.
 *
 * WHAT THIS CONTROL IS, AND WHAT IT IS CAREFUL NOT TO CLAIM
 *
 * The default path is lexical. It compares identifiers, field values and words
 * against the index and it does not read for meaning. That is stated on the
 * page in those words. The retired Browse control (`_archive/try/BrowseMode`)
 * did the opposite: it headlined itself as full retrieval by meaning while
 * serving six baked rows with its motor offline. A control that overstates its
 * own method, and keeps answering after its data source is gone, is precisely
 * the failure LEGIBLE exists to name. So every state below either answers from
 * the index or says plainly that it cannot.
 *
 * WHY THE INDEX LOADS LATE
 *
 * `/library-index.json` is generated from the corpus and is not small. Most
 * readers of this page never touch the box, so the fetch is deferred to the
 * first real interaction (a focus, a keystroke, or a probe chip) and happens
 * exactly once. It is abort guarded, so leaving the page mid fetch does not
 * land a state update on an unmounted tree.
 *
 * WHY A MISSING FILE IS A STATE AND NOT AN ERROR
 *
 * The index is gitignored, because the corpus behind it is private. A clean
 * checkout therefore 404s on it, which is expected rather than broken, and it
 * gets its own panel with its own sentence.
 *
 * HOSTILE INPUT
 *
 * Pair text quotes real exploit payloads verbatim, literal `</script>` among
 * them. Everything rendered here, pair text and the reader's own paste alike,
 * goes through React as a text node. No branch of this component builds markup
 * from data.
 */

/** How many hits a reader can actually read before scrolling loses the thread. */
const RESULT_LIMIT = 8;

/** Long enough to swallow a burst of typing, short enough to feel local. */
const DEBOUNCE_MS = 180;

type IndexState =
  | { kind: "unstarted" }
  | { kind: "loading" }
  | { kind: "ready"; index: LibraryIndex }
  | { kind: "missing" }
  | { kind: "error"; message: string };

/* A missing index and a broken one deserve different sentences, and the only
   thing the loader can hand back is a message, so the 404 is read out of it.
   Anything unrecognised is treated as a real failure: over reporting a fault
   is the safe direction, since the fallback panel names the fault rather than
   papering over it. */
function isMissing(message: string): boolean {
  return /\b404\b|not found/i.test(message);
}

/* Rank is a claim this surface makes, so it is made here rather than assumed
   of the caller: an exact identifier match outranks any amount of word
   overlap, and inside each group the score decides. Array sort is stable, so
   the index's own order survives a tie. */
function rank(hits: LibraryHit[]): LibraryHit[] {
  return [...hits].sort((a, b) => (a.exact === b.exact ? b.score - a.score : a.exact ? -1 : 1));
}

const n = (value: number) => value.toLocaleString("en-US");

export function FindingSearch() {
  const uid = useId();
  const fieldId = `${uid}-finding`;
  const hintId = `${uid}-hint`;

  const [query, setQuery] = useState("");
  const [indexState, setIndexState] = useState<IndexState>({ kind: "unstarted" });
  /* The last settled run, stamped with the query that produced it. Storing the
     query alongside the hits is what lets everything else be derived: a result
     whose stamp no longer matches the box is stale by definition, so no second
     state has to be kept in sync to say whether a search is in flight. */
  const [result, setResult] = useState<{ query: string; hits: LibraryHit[] } | null>(null);
  const [focused, setFocused] = useState(false);

  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  /* One fetch, on first contact. `startedRef` rather than state, because the
     guard has to hold within a single render pass: focus and the first
     keystroke can arrive before React has committed anything. */
  const ensureIndex = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setIndexState({ kind: "loading" });
    loadIndex(controller.signal).then(
      (index) => {
        if (controller.signal.aborted) return;
        setIndexState({ kind: "ready", index });
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return; // unmounted, or superseded
        const message = cause instanceof Error ? cause.message : String(cause);
        setIndexState(isMissing(message) ? { kind: "missing" } : { kind: "error", message });
      }
    );
  }, []);

  // leaving the page mid fetch must not settle into an unmounted tree
  useEffect(() => () => abortRef.current?.abort(), []);

  /* Search as you type. `search` runs against an index that is already local,
     so there is no request to cancel here; the debounce timer is the thing
     that has to be cleaned up, and clearing it on every change is what keeps a
     superseded query from ever landing. The effect body itself sets nothing:
     the only write happens inside the timer, so a keystroke cannot cascade a
     render before it has been debounced. */
  useEffect(() => {
    const q = query.trim();
    if (!q || indexState.kind !== "ready") return;
    const handle = window.setTimeout(() => {
      setResult({ query: q, hits: rank(search(indexState.index, q, { limit: RESULT_LIMIT })) });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query, indexState]);

  const onPick = useCallback(
    (text: string) => {
      ensureIndex();
      setQuery(text);
      fieldRef.current?.focus();
    },
    [ensureIndex]
  );

  const meta = indexState.kind === "ready" ? indexState.index.meta : null;
  const settled = query.trim();
  const typed = settled.length > 0;
  const chars = query.length;
  /* Stale means the box has moved on and the debounce has not landed yet. The
     stale set stays on screen rather than being blanked, so a reader editing a
     paste is not thrown back to a skeleton on every keystroke; the spinner and
     `aria-busy` are what say the answer is still moving. */
  const stale = result != null && result.query !== settled;
  const busy = indexState.kind === "loading" || (typed && indexState.kind === "ready" && (result == null || stale));

  function body() {
    // a broken or absent index outranks everything: there is nothing to search
    if (indexState.kind === "missing") return <IndexMissing />;
    if (indexState.kind === "error") return <ErrorState message={indexState.message} />;
    if (!typed) return <EmptyPrompt onPick={onPick} />;
    if (indexState.kind !== "ready") return <IndexLoading />;
    if (result === null) return <Searching />;
    // an empty stale set says nothing about the query now in the box
    if (result.hits.length === 0) return stale ? <Searching /> : <NoResults query={result.query} />;
    return (
      <div className="mt-4 flex flex-col gap-4">
        {result.hits.map((hit, i) => (
          <ResultRecord key={hit.pair.id} hit={hit} rank={i} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <Reveal>
        <p className="mono mb-4 text-[12px]" style={{ color: "var(--color-muted)" }}>
          {copy.label}
        </p>
        <h2 className="h2 max-w-[24ch]" style={{ color: "var(--color-ink)" }}>
          {copy.heading}
        </h2>
        <p className="lede mt-4 max-w-[62ch]">{copy.lede}</p>
      </Reveal>

      {/* ---- the box ---- */}
      <div className="mt-9 max-w-[880px]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <WorldLabel world="tech" title={copy.fieldLabel} htmlFor={fieldId} />
          <div className="flex items-center gap-2.5">
            <span className="mono num text-[11px]" style={{ color: "var(--color-muted)" }}>
              {n(chars)} {chars === 1 ? copy.countUnit.one : copy.countUnit.many}
            </span>
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={`${copy.clear}: ${copy.fieldLabel}`}
                className="hov hov-bc hov-fg mono rounded-full px-2.5 py-0.5 text-[11px] lowercase active:translate-y-px"
                style={{
                  color: "var(--color-muted)",
                  border: "1px solid var(--color-line)",
                  ["--hv-bc" as string]: "var(--color-tech-line)",
                  ["--hv-fg" as string]: "var(--color-ink)",
                }}
              >
                {copy.clear}
              </button>
            ) : null}
          </div>
        </div>

        <p id={hintId} className="mt-2 max-w-[68ch] text-[12.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
          {copy.fieldHint}
        </p>

        <div className="relative mt-3">
          <textarea
            id={fieldId}
            name={fieldId}
            ref={fieldRef}
            value={query}
            onChange={(e) => {
              ensureIndex();
              setQuery(e.target.value);
            }}
            onFocus={() => {
              ensureIndex();
              setFocused(true);
            }}
            onBlur={() => setFocused(false)}
            aria-describedby={hintId}
            rows={7}
            spellCheck={false}
            autoComplete="off"
            placeholder={copy.placeholder}
            className="mono w-full resize-y rounded-[10px] border p-3.5 pr-10 text-[12.5px] leading-[1.7] outline-none"
            style={{
              borderColor: focused ? "var(--color-tech)" : "var(--color-tech-line)",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              boxShadow: focused ? "0 0 0 3px var(--color-tech-soft)" : "none",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
          />
          {busy ? (
            <CircleNotch
              size={15}
              weight="bold"
              aria-hidden
              className="animate-spin absolute right-3.5 top-3.5"
              style={{ color: "var(--color-accent-ink)" }}
            />
          ) : null}
        </div>

        {/* ---- what the box does, said in the words it actually does it in ---- */}
        <p className="mono mt-3 max-w-[80ch] text-[11px] leading-[1.75]" style={{ color: "var(--color-muted)" }}>
          {copy.method}
        </p>
        <p className="mono mt-1.5 max-w-[80ch] text-[11px] leading-[1.75]" style={{ color: "var(--color-muted)" }}>
          {copy.privacy}
        </p>

        {/* ---- what it can and cannot reach, as a number ---- */}
        <div
          className="mt-4 rounded-[10px] border px-3.5 py-3"
          style={{ borderColor: "var(--color-line)", background: "var(--color-bg-2)" }}
        >
          {meta ? (
            <>
              <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
                {copy.coverage(n(meta.pairs), n(meta.total), n(meta.withheld))}{" "}
                <span style={{ color: "var(--color-ink)" }}>{meta.withheldReason}</span>
              </p>
              <p className="mono num mt-2 text-[10.5px]" style={{ color: "var(--color-muted)" }}>
                {copy.stamp(meta.buildTag, meta.generatedAt)}
              </p>
            </>
          ) : (
            <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
              {copy.coveragePending}
            </p>
          )}
        </div>
      </div>

      {/* ---- results ---- */}
      {typed && indexState.kind === "ready" && result && result.hits.length ? (
        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5">
          <p className="mono num text-[11.5px]" style={{ color: "var(--color-ink-2)" }}>
            {copy.results.countLabel(n(result.hits.length), result.hits.length === 1)}
          </p>
          <p className="mono text-[11px]" style={{ color: "var(--color-muted)" }}>
            {copy.results.rankNote}
          </p>
        </div>
      ) : null}

      <div className="mt-5" aria-live="polite" aria-busy={busy}>
        {body()}
      </div>
    </div>
  );
}
