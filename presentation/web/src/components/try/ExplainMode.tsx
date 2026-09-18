"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Quotes } from "@phosphor-icons/react";
import library from "@/content/explainLibrary.json";
import { explain as copy } from "@/content/copy/tryIt";
import { EASE } from "./gate";
import { SplitCanvas, SeamButton, WorldLabel } from "./seam";

/* Explain: a working retriever, not an example picker, staged on the split.
   The concept holds the technical world; the analogy a professional actually
   published holds the legible one; retrieval is the crossing. Nothing is
   ever generated; a miss says so. Library: src/content/explainLibrary.json,
   baked by scripts/gen_explain_library.py from the register dataset. */

type Analogy = {
  concept: string;
  text: string;
  match: string[];
  attribution: string;
  license: string | null;
  url: string | null;
  confidence: number | null;
};

const LIBRARY = (library as { analogies: Analogy[] }).analogies;

const STOP = new Set([
  "the", "a", "an", "is", "are", "was", "were", "of", "to", "in", "on", "for",
  "and", "or", "it", "its", "this", "that", "with", "as", "by", "from",
  "about", "into", "over", "under", "what", "how", "why", "our", "your",
]);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function bestAnalogy(input: string): Analogy | null {
  const n = ` ${norm(input)} `;
  const toks = new Set(n.trim().split(" ").filter((t) => t.length >= 3 && !STOP.has(t)));
  let best: Analogy | null = null;
  let bestScore = 0;
  for (const e of LIBRARY) {
    let s = 0;
    for (const m of e.match) {
      if (m.includes(" ")) {
        if (n.includes(` ${m} `)) s += 4; // phrase hit: strong evidence
      } else if (toks.has(m)) {
        s += 2; // distinctive keyword hit
      }
    }
    if (s > bestScore || (s === bestScore && s > 0 && best !== null && (e.confidence ?? 0) > (best.confidence ?? 0))) {
      best = e;
      bestScore = s;
    }
  }
  return bestScore >= 2 ? best : null;
}

const SUGGESTIONS = ["hashing", "DDoS", "buffer overflow", "zero trust", "OAuth", "lateral movement", "ransomware"];

export function ExplainMode() {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<"idle" | "done">("idle");
  const [result, setResult] = useState<Analogy | null>(null);
  const [runs, setRuns] = useState(0);

  function explain(text: string) {
    if (!text.trim()) return;
    setResult(bestAnalogy(text));
    setPhase("done");
    setRuns((n) => n + 1);
  }

  /* the technical world: a finding, or just a term */
  const left = (
    <div>
      <WorldLabel world="tech" title="technical" sub="a finding, or just a concept" htmlFor="explain-query" />
      <textarea
        id="explain-query"
        name="explain-query"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        rows={8}
        placeholder="Paste a finding, or name a concept to explain..."
        className="mono mt-4 w-full rounded-[10px] border p-3 text-[12.5px] leading-[1.7]"
        style={{ borderColor: "var(--color-tech-line)", background: "var(--color-surface)", color: "var(--color-ink)" }}
      />
      <p className="mono mt-3 text-[10.5px]" style={{ color: "var(--color-muted)" }}>
        {copy.retrievesNote(LIBRARY.length)}
      </p>
    </div>
  );

  /* the legible world: a real analogy, its author on the record */
  const right = (
    <div>
      <WorldLabel world="legible" title="legible" sub="for a non-expert" />
      <div className="mt-6" aria-live="polite">
        {phase === "idle" ? (
          <div>
            <div className="flex flex-col gap-2" aria-hidden>
              <span className="h-[3px] w-24 rounded-full" style={{ background: "var(--color-accent)", opacity: 0.75 }} />
              <span className="h-[3px] w-14 rounded-full" style={{ background: "var(--color-accent)", opacity: 0.35 }} />
              <span className="h-[3px] w-8 rounded-full" style={{ background: "var(--color-accent)", opacity: 0.16 }} />
            </div>
            <p className="mt-5 max-w-[44ch] text-[13.5px]" style={{ color: "var(--color-muted)" }}>
              {copy.idle}
            </p>
          </div>
        ) : result ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={result.concept + result.attribution}
              initial={reduce ? false : { opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: 8 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <p className="mono text-[11px]" style={{ color: "var(--color-accent-ink)" }}>
                {result.concept}
              </p>
              <p className="mt-3 max-w-[60ch] whitespace-pre-wrap text-[15.5px] leading-[1.7]" style={{ color: "var(--color-ink)" }}>
                {result.text}
              </p>
              <div className="mono mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px]" style={{ color: "var(--color-muted)" }}>
                <span>
                  {result.attribution}
                  {result.license ? ` · ${result.license}` : ""}
                </span>
                {result.url ? (
                  <a href={result.url} target="_blank" rel="noopener" className="inline-flex items-center gap-0.5" style={{ color: "var(--color-accent-ink)" }}>
                    source <ArrowUpRight size={10} weight="bold" />
                  </a>
                ) : null}
              </div>
              <p className="mono mt-3 text-[10.5px]" style={{ color: "var(--color-muted)" }}>
                {copy.verbatimNote}
              </p>
            </motion.div>
          </AnimatePresence>
        ) : (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <p className="text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>
              {copy.missHeading}
            </p>
            <p className="mt-2 max-w-[52ch] text-[13.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
              {copy.missBody}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setQuery(s);
                    explain(s);
                  }}
                  className="hov hov-bc hov-fg mono rounded-full px-3 py-1.5 text-[12px] active:translate-y-px"
                  style={{ color: "var(--color-ink-2)", border: "1px solid var(--color-line-2)", ["--hv-bc" as string]: "var(--color-accent-line)", ["--hv-fg" as string]: "var(--color-ink)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );

  return (
    <SplitCanvas
      state={phase === "done" && result ? "crossed" : "idle"}
      crossKey={runs}
      left={left}
      seam={
        <SeamButton
          label="explain"
          icon={<Quotes size={20} weight="bold" aria-hidden />}
          onClick={() => explain(query)}
          disabled={!query.trim()}
        />
      }
      right={right}
    />
  );
}
