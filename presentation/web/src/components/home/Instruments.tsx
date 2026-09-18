"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { instruments } from "@/content/copy/home";
import { Reveal } from "../primitives";

/* The three instruments, with the rubric named as what they share.
 *
 * Deliberately not three equal cards in a row: the rubric sits underneath the
 * other three rather than beside them, and the layout says so. Links are named
 * after where they go, never after an action the reader is being pushed into. */

function InstrumentRow({
  title,
  body,
  href,
  linkLabel,
  index,
}: {
  title: string;
  body: string;
  href: string;
  linkLabel: string;
  index: number;
}) {
  return (
    <Reveal delay={0.06 * index} as="li">
      <a
        href={href}
        className="hov hov-bc group grid gap-3 border-t py-7 md:grid-cols-[200px_1fr] md:gap-10"
        style={{
          borderColor: "var(--color-line)",
          ["--hv-bc" as string]: "var(--color-accent-line)",
        }}
      >
        <h3 className="text-[17px] font-semibold" style={{ color: "var(--color-ink)" }}>
          {title}
        </h3>
        <div>
          <p className="max-w-[64ch] text-[15px] leading-[1.7]" style={{ color: "var(--color-ink-2)" }}>
            {body}
          </p>
          <span
            className="mono mt-3 inline-flex items-center gap-1.5 text-[12.5px]"
            style={{ color: "var(--color-accent-ink)" }}
          >
            {linkLabel}
            <ArrowRight
              size={13}
              weight="bold"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </a>
    </Reveal>
  );
}

export function Instruments() {
  return (
    <section
      id="instruments"
      className="border-t py-20 md:py-28"
      style={{ borderColor: "var(--color-line)", background: "var(--color-bg-2)" }}
    >
      <div className="wrap-wide">
        <Reveal>
          <p className="mono mb-4 text-[12px]" style={{ color: "var(--color-muted)" }}>
            {instruments.kicker}
          </p>
          <h2 className="h2 max-w-[18ch]" style={{ color: "var(--color-ink)" }}>
            {instruments.heading}
          </h2>
          <p className="lede mt-4">{instruments.lede}</p>
        </Reveal>

        <ul className="mt-12 flex flex-col">
          {instruments.items.map((item, i) => (
            <InstrumentRow
              key={item.key}
              title={item.title}
              body={item.body}
              href={item.href}
              linkLabel={item.linkLabel}
              index={i}
            />
          ))}
        </ul>

        {/* The rubric, set apart: it is not a fourth instrument, it is the thing
            the other three are measured against. */}
        <Reveal delay={0.24}>
          <a
            href={instruments.rubric.href}
            className="hov hov-bc group mt-10 block rounded-[14px] border p-7 md:p-9"
            style={{
              borderColor: "var(--color-accent-line)",
              background: "var(--color-surface)",
              ["--hv-bc" as string]: "var(--color-accent)",
            }}
          >
            <h3 className="text-[17px] font-semibold" style={{ color: "var(--color-accent-ink)" }}>
              {instruments.rubric.title}
            </h3>
            <p
              className="mt-3 max-w-[68ch] text-[15px] leading-[1.7]"
              style={{ color: "var(--color-ink-2)" }}
            >
              {instruments.rubric.body}
            </p>
            <span
              className="mono mt-3 inline-flex items-center gap-1.5 text-[12.5px]"
              style={{ color: "var(--color-accent-ink)" }}
            >
              {instruments.rubric.linkLabel}
              <ArrowRight
                size={13}
                weight="bold"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
