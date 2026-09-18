import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { PairExample } from "@/components/PairExample";
import { Composition } from "@/components/Composition";
import { SourcesStrip } from "@/components/SourcesStrip";
import { Method } from "@/components/Method";
import { Proven } from "@/components/Proven";
import { AgentsStrip } from "@/components/AgentsStrip";
import { Schema } from "@/components/Schema";
import { Footer } from "@/components/Footer";
import { FindingSearch } from "@/components/library/FindingSearch";
import { Reveal } from "@/components/primitives";
import { licensing } from "@/content/data";
import { backToHome, routeMetadata } from "@/content/copy/site";
import { hero, licensingBlock, meta } from "@/content/copy/library";

/* /library is what /dataset was, minus the audience personas, plus the two
   blocks that were written and never rendered: the licence split and the
   The limits block was removed on 2026-08-31: it is the project auditing
   itself, which belongs in the repo, not on the page. /dataset survives as a
   stub pointing here.
   The finding search sits directly under the hero: the page opens with the one
   thing a reader can do with the corpus, and every block below it explains what
   they just searched. */

export const metadata: Metadata = routeMetadata(meta);

const LICENCE_BUCKETS = [licensing.core, licensing.quotation];

export default function LibraryPage() {
  return (
    <>
      <Nav />
      <main>
        <section id="top" className="relative overflow-hidden pt-28 pb-14 md:pt-32 md:pb-20">
          {/* the corpus, as a faint background (no box, no caption) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "url(/img/v3/corpus-shelf.webp)",
              backgroundSize: "cover",
              backgroundPosition: "center right",
              opacity: 0.3,
              maskImage: "linear-gradient(180deg, transparent, black 45%, black 78%, transparent)",
              WebkitMaskImage: "linear-gradient(180deg, transparent, black 45%, black 78%, transparent)",
            }}
          />
          <div className="wrap-wide relative">
            <Link href={backToHome.href} className="mono inline-flex items-center gap-1.5 text-[13px] transition-colors hover:text-[color:var(--color-ink)]" style={{ color: "var(--color-muted)" }}>
              {backToHome.label}
            </Link>
            <Reveal className="mt-6">
              <h1 className="h2 max-w-[18ch]" style={{ color: "var(--color-ink)" }}>
                {hero.heading}
              </h1>
              <p className="lede mt-4 max-w-[52ch]">
                {hero.lede}
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---- #search : paste a finding, get the pairs already written ---- */}
        <section id="search" className="border-t py-16 md:py-20" style={{ borderColor: "var(--color-line)" }}>
          <div className="wrap-wide">
            <FindingSearch />
          </div>
        </section>

        <PairExample />
        <Composition />
        <SourcesStrip />

        <Method />
        <Proven />

        {/* ---- #agents : built by an agent workforce (moved from home) ---- */}
        <section id="agents" className="border-t py-20 md:py-28" style={{ borderColor: "var(--color-line)" }}>
          <div className="wrap-wide">
            <AgentsStrip />
          </div>
        </section>

        <Schema />

        {/* ---- #licensing : which pairs may be redistributed, and which may not ---- */}
        <section id="licensing" className="border-t py-20 md:py-28" style={{ borderColor: "var(--color-line)", background: "var(--color-bg-2)" }}>
          <div className="wrap-wide">
            <Reveal>
              {/* plain mono label, not a kicker: this page is already at its two-kicker budget (DATA-02) */}
              <p className="mono mb-4 text-[12px]" style={{ color: "var(--color-muted)" }}>{licensingBlock.label}</p>
              <h2 className="h2 max-w-[22ch]" style={{ color: "var(--color-ink)" }}>{licensingBlock.heading}</h2>
              <p className="lede mt-4 max-w-[62ch]">{licensingBlock.lede}</p>
            </Reveal>

            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              {LICENCE_BUCKETS.map((bucket, i) => (
                <Reveal key={bucket.title} delay={i * 0.06}>
                  <div className="flex h-full flex-col rounded-[14px] border p-6 md:p-7" style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}>
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>{bucket.title}</h3>
                      <span className="mono text-[12px]" style={{ color: "var(--color-muted)" }}>{bucket.pairs}</span>
                    </div>
                    <p className="mt-3 text-[14px] leading-[1.65]" style={{ color: "var(--color-ink-2)" }}>{bucket.body}</p>
                    <div className="mt-5 flex flex-col gap-2">
                      {bucket.rows.map((row) => (
                        <div key={row.name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-2.5" style={{ borderTop: "1px solid var(--color-line)" }}>
                          <span className="text-[13.5px]" style={{ color: "var(--color-ink-2)" }}>{row.name}</span>
                          <span className="mono text-[11.5px]" style={{ color: "var(--color-muted)" }}>{row.tag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>


      </main>
      <Footer />
    </>
  );
}
