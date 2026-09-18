import {
  axisLabel,
  dimensions,
  layers,
  type Dimension,
  type LayerId,
} from "@/content/rubric";
import { dimensionsSection as copy } from "@/content/copy/rubric";
import { DimensionIcon } from "./DimensionIcons";

/* A check's measurement layer, coloured.
 *
 * The layer is the single most load bearing thing about a check, because it
 * fixes how far the verdict may be trusted, and it used to render as grey text
 * in a grey pill. One colour per layer, drained as the ladder climbs: a
 * deterministic failure is a fact, an entailment finding is a score, a model
 * judgement is an opinion, and the human rung is not automatic at all. The
 * `title` carries the layer's own definition so hovering a chip says what that
 * layer is allowed to conclude, without spending page space on it. */
const LAYER_STYLE: Record<LayerId, { ink: string; bg: string }> = {
  L0: { ink: "var(--color-ok-ink)", bg: "var(--color-ok-soft)" },
  L1: { ink: "var(--color-warn-ink)", bg: "var(--color-warn-soft)" },
  L2: { ink: "var(--color-accent-ink)", bg: "var(--color-accent-soft)" },
  H: { ink: "var(--color-muted)", bg: "var(--color-surface-2)" },
};

function LayerChip({ id }: { id: LayerId }) {
  const layer = layers[id];
  const tone = LAYER_STYLE[id];
  return (
    <span
      className="mono cursor-help rounded-md px-1.5 py-0.5 text-[12px]"
      style={{ color: tone.ink, background: tone.bg }}
      title={`${layer.name}. ${layer.mayConclude}`}
    >
      {id}
      <span className="sr-only">: {layer.name}. {layer.mayConclude}</span>
    </span>
  );
}

/* The eight dimensions, one card each.
 *
 * Every card carries an axis rail down its left edge, tinted by the axis the
 * dimension sits on: rust for fidelity, cobalt for utility, both for the one
 * dimension that answers to both. Three of the eight fail in two directions,
 * and those three get a repeated glyph ON the rail, a two headed arrow rather
 * than a word, so failing by excess and by defect is something a reader can
 * scan the page for instead of reading for.
 */

function railBackground(axes: Dimension["axes"]): string {
  const hasF = axes.includes("F");
  const hasU = axes.includes("U");
  if (hasF && hasU) {
    return "linear-gradient(180deg, var(--color-tech), var(--color-accent))";
  }
  return hasF ? "var(--color-tech)" : "var(--color-accent)";
}

/* The mark. Repeated identically on every bidirectional dimension: same size,
   same position on the rail, so three of them read as one pattern. */
function BidirectionalGlyph() {
  return (
    <span className="relative inline-flex">
      <span className="sr-only">{copy.bidirectionalGlyphLabel}</span>
      <svg
        width="20"
        height="34"
        viewBox="0 0 20 34"
        fill="none"
        aria-hidden
        style={{ display: "block" }}
      >
        <circle cx="10" cy="17" r="9.25" fill="var(--color-bg)" stroke="var(--color-line)" strokeWidth="1" />
        <path
          d="M10 6.5 V27.5 M6.2 10.3 L10 6.5 L13.8 10.3 M6.2 23.7 L10 27.5 L13.8 23.7"
          stroke="var(--color-ink-2)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mono text-[12px] uppercase tracking-[0.13em]" style={{ color: "var(--color-muted)" }}>
      {children}
    </p>
  );
}

function DimensionCard({ d }: { d: Dimension }) {
  return (
    <article
      id={d.id.toLowerCase()}
      className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 sm:gap-x-6"
    >
      {/* the axis rail */}
      <div className="relative flex w-[20px] justify-center pt-1">
        <span
          aria-hidden
          className="absolute inset-y-0 w-[3px] rounded-full"
          style={{ background: railBackground(d.axes), opacity: 0.85 }}
        />
        {d.bidirectional ? (
          <span className="sticky top-24 z-[1]">
            <BidirectionalGlyph />
          </span>
        ) : null}
      </div>

      <div
        className="min-w-0 rounded-[14px] border p-5 sm:p-6"
        style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]"
            style={{
              color: d.axes.includes("F") ? "var(--color-tech-ink)" : "var(--color-accent-ink)",
              background: d.axes.includes("F") ? "var(--color-tech-soft)" : "var(--color-accent-soft)",
            }}
          >
            <DimensionIcon id={d.id} size={20} />
          </span>
          <span className="mono num text-[13px]" style={{ color: "var(--color-muted)" }}>
            {String(d.number).padStart(2, "0")}
          </span>
          <h3 className="text-[18px] font-semibold tracking-[-0.018em]" style={{ color: "var(--color-ink)" }}>
            {d.name}
          </h3>
          <span
            className="mono rounded-md px-1.5 py-0.5 text-[12px]"
            style={{ color: "var(--color-muted)", background: "var(--color-surface-2)" }}
          >
            {axisLabel(d.axes)}
          </span>
        </div>

        <p className="mt-3 text-[17px] leading-[1.6]" style={{ color: "var(--color-ink)" }}>
          {d.question}
        </p>

        <div className="mt-5">
        </div>

        {d.bidirectional ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div
              className="rounded-[10px] p-3.5"
              style={{ background: "var(--color-surface-2)" }}
            >
              <Label>{copy.labels.excess}</Label>
              <p className="mt-1.5 text-[15px] leading-[1.6]" style={{ color: "var(--color-ink-2)" }}>
                {d.bidirectional.excess}
              </p>
            </div>
            <div
              className="rounded-[10px] p-3.5"
              style={{ background: "var(--color-surface-2)" }}
            >
              <Label>{copy.labels.defect}</Label>
              <p className="mt-1.5 text-[15px] leading-[1.6]" style={{ color: "var(--color-ink-2)" }}>
                {d.bidirectional.defect}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <Label>{copy.labels.checks}</Label>
          <ul className="mt-2">
            {d.checks.map((c, i) => (
              <li
                key={c.id}
                className="py-3"
                style={{ borderTop: i === 0 ? "none" : "1px solid var(--color-line)" }}
              >
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="mono text-[13px]" style={{ color: "var(--color-accent-ink)" }}>
                    {c.id}
                  </span>
                  <span
                    className="flex flex-wrap items-center gap-1"
                  >
                    {c.layers.map((l) => (
                      <LayerChip key={l} id={l} />
                    ))}
                  </span>
                </div>
                <p className="mt-1.5 text-[15.5px] leading-[1.6]" style={{ color: "var(--color-ink-2)" }}>
                  {c.text}
                </p>
                {c.note ? (
                  <p className="mt-1.5 text-[14px] leading-[1.6]" style={{ color: "var(--color-muted)" }}>
                    {c.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <dl
          className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 sm:gap-x-8"
          style={{ borderColor: "var(--color-line)" }}
        >
          <div>
            <dt className="mono text-[12px] uppercase tracking-[0.13em]" style={{ color: "var(--color-muted)" }}>
              {copy.labels.scale}
            </dt>
            <dd className="mt-1.5 text-[15px] leading-[1.6]" style={{ color: "var(--color-ink-2)" }}>
              {d.scale}
            </dd>
          </div>
          <div>
            <dt className="mono text-[12px] uppercase tracking-[0.13em]" style={{ color: "var(--color-muted)" }}>
              {copy.labels.evidence}
            </dt>
            <dd className="mt-1.5 text-[15px] leading-[1.6]" style={{ color: "var(--color-ink-2)" }}>
              {d.evidence}
            </dd>
          </div>
        </dl>

        {d.sourceNote ? (
          <p
            className="mt-4 border-t pt-4 text-[14px] leading-[1.6]"
            style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
          >
            <span className="mono uppercase tracking-[0.13em]">{copy.labels.sourceNote}</span>{" "}
            {d.sourceNote}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function DimensionList() {
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="shrink-0 pt-0.5">
          <BidirectionalGlyph />
        </span>
        <p className="max-w-[62ch] text-[15.5px] leading-[1.6]" style={{ color: "var(--color-muted)" }}>
          {copy.bidirectionalNote}
        </p>
      </div>
      <div className="mt-8 grid gap-8">
        {dimensions.map((d) => (
          <DimensionCard key={d.id} d={d} />
        ))}
      </div>
    </div>
  );
}
