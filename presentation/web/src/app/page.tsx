import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Origin } from "@/components/home/Origin";
import { Instruments } from "@/components/home/Instruments";
import { Footer } from "@/components/Footer";
import { meta } from "@/content/copy/home";

/* v3 home, after the 2026-08-31 information-architecture pass.
 *
 * Three sections stood between the hero and the doors: the workflow rail, the
 * retrieval pipeline, and, inside the hero, the finding-to-translation
 * animation. All three explained a translation machine, and LEGIBLE does not
 * translate anything for now. They are in src/components/_archive/ and this
 * page is short by exactly that much on purpose.
 *
 * What replaced them: Origin (where the corpus came from, carried by the paired
 * documents scene), Instruments (library, benchmark, checker, with the rubric set
 * apart underneath as the thing they are all measured against), and one measured
 * finding. GoDeeper is no longer mounted: its doors said the same thing as
 * Instruments, and /model moved to the footer. The file stays where it is. */

// Title/description/OG/Twitter are all correct as inherited from the root
// layout (this route IS the site root they describe): only the canonical
// link is missing sitewide until this pass, so add it here without
// overwriting the inherited fields (Metadata objects are shallow-merged
// per key; omitting openGraph/twitter here keeps layout's version).
export const metadata: Metadata = {
  alternates: { canonical: meta.canonical },
};

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Origin />
        <Instruments />
      </main>
      <Footer />
    </>
  );
}
