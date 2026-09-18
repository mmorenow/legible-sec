"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { runGate } from "@/lib/judge";
import { runGenreChecks, type JurisdictionId } from "@/lib/genreChecks";
import { buildReport } from "@/lib/reviewModel";
import { LlmError, runJudgement, type JudgementReport } from "@/lib/judgeLlm";
import type { SituationId } from "@/content/rubric";
import { empty, intro, judgement, layers } from "@/content/copy/review";
import { KeyGate, useStoredKey } from "../KeyGate";
import { SituationPicker, type SituationChoice } from "./SituationPicker";
import { SourceInputs } from "./SourceInputs";
import { ResultList } from "./ResultList";
import { AxisScores } from "./AxisScores";
import { UndecidedPanel } from "./UndecidedPanel";
import { JudgementPanel, JudgementRunner } from "./JudgementPanel";

/* Review, composed.
 *
 * Everything below runs in this tab. The eight checks in judge.ts and the three
 * in genreChecks.ts are pure functions over two strings and a situation, so
 * there is no request to make and nothing to wait for: the report recomputes as
 * the draft changes. The key layer is not needed for any of it, which is the
 * shape of the argument the rubric makes about its own layers.
 *
 * The one thing this component must not do is let a clean result read as
 * approval. A pass here is a non detection, and the panel that says what went
 * unexamined carries the same weight as the panel that says what fired.
 */

export function ReviewStudio() {
  const [source, setSource] = useState("");
  const [draft, setDraft] = useState("");
  const [situation, setSituation] = useState<SituationId | null>(null);
  const [jurisdiction, setJurisdiction] = useState<JurisdictionId | null>(null);
  /* KeyGate subscribes to the store itself, so the layer strip reads the same
     source rather than being told about changes. */
  const keyed = useStoredKey() !== null;

  /* The checks are cheap but not free, and they run on every keystroke. The
     deferred value keeps typing responsive on a long finding. */
  const dSource = useDeferredValue(source);
  const dDraft = useDeferredValue(draft);

  const ready = dSource.trim().length > 0 && dDraft.trim().length > 0 && situation !== null;

  /* The model layer. It is deliberately NOT reactive: the rule layer recomputes
     on every keystroke because it is free, and this one costs the visitor money
     and takes seconds, so it runs when asked and is thrown away the moment the
     texts it judged stop being the texts on screen. A stale opinion presented
     beside fresh rules would be the worst failure this surface could have. */
  const [judged, setJudged] = useState<JudgementReport | null>(null);
  const [judgeState, setJudgeState] = useState<"idle" | "running" | "done">("idle");
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const report = useMemo(() => {
    if (!ready || situation === null) return null;
    const gate = runGate(dSource, dDraft);
    const genre = runGenreChecks(dDraft, situation, jurisdiction);
    return buildReport(situation, gate, genre);
  }, [ready, dSource, dDraft, situation, jurisdiction]);

  /* Any change to what is being judged invalidates the judgement. */
  useEffect(() => {
    abortRef.current?.abort();
    setJudged(null);
    setJudgeState("idle");
    setJudgeError(null);
  }, [dSource, dDraft, situation, jurisdiction]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runJudge = useCallback(async () => {
    if (!report || situation === null) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setJudgeState("running");
    setJudgeError(null);
    try {
      const out = await runJudgement({
        source: dSource,
        draft: dDraft,
        situation,
        undecided: report.undecided,
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      setJudged(out);
      setJudgeState("done");
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setJudgeState("idle");
      setJudgeError(messageFor(e));
    }
  }, [report, situation, dSource, dDraft]);

  const cancelJudge = useCallback(() => {
    abortRef.current?.abort();
    setJudgeState("idle");
  }, []);

  function onChoice(choice: SituationChoice) {
    setSituation(choice.situation);
    setJurisdiction(choice.jurisdiction);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.018em]" style={{ color: "var(--color-ink)" }}>
          {intro.heading}
        </h2>
        <p className="mt-2 max-w-[72ch] text-[16px] leading-[1.6]" style={{ color: "var(--color-ink-2)" }}>
          {intro.lede}
        </p>

        <div className="mt-7">
          <SituationPicker situation={situation} jurisdiction={jurisdiction} onChange={onChoice} />
        </div>
      </div>

      <SourceInputs
        source={source}
        draft={draft}
        onSourceChange={setSource}
        onDraftChange={setDraft}
        below={
          report ? (
            <div className="flex flex-col gap-6 pt-2">
              <ResultList
                flags={report.flags}
                ranCount={report.ranCount}
                situation={report.situation}
                advisoryNote={report.advisoryNote ?? undefined}
              />
              <AxisScores axes={report.axes} situation={report.situation} />
              <UndecidedPanel undecided={report.undecided} declared={report.declared} />

              {/* The model layer sits under the rules, never beside them, so the
                  reading order matches the authority order. */}
              <div
                className="rounded-[12px] border border-dashed p-5 sm:p-6"
                style={{ borderColor: "var(--color-line)" }}
              >
                <h3 className="text-[15.5px] font-semibold tracking-[-0.012em]" style={{ color: "var(--color-ink)" }}>
                  {judgement.heading}
                </h3>
                <p className="mt-2 max-w-[72ch] text-[13px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
                  {judgement.lede}
                </p>
                <JudgementRunner
                  className="mt-4"
                  state={judgeState}
                  hasKey={keyed}
                  onRun={runJudge}
                  onCancel={cancelJudge}
                  error={judgeError}
                />
              </div>

              {judged ? <JudgementPanel report={judged} /> : null}
            </div>
          ) : (
            <div className="mx-auto max-w-[60ch] pt-6 text-center">
              <p className="text-[15px]" style={{ color: "var(--color-ink-2)" }}>
                {empty.heading}
              </p>
              <p className="mt-1.5 text-[14px]" style={{ color: "var(--color-muted)" }}>
                {empty.note}
              </p>
            </div>
          )
        }
      />

      {/* The layer contract, stated where the reader can see which half is
          running. The deterministic layer needs nothing; the layers above it
          need a key the visitor supplies and that never leaves their browser. */}
      <div>
        <div
          className="rounded-[14px] border p-5 sm:p-6"
          style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
        >
          <p className="mono text-[12px] uppercase tracking-[0.13em]" style={{ color: "var(--color-muted)" }}>
            {layers.heading}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[15px] font-semibold" style={{ color: "var(--color-ok-ink)" }}>
                {layers.deterministic.label} · {layers.deterministic.state}
              </p>
              <p className="mt-1.5 text-[14px] leading-[1.55]" style={{ color: "var(--color-ink-2)" }}>
                {layers.deterministic.note}
              </p>
            </div>
            <div>
              <p
                className="text-[15px] font-semibold"
                style={{ color: keyed ? "var(--color-warn-ink)" : "var(--color-muted)" }}
              >
                {layers.withKey.label} · {keyed ? layers.withKey.stateOn : layers.withKey.stateOff}
              </p>
              <p className="mt-1.5 text-[14px] leading-[1.55]" style={{ color: "var(--color-ink-2)" }}>
                {layers.withKey.note}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <KeyGate />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Provider failures reach the visitor as one sentence they can act on. The key
   never appears in any of them, which is checked by keeping the mapping here
   rather than interpolating anything off the error. */
function messageFor(e: unknown): string {
  if (e instanceof LlmError) {
    switch (e.kind) {
      case "auth":
        return judgement.errors.auth;
      case "quota":
        return judgement.errors.quota;
      case "rate-limit":
        return judgement.errors.rateLimit;
      case "network":
        return judgement.errors.network;
      case "response":
        return judgement.errors.response;
      case "no-key":
        return judgement.needsKey;
      default:
        return e.message || judgement.errors.generic;
    }
  }
  return judgement.errors.generic;
}
