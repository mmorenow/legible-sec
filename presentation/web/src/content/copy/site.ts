// Site-wide copy: every user-facing string that is not owned by a single route.
//
// The rule this directory exists to enforce: a string a reader reads lives in
// `src/content/copy/`, never inside a component or a page file. Components read
// copy; they do not carry it. Numbers never appear as literals here either,
// they are interpolated from `@/content/facts`, which reconciles them against
// the dataset at build time.

import type { Metadata } from "next";
import * as f from "@/content/facts";
import type { ClaimKey } from "@/content/status";

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** The project name, as it is written everywhere it is written. */
export const siteName = "LEGIBLE";

/** The social card shared by every sub-route page. */
export const ogImage = {
  url: "/img/v3/og-card-light.png",
  width: 1536,
  height: 1024,
  alt: "LEGIBLE dataset and system",
} as const;

// ---------------------------------------------------------------------------
// Page metadata
//
// A link preview is copy: it is what a reader sees before the page loads. Each
// route module states its own title, description and canonical path; this
// helper wraps them in the OpenGraph and Twitter shape all four sub-routes
// share, so the shape lives in one place and the words live with their route.
// ---------------------------------------------------------------------------

export type RouteMeta = {
  title: string;
  description: string;
  canonical: string;
};

export function routeMetadata({ title, description, canonical }: RouteMeta): Metadata {
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      type: "website",
      images: [{ url: ogImage.url, width: ogImage.width, height: ogImage.height, alt: ogImage.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.url],
    },
  };
}

/** The root layout's metadata: what the site is, before any route narrows it. */
export const rootMeta = {
  title: "LEGIBLE: how security findings get told to the people who decide",
  description: `An open research project on communicating security findings to non-technical readers. It holds ${f.formatCount(f.PAIRS)} findings paired with the executive prose a professional wrote about them, drawn from ${f.formatCount(f.DOCUMENTS)} public documents across ${f.ORGANIZATIONS} organizations, and a rubric for judging whether such a retelling is faithful and useful.`,
  keywords: [
    "security communication",
    "executive summary",
    "fidelity evaluation",
    "rubric",
    "pentest reports",
    "LLM benchmark",
    "audience adaptation",
    "open dataset",
  ],
  ogDescription: `${f.formatCount(f.PAIRS)} aligned pairs · ${f.formatCount(f.DOCUMENTS)} documents · ${f.ORGANIZATIONS} organizations · ${f.FIELDS} fields. The corpus, the rubric, and the instruments built on it.`,
  twitterDescription: `${f.formatCount(f.PAIRS)} security findings paired with what a professional wrote about them, and a rubric for judging the retelling.`,
  /** The root card names the project only; the sub-routes use `ogImage.alt`. */
  ogImageAlt: "LEGIBLE",
};

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export const nav = {
  wordmark: siteName,
  wordmarkAriaLabel: "LEGIBLE, home",
  /* The order is the reading order of the project: what it is, the definition
     underneath it, the evidence, the test, the tool. `/model/` left this list
     on 2026-08-31 and appears in the footer only, labelled as archived, which
     is what the claim ledger already says it is. */
  links: [
    { href: "/", label: "How it works" },
    { href: "/rubric/", label: "Rubric" },
    { href: "/library/", label: "Library" },
    { href: "/benchmark/", label: "Benchmark" },
    { href: "/try/", label: "Try it" },
  ],
  menuOpenLabel: "Open menu",
  menuCloseLabel: "Close menu",
};

/**
 * The back link every sub-route carries above its heading.
 *
 * The arrow is part of the label rather than a sibling character in the JSX:
 * one text node in, one text node out, which keeps the rendered markup
 * byte-identical to the literal it replaced.
 */
export const backToHome = {
  href: "/",
  label: "← LEGIBLE",
};

// ---------------------------------------------------------------------------
// Availability block (rendered by Access, on /library)
// ---------------------------------------------------------------------------

export type AvailabilityRow = { label: string; claim: ClaimKey };

export const availability = {
  kicker: "Availability",
  heading: "What exists, and what does not",
  lede: "The corpus is not published. This page states where each part of the project stands, so that nothing here has to be taken on trust.",
  /* Each row renders the note from the claim ledger in `@/content/status`; only
     the label is copy, the state and the note belong to the ledger. */
  rows: [
    { label: "The corpus", claim: "datasetPublic" },
    { label: "Hugging Face", claim: "huggingface" },
    { label: "Source code", claim: "sourceCode" },
    { label: "Paper", claim: "paper" },
    { label: "The rubric", claim: "rubric" },
    { label: "The checker", claim: "checkerDeterministic" },
    { label: "The benchmark", claim: "benchmarkRun" },
  ] satisfies AvailabilityRow[],
};

// ---------------------------------------------------------------------------
// Footer
//
// Rendered by `Footer`, which every route carries. It used to live inside
// `Access`, so only the two routes that showed the availability plate had one.
// ---------------------------------------------------------------------------

export const footer = {
  wordmark: siteName,
  note: "Non-commercial research project. Any firm may request removal of its derived pairs; the licensed core is unaffected.",
  links: [
    { href: "/model/", label: "Model, archived" },
    { href: "#top", label: "Back to top" },
  ],
};
