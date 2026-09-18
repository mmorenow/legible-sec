"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { MagnifyingGlass, CircleNotch } from "@phosphor-icons/react";
import demo from "@/content/tryDemo.json";
import { health, search, type Exemplar, type Health } from "@/lib/legibleApi";
import { EASE } from "@/components/try/gate";
import { EvidenceLedger, REGISTERS, toRegister, type EvidenceItem, type RegisterKey } from "@/components/try/evidence";

/* Browse: a live, 100% SEMANTIC search over the whole corpus, powered by the
   local motor's RAG retriever (POST /api/search → rag.retrieve, rerank off for
   interactivity). No keyword or full-text fallback anywhere (owner decision):
   every row is a nearest neighbor in embedding space, retrieved by meaning, and
   nothing is generated. Search-as-you-type; each settled query ranks its pairs
   in on the same split-world ledger every other mode crosses. With no motor
   there is nothing to search, so Browse shows the quickstart and a small baked
   sample rather than a dead box. Replaces the old static Precedents gallery. */

const SUGGESTIONS = ["SSRF", "exposed S3 bucket", "weak password hashing", "privilege escalation", "hardcoded credentials"];

const TOKENS: Array<"all" | RegisterKey> = ["all", ...REGISTERS];

// mirror the quickstart the /try footer and TryPanel already print, verbatim.
const QUICKSTART = [
  ".venv/bin/pip install -r requirements-app.txt",
  "LEGIBLE_EMBED_DEVICE=cpu .venv/bin/uvicorn app.server:app --port 8787",
  "cd presentation/web && npm run dev",
];

/* The baked precedents (tryDemo.json), reused ONLY as an offline sample: a
   glimpse of what the live search returns from the full corpus. */
type Precedent = {
  id: string;
  org: string;
  year: string | null;
  severity: string | null;
  audience: string;
  tech: string;
  exec: string;
  url: string | null;
};
const SAMPLE: EvidenceItem[] = (demo.precedents as Precedent[]).slice(0, 6).map((r) => ({
  id: r.id,
  org: r.org,
  year: r.year,
  severity: r.severity,
  register: toRegister(r.audience) ?? r.audience,
  tech: r.tech,
  exec: r.exec,
  url: r.url,
}));

/* A retrieved pair → the shared evidence surface. register comes from the row's
   real audience_observed (passed through toRegister), so the ledger shows the
   pair's true register, not the filter that surfaced it. */
function toItems(rows: Exemplar[]): EvidenceItem[] {
  return rows.map((e, i) => ({
    id: e.pair_id ?? `result-${i}`,
    org: e.source_org,
    severity: e.severity_original,
    register: e.audience_observed ? toRegister(e.audience_observed) ?? e.audience_observed : null,
    tech: e.technical_text,
    exec: e.executive_text,
    url: e.source_url,
  }));
}

type Phase = "idle" | "searching" | "done" | "error";

export function BrowseMode() {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [register, setRegister] = useState<"all" | RegisterKey>("all");
  const [results, setResults] = useState<Exemplar[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [stamp, setStamp] = useState(0); // replays the rank-in when new results land
  const [focused, setFocused] = useState(false);
  const [h, setH] = useState<Health | null>(null);
  const [checked, setChecked] = useState(false);

  const tokensRef = useRef<Array<HTMLButtonElement | null>>([]);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  // motor detection (mirrors TryPanel): poll health on mount and on refocus.
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const r = await health();
      if (cancelled) return;
      setH(r);
      setChecked(true);
    };
    poll();
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const offline = checked && h == null;

  // search-as-you-type: debounce, then fire. A new keystroke aborts the
  // in-flight request (AbortController) and a sequence guard drops any late or
  // stale response that resolves out of order.
  useEffect(() => {
    const q = query.trim();
    abortRef.current?.abort();
    if (!q || offline) {
      setPhase("idle");
      setResults([]);
      setErr("");
      return;
    }
    setPhase("searching");
    const handle = window.setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = ++seqRef.current;
      try {
        const res = await search(q, {
          register: register === "all" ? null : register,
          k: 10,
          signal: controller.signal,
        });
        if (seq !== seqRef.current) return; // superseded by a newer query
        setResults(res.results);
        setErr("");
        setStamp((s) => s + 1);
        setPhase("done");
      } catch (e) {
        if (controller.signal.aborted || seq !== seqRef.current) return; // cancelled / superseded
        setErr(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, register, offline]);

  // abort any in-flight request on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  function onTokenKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const j = (i + (e.key === "ArrowRight" ? 1 : TOKENS.length - 1)) % TOKENS.length;
    setRegister(TOKENS[j]);
    tokensRef.current[j]?.focus();
  }

  const items = toItems(results);
  const searching = phase === "searching";
  const warming = h ? !h.model_loaded : false;

  function body() {
    if (offline) return <OfflineSample />;
    if (phase === "idle") return <EmptyPrompt onPick={setQuery} />;
    if (phase === "error") return <ErrorState message={err} warming={warming} />;
    if (results.length) {
      return (
        <motion.div
          key={stamp}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <EvidenceLedger items={items} variant="ledger" />
        </motion.div>
      );
    }
    if (searching) return <SearchingState />;
    return <NoResults query={query} />; // phase "done", nothing near
  }

  return (
    <div>
      {/* the search field: the whole corpus, by meaning */}
      <label htmlFor="browse-query" className="sr-only">
        Search the corpus by meaning
      </label>
      <div className="relative">
        <MagnifyingGlass
          size={17}
          weight="bold"
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
          style={{ color: offline ? "var(--color-line-2)" : "var(--color-tech-ink)" }}
        />
        <input
          id="browse-query"
          name="browse-query"
          type="search"
          value={query}
          disabled={offline}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={offline ? "start the motor to search the full corpus" : "Search by concept · SSRF, weak password hashing, exposed bucket..."}
          autoComplete="off"
          spellCheck={false}
          aria-describedby="browse-help"
          className="mono w-full rounded-[12px] border py-3.5 pl-11 pr-11 text-[14px] leading-normal outline-none"
          style={{
            borderColor: focused ? "var(--color-accent-line)" : "var(--color-line-2)",
            background: "var(--color-surface)",
            color: "var(--color-ink)",
            boxShadow: focused ? "0 0 0 3px var(--color-accent-soft)" : "none",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        />
        {searching ? (
          <CircleNotch
            size={16}
            weight="bold"
            aria-hidden
            className="animate-spin absolute right-4 top-1/2 -translate-y-1/2"
            style={{ color: "var(--color-accent-ink)" }}
          />
        ) : null}
      </div>
      <p id="browse-help" className="mono mt-2.5 text-[11px]" style={{ color: "var(--color-muted)" }}>
        {offline
          ? "the semantic index lives in the motor · connect it below to search every pair by meaning"
          : "100% semantic · every result is a real pair retrieved by meaning, never generated · each query is sent to the motor on your own machine"}
      </p>

      {/* register filter + result count */}
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div role="radiogroup" aria-label="filter by register" className="flex flex-wrap items-center gap-1.5">
          <span className="mono mr-1.5 text-[11px]" style={{ color: "var(--color-muted)" }}>
            register
          </span>
          {TOKENS.map((t, i) => {
            const on = t === register;
            return (
              <button
                key={t}
                ref={(el) => {
                  tokensRef.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={t === "all" ? "all registers" : t}
                tabIndex={on ? 0 : -1}
                disabled={offline}
                onClick={() => setRegister(t)}
                onKeyDown={(e) => onTokenKeyDown(e, i)}
                className="hov hov-bc hov-fg mono relative rounded-full px-3 py-1 text-[11.5px] active:translate-y-px before:absolute before:inset-x-0 before:-top-1.5 before:-bottom-1.5 before:content-['']"
                style={{
                  color: on ? "var(--color-ink)" : "var(--color-muted)",
                  background: on ? "var(--color-accent-soft)" : "transparent",
                  border: `1px solid ${on ? "var(--color-accent)" : "var(--color-line)"}`,
                  opacity: offline ? 0.55 : 1,
                  ["--hv-bc" as string]: on ? "var(--color-accent)" : "var(--color-accent-line)",
                  ["--hv-fg" as string]: "var(--color-ink)",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
        <p className="mono text-[11px]" style={{ color: "var(--color-muted)" }}>
          {phase === "done" && results.length ? (
            <>
              {results.length} nearest {results.length === 1 ? "pair" : "pairs"} ·{" "}
            </>
          ) : (
            <>semantic retrieval · </>
          )}
          <Link href="/dataset/" className="hov-c hov-fg" style={{ color: "var(--color-accent-ink)", ["--hv-fg" as string]: "var(--color-ink)" }}>
            the full corpus
          </Link>
        </p>
      </div>

      {/* results straddle the seam on the same split-world canvas */}
      <div className="try-canvas mt-5" data-state="idle">
        <div className="wrap-wide">
          <div className="pb-8 pt-6" aria-live="polite" aria-busy={searching}>
            {body()}
          </div>
        </div>
      </div>

      {phase === "done" && results.length ? (
        <p className="mono mt-2 text-[10.5px]" style={{ color: "var(--color-muted)" }}>
          click a pair to expand · the same evidence surface Translate cites before it writes
        </p>
      ) : null}
    </div>
  );
}

/* Empty query: an inviting prompt with the topics the corpus knows well. */
function EmptyPrompt({ onPick }: { onPick: (topic: string) => void }) {
  return (
    <div className="pt-4" style={{ borderTop: "1px solid var(--color-line)" }}>
      <div className="flex flex-col gap-2" aria-hidden>
        <span className="h-[3px] w-24 rounded-full" style={{ background: "var(--color-accent)", opacity: 0.75 }} />
        <span className="h-[3px] w-14 rounded-full" style={{ background: "var(--color-accent)", opacity: 0.35 }} />
        <span className="h-[3px] w-8 rounded-full" style={{ background: "var(--color-accent)", opacity: 0.16 }} />
      </div>
      <p className="mt-5 max-w-[54ch] text-[13.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
        Type a concept, a vulnerability class, or a whole finding. LEGIBLE retrieves the nearest real pairs from the corpus
        by meaning, each beside the sentence that actually shipped. Try one:
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="hov hov-bc hov-fg mono rounded-full px-3 py-1.5 text-[12px] active:translate-y-px"
            style={{ color: "var(--color-ink-2)", border: "1px solid var(--color-line-2)", ["--hv-bc" as string]: "var(--color-accent-line)", ["--hv-fg" as string]: "var(--color-ink)" }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* First-response skeleton (only when there are no prior results to keep). */
function SearchingState() {
  return (
    <div className="pt-2" aria-hidden>
      <p className="mono text-[11px]" style={{ color: "var(--color-accent-ink)" }}>
        retrieving the nearest pairs...
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-y-2 md:grid-cols-2 md:gap-x-12">
            <div className="skeleton-shimmer h-10 rounded-[6px]" style={{ background: "var(--color-surface-2)" }} />
            <div className="skeleton-shimmer h-10 rounded-[6px]" style={{ background: "var(--color-surface-2)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Nothing near: never fabricate a match. */
function NoResults({ query }: { query: string }) {
  return (
    <div className="pt-4" style={{ borderTop: "1px solid var(--color-line)" }}>
      <p className="text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>
        Nothing close in the corpus for that.
      </p>
      <p className="mt-2 max-w-[54ch] text-[13.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
        Semantic search found no pair near &ldquo;{query.trim()}&rdquo;. LEGIBLE never fabricates one · try a broader concept, or browse the full dataset.
      </p>
      <Link
        href="/dataset/"
        className="hov-c hov-fg mono mt-3 inline-block text-[12px]"
        style={{ color: "var(--color-accent-ink)", ["--hv-fg" as string]: "var(--color-ink)" }}
      >
        browse the full dataset →
      </Link>
    </div>
  );
}

/* A search failed. A cold embedder (first query loads the local model) reads as
   a timeout; say so plainly instead of alarming the reader. */
function ErrorState({ message, warming }: { message: string; warming: boolean }) {
  return (
    <div className="pt-4" style={{ borderTop: "1px solid var(--color-line)" }}>
      {warming ? (
        <>
          <p className="text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>
            The motor is warming its embedder.
          </p>
          <p className="mt-2 max-w-[54ch] text-[13.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
            The first semantic search loads the local embedding model · it settles after about twenty seconds. Keep typing and it will answer.
          </p>
        </>
      ) : (
        <>
          <p className="text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>
            Search hit a snag.
          </p>
          <p role="alert" className="mono mt-2 text-[11.5px]" style={{ color: "var(--color-bad)" }}>
            {message}
          </p>
        </>
      )}
    </div>
  );
}

/* Motor offline: Browse is semantic-only, so there is nothing to search here.
   Show the quickstart and a small baked sample of what the live search returns. */
function OfflineSample() {
  return (
    <div className="pt-2">
      <p className="text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>
        Semantic search runs on your machine.
      </p>
      <p className="mt-2 max-w-[52ch] text-[13.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
        Browse retrieves by meaning over the full corpus from your own motor. Start it in three commands, then search live:
      </p>
      <div
        className="mono mt-3 flex max-w-[560px] flex-col gap-1.5 rounded-[10px] p-3.5 text-[11.5px] leading-relaxed"
        style={{ background: "var(--color-surface-2)", color: "var(--color-ink-2)" }}
      >
        {QUICKSTART.map((c) => (
          <span key={c}>$ {c}</span>
        ))}
      </div>
      <p className="mono mt-2 text-[10.5px]" style={{ color: "var(--color-muted)" }}>
        the motor listens on :8787 · this page detects it on its own
      </p>

      <p className="mono mt-9 text-[11px]" style={{ color: "var(--color-muted)" }}>
        a sample of what comes back · connect the motor to search every pair by meaning
      </p>
      <div className="mt-3">
        <EvidenceLedger items={SAMPLE} variant="ledger" />
      </div>
    </div>
  );
}
