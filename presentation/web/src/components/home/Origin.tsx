"use client";

import { origin } from "@/content/copy/home";
import { Reveal } from "../primitives";
import { PairedDocumentsScene } from "../PairedDocumentsScene";

/* Where the project came from.
 *
 * This section replaces the workflow rail, which described a translation machine
 * the project no longer is. The argument here is the one thing that makes the
 * corpus possible at all: a security report already contains both registers,
 * written by the same author about the same finding, a few pages apart. The
 * PairedDocumentsScene draws exactly that, so it carries the section rather than
 * decorating it. */

export function Origin() {
  return (
    <section
      id={origin.id}
      className="border-t py-20 md:py-28"
      style={{ borderColor: "var(--color-line)" }}
    >
      <div className="wrap-wide">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-16">
          <div>
            <Reveal>
              <p className="mono mb-4 text-[12px]" style={{ color: "var(--color-muted)" }}>
                {origin.kicker}
              </p>
              <h2 className="h2 max-w-[16ch]" style={{ color: "var(--color-ink)" }}>
                {origin.heading}
              </h2>
            </Reveal>

            <div className="mt-7 flex flex-col gap-5">
              {origin.body.map((p, i) => (
                <Reveal key={i} delay={0.05 * (i + 1)}>
                  <p
                    className="max-w-[62ch] text-[15.5px] leading-[1.7]"
                    style={{ color: "var(--color-ink-2)" }}
                  >
                    {p}
                  </p>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.24}>
              <p
                className="mt-7 max-w-[52ch] border-l-2 pl-4 text-[13.5px] leading-[1.6]"
                style={{ borderColor: "var(--color-line-2)", color: "var(--color-muted)" }}
              >
                {origin.note}
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.12}>
            <PairedDocumentsScene />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
