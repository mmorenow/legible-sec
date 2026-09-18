import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { TryInstrument } from "@/components/try/TryInstrument";
import { backToHome, routeMetadata } from "@/content/copy/site";
import { meta, page, runsHere } from "@/content/copy/tryIt";

export const metadata: Metadata = routeMetadata(meta);

export default function TryPage() {
  return (
    <>
      <Nav />
      <main>
        {/* This page is a TOOL, not a pitch (owner law). One back link, then
            the instrument. Review takes the visitor's OWN text, blank inputs,
            no canned corpus examples, and both modes run in the browser, so
            the page can state one privacy line and have it be true. #judge
            deep-links land on Review. */}
        <section id="judge" className="relative pt-28 md:pt-32">
          <div className="wrap-wide">
            <Link
              href={backToHome.href}
              className="mono inline-flex items-center gap-1.5 text-[13px] transition-colors hover:text-[color:var(--color-ink)]"
              style={{ color: "var(--color-muted)" }}
            >
              {backToHome.label}
            </Link>
            <h1 className="sr-only">{page.srHeading}</h1>
            <div className="mt-7">
              <TryInstrument />
            </div>
          </div>
        </section>

        {/* Where it runs. A checker earns the question "what happens to my
            text", so the answer sits on the page rather than in a policy. */}
        <section className="mt-20 border-t py-12 md:mt-28" style={{ borderColor: "var(--color-line)", background: "var(--color-bg-2)" }}>
          <div className="wrap-wide grid gap-8 md:grid-cols-[1fr_1.1fr] md:items-start">
            <div>
              <p className="text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>
                {runsHere.heading}
              </p>
              <p className="mt-2 max-w-[52ch] text-[13.5px] leading-[1.6]" style={{ color: "var(--color-ink-2)" }}>
                {runsHere.body}
              </p>
            </div>
            <dl className="flex flex-col gap-2.5">
              {runsHere.points.map((p) => (
                <div key={p.label} className="flex flex-wrap items-baseline gap-x-3 border-b pb-2.5" style={{ borderColor: "var(--color-line)" }}>
                  <dt className="mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--color-muted)" }}>
                    {p.label}
                  </dt>
                  <dd className="text-[13.5px]" style={{ color: "var(--color-ink-2)" }}>
                    {p.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
