"use client";

import { status, linkFor, type ClaimKey } from "@/content/status";
import { availability } from "@/content/copy/site";
import { Reveal } from "./primitives";

/* RETIRED 2026-08-31, kept per the no-deletion rule.
 *
 * This rendered a plate headed "What exists, and what does not", listing the
 * state of every part of the project. It is the project's own accounting, and
 * the owner is right that it does not belong on a page a reader came to in order
 * to learn what the thing is. The same error as the provenance block, the
 * declared limitations and the anticipated objections: internal apparatus
 * shipped as content.
 *
 * content/status.ts stays and still does the work that matters: it is what stops
 * a call to action pointing at something that does not exist. The ledger governs
 * links; it does not need a page of its own.
 *
 * Original note follows.
 *
 * Availability, stated plainly.
 *
 * This block used to be three filled call-to-action buttons and two copyable
 * code blocks: a `load_dataset` call and a BibTeX entry, both pointing at a
 * Hugging Face dataset that does not exist, behind hrefs that were the literal
 * string "#placeholder". The lede admitted the URLs were placeholders while the
 * buttons said "Load the dataset", which is the shape of a claim the page could
 * not keep.
 *
 * Nothing here renders a link unless `status` says the thing is shipped.
 *
 * The site footer used to be the second half of this component, which is why
 * only the routes that wanted the availability plate had one. It lives in
 * `Footer` now and every route renders it. */

function AvailabilityRow({ label, claim }: { label: string; claim: ClaimKey }) {
  const href = linkFor(claim);
  const { note } = status[claim];
  return (
    <div className="grid gap-1.5 py-4 sm:grid-cols-[180px_1fr] sm:gap-6" style={{ borderTop: "1px solid var(--color-line)" }}>
      <div className="mono text-[12.5px]" style={{ color: "var(--color-ink-2)" }}>{label}</div>
      <div className="text-[14px] leading-[1.6]" style={{ color: "var(--color-muted)" }}>
        {href ? (
          <a href={href} className="hov hov-fg" style={{ color: "var(--color-accent-ink)", ["--hv-fg" as string]: "var(--color-ink)" }}>
            {note}
          </a>
        ) : (
          note
        )}
      </div>
    </div>
  );
}

export function Access() {
  return (
    <section id="access" style={{ borderTop: "1px solid var(--color-line)" }}>
      <div className="wrap-wide py-20 md:py-28">
        <div className="plate p-7 sm:p-10 md:p-12">
          <Reveal>
            <p className="mono mb-4 text-[12px]" style={{ color: "var(--color-muted)" }}>{availability.kicker}</p>
            <h2 className="h2" style={{ color: "var(--color-ink)" }}>{availability.heading}</h2>
            <p className="lede mt-4">{availability.lede}</p>
          </Reveal>

          <div className="mt-9">
            {availability.rows.map((row) => (
              <AvailabilityRow key={row.claim} label={row.label} claim={row.claim} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
