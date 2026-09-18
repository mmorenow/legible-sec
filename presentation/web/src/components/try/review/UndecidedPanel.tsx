"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { results, undecidedPanel as copy } from "@/content/copy/review";
import type { FormatConstant } from "@/content/genres";
import { GENRE_CHECKS, type DeclaredContext, type GenreCheck, type Undecided } from "@/lib/genreChecks";
import { EASE, TONE_INK, TONE_SOFT } from "../gate";

/* What the rule layer could not settle, and what it states without judging.
 *
 * This is not a disclaimer bolted to a result. The measurement contract says a
 * property a layer cannot decide is declared rather than quietly passed, so a
 * checker that publishes its own undecidables is the instrument working as
 * designed. It carries the same chrome, the same rule weight and the same type
 * sizes as the results above it.
 *
 * Two different things live here and they are kept apart. An undecided item is
 * something the rule layer looked at and could not settle. A declared item is
 * something true of the genre that the checker states and deliberately does not
 * enforce, such as a 72 hour deadline, which is a property of the process and
 * not of the text.
 *
 * Both lists run long on the formal genres: 25 mandatory questions share one
 * reason and 8 deadlines share one, so the reason is stated once per group and
 * the items sit under it.
 *
 * The items fold and the counts and reasons do not. That distinction is the
 * whole design: unfolded, this panel runs three times the length of the panel
 * that reports actual failures, and the instrument would be burying its own
 * result behind its own honesty. Nothing is dropped, and every count is on
 * screen before anything is opened.
 */

/** The corpus paths are long. The file is the provenance; the folder is not. */
function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function SourceLine({ file }: { file: string }) {
  return (
    <span className="mono text-[10.5px]" style={{ color: "var(--color-muted)" }} title={file}>
      {copy.sourceFileLabel} {basename(file)}
    </span>
  );
}

/* The fold. Native <details> so it works without JavaScript, answers to the
   keyboard on its own and needs no state. The summary carries the count, which
   is the part that must stay readable when it is closed. */
function Fold({ n, children }: { n: number; children: ReactNode }) {
  return (
    <details className="group mt-2">
      <summary
        className="mono inline-flex cursor-pointer list-none items-center gap-1.5 rounded px-1.5 py-0.5 text-[11.5px]"
        style={{ color: "var(--color-ink-2)", background: "var(--color-surface-2)" }}
      >
        <span aria-hidden className="transition-transform group-open:rotate-90">
          &rsaquo;
        </span>
        {copy.itemsLabel(n)}
      </summary>
      <div className="mt-2.5">{children}</div>
    </details>
  );
}

function Item({ u }: { u: Undecided }) {
  return (
    <li className="pl-3.5" style={{ borderLeft: `2px solid ${TONE_SOFT.warn}` }}>
      <p className="max-w-[68ch] text-[13px] leading-relaxed" style={{ color: "var(--color-ink)" }}>
        {u.item}
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px]" style={{ color: "var(--color-ink-2)" }}>
        {u.source ? (
          <span>
            <span className="mono text-[10.5px] uppercase tracking-[0.08em]" style={{ color: "var(--color-muted)" }}>
              {results.sourceLabel}
            </span>{" "}
            {u.source}
          </span>
        ) : null}
        {u.sourceFile ? <SourceLine file={u.sourceFile} /> : null}
      </p>
    </li>
  );
}

/** One check, its items grouped under the reason they share. */
function Group({ check, items, index }: { check: GenreCheck; items: Undecided[]; index: number }) {
  const reduce = useReducedMotion();
  const reasons: { reason: string; items: Undecided[] }[] = [];
  for (const u of items) {
    const found = reasons.find((r) => r.reason === u.reason);
    if (found) found.items.push(u);
    else reasons.push({ reason: u.reason, items: [u] });
  }

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: reduce ? 0 : 0.05 * index }}
    >
      <h4 className="flex items-baseline gap-2">
        <span className="mono text-[11.5px]" style={{ color: TONE_INK.warn }}>
          {check}
        </span>
        <span className="mono num text-[11px]" style={{ color: "var(--color-muted)" }}>
          {items.length}
        </span>
      </h4>
      <div className="mt-2.5 flex flex-col gap-4">
        {reasons.map((r) => (
          <div key={r.reason}>
            <p className="max-w-[70ch] text-[12.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
              {r.reason}
            </p>
            <Fold n={r.items.length}>
              <ul className="flex flex-col gap-2.5">
                {r.items.map((u, i) => (
                  <Item key={`${u.item}-${i}`} u={u} />
                ))}
              </ul>
            </Fold>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

/** The declared rules, grouped by kind, because the reason is the kind. */
function Declared({ items }: { items: DeclaredContext[] }) {
  const kinds: FormatConstant["kind"][] = ["clock", "template", "length", "fields"];
  const groups = kinds
    .map((k) => ({ kind: k, items: items.filter((d) => d.kind === k) }))
    .filter((g) => g.items.length > 0);

  return (
    <section className="mt-7 pt-5" style={{ borderTop: "1px solid var(--color-line)" }}>
      <h4 className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--color-ink)" }}>
        {copy.declaredHeading}
      </h4>
      <p className="mt-2 max-w-[70ch] text-[13px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
        {copy.declaredNote}
      </p>
      <div className="mt-4 flex flex-col gap-5">
        {groups.map((g) => (
          <div key={g.kind}>
            <h5 className="flex items-baseline gap-2">
              <span
                className="mono rounded px-1.5 py-0.5 text-[10px]"
                style={{ color: "var(--color-ink-2)", background: "var(--color-surface-2)" }}
              >
                {g.kind}
              </span>
              <span className="mono num text-[11px]" style={{ color: "var(--color-muted)" }}>
                {g.items.length}
              </span>
            </h5>
            <p className="mt-2 max-w-[70ch] text-[12.5px] leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
              {copy.kindWhy[g.kind]}
            </p>
            <Fold n={g.items.length}>
              <ul className="flex flex-col gap-2.5">
                {g.items.map((d, i) => (
                <li key={`${d.rule}-${i}`} className="pl-3.5" style={{ borderLeft: "2px solid var(--color-line-2)" }}>
                  <p className="max-w-[68ch] text-[13px] leading-relaxed" style={{ color: "var(--color-ink)" }}>
                    {d.rule}
                  </p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                    <span className="mono text-[11.5px]" style={{ color: "var(--color-ink-2)" }}>
                      {d.value}
                    </span>
                    <SourceLine file={d.sourceFile} />
                  </p>
                  </li>
                ))}
              </ul>
            </Fold>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UndecidedPanel({
  undecided,
  declared,
  className = "",
}: {
  /** What a rule looked at and could not settle. Never a pass. */
  undecided: Undecided[];
  /** What is true of the genre and is stated rather than enforced. */
  declared: DeclaredContext[];
  className?: string;
}) {
  if (undecided.length === 0 && declared.length === 0) return null;

  const groups = GENRE_CHECKS.map((c) => ({ check: c, items: undecided.filter((u) => u.check === c) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <section
      aria-label={results.undecidedHeading}
      className={`rounded-[12px] border p-5 sm:p-6 ${className}`}
      style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className="mono inline-flex items-center rounded-md px-2 py-1 text-[10.5px]"
          style={{ color: TONE_INK.warn, background: TONE_SOFT.warn }}
        >
          {copy.chip}
        </span>
        <h3 className="text-[15.5px] font-semibold tracking-[-0.012em]" style={{ color: "var(--color-ink)" }}>
          {results.undecidedHeading}
        </h3>
      </div>

      {groups.length > 0 ? (
        <div className="mt-5 flex flex-col gap-6">
          {groups.map((g, i) => (
            <Group key={g.check} check={g.check} items={g.items} index={i} />
          ))}
        </div>
      ) : null}

      {declared.length > 0 ? <Declared items={declared} /> : null}

      <p
        className="mono mt-6 max-w-[76ch] pt-4 text-[11.5px] leading-relaxed"
        style={{ color: "var(--color-muted)", borderTop: "1px solid var(--color-line)" }}
      >
        {results.undecidedNote}
      </p>
    </section>
  );
}
