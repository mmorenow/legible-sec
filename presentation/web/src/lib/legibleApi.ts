/* Thin client for the local LEGIBLE motor (app/server.py, FastAPI on :8787).
   The Next site is a static export, so there is no server at runtime: the
   instrument talks to the user's own localhost motor, and falls back to the
   baked recorded session when the motor is not running. */

export type Exemplar = {
  pair_id: string;
  source_org: string;
  severity_original: string | null;
  vuln_class: string | null;
  /** the row's real register (audience_observed); shown verbatim as register=… */
  audience_observed?: string | null;
  technical_text: string;
  executive_text: string;
  source_url: string | null;
  filter_used: string | null;
  score: number | null;
};

export type JudgeFlag = { check: string; level: string; message: string; evidence: string[] };
export type JudgeReport = { ok: boolean; passed: string[]; flags: JudgeFlag[] } | null;

export type TranslateResult = {
  translation: string;
  severity_conveyed: string | null;
  preserved_facts?: string[];
  omitted_details: string[];
  confidence: number | string | null;
  backend: string;
  assembled_prompt: string;
  exemplars: Exemplar[];
  judge: JudgeReport;
};

export type Health = {
  ok: boolean;
  backend: string;
  model_loaded: boolean;
  index_rows: number;
  dataset_version: string;
};

const BASE = process.env.NEXT_PUBLIC_LEGIBLE_API ?? "http://127.0.0.1:8787";

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await p(c.signal);
  } finally {
    clearTimeout(t);
  }
}

export async function health(): Promise<Health | null> {
  try {
    return await withTimeout(async (signal) => {
      const r = await fetch(`${BASE}/api/health`, { signal });
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) as Health;
    }, 1500);
  } catch {
    return null; // motor offline: the UI shows the quickstart + recorded session
  }
}

export type TranslateBody = {
  finding: string;
  audience: "board" | "cfo" | "it_manager" | "client_exec";
  format: "email" | "slide" | "one_pager";
  backend?: "auto" | "dry" | "cloud" | "openai" | "gemini" | "local";
};

export async function translate(body: TranslateBody): Promise<TranslateResult> {
  return withTimeout(async (signal) => {
    const r = await fetch(`${BASE}/api/translate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const text = await r.text();
    if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
    return JSON.parse(text) as TranslateResult;
  }, 300_000); // local model can take minutes
}

export type SearchResult = { query: string; count: number; results: Exemplar[] };

/* Live semantic browse over the corpus (POST /api/search → rag.retrieve, rerank
   off). This is the search-as-you-type path, so it mirrors withTimeout's
   setTimeout+AbortController shape but ALSO accepts the caller's own signal:
   a fresh keystroke aborts the superseded request instead of racing it. Short
   4s timeout because retrieval is fast (the cross-encoder is off). */
export async function search(
  query: string,
  opts: { register?: string | null; k?: number; signal?: AbortSignal } = {}
): Promise<SearchResult> {
  const { register = null, k = 10, signal } = opts;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 4000);
  const onAbort = () => c.abort();
  if (signal) {
    if (signal.aborted) c.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    const r = await fetch(`${BASE}/api/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, register, k }),
      signal: c.signal,
    });
    const text = await r.text();
    if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
    return JSON.parse(text) as SearchResult;
  } finally {
    clearTimeout(t);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}
