import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { routeMetadata } from "@/content/copy/site";
import { moved } from "@/content/copy/library";

/* /dataset is a stub. Its contents moved to /library on 2026-08-31.
 *
 * A static export has no server to answer with a 301, so the route stays alive
 * and does the redirect in the document: a meta refresh for browsers, a
 * canonical link for crawlers, and a card for anyone the refresh does not
 * carry. It costs about a kilobyte and it never 404s on a link that is already
 * in somebody's notes. */

export const metadata: Metadata = routeMetadata(moved.meta);

export default function DatasetMovedPage() {
  return (
    <>
      {/* http-equiv has no `metadata` field in this version of Next; the docs
          say to render the tag in the page itself, which React hoists. */}
      <meta httpEquiv="refresh" content={`0; url=${moved.to}`} />
      <Nav />
      <main>
        <section className="wrap-wide flex min-h-[62vh] items-center pt-28 pb-20 md:pt-32">
          <div className="plate w-full max-w-[46rem] p-7 sm:p-10">
            <p className="mono text-[12px]" style={{ color: "var(--color-muted)" }}>{moved.label}</p>
            <h1 className="h2 mt-4 max-w-[20ch]" style={{ color: "var(--color-ink)" }}>{moved.heading}</h1>
            <p className="lede mt-4 max-w-[52ch]">{moved.body}</p>
            <Link
              href={moved.to}
              className="hov hov-bc mt-8 inline-flex items-center gap-2 rounded-full px-5 py-3 text-[15px] font-medium"
              style={{ border: "1px solid var(--color-line-2)", color: "var(--color-ink)", ["--hv-bc" as string]: "var(--color-accent-line)" }}
            >
              {moved.linkLabel}
              <ArrowRight size={16} weight="bold" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
