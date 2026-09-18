import {
  URL_CHECK_DATE,
  corpusTypeMeta,
  evidence,
  evidenceSummary,
  sourceKindMeta,
  type EvidenceSource,
  type SourceKind,
} from "@/content/evidence";
import { sourcesSection as copy } from "@/content/copy/rubric";

/* The provenance list: every dimension, every source, grouped by who is
 * speaking.
 *
 * Grouping is the whole point. A regulator's checklist and a vendor blog post
 * are both citable and they are not the same claim, so the page never lists
 * them in one undifferentiated run. Each group states the standing of that kind
 * of source before the sources themselves.
 *
 * A source whose check came back `blocked` is a host that answered and declined
 * an automated request. It is labelled as existing and refusing, never as
 * broken. Nothing recorded as dead can reach this component: `evidence.ts`
 * throws at module scope instead.
 */

/** Strongest standing first. The order is an argument, so it is explicit. */
const KIND_ORDER: SourceKind[] = [
  "regulator",
  "standards-body",
  "governance-body",
  "peer-reviewed",
  "academic",
  "trade-press",
  "practitioner",
  "vendor",
];

function StatusChip({ source }: { source: EvidenceSource }) {
  const blocked = source.check.status === "blocked";
  const label = blocked ? copy.statusLabels.blocked : copy.statusLabels.reachable;
  return (
    <span
      className="mono rounded-md px-1.5 py-0.5 text-[12px]"
      style={{
        color: blocked ? "var(--color-muted)" : "var(--color-ink-2)",
        background: "var(--color-surface-2)",
      }}
      title={blocked ? copy.blockedNote : undefined}
    >
      {label} · {source.check.httpStatus}
    </span>
  );
}

function SourceRow({ source, first }: { source: EvidenceSource; first: boolean }) {
  return (
    <li
      className="py-3.5"
      style={{ borderTop: first ? "none" : "1px solid var(--color-line)" }}
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-[15.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
          {source.publisher}
        </span>
        {source.author ? (
          <span className="text-[14px]" style={{ color: "var(--color-muted)" }}>
            {source.author}
          </span>
        ) : null}
      </div>

      <p className="mt-1 text-[15.5px] leading-snug">
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hov hov-fg underline decoration-[1px] underline-offset-[3px]"
          style={{
            color: "var(--color-accent-ink)",
            ["--hv-fg" as string]: "var(--color-ink)",
            textDecorationColor: "var(--color-accent-line)",
          }}
        >
          {source.title}
          <span aria-hidden> ↗</span>
        </a>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusChip source={source} />
        <span
          className="mono rounded-md px-1.5 py-0.5 text-[12px]"
          style={{ color: "var(--color-muted)", background: "var(--color-surface-2)" }}
        >
          {copy.situationLabel} {source.situation}
        </span>
        {source.corpusTypes.map((t) => (
          <span
            key={t}
            className="mono rounded-md px-1.5 py-0.5 text-[12px]"
            style={{ color: "var(--color-muted)", background: "var(--color-surface-2)" }}
            title={`${corpusTypeMeta[t].label}: ${corpusTypeMeta[t].note}`}
          >
            {t} · {corpusTypeMeta[t].label}
          </span>
        ))}
      </div>
    </li>
  );
}

function KindGroup({ kind, sources }: { kind: SourceKind; sources: EvidenceSource[] }) {
  const meta = sourceKindMeta[kind];
  return (
    <section className="pt-5">
      <h4 className="mono text-[12.5px] uppercase tracking-[0.14em]" style={{ color: "var(--color-accent-ink)" }}>
        {meta.label}
        <span className="num" style={{ color: "var(--color-muted)" }}>
          {" "}
          · {sources.length}
        </span>
      </h4>
      <p className="mt-1 max-w-[70ch] text-[14px] leading-[1.6]" style={{ color: "var(--color-muted)" }}>
        {meta.standing}
      </p>
      <ul className="mt-1">
        {sources.map((s, i) => (
          <SourceRow key={s.id} source={s} first={i === 0} />
        ))}
      </ul>
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="num text-[22px] font-semibold tracking-[-0.02em]" style={{ color: "var(--color-ink)" }}>
        {value}
      </p>
      <p className="mono mt-0.5 text-[12px] uppercase tracking-[0.13em]" style={{ color: "var(--color-muted)" }}>
        {label}
      </p>
    </div>
  );
}

export function SourceList() {
  return (
    <div>
      <div
        className="rounded-[14px] border p-5 sm:p-6"
        style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
      >
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          <SummaryStat label={copy.summaryLabels.citations} value={evidenceSummary.citations} />
          <SummaryStat label={copy.summaryLabels.distinctSources} value={evidenceSummary.distinctSources} />
          <SummaryStat label={copy.summaryLabels.reachable} value={evidenceSummary.reachable} />
          <SummaryStat label={copy.summaryLabels.blocked} value={evidenceSummary.blocked} />
          <SummaryStat label={copy.summaryLabels.inCorpus} value={evidenceSummary.inCorpus} />
        </div>
        <p
          className="mt-5 border-t pt-4 text-[14px] leading-[1.6]"
          style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
        >
          {copy.checkedOnLabel} <span className="mono num">{URL_CHECK_DATE}</span>. {copy.checkedOnNote}{" "}
          {copy.blockedNote}
        </p>
      </div>

      <div className="mt-6">
        {evidence.map((dimension) => {
          const groups = KIND_ORDER.map((kind) => ({
            kind,
            sources: dimension.sources.filter((s) => s.kind === kind),
          })).filter((g) => g.sources.length > 0);

          return (
            <details
              key={dimension.id}
              className="group border-t"
              style={{ borderColor: "var(--color-line)" }}
            >
              <summary className="flex cursor-pointer list-none items-start gap-3 rounded-[6px] py-5 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)] [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="mt-[7px] shrink-0 motion-safe:transition-transform motion-safe:duration-200 group-open:rotate-90"
                  style={{ color: "var(--color-accent-ink)" }}
                >
                  <svg width="9" height="12" viewBox="0 0 9 12" fill="none">
                    <path d="M1.5 1.5 L7 6 L1.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="mono text-[13px]" style={{ color: "var(--color-accent-ink)" }}>
                      {dimension.id}
                    </span>
                    <span className="text-[16px] font-semibold tracking-[-0.014em]" style={{ color: "var(--color-ink)" }}>
                      {dimension.name}
                    </span>
                    <span className="mono num text-[12.5px]" style={{ color: "var(--color-muted)" }}>
                      {dimension.sources.length} {copy.expandHint}
                    </span>
                  </h3>
                  <p className="mt-1 max-w-[68ch] text-[15.5px] leading-[1.6]" style={{ color: "var(--color-ink-2)" }}>
                    {dimension.question}
                  </p>
                </div>
              </summary>
              <div className="pb-6 pl-[21px]">
                {groups.map((g) => (
                  <KindGroup key={g.kind} kind={g.kind} sources={g.sources} />
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
