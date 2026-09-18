/* One call, three providers, structured output.
 *
 * The site is a static export, so this runs in the visitor's browser with the
 * visitor's own key and talks to the provider directly. That is the whole
 * design: the deterministic layer needs no key and no network, and only the
 * entailment and judgement layers reach a model.
 *
 * The caller passes a JSON schema and gets typed data back. Each provider
 * constrains output differently (Anthropic output_config.format, OpenAI
 * response_format, Gemini responseSchema); none of that leaks past complete().
 *
 * The key is read from keyStore, put in exactly one header or query parameter,
 * and never logged, never attached to an error, never re-thrown inside one.
 */

import { getKey, PROVIDER_LABEL, type Provider, type StoredKey } from "./keyStore";

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export type JsonSchema = Record<string, unknown>;

export type CompleteRequest = {
  /** The instruction that frames the task. Sent as the system prompt. */
  system?: string;
  /** The text to judge. */
  prompt: string;
  /** The shape the answer must take. Objects only: every provider requires a root object. */
  schema: JsonSchema;
  /** Schema name, required by OpenAI, ignored elsewhere. Letters, digits and underscores. */
  schemaName?: string;
  /** Output ceiling. Default 8192. */
  maxTokens?: number;
  /** Cancel from a component. */
  signal?: AbortSignal;
  /** Overrides the provider default. */
  model?: string;
  /** Wall clock ceiling in ms. Default 90s. */
  timeoutMs?: number;
};

export type LlmResult<T> = {
  data: T;
  provider: Provider;
  /** The model that answered, for the caller to show next to the verdict. */
  model: string;
};

export type LlmErrorKind =
  /** No key stored. The caller should render KeyGate rather than an error. */
  | "no-key"
  /** The key was rejected. */
  | "auth"
  /** Too many requests. */
  | "rate-limit"
  /** The account has no credit or is over its quota. */
  | "quota"
  /** The key cannot reach the model asked for. */
  | "model-access"
  /** The request itself was refused: bad shape, too long, blocked content. */
  | "request"
  /** The provider failed on its side. */
  | "server"
  /** The browser never reached the provider. */
  | "network"
  /** A reply arrived but was not the answer asked for. */
  | "response"
  /** The caller aborted. */
  | "aborted";

/** Carries a sentence a person can act on. Never carries the key. */
export class LlmError extends Error {
  readonly kind: LlmErrorKind;
  readonly provider: Provider | null;
  readonly status: number | null;
  constructor(kind: LlmErrorKind, message: string, provider: Provider | null = null, status: number | null = null) {
    super(message);
    this.name = "LlmError";
    this.kind = kind;
    this.provider = provider;
    this.status = status;
  }
}

/* Kept as constants so a model change is one line. Anthropic's id comes from
   the current model list; the other two are each provider's current default
   tier for structured output. */
export const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5",
  google: "gemini-2.5-flash",
};

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Run one completion against the stored key and parse the answer against the
 * schema. Throws LlmError, never a bare fetch error.
 */
export async function complete<T = unknown>(req: CompleteRequest): Promise<LlmResult<T>> {
  const stored = getKey();
  if (!stored) {
    throw new LlmError("no-key", "No key is stored, so the model layers cannot run. The deterministic checks are unaffected.");
  }
  const model = req.model ?? DEFAULT_MODEL[stored.provider];
  const raw = await send(stored, model, req);
  const data = parseJson<T>(raw, stored.provider);
  return { data, provider: stored.provider, model };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

async function send(stored: StoredKey, model: string, req: CompleteRequest): Promise<string> {
  const maxTokens = req.maxTokens ?? DEFAULT_MAX_TOKENS;
  switch (stored.provider) {
    case "anthropic":
      return anthropic(stored.key, model, req, maxTokens);
    case "openai":
      return openai(stored.key, model, req, maxTokens);
    case "google":
      return google(stored.key, model, req, maxTokens);
  }
}

/* Anthropic: browser calls are allowed only with the direct-access header
   alongside x-api-key and anthropic-version. The answer is constrained with
   output_config.format, which makes the text block valid JSON. */
async function anthropic(key: string, model: string, req: CompleteRequest, maxTokens: number): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: req.prompt }],
    output_config: { format: { type: "json_schema", schema: req.schema } },
  };
  if (req.system) body.system = req.system;

  const res = await request("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  }, "anthropic", key, req);

  const json = await readJson(res, "anthropic", key);
  const stop = str(json.stop_reason);
  if (stop === "refusal") {
    throw new LlmError("request", "Anthropic declined to answer for this text. Nothing was returned to judge.", "anthropic");
  }
  const blocks = Array.isArray(json.content) ? json.content : [];
  const text = blocks
    .filter((b): b is { type: string; text: string } => isRecord(b) && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("");
  if (!text) {
    throw new LlmError("response", truncatedOrEmpty(stop, "Anthropic"), "anthropic");
  }
  if (stop === "max_tokens") {
    throw new LlmError("response", "The answer was cut off before it finished. Try again with a shorter draft.", "anthropic");
  }
  return text;
}

/* OpenAI: bearer token, and response_format with strict json_schema. Strict
   mode requires every object to close additionalProperties and list every key
   as required, so the schema is hardened on the way out. */
async function openai(key: string, model: string, req: CompleteRequest, maxTokens: number): Promise<string> {
  const messages: { role: string; content: string }[] = [];
  if (req.system) messages.push({ role: "system", content: req.system });
  messages.push({ role: "user", content: req.prompt });

  const res = await request("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages,
      max_completion_tokens: maxTokens,
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName(req.schemaName), strict: true, schema: hardenSchema(req.schema) },
      },
    }),
  }, "openai", key, req);

  const json = await readJson(res, "openai", key);
  const choice = Array.isArray(json.choices) && isRecord(json.choices[0]) ? json.choices[0] : null;
  const message = choice && isRecord(choice.message) ? choice.message : null;
  if (message && typeof message.refusal === "string" && message.refusal) {
    throw new LlmError("request", "OpenAI declined to answer for this text. Nothing was returned to judge.", "openai");
  }
  const text = message && typeof message.content === "string" ? message.content : "";
  if (!text) {
    const finish = choice ? str(choice.finish_reason) : null;
    if (finish === "length") {
      throw new LlmError("response", "The answer was cut off before it finished. Try again with a shorter draft.", "openai");
    }
    throw new LlmError("response", truncatedOrEmpty(finish, "OpenAI"), "openai");
  }
  return text;
}

/* Google: the key goes in the query string, because the Gemini endpoint only
   allows content-type through CORS preflight and would reject an auth header
   before the request left the browser. responseSchema is OpenAPI shaped, not
   JSON Schema, so unsupported keywords are stripped. */
async function google(key: string, model: string, req: CompleteRequest, maxTokens: number): Promise<string> {
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: req.prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(req.schema),
      maxOutputTokens: maxTokens,
    },
  };
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }, "google", key, req);

  const json = await readJson(res, "google", key);
  const feedback = isRecord(json.promptFeedback) ? json.promptFeedback : null;
  if (feedback && str(feedback.blockReason)) {
    throw new LlmError("request", "Google blocked this text before answering. Nothing was returned to judge.", "google");
  }
  const candidate = Array.isArray(json.candidates) && isRecord(json.candidates[0]) ? json.candidates[0] : null;
  const content = candidate && isRecord(candidate.content) ? candidate.content : null;
  const parts = content && Array.isArray(content.parts) ? content.parts : [];
  const text = parts
    .filter((p): p is { text: string } => isRecord(p) && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  const finish = candidate ? str(candidate.finishReason) : null;
  if (!text) {
    if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT") {
      throw new LlmError("request", "Google blocked this text before answering. Nothing was returned to judge.", "google");
    }
    throw new LlmError("response", truncatedOrEmpty(finish, "Google"), "google");
  }
  if (finish === "MAX_TOKENS") {
    throw new LlmError("response", "The answer was cut off before it finished. Try again with a shorter draft.", "google");
  }
  return text;
}

// ---------------------------------------------------------------------------
// Transport, and turning a status code into a sentence
// ---------------------------------------------------------------------------

async function request(
  url: string,
  init: RequestInit,
  provider: Provider,
  key: string,
  req: CompleteRequest
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  const outer = req.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", onAbort, { once: true });
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (outer?.aborted) throw new LlmError("aborted", "The request was cancelled.", provider);
    if (isAbort(e)) {
      throw new LlmError("network", `${PROVIDER_LABEL[provider]} did not answer in time. Try again.`, provider);
    }
    /* A browser-to-provider fetch that throws is a blocked request, not a bad
       one: no network, an extension or a proxy in the way, or the provider
       refusing the browser origin. The response is unreadable in that case, so
       the message names the possibilities rather than inventing a cause.
       OpenAI is called out because its refusals are indistinguishable here:
       its preflight passes and the answer then arrives without the header the
       browser needs, which is what a rejected key also looks like. */
    throw new LlmError("network", networkMessage(provider, url), provider);
  } finally {
    clearTimeout(timer);
    if (outer) outer.removeEventListener("abort", onAbort);
  }

  if (!res.ok) throw await statusError(res, provider, key);
  return res;
}

async function statusError(res: Response, provider: Provider, key: string): Promise<LlmError> {
  const name = PROVIDER_LABEL[provider];
  const detail = scrub(await bodyMessage(res), key);
  const lower = detail.toLowerCase();
  const status = res.status;

  const outOfCredit =
    lower.includes("insufficient_quota") ||
    lower.includes("credit balance") ||
    lower.includes("billing") ||
    lower.includes("exceeded your current quota");

  if (status === 401 || status === 403) {
    return new LlmError(
      "auth",
      `${name} rejected the key. Check that it was pasted whole and is still active, then add it again.`,
      provider,
      status
    );
  }
  if (status === 402 || outOfCredit) {
    return new LlmError(
      "quota",
      `The ${name} account behind this key has no credit left. Top it up, or remove the key and keep the deterministic checks.`,
      provider,
      status
    );
  }
  if (status === 429) {
    return new LlmError("rate-limit", `${name} is rate limiting this key. Wait a moment and run it again.`, provider, status);
  }
  if (status === 404 || lower.includes("model_not_found") || lower.includes("does not have access")) {
    return new LlmError(
      "model-access",
      `This key cannot reach the model the checker asks for on ${name}. A key from a different plan or project usually fixes it.`,
      provider,
      status
    );
  }
  if (status === 413 || lower.includes("too long") || lower.includes("maximum context")) {
    return new LlmError("request", `The text is longer than ${name} accepts in one request. Shorten the finding or the draft.`, provider, status);
  }
  if (status >= 500) {
    return new LlmError("server", `${name} failed on its side. Nothing was judged. Try again in a minute.`, provider, status);
  }
  return new LlmError(
    "request",
    detail ? `${name} refused the request: ${detail}` : `${name} refused the request.`,
    provider,
    status
  );
}

async function bodyMessage(res: Response): Promise<string> {
  let text = "";
  try {
    text = await res.text();
  } catch {
    return "";
  }
  try {
    const json: unknown = JSON.parse(text);
    if (isRecord(json)) {
      const err = isRecord(json.error) ? json.error : json;
      const m = str(err.message);
      if (m) return m;
      const t = str(err.type) ?? str(err.status);
      if (t) return t;
    }
  } catch {
    // not JSON: fall through to the raw text
  }
  return text.slice(0, 200);
}

async function readJson(res: Response, provider: Provider, key: string): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await res.text();
  } catch {
    throw new LlmError("response", `${PROVIDER_LABEL[provider]} answered with something this page could not read.`, provider);
  }
  try {
    const json: unknown = JSON.parse(scrub(text, key));
    if (!isRecord(json)) throw new Error("not an object");
    return json;
  } catch {
    throw new LlmError("response", `${PROVIDER_LABEL[provider]} answered with something that was not a reply.`, provider);
  }
}

function parseJson<T>(text: string, provider: Provider): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new LlmError(
      "response",
      `${PROVIDER_LABEL[provider]} did not return the structure the checker asked for, so there is nothing to show. Running it again usually works.`,
      provider
    );
  }
}

// ---------------------------------------------------------------------------
// Schema shaping
// ---------------------------------------------------------------------------

/* OpenAI strict mode rejects any object that leaves additionalProperties open
   or lists fewer required keys than it declares properties, so every object
   node is closed and every key marked required. Optional fields have to be
   expressed as nullable types in the schema the caller passes. */
function hardenSchema(node: JsonSchema): JsonSchema {
  const out: Record<string, unknown> = { ...node };
  if (out.type === "object" && isRecord(out.properties)) {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(out.properties)) props[k] = isRecord(v) ? hardenSchema(v) : v;
    out.properties = props;
    out.required = Object.keys(props);
    out.additionalProperties = false;
  }
  if (isRecord(out.items)) out.items = hardenSchema(out.items);
  return out;
}

/* Gemini takes an OpenAPI subset, not JSON Schema: an unknown keyword is a 400,
   so only the keywords it documents survive. */
const GEMINI_KEYS = new Set([
  "type", "format", "description", "nullable", "enum", "items", "properties",
  "required", "minItems", "maxItems", "propertyOrdering",
]);

function toGeminiSchema(node: JsonSchema): JsonSchema {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (!GEMINI_KEYS.has(k)) continue;
    if (k === "properties" && isRecord(v)) {
      const props: Record<string, unknown> = {};
      for (const [pk, pv] of Object.entries(v)) props[pk] = isRecord(pv) ? toGeminiSchema(pv) : pv;
      out.properties = props;
    } else if (k === "items" && isRecord(v)) {
      out.items = toGeminiSchema(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function schemaName(name: string | undefined): string {
  const cleaned = (name ?? "").replace(/[^A-Za-z0-9_]/g, "_");
  return cleaned || "legible_result";
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException ? e.name === "AbortError" : isRecord(e) && e.name === "AbortError";
}

function networkMessage(provider: Provider, url: string): string {
  if (provider === "openai") {
    return "The browser could not reach OpenAI. OpenAI often refuses calls made straight from a page, and a rejected key looks identical from here. Check the key, or use an Anthropic or Google key instead.";
  }
  return `The browser could not reach ${PROVIDER_LABEL[provider]}. Check the connection, and any extension or network policy that blocks calls to ${hostOf(url)}.`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "the provider";
  }
}

/* Last line of defence: nothing that reaches a message may contain the key,
   whatever a provider chose to echo back. */
function scrub(text: string, key: string): string {
  return key && text.includes(key) ? text.split(key).join("[key]") : text;
}

function truncatedOrEmpty(reason: string | null, name: string): string {
  return reason
    ? `${name} stopped without answering (${reason}). Nothing was judged.`
    : `${name} returned an empty answer. Nothing was judged.`;
}
