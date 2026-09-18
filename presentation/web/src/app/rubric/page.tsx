import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal, Stagger, StaggerItem } from "@/components/primitives";
import { AxesSplit } from "@/components/rubric/AxesSplit";
import { MeasurementLadder } from "@/components/rubric/MeasurementLadder";
import { DimensionGrid } from "@/components/rubric/DimensionGrid";
import { WeightsMatrix } from "@/components/rubric/WeightsMatrix";
import { SourceList } from "@/components/rubric/SourceList";
import { backToHome, routeMetadata } from "@/content/copy/site";
import {
  aggregationRules,
  axisIndependence,
  rubricMeta,
} from "@/content/rubric";
import {
  aggregationSection,
  axesSection,
  contractSection,
  dimensionsSection,
  header,
  meta,
  sourcesSection,
  weightsSection,
} from "@/content/copy/rubric";

export const metadata: Metadata = routeMetadata(meta);

/* /rubric states the definition the rest of the site depends on, and nothing
   else. It renders three data modules: the rubric, what the corpus shows, and
   the sources.

   Three sections were removed on 2026-08-31 after the owner read the page. A
   provenance block arguing how the version was sourced, the declared
   limitations, and the eight anticipated objections. All three defend the
   method rather than state it, and they belong in MASTER_GUIDE.md, which exists
   so the owner can answer a reviewer. Their data is untouched in
   content/rubric.ts and content/evidence.ts. */

/* ------------------------------------------------------------------ */
/* Section chrome                                                      */
/* ------------------------------------------------------------------ */

function SectionHead({
  heading,
  lede,
}: {
  eyebrow?: string;
  heading: string;
  lede?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-[74ch] text-center">
      <h2
        className="font-semibold"
        style={{ fontSize: "clamp(1.6rem, 2.6vw, 2.2rem)", lineHeight: 1.15, letterSpacing: "-0.02em", color: "var(--color-ink)" }}
      >
        {heading}
      </h2>
      {lede ? (
        <p
          className="mt-8 text-[17.5px] leading-[1.7]"
          style={{ color: "var(--color-ink-2)", textAlign: "justify", textJustify: "inter-word", hyphens: "auto" }}
        >
          {lede}
        </p>
      ) : null}
    </Reveal>
  );
}

function Rule() {
  return <hr className="border-0 border-t" style={{ borderColor: "var(--color-line)" }} />;
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

export default function RubricPage() {
  return (
    <>
      <Nav />
      <main>
        {/* ---- 1. header ---- */}
        <section className="relative pt-28 pb-16 md:pt-32 md:pb-20">
          <div className="wrap-wide">
            <Link
              href={backToHome.href}
              className="mono inline-flex items-center gap-1.5 text-[15px] transition-colors hover:text-[color:var(--color-ink)]"
              style={{ color: "var(--color-muted)" }}
            >
              {backToHome.label}
            </Link>

            <Reveal className="mx-auto mt-10 max-w-[74ch] text-center">
              <h1
                className="font-extrabold"
                style={{ fontSize: "clamp(2.8rem, 6.5vw, 4.6rem)", lineHeight: 1.0, letterSpacing: "-0.035em", color: "var(--color-ink)" }}
              >
                {header.heading}
              </h1>
              <p
                className="mt-9 text-[19px] leading-[1.7]"
                style={{ color: "var(--color-ink-2)", textAlign: "justify", textJustify: "inter-word", hyphens: "auto" }}
              >
                {header.frame}
              </p>
              <p className="mono mt-7 text-[13px]" style={{ color: "var(--color-muted)" }}>
                {rubricMeta.label} · {rubricMeta.date}
              </p>
            </Reveal>
          </div>
        </section>

        <Rule />

        {/* ---- 2. the two axes ---- */}
        <section id="axes" className="py-16 md:py-20">
          <div className="wrap-wide">
            <SectionHead heading={axesSection.heading} lede={axesSection.lede} />
          </div>
          <div className="mt-10">
            <AxesSplit />
          </div>
        </section>

        <Rule />

        {/* ---- 3. the measurement contract ---- */}
        <section id="contract" className="wrap-wide py-16 md:py-20">
          <SectionHead
            eyebrow={contractSection.eyebrow}
            heading={contractSection.heading}
            lede={contractSection.lede}
          />
          <Reveal className="mt-9">
            <MeasurementLadder />
          </Reveal>
        </section>

        <Rule />

        {/* ---- 4. the eight dimensions ---- */}
        <section id="dimensions" className="wrap-wide py-16 md:py-20">
          <SectionHead
            eyebrow={dimensionsSection.eyebrow}
            heading={dimensionsSection.heading}
            lede={dimensionsSection.lede}
          />
          <div className="mt-9">
            <DimensionGrid />
          </div>
        </section>

        <Rule />

        {/* ---- 5. the weights ----
             The component owns the table, its legend and the reading notes. The
             page owns the words, so the heading reads like every other section
             and the how-to-read sits above the thing it explains. */}
        <div className="wrap-wide pt-16 pb-10 md:pt-20">
          <SectionHead heading={weightsSection.heading} lede={weightsSection.lede} />
        </div>
        <WeightsMatrix />

        <Rule />

        {/* ---- 7. aggregation ---- */}
        <section id="aggregation" className="wrap-wide py-16 md:py-20">
          <SectionHead
            eyebrow={aggregationSection.eyebrow}
            heading={aggregationSection.heading}
            lede={aggregationSection.lede}
          />
          <ol className="mt-8 max-w-[80ch]">
            {aggregationRules.map((r) => (
              <li
                key={r.n}
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 border-t py-5"
                style={{ borderColor: "var(--color-line)" }}
              >
                <span
                  className="mono num text-[13.5px]"
                  style={{ color: r.emphasis ? "var(--color-accent-ink)" : "var(--color-muted)", paddingTop: r.emphasis ? 6 : 3 }}
                >
                  {String(r.n).padStart(2, "0")}
                </span>
                <p
                  className={r.emphasis ? "text-[19px] leading-[1.6] tracking-[-0.014em] sm:text-[21px]" : "text-[16.5px] leading-[1.6]"}
                  style={{
                    color: r.emphasis ? "var(--color-ink)" : "var(--color-ink-2)",
                    fontWeight: r.emphasis ? 600 : 400,
                  }}
                >
                  {r.text}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <Rule />


        {/* ---- 9. where it comes from ---- */}
        <section id="sources" className="wrap-wide py-16 md:py-20">
          <SectionHead
            eyebrow={sourcesSection.eyebrow}
            heading={sourcesSection.heading}
            lede={sourcesSection.methodLede}
          />
          <div className="mt-9">
            <SourceList />
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
