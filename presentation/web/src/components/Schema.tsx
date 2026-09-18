"use client";

import { schemaGroups } from "@/content/data";
import * as f from "@/content/facts";
import { schema } from "@/content/copy/library";
import { Reveal, Stagger, StaggerItem } from "./primitives";

/* The two fields that carry the state of the corpus rather than its content.
   Until 2026-08-31 this set highlighted executive_text_provenance and license,
   which are informative but say nothing about what was and was not checked.
   human_verified and pii_scrubbed do, and both of them read worse than a
   visitor would assume, which is exactly why they are the ones on display. */
const HONESTY = new Set(["human_verified", "pii_scrubbed"]);

export function Schema() {
  const total = schemaGroups.reduce((a, g) => a + g.fields.length, 0);
  return (
    <section className="py-20 md:py-28">
      <div className="wrap-wide">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="h2" style={{ color: "var(--color-ink)" }}>{schema.heading}</h2>
              <p className="lede mt-4">
                {total} fields per pair, grouped by purpose. Two of them, highlighted below, record
                the state of the corpus rather than its content.
              </p>
            </div>
            <span className="num hidden text-[64px] font-bold leading-none tracking-[-0.04em] md:block" style={{ color: "var(--color-accent-soft)" }}>
              {total}
            </span>
          </div>
        </Reveal>

        <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" step={0.05}>
          {schemaGroups.map((g) => (
            <StaggerItem key={g.group}>
              <div className="flex h-full flex-col rounded-[14px] border p-5" style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}>
                <div className="mb-3.5 flex items-baseline justify-between">
                  <h3 className="text-[14px] font-semibold capitalize" style={{ color: "var(--color-ink)" }}>{g.group}</h3>
                  <span className="mono text-[11px]" style={{ color: "var(--color-muted)" }}>{g.fields.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.fields.map((f) => {
                    const honest = HONESTY.has(f);
                    return (
                      <span
                        key={f}
                        className="mono rounded-full px-2.5 py-1 text-[11.5px]"
                        style={
                          honest
                            ? { color: "var(--color-accent-ink)", background: "var(--color-accent-soft)", border: "1px solid var(--color-accent-line)" }
                            : { color: "var(--color-ink-2)", background: "var(--color-bg-2)", border: "1px solid var(--color-line)" }
                        }
                      >
                        {f}
                      </span>
                    );
                  })}
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.05}>
          <div className="mt-6 flex flex-col gap-2.5 text-[13.5px]" style={{ color: "var(--color-muted)" }}>
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="inline-block h-2.5 w-2.5 shrink-0 translate-y-px rounded-full" style={{ background: "var(--color-accent)" }} />
              <span className="mono" style={{ color: "var(--color-accent-ink)" }}>human_verified</span>
              is <span className="mono">false</span> on all {f.formatCount(f.PAIRS)} records. Nothing here was verified by
              exhaustive human reading: the link between the two sides was judged by LLM passes and a blind audit instead.
            </p>
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="inline-block h-2.5 w-2.5 shrink-0 translate-y-px rounded-full" style={{ background: "var(--color-accent)" }} />
              <span className="mono" style={{ color: "var(--color-accent-ink)" }}>pii_scrubbed</span>
              is <span className="mono">false</span> on {f.formatCount(f.PII_SCRUBBED_FALSE)} records, {f.formatPct(f.PII_SCRUBBED_FALSE)} of
              the corpus. Those pairs carry their source text with no redaction pass applied; the other {f.formatCount(f.PII_SCRUBBED_TRUE)} went through one.
            </p>
            <p>
              <span className="mono">executive_text_provenance</span> reads <span className="mono">natural</span> on
              all {f.formatCount(f.PAIRS)} records, counted field by field across the v0.4 file: the executive side is
              lifted from the source document, never model written.
            </p>
            <p>
              <span className="mono">source_url</span>{" "}
              {schema.sourceUrlNote.lead(f.formatCount(f.WITH_SOURCE_URL), f.formatPct(f.WITH_SOURCE_URL))}{" "}
              <span className="mono">source_doc_id</span>{" "}
              {schema.sourceUrlNote.tail}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
