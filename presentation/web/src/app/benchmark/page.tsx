import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { backToHome, routeMetadata } from "@/content/copy/site";
import { meta } from "@/content/copy/benchmark";
import { Benchmark } from "@/components/Benchmark";

export const metadata: Metadata = routeMetadata(meta);

export default function BenchmarkPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="relative pt-28 pb-4 md:pt-32">
          <div className="wrap-wide">
            <Link href={backToHome.href} className="mono inline-flex items-center gap-1.5 text-[13px] transition-colors hover:text-[color:var(--color-ink)]" style={{ color: "var(--color-muted)" }}>
              {backToHome.label}
            </Link>
          </div>
        </section>
        <section className="wrap-wide pb-24 md:pb-32">
          <Benchmark />
        </section>
      </main>
      <Footer />
    </>
  );
}
