"use client";

import { motion, useReducedMotion } from "motion/react";
import { CheckCircle, Warning, X } from "@phosphor-icons/react";
import { judgement as copy } from "@/content/copy/review";
import { digest, type ClaimVerdict, type JargonVerdict, type JudgementReport, type QuestionVerdict } from "@/lib/judgeLlm";
import { EASE, TONE_INK, TONE_SOFT } from "../gate";

/* The model's half of the review.
 *
 * Everything above this panel decides. This panel reports. The distinction is
 * carried visually and not only in words: no result here takes the fail chrome
 * the rule layer uses, every item is stamped as opinion, and a quote the model
 * could not anchor in the text is marked rather than quietly dropped.
 *
 * The span shown under a judgement is the REAL text, pulled out of the source
 * or the draft by the anchoring pass in judgeLlm.ts, never the model's copy of
 * it. That is the only reason a quote on this panel can be read as evidence at
 * all: it is the same promise the deterministic checks make, kept by checking
 * the model rather than by trusting it.
 */

/* Copy that is structural rather than prose: the two words that name which text
   a span was taken from. They live here because they are labels on a control,
   not sentences, and because the panel is the only place they can appear. */
function Span({ label, text, tone }: { label: string; text: string; tone: "tech" | "legible" }) {
  return (
    <div className="mt-2">
      <p className="mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--color-muted)" }}>
        {label}
      </p>
      <p
        className="mono mt-1 rounded-[6px] px-2 py-1.5 text-[12px] leading-[1.6]"
        style={{
          color: "var(--color-ink)",
          background: "var(--color-surface-2)",
          borderLeft: `2px solid ${tone === "tech" ? "var(--color-tech-line)" : "var(--color-accent-line)"}`,
        }}
      >
        {text}
      </p>
    </div>
  );
}

function UnanchoredMark() {
  return (
    <span
      className="mono inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
      style={{ color: TONE_INK.warn, background: TONE_SOFT.warn }}
      title={copy.unanchoredWhy}
    >
      <Warning size={10} weight="bold" aria-hidden />
      {copy.unanchoredChip}
    </span>
  );
}

/** One row. Shared shape so a claim, a question and a jargon class read alike. */
function Row({
  label,
  verdictWord,
  flagged,
  note,
  anchored,
  source,
  children,
}: {
  label: string;
  verdictWord: string;
  /** Drives emphasis only. Nothing here is a failure, so nothing takes fail chrome. */
  flagged: boolean;
  note: string;
  anchored: boolean;
  /** Who requires the item. Carried from the genre list, and shown, because a
      question with no named authority behind it is just an opinion about an
      opinion. */
  source?: string;
  children?: React.ReactNode;
}) {
  return (
    <li
      className="pl-3.5"
      style={{ borderLeft: `2px solid ${flagged ? TONE_SOFT.warn : "var(--color-line)"}` }}
    >
      <p className="max-w-[70ch] text-[13.5px] leading-relaxed" style={{ color: "var(--color-ink)" }}>
        {label}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className="mono text-[11px]"
          style={{ color: flagged ? TONE_INK.warn : "var(--color-muted)" }}
        >
          {verdictWord}
        </span>
        {!anchored ? <UnanchoredMark /> : null}
        {source ? (
          <span className="text-[11.5px]" style={{ color: "var(--color-ink-2)" }}>
            <span className="mono text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--color-muted)" }}>
              {copy.requiredBy}
            </span>{" "}
            {source}
          </span>
        ) : null}
      </p>
      {note ? (
        <p className="mt-1.5 max-w-[70ch] text-[12.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
          {note}
        </p>
      ) : null}
      {children}
    </li>
  );
}

function Claims({ items }: { items: ClaimVerdict[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h4 className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--color-ink)" }}>
        {copy.claimsHeading}
      </h4>
      <p className="mt-1.5 max-w-[72ch] text-[12.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
        {copy.claimsNote}
      </p>
      <ul className="mt-3 flex flex-col gap-3.5">
        {items.map((c, i) => (
          <Row
            key={`${c.claim}-${i}`}
            label={c.claimSpan ?? c.claim}
            verdictWord={copy.support[c.support]}
            flagged={c.support !== "supported"}
            note={c.note}
            anchored={c.anchored}
          >
            {c.sourceSpan ? <Span label={copy.sourceSpanLabel} text={c.sourceSpan} tone="tech" /> : null}
          </Row>
        ))}
      </ul>
    </section>
  );
}

function Questions({ items }: { items: QuestionVerdict[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h4 className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--color-ink)" }}>
        {copy.questionsHeading}
      </h4>
      <p className="mt-1.5 max-w-[72ch] text-[12.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
        {copy.questionsNote}
      </p>
      <ul className="mt-3 flex flex-col gap-3.5">
        {items.map((q, i) => (
          <Row
            key={`${q.question}-${i}`}
            label={q.question}
            verdictWord={q.answered ? copy.answered : copy.unanswered}
            flagged={!q.answered}
            note={q.note}
            anchored={q.anchored}
            source={q.source}
          >
            {q.draftSpan ? <Span label={copy.draftSpanLabel} text={q.draftSpan} tone="legible" /> : null}
          </Row>
        ))}
      </ul>
    </section>
  );
}

function Jargon({ items }: { items: JargonVerdict[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h4 className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--color-ink)" }}>
        {copy.jargonHeading}
      </h4>
      <p className="mt-1.5 max-w-[72ch] text-[12.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
        {copy.jargonNote}
      </p>
      <ul className="mt-3 flex flex-col gap-3.5">
        {items.map((j, i) => (
          <Row
            key={`${j.className}-${i}`}
            label={j.className}
            verdictWord={j.present ? copy.jargonPresent : copy.jargonAbsent}
            flagged={j.present}
            note={j.note}
            anchored={j.anchored}
            source={j.source}
          >
            {j.draftSpan ? <Span label={copy.draftSpanLabel} text={j.draftSpan} tone="legible" /> : null}
          </Row>
        ))}
      </ul>
    </section>
  );
}

export function JudgementPanel({
  report,
  className = "",
}: {
  report: JudgementReport;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const d = digest(report);

  return (
    <motion.section
      aria-label={copy.heading}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={`rounded-[12px] border p-5 sm:p-6 ${className}`}
      style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* No icon. The quote glyph rendered beside the word as a literal 99
            and read as a count, which is the one thing a chip must never do. */}
        <span
          className="mono inline-flex items-center rounded-md px-2 py-1 text-[10.5px]"
          style={{ color: "var(--color-ink-2)", background: "var(--color-surface-2)" }}
        >
          {copy.opinionChip}
        </span>
        <h3 className="text-[15.5px] font-semibold tracking-[-0.012em]" style={{ color: "var(--color-ink)" }}>
          {copy.heading}
        </h3>
      </div>

      <p className="mono mt-2 text-[11px]" style={{ color: "var(--color-muted)" }}>
        {copy.modelLine(report.model, report.provider)}
      </p>

      {/* The anchoring result, before any judgement is read. A model that could
          not point at the text has said something about its own answer, and
          burying that under the findings would invert the whole contract. */}
      {report.unanchored > 0 ? (
        <p
          className="mt-3 max-w-[72ch] rounded-[8px] p-3 text-[12.5px] leading-relaxed"
          style={{ color: TONE_INK.warn, background: TONE_SOFT.warn }}
        >
          {copy.unanchoredCount(report.unanchored)} {copy.unanchoredWhy}
        </p>
      ) : null}

      {report.authority === "L2" ? (
        <p className="mt-3 max-w-[72ch] text-[12.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
          {copy.advisory}
        </p>
      ) : null}

      {d.total === 0 ? (
        <p className="mt-4 flex max-w-[72ch] items-start gap-2 text-[13px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
          <CheckCircle size={15} weight="bold" aria-hidden style={{ color: "var(--color-muted)", flexShrink: 0, marginTop: 2 }} />
          {copy.nothingFound}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-7">
        <Claims items={report.claims} />
        <Questions items={report.questions} />
        <Jargon items={report.jargon} />
      </div>

      {report.omitted ? (
        <p className="mono mt-6 max-w-[76ch] pt-4 text-[11.5px] leading-relaxed" style={{ color: "var(--color-muted)", borderTop: "1px solid var(--color-line)" }}>
          {copy.omitted(report.omitted.count)}
        </p>
      ) : null}
    </motion.section>
  );
}

/** The control that runs it, and everything that can happen instead. */
export function JudgementRunner({
  state,
  hasKey,
  onRun,
  onCancel,
  error,
  className = "",
}: {
  state: "idle" | "running" | "done";
  hasKey: boolean;
  onRun: () => void;
  onCancel: () => void;
  error: string | null;
  className?: string;
}) {
  const running = state === "running";
  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={running ? onCancel : onRun}
          disabled={!hasKey && !running}
          className="hov hov-bc mono rounded-full px-3.5 py-1.5 text-[12px] active:translate-y-px"
          style={{
            color: hasKey || running ? "var(--color-ink)" : "var(--color-muted)",
            border: "1px solid var(--color-line)",
            background: "var(--color-surface)",
            cursor: hasKey || running ? "pointer" : "default",
            opacity: hasKey || running ? 1 : 0.6,
            ["--hv-bc" as string]: "var(--color-accent-line)",
          }}
        >
          {running ? copy.cancel : state === "done" ? copy.rerun : copy.run}
        </button>
        {running ? (
          <span className="mono text-[11.5px]" style={{ color: "var(--color-muted)" }}>
            {copy.running}
          </span>
        ) : null}
        {!hasKey && !running ? (
          <span className="max-w-[52ch] text-[12.5px]" style={{ color: "var(--color-ink-2)" }}>
            {copy.needsKey}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="flex items-start gap-1.5 text-[12.5px]" style={{ color: TONE_INK.fail }}>
          <X size={13} weight="bold" aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
