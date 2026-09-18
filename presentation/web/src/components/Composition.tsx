"use client";

import { distSeverity, distVuln } from "@/content/data";
import * as f from "@/content/facts";
import { BarList, type BarItem } from "./charts";
import { PairedDocumentsScene } from "./PairedDocumentsScene";
import { Reveal } from "./primitives";

// medium maps to a genuine mid-gray, never cobalt: rust = technical only,
// cobalt = the one executive/brand signal, never a severity tier (DATA-07).
/* Keyed off the severity words the corpus actually uses, which are capitalised.
   This map was lowercase and matched nothing, so every bar fell through to the
   default tone. `not stated` is the largest bucket by far and gets the muted
   tone on purpose: absence is a real value here, not a severity band. */
const sevTone: Record<string, BarItem["tone"]> = {
  Critical: "bad",
  High: "warn",
  Medium: "mid",
  Low: "neutral",
  Informational: "neutral",
  Undetermined: "neutral",
  "not stated": "mid",
};

export function Composition() {
  return (
    <section id="data" className="border-t py-20 md:py-28" style={{ borderColor: "var(--color-line)", background: "var(--color-bg-2)" }}>
      <div className="wrap-wide">
        <Reveal>
          {/* Every number here is interpolated from the dataset. The previous
              headline read "3,050 documents. 128 organizations. 15 years." The
              first two were the v0.2 counts. The third described a report-year
              range that only half the corpus records, so the coverage count now
              travels with it. */}
          <h2 className="h2 max-w-[16ch]" style={{ color: "var(--color-ink)" }}>
            {f.formatCount(f.DOCUMENTS)} documents. {f.formatCount(f.ORGANIZATIONS)} organizations.
          </h2>
          <p className="lede mt-4 max-w-[58ch]">
            {f.DOC_TYPES.length} kinds of document from {f.ORG_TYPES.length} kinds of organization, under{" "}
            {f.LICENSES.length} license regimes: government advisories and Inspector General audits,
            consultancy reviews and pentest reports, enforcement complaints and incident postmortems.
            A report year is recorded on {f.formatCount(f.YEAR_KNOWN)} of the {f.formatCount(f.PAIRS)} pairs,
            and where it is recorded it runs from {f.YEAR_MIN} to {f.YEAR_MAX}.
          </p>
        </Reveal>

        {/* fig.3 : the product story as a crafted, animated scene (owner law:
            AI art is reference only, never a cropped band; the graphic itself
            is built and animated in code) */}
        <Reveal delay={0.03}>
          <figure className="mt-8">
            <PairedDocumentsScene />
          </figure>
        </Reveal>

        {/* severity + vuln, two-up (condensed: the big source table and splits moved out) */}
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-[14px] border p-6" style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}>
              <h3 className="mb-5 text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>Original severity</h3>
              <BarList items={distSeverity.map((d) => ({ label: d.key, n: d.n, tone: sevTone[d.key] }))} />
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="h-full rounded-[14px] border p-6" style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}>
              <h3 className="mb-5 text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>Vulnerability class</h3>
              <BarList items={distVuln.map((d) => ({ label: d.key, n: d.n, tone: "accent" }))} />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
