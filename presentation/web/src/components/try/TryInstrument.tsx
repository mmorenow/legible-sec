"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ReviewStudio } from "./review/ReviewStudio";
import { ExplainMode } from "./ExplainMode";
import { EASE } from "./gate";

/* The /try instrument shell. The headline IS the selector: four verbs set in
   display type, the active one inked with a cobalt bar that slides between
   words. Everything below is the chosen surface. Deep links: /try/#review
   (alias #judge), #explain, #browse (alias #precedents). */

/* Each mode declares where its text goes, because that differs by mode and a
   single global claim would be false on half of them. Translate and Browse
   POST what the visitor types to the local motor on 127.0.0.1; Review and
   Explain compute in the tab, and Review only reaches the motor if the reader
   presses for precedents. `local` = nothing is sent by the mode itself. */
/* Two modes. Translate and Browse both needed the local motor, which no visitor
   runs, and both belonged to the generation side the project archived. Review is
   first because it is what the project is now: the checks run here, in this tab,
   over the text you paste, with nothing sent anywhere. */
const MODES = [
  { key: "review", word: "Review", blurb: "paste a finding and a summary of it, and the checks read the summary against the finding", privacy: "the checks run in this tab, in JavaScript · nothing you paste is sent anywhere", local: true },
  { key: "explain", word: "Explain", blurb: "a concept explained through an analogy a professional actually published", privacy: "the analogy library ships with this page · nothing you type is sent anywhere", local: true },
] as const;

type ModeKey = (typeof MODES)[number]["key"];

const HASH_TO_MODE: Record<string, ModeKey> = {
  "#review": "review",
  "#judge": "review", // the judge demo lived here
  "#explain": "explain",
};

/* Browse moved to /library and Translate is archived, so their deep links go
   somewhere that exists rather than silently landing on the wrong tab. */
const HASH_REDIRECT: Record<string, string> = {
  "#browse": "/library/",
  "#precedents": "/library/",
  "#translate": "/model/",
};

export function TryInstrument() {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<ModeKey>("review");
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    // sync with the URL hash (deep links land here after hydration; in-page
    // anchor navigation keeps working)
    const apply = () => {
      const redirect = HASH_REDIRECT[window.location.hash];
      if (redirect) {
        window.location.replace(redirect);
        return;
      }
      const m = HASH_TO_MODE[window.location.hash];
      if (m) setMode(m);
    };
    window.addEventListener("hashchange", apply);
    const t = window.setTimeout(apply, 0);
    return () => {
      window.removeEventListener("hashchange", apply);
      window.clearTimeout(t);
    };
  }, []);

  function select(m: ModeKey) {
    setMode(m);
    window.history.replaceState(null, "", m === "review" ? window.location.pathname : `#${m}`);
  }

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const j = (i + (e.key === "ArrowRight" ? 1 : MODES.length - 1)) % MODES.length;
    select(MODES[j].key);
    tabsRef.current[j]?.focus();
  }

  const active = MODES.find((m) => m.key === mode) ?? MODES[0];

  return (
    <div>
      {/* the headline that is also the instrument selector */}
      <div role="tablist" aria-label="LEGIBLE instruments" className="flex flex-wrap items-baseline gap-x-7 gap-y-2 sm:gap-x-9">
        {MODES.map((m, i) => {
          const on = m.key === mode;
          return (
            <button
              key={m.key}
              ref={(el) => { tabsRef.current[i] = el; }}
              role="tab"
              id={`try-tab-${m.key}`}
              aria-selected={on}
              aria-controls={`try-panel-${m.key}`}
              tabIndex={on ? 0 : -1}
              onClick={() => select(m.key)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className="hov-c hov-fg relative pb-2 font-[640] tracking-[-0.026em]"
              style={{
                fontSize: "clamp(1.6rem, 3.4vw, 2.75rem)",
                lineHeight: 1.05,
                color: on ? "var(--color-ink)" : "var(--color-muted)",
                ["--hv-fg" as string]: on ? "var(--color-ink)" : "var(--color-ink-2)",
              }}
            >
              {m.word}
              {/* the active bar is the seam in miniature: rust meeting cobalt */}
              {on ? (
                reduce ? (
                  <span
                    className="absolute inset-x-0 bottom-0 h-[3px] rounded-full"
                    style={{ background: "linear-gradient(90deg, var(--color-tech), var(--color-accent))" }}
                    aria-hidden
                  />
                ) : (
                  <motion.span
                    layoutId="try-mode-bar"
                    className="absolute inset-x-0 bottom-0 h-[3px] rounded-full"
                    style={{ background: "linear-gradient(90deg, var(--color-tech), var(--color-accent))" }}
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    aria-hidden
                  />
                )
              ) : null}
            </button>
          );
        })}
      </div>

      {/* the changing role line + the standing truth */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={mode}
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="mono text-[12.5px]"
            style={{ color: "var(--color-muted)" }}
          >
            {active.blurb}
          </motion.p>
        </AnimatePresence>
        <p className="mono flex min-w-0 items-baseline gap-2 text-[11px]" style={{ color: "var(--color-muted)" }}>
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: active.local ? "var(--color-ok)" : "var(--color-tech)" }}
            aria-hidden
          />
          <span>{active.privacy}</span>
        </p>
      </div>

      {/* Both panels stay MOUNTED. They used to swap through AnimatePresence,
          which unmounted the one leaving, and a visitor who tapped Explain to
          see what it was lost the finding and the draft they had just pasted,
          plus the situation they had chosen. Nothing warned them. The hidden
          panel keeps its state, is display:none so it costs no layout, and
          carries hidden + inert so it is out of the tab order and out of the
          accessibility tree.

          There is no entrance animation on the switch, and there cannot be one
          that is keyed on the mode: a `key` here is exactly what makes React
          unmount the subtree, which is the same state loss by another route.
          The first attempt at this fix kept the keyed wrapper and the text was
          still gone. A 260ms fade is worth less than a pasted finding, and the
          selector's own sliding bar and blurb line still carry the change. */}
      <div className="mt-6">
        <div>
          {MODES.map((m) => (
            <div
              key={m.key}
              role="tabpanel"
              id={`try-panel-${m.key}`}
              aria-labelledby={`try-tab-${m.key}`}
              hidden={mode !== m.key}
              inert={mode !== m.key ? true : undefined}
              style={{ display: mode === m.key ? undefined : "none" }}
            >
              {m.key === "review" ? <ReviewStudio /> : <ExplainMode />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
