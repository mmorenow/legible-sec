import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { backToHome, routeMetadata } from "@/content/copy/site";
import { meta } from "@/content/copy/model";
import { PlaintextBanner } from "@/components/PlaintextBanner";
import { LoraDiagram } from "@/components/LoraDiagram";
import { ModelRunIt } from "@/components/ModelRunIt";

export const metadata: Metadata = routeMetadata(meta);

export default function ModelPage() {
  return (
    <>
      <Nav />
      {/* v4.1: the whole page breathes the cobalt atmosphere (owner law: the
          wash belongs to the page, not a card); content sits loose on it. The
          model page routes people to /try and HF, never to the dataset Access
          block: the model is its own artifact. */}
      <main className="relative overflow-hidden">
        <div aria-hidden className="model-atmo" />

        <section className="relative pt-28 pb-4 md:pt-32">
          <div className="wrap-wide">
            <Link
              href={backToHome.href}
              className="mono inline-flex items-center gap-1.5 text-[13px] transition-colors hover:text-[color:var(--color-ink)]"
              style={{ color: "var(--color-muted)" }}
            >
              {backToHome.label}
            </Link>
          </div>
        </section>

        <section className="wrap-wide relative pb-20 md:pb-28">
          {/* the decode */}
          <PlaintextBanner />
          {/* how it's built + how we know it works */}
          <div className="mt-16 md:mt-24">
            <LoraDiagram />
          </div>
          {/* run it locally + where to go next */}
          <div className="mt-14 md:mt-20">
            <ModelRunIt />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
