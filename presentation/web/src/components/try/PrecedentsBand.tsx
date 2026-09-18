"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { precedents } from "@/content/copy/tryIt";
import { EASE } from "./gate";
import { Prose } from "./Prose";

/* The precedents band: 3 to 5 real pairs from the corpus, near the finding at
   hand, held behind a "Check precedents" button so the result keeps the stage
   until the reader asks for its grounding. One band serves both gears:
   Translate hands it the exemplars the motor already retrieved (no second
   call); Review hands it a query and the band asks the motor's /api/search
   itself on reveal. Designed for READING, not density: each pair is the two
   worlds side by side with the site's rust and cobalt rules, executive prose
   set by Prose, metadata kept quiet. If the motor is offline it degrades to
   one calm line, never a broken band. */

export type PrecedentPair = {
  id: string;
  org: string;
  year?: string | null;
  severity?: string | null;
  vulnClass?: string | null;
  /** register key (or raw retrieval filter), shown verbatim as register=… */
  register?: string | null;
  tech: string;
  exec: string;
  url?: string | null;
};

/* Structural view of the motor's exemplar rows (translate result and /api/search
   both speak it). Kept local and all-optional so this band never breaks when
   the wire type gains fields. */
export type RawExemplarLike = {
  pair_id?: string | null;
  source_org?: string | null;
  severity_original?: string | null;
  vuln_class?: string | null;
  audience_observed?: string | null;
  technical_text?: string | null;
  executive_text?: string | null;
  source_url?: string | null;
  filter_used?: string | null;
};

export function toPrecedent(e: RawExemplarLike, i: number): PrecedentPair {
  const register = e.audience_observed ?? (e.filter_used ? e.filter_used.replace(/^register=/, "") : null);
  return {
    id: e.pair_id || `precedent-${i}`,
    org: e.source_org || "unknown source",
    severity: e.severity_original ?? null,
    vulnClass: e.vuln_class ?? null,
    register,
    tech: e.technical_text ?? "",
    exec: e.executive_text ?? "",
    url: e.source_url ?? null,
  };
}

const BASE = process.env.NEXT_PUBLIC_LEGIBLE_API ?? "http://127.0.0.1:8787";

/* Review's own retrieval: POST /api/search on the local motor. Deliberately
   NOT lib/legibleApi.ts (another hand owns that file right now); once the
   canonical search() settles, this should be folded onto it. */
async function searchPrecedents(query: string): Promise<PrecedentPair[]> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 4000);
  try {
    const r = await fetch(`${BASE}/api/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, k: 5 }),
      signal: c.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = (await r.json()) as { results?: RawExemplarLike[] };
    return (data.results ?? []).slice(0, 5).map(toPrecedent);
  } finally {
    clearTimeout(t);
  }
}

const clampLines = (lines: number): CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

/* One precedent: the record line, then the pair as two ruled columns · rust
   rule for the finding (mono), cobalt rule for the executive prose (Prose).
   Long findings clamp to six lines with an explicit toggle. */
function PrecedentRow({ p, index }: { p: PrecedentPair; index: number }) {
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const long = p.tech.length > 420;
  const facts = [p.year, p.severity ? `severity: ${p.severity}` : null, p.vulnClass].filter(Boolean).join(" · ");
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.08 + index * 0.07 }}
      className="py-7"
      style={{ borderTop: "1px solid var(--color-line)" }}
    >
      <div className="mono flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px]" style={{ color: "var(--color-muted)" }}>
        <span className="text-[12px] font-medium" style={{ color: "var(--color-ink)" }}>
          {p.org}
        </span>
        {facts ? <span>{facts}</span> : null}
        <span className="ml-auto inline-flex items-baseline gap-x-3">
          {p.register ? <span>register={p.register}</span> : null}
          {p.url ? (
            <a
              href={p.url}
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
      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:gap-x-12">
        <div>
          <p
            className="mono whitespace-pre-wrap text-[12px] leading-[1.7]"
            style={{
              color: "var(--color-ink-2)",
              borderLeft: "2px solid var(--color-tech-line)",
              paddingLeft: 14,
              ...(long && !expanded ? clampLines(6) : {}),
            }}
          >
            {p.tech}
          </p>
          {long ? (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="hov-c hov-fg mono mt-2 text-[10.5px]"
              style={{ color: "var(--color-tech-ink)", paddingLeft: 16, ["--hv-fg" as string]: "var(--color-ink)" }}
            >
              {expanded ? "collapse the finding" : "read the full finding"}
            </button>
          ) : null}
        </div>
        <div style={{ borderLeft: "2px solid var(--color-accent-line)", paddingLeft: 14 }}>
          <Prose text={p.exec} />
        </div>
      </div>
    </motion.div>
  );
}

type BandState =
  | { kind: "hidden" }
  | { kind: "loading" }
  | { kind: "shown"; items: PrecedentPair[] }
  | { kind: "offline" };

export function PrecedentsBand({
  items,
  query,
  caption = "precedents · real pairs from the corpus, nearest this finding",
}: {
  /** Translate: pairs already retrieved with the result (no second call) */
  items?: PrecedentPair[];
  /** Review: the source finding; the band asks the motor's /api/search on reveal */
  query?: string;
  caption?: string;
}) {
  const reduce = useReducedMotion();
  const [state, setState] = useState<BandState>({ kind: "hidden" });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function reveal() {
    if (items?.length) {
      setState({ kind: "shown", items: items.slice(0, 5) });
      return;
    }
    if (!query?.trim()) {
      setState({ kind: "shown", items: [] });
      return;
    }
    setState({ kind: "loading" });
    try {
      const found = await searchPrecedents(query);
      if (alive.current) setState({ kind: "shown", items: found });
    } catch {
      if (alive.current) setState({ kind: "offline" });
    }
  }

  if (state.kind === "hidden") {
    return (
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={reveal}
          className="hov hov-bc hov-fg mono inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-[12px] active:translate-y-px"
          style={{
            border: "1px solid var(--color-line-2)",
            color: "var(--color-ink-2)",
            background: "var(--color-surface)",
            ["--hv-bc" as string]: "var(--color-accent-line)",
            ["--hv-fg" as string]: "var(--color-ink)",
          }}
        >
          <span
            aria-hidden
            className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ background: "linear-gradient(90deg, var(--color-tech), var(--color-accent))" }}
          />
          Check precedents
        </button>
      </div>
    );
  }

  if (state.kind === "loading") {
    return (
      <p className="mono animate-pulse pt-3 text-center text-[11.5px]" style={{ color: "var(--color-muted)" }}>
        consulting the corpus
      </p>
    );
  }

  if (state.kind === "offline") {
    return (
      <p className="mono pt-3 text-center text-[11.5px]" style={{ color: "var(--color-muted)" }}>
        {precedents.offlineNote}{" "}
        <button
          type="button"
          onClick={reveal}
          className="hov-c hov-fg underline underline-offset-2"
          style={{ color: "var(--color-accent-ink)", ["--hv-fg" as string]: "var(--color-ink)" }}
        >
          {precedents.retryLabel}
        </button>
      </p>
    );
  }

  if (!state.items.length) {
    return (
      <p className="mono pt-3 text-center text-[11.5px]" style={{ color: "var(--color-muted)" }}>
        {precedents.emptyNote}
      </p>
    );
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="mx-auto w-full max-w-[900px]"
    >
      <p className="mono pb-4 text-center text-[11px]" style={{ color: "var(--color-muted)" }}>
        {caption}
      </p>
      {state.items.map((p, i) => (
        <PrecedentRow key={p.id} p={p} index={i} />
      ))}
    </motion.div>
  );
}
