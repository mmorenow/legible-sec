import type { Metadata } from "next";
import { Hanken_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ogImage, rootMeta, siteName } from "@/content/copy/site";

/* The "legible / executive" voice — a grotesque built for reading. */
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

/* The "raw / technical" voice — a machine monospace. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const SITE = "https://legible-sec.github.io"; // update to the real deploy URL

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: rootMeta.title,
  description: rootMeta.description,
  keywords: rootMeta.keywords,
  openGraph: {
    title: rootMeta.title,
    description: rootMeta.ogDescription,
    url: SITE,
    siteName,
    images: [{ url: ogImage.url, width: ogImage.width, height: ogImage.height, alt: rootMeta.ogImageAlt }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: rootMeta.title,
    description: rootMeta.twitterDescription,
    images: [ogImage.url],
  },
};

// Minimal, honest WebSite structured data: name/url/description only, no
// invented ratings or search action (the site has no search feature).
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteName,
  url: SITE,
  description: rootMeta.description,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${hanken.variable} ${geistMono.variable}`}>
      <head>
        {/* Readers without JS still get every section (Motion ships opacity:0 in SSR). */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
