/* Retired 2026-08-31, not deleted.
 *
 * The seven-stage pipeline strip. It was exported but never imported by any
 * component, and every figure in it belonged to an older build: 2,678 documents
 * where the corpus has 2,059, "27 fields" where records carry 30, "LEGIBLE v0.1",
 * and a MinHash line reading 119 where the build record attributes 119 to
 * near_duplicate and 17 to minhash_near_dup.
 *
 * The honest version of this story is Method.tsx, which walks one pair from a
 * public report to a dataset record and is rendered.
 */

export const pipeline = [
  { id: "corpus", label: "2,678 documents", detail: "PDFs via Docling + OCR fallback · CISA HTML via a custom parser" },
  { id: "sections", label: "Section split", detail: "per-firm heading profiles separate exec prose from findings" },
  { id: "routes", label: "3 extraction routes", detail: "ID regex (tier-0) · structural (CISA / doc-level) · embeddings + LLM (thematic)" },
  { id: "verify", label: "LLM verification", detail: "Gemini 3 Flash · 3 passes · a model family disjoint from any generator the benchmark scores" },
  { id: "audit", label: "Blind audit", detail: "independent agents re-extracted held-out reports: 0 fabricated pairs in 57 checked" },
  { id: "dedup", label: "MinHash dedup", detail: "119 near-duplicate pairs removed" },
  { id: "dataset", label: "LEGIBLE v0.1", detail: "27 fields · frozen splits · OOD firm + temporal" },
];

