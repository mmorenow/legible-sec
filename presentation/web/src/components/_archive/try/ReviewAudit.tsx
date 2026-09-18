"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ShieldCheck } from "@phosphor-icons/react";
import { annotateDraft, GATE_CHECKS, runGate, sourceTargets, translationTargets, type GateReport, type SentenceNote } from "@/lib/judge";
import { EASE, GateRail, GateSweep, Highlighted, TONE_INK, TONE_SOFT } from "@/components/try/gate";
import { PrecedentsBand } from "@/components/try/PrecedentsBand";
import { SplitCanvas, SeamButton, WorldLabel } from "@/components/try/seam";

/* Review: the reverse gear and the reason this page exists, staged on the
   split. The source finding holds the technical world; the draft under audit
   holds the legible world; the deterministic gate is mounted on the SEAM and
   reads across it. Where the crossing broke, both panels light the exact
   strings, and the verdict hangs from the seam below. Both inputs start
   EMPTY: this is a tool, not a demo. The audit itself runs entirely in this
   tab and sends nothing; only the precedents band, and only when the reader
   presses it, calls the local motor.

   COPY LAW for this surface: a pass is a NON-DETECTION, never a verification.
   The gate is string-level. It cannot see paraphrase, it cannot see severity
   softened into synonyms, and its caveat recall is below the bar the project
   set for it. Nothing here may be worded as if it could. What the layer
   cannot decide is declared out loud in the coverage panel below the verdict,
   because the measurement contract says an undecidable property is declared,
   not silently passed. */

/* ---------------------------------------------------------------------------
   "What this does not check": the declared edge of the deterministic gate.

   This panel is not a disclaimer bolted onto a result. The project's
   measurement contract requires that a property a layer cannot decide be
   DECLARED rather than silently passed, so a checker that publishes its own
   coverage gaps is the product working as designed. It therefore carries the
   same width, the same rule weight and the same type sizes as the verdict
   above it, and it renders on every audit, pass or fail.

   Tone tokens come from ./gate (TONE_INK / TONE_SOFT, warn), so it reads as
   part of the same family as the rail and the flag rows. --------------- */

const GAPS: { label: string; body: string }[] = [
  {
    label: "paraphrase",
    body:
      "A draft can hold the meaning while changing every word, or hold the words and lose the meaning. Matching strings cannot tell those two apart.",
  },
  {
    label: "severity softened by synonym",
    body:
      "severity_drift reads the labeled severity words. A critical finding retold as something worth a look keeps every number and passes.",
  },
  {
    label: "the questions its reader actually has",
    body:
      "Whether the draft answers what the person reading it needs to know: am I affected, since when, what happens next. Nothing here reads for that.",
  },
  {
    label: "whether the register fits the audience",
    body:
      "A board, a customer and a regulator are not the same reader. No check on this page knows which one the draft is for, or whether it sounds right to them.",
  },
  {
    label: "whether it ends in something actionable",
    body:
      "Whether the draft closes on a decision the reader can make or a step they can take. A summary that ends in nothing clears every check above.",
  },
  {
    label: "caveat detection is below its own bar",
    body:
      "caveat_parity recall measures under the bar this project set for it, so a condition dropped from the source can pass through uncaught. Known, open, unfixed.",
  },
];

function CoverageGaps() {
  const reduce = useReducedMotion();
  return (
    <motion.section
      aria-label="What this does not check"
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : 0.25 }}
      className="mt-9 w-full max-w-[820px] rounded-[12px] border p-5 sm:p-6"
      style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className="mono inline-flex items-center rounded-md px-2 py-1 text-[10.5px]"
          style={{ color: TONE_INK.warn, background: TONE_SOFT.warn }}
        >
          not checked
        </span>
        <h3 className="text-[15.5px] font-semibold tracking-[-0.012em]" style={{ color: "var(--color-ink)" }}>
          What this does not check
        </h3>
      </div>
      <p className="mt-2.5 max-w-[62ch] text-[13.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
        The gate above reads strings. Everything below belongs to the same draft, and nothing on this page decides
        any of it. A clean rail means these went unexamined, not that they went well.
      </p>

      <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {GAPS.map((g) => (
          <li key={g.label} className="pl-3" style={{ borderLeft: `2px solid ${TONE_SOFT.warn}` }}>
            <p className="mono text-[11.5px]" style={{ color: TONE_INK.warn }}>
              {g.label}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
              {g.body}
            </p>
          </li>
        ))}
      </ul>

      <p className="mono mt-6 max-w-[70ch] pt-4 text-[11.5px] leading-relaxed" style={{ color: "var(--color-muted)", borderTop: "1px solid var(--color-line)" }}>
        this list is published, not conceded · the measurement contract says a property a layer cannot decide gets
        declared instead of quietly passed, so the verdict above stops exactly here
      </p>
    </motion.section>
  );
}

export function ReviewAudit() {
  const reduce = useReducedMotion();
  const [source, setSource] = useState("");
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<"edit" | "audited">("edit");
  const [report, setReport] = useState<GateReport | null>(null);
  const [notes, setNotes] = useState<SentenceNote[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [runs, setRuns] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  function audit() {
    if (!source.trim() || !draft.trim()) return;
    const rep = runGate(source, draft);
    setReport(rep);
    setNotes(annotateDraft(source, draft, rep));
    setSelected(rep.flags[0]?.check ?? null);
    setPhase("audited");
    setRuns((n) => n + 1);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function backToEdit() {
    setPhase("edit");
    setReport(null);
    setSelected(null);
  }

  const selectedFlag = report?.flags.find((f) => f.check === selected) ?? null;
  const selectedIsPass = selected != null && (report?.passed.includes(selected) ?? false);
  const srcMarks = selectedFlag ? sourceTargets(selectedFlag) : [];
  const trnMarks = selectedFlag ? translationTargets(selectedFlag) : [];
  const fails = report?.flags.filter((f) => f.level === "fail").length ?? 0;
  const warns = report?.flags.filter((f) => f.level === "warn").length ?? 0;

  /* the technical world: the truth being summarized */
  const left = (
    <div>
      <WorldLabel
        world="tech"
        title="technical"
        sub="the source finding, the truth being summarized"
        htmlFor={phase === "edit" ? "review-source" : undefined}
      />
      {phase === "edit" ? (
        <textarea
          id="review-source"
          name="review-source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={12}
          placeholder="Paste the technical finding: description, severity, numbers, caveats..."
          className="mono mt-4 w-full rounded-[10px] border p-3 text-[12.5px] leading-[1.7]"
          style={{ borderColor: "var(--color-tech-line)", background: "var(--color-surface)", color: "var(--color-ink)" }}
        />
      ) : (
        <div
          className="relative mt-4 overflow-hidden rounded-[10px] border p-3.5"
          style={{ borderColor: "var(--color-tech-line)", background: "var(--color-tech-soft)" }}
        >
          <GateSweep playKey={`src-${runs}`} height={260} />
          <p className="mono whitespace-pre-wrap text-[12.5px] leading-[1.7]" style={{ color: "var(--color-ink)" }}>
            <Highlighted text={source} targets={srcMarks} tone={selectedFlag?.level === "warn" ? "warn" : "fail"} />
          </p>
        </div>
      )}
    </div>
  );

  /* the legible world: anyone's wording, under oath */
  const right = (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <WorldLabel
          world="legible"
          title="the draft under audit"
          sub="anyone's wording"
          htmlFor={phase === "edit" ? "review-draft" : undefined}
        />
        {phase === "audited" ? (
          <button
            type="button"
            onClick={backToEdit}
            className="hov hov-bc hov-fg mono rounded-full px-3 py-1 text-[11px] active:translate-y-px"
            style={{
              border: "1px solid var(--color-line-2)",
              color: "var(--color-ink-2)",
              ["--hv-bc" as string]: "var(--color-accent-line)",
              ["--hv-fg" as string]: "var(--color-ink)",
            }}
          >
            edit the pair
          </button>
        ) : null}
      </div>
      {phase === "edit" ? (
        <textarea
          id="review-draft"
          name="review-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={12}
          placeholder="Paste the summary somebody wrote about it: an email, a slide line, another AI's output..."
          className="mt-4 w-full rounded-[10px] border p-3 text-[13.5px] leading-relaxed"
          style={{ borderColor: "var(--color-accent-line)", background: "var(--color-surface)", color: "var(--color-ink)" }}
        />
      ) : (
        <div
          className="relative mt-4 overflow-hidden rounded-[10px] border p-3.5"
          style={{ borderColor: "var(--color-accent-line)", background: "var(--color-accent-soft)" }}
        >
          <GateSweep playKey={`trn-${runs}`} height={260} />
          <p className="text-[14px] leading-relaxed" style={{ color: "var(--color-ink)" }}>
            {notes.map((n, i) => {
              const tinted = n.level !== "ok";
              const tint = n.level === "red" ? "var(--color-bad-soft)" : "var(--color-warn-soft)";
              const inkTone = n.level === "red" ? TONE_INK.fail : TONE_INK.warn;
              return (
                <span key={i}>
                  <span
                    role={tinted ? "button" : undefined}
                    tabIndex={tinted ? 0 : undefined}
                    onClick={tinted ? () => setSelected(n.checks[0]) : undefined}
                    onKeyDown={
                      tinted
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelected(n.checks[0]);
                            }
                          }
                        : undefined
                    }
                    title={tinted ? n.reasons[0] : undefined}
                    style={
                      tinted
                        ? {
                            background: tint,
                            borderRadius: 4,
                            padding: "1px 2px",
                            cursor: "pointer",
                            boxShadow: `inset 0 -1.5px 0 ${inkTone}`,
                          }
                        : undefined
                    }
                  >
                    <Highlighted text={n.text} targets={trnMarks} tone={selectedFlag?.level === "warn" ? "warn" : "fail"} />
                  </span>{" "}
                </span>
              );
            })}
          </p>
        </div>
      )}
    </div>
  );

  /* the verdict, hanging from the seam: the gate read across it */
  const below = (
    <div aria-live="polite">
      {phase === "audited" && report ? (
        <motion.div
          ref={resultsRef}
          key={runs}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex flex-col items-center pt-1"
        >
          <span className="seam-connector" aria-hidden />
          <p
            className="mono mt-3 text-center text-[11.5px]"
            style={{ color: fails ? "var(--color-bad-ink)" : warns ? "var(--color-warn-ink)" : "var(--color-ok-ink)" }}
          >
            {fails
              ? `${fails} check${fails > 1 ? "s" : ""} failed${warns ? `, ${warns} warned` : ""} · every failure shows its strings`
              : warns
                ? `no check failed, ${warns} warned`
                : `${GATE_CHECKS.length} checks ran, none fired · a pass here means nothing was detected, not that nothing is wrong`}
          </p>
          <div className="mt-4">
            <GateRail report={report} selected={selected} onSelect={setSelected} stampKey={runs} center />
          </div>

          <div className="mt-5 min-h-[64px] w-full max-w-[820px] pt-4" style={{ borderTop: "1px solid var(--color-line)" }}>
            {selectedFlag ? (
              <div>
                <p className="text-[13px]" style={{ color: "var(--color-ink)" }}>
                  <span className="mono" style={{ color: selectedFlag.level === "warn" ? "var(--color-warn-ink)" : "var(--color-bad-ink)" }}>
                    {selectedFlag.check}
                  </span>{" "}
                  <span style={{ color: "var(--color-muted)" }}>{selectedFlag.message} · lit in the worlds above</span>
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {selectedFlag.evidence.map((e, i) => (
                    <span
                      key={i}
                      className="mono rounded-md px-2 py-1 text-[11px]"
                      style={{
                        background: selectedFlag.level === "warn" ? "var(--color-warn-soft)" : "var(--color-bad-soft)",
                        color: selectedFlag.level === "warn" ? "var(--color-warn-ink)" : "var(--color-bad-ink)",
                        border: `1px solid color-mix(in oklch, ${selectedFlag.level === "warn" ? "var(--color-warn-ink)" : "var(--color-bad-ink)"} 30%, transparent)`,
                      }}
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            ) : selectedIsPass ? (
              <p className="mono text-[12.5px]" style={{ color: "var(--color-ok-ink)" }}>
                {selected} ran and found nothing to flag · this check has no evidence to show, because a pass is the
                absence of a match
              </p>
            ) : (
              <p className="mono text-[12px]" style={{ color: "var(--color-muted)" }}>
                select a check to see its proof
              </p>
            )}
          </div>

          {/* the declared edge of the verdict: same width and weight as the
              results, because a layer that states its own coverage gaps is
              the measurement contract working, not a disclaimer. */}
          <CoverageGaps />

          <div className="mt-6 flex w-full max-w-[820px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <span
              className="mono inline-flex w-fit items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px]"
              style={{ color: "var(--color-muted)", border: "1px dashed var(--color-line)" }}
            >
              LLM layer
              <span style={{ opacity: 0.7 }}>· specified, not built · no model runs on this page</span>
            </span>
            <p className="mono text-[11.5px]" style={{ color: "var(--color-muted)" }}>
              zero false authority: a failure shows its exact strings, a pass shows only that nothing matched.
            </p>
          </div>

          {/* how real reports crossed this same ground: the band asks the
              local motor's search for the source finding's nearest pairs,
              only when the reader presses for them. Remounts with `runs`
              (the parent key), so a re-audit folds it back down. */}
          <div className="mt-9 w-full">
            <PrecedentsBand query={source} caption="precedents · how real reports crossed this same ground" />
          </div>
        </motion.div>
      ) : null}
    </div>
  );

  return (
    <SplitCanvas
      state={phase === "audited" ? "crossed" : "idle"}
      crossKey={runs}
      left={left}
      seam={
        <SeamButton
          label="audit"
          icon={<ShieldCheck size={20} weight="bold" aria-hidden />}
          onClick={audit}
          disabled={!source.trim() || !draft.trim()}
        />
      }
      right={right}
      below={below}
    />
  );
}
