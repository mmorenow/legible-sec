/* Where the visitor's own API key lives.
 *
 * The site is a static export: there is no server, so there is nowhere to put a
 * key except the visitor's browser. It goes in localStorage under one key, it
 * is never written to a cookie, and the only place it is ever sent is the
 * endpoint of the provider the visitor picked (see lib/llm.ts).
 *
 * Every read and write is wrapped: private windows, cleared site data and
 * browsers configured to block storage all throw on access, and the
 * deterministic checks have to keep working when they do. A storage failure
 * degrades to "no key", never to a crash.
 */

export type Provider = "anthropic" | "openai" | "google";

export type StoredKey = { provider: Provider; key: string };

export const PROVIDERS: readonly { id: Provider; label: string; keyHint: string }[] = [
  { id: "anthropic", label: "Anthropic", keyHint: "sk-ant-..." },
  { id: "openai", label: "OpenAI", keyHint: "sk-..." },
  { id: "google", label: "Google", keyHint: "AIza..." },
];

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
};

/** Where a key for each provider is issued, for the link next to the input. */
export const PROVIDER_CONSOLE: Record<Provider, string> = {
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  google: "https://aistudio.google.com/apikey",
};

const STORAGE_KEY = "legible.llm.key.v1";

function isProvider(v: unknown): v is Provider {
  return v === "anthropic" || v === "openai" || v === "google";
}

// ---------------------------------------------------------------------------
// Shape validation. No network call: this only catches a key pasted into the
// wrong provider, or half a key, before a request fails with a status code the
// visitor cannot read.
// ---------------------------------------------------------------------------

const GOOGLE_KEY = /^AIza[A-Za-z0-9_-]{35}$/;

/** null when the shape is plausible, otherwise the sentence to show. */
export function validateKeyShape(provider: Provider, key: string): string | null {
  const k = key.trim();
  if (!k) return "Paste a key first.";
  if (/\s/.test(k)) return "That key has a space in it. Copy it again without line breaks.";

  if (provider === "anthropic") {
    if (k.startsWith("sk-ant-")) return k.length < 20 ? "That key looks cut short. Copy the whole value." : null;
    return k.startsWith("sk-")
      ? "That looks like an OpenAI key. Switch the provider to OpenAI, or paste an Anthropic key starting with sk-ant-."
      : "An Anthropic key starts with sk-ant-.";
  }

  if (provider === "openai") {
    if (k.startsWith("sk-ant-"))
      return "That is an Anthropic key. Switch the provider to Anthropic, or paste an OpenAI key.";
    if (!k.startsWith("sk-")) return "An OpenAI key starts with sk-.";
    return k.length < 20 ? "That key looks cut short. Copy the whole value." : null;
  }

  if (GOOGLE_KEY.test(k)) return null;
  return k.startsWith("AIza")
    ? "A Google key is 39 characters. That one is not."
    : "A Google key starts with AIza and is 39 characters long.";
}

// ---------------------------------------------------------------------------
// Read and write
// ---------------------------------------------------------------------------

/* Cached so getSnapshot() can return a stable reference to React. It is
   refreshed on every write, on a storage event from another tab, and once on
   the first read of the session. */
let cache: StoredKey | null = null;
let cacheLoaded = false;

function readStorage(): StoredKey | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { provider, key } = parsed as { provider?: unknown; key?: unknown };
    if (!isProvider(provider) || typeof key !== "string" || !key) return null;
    return { provider, key };
  } catch {
    return null; // blocked storage, or something else wrote over the slot
  }
}

/** The stored key, or null. Returns null during prerender and on any failure. */
export function getKey(): StoredKey | null {
  if (typeof window === "undefined") return null;
  if (!cacheLoaded) {
    cache = readStorage();
    cacheLoaded = true;
  }
  return cache;
}

export function hasKey(): boolean {
  return getKey() !== null;
}

export type SetKeyResult = { ok: true } | { ok: false; message: string };

/** Validates the shape, then stores it. Reports why it failed instead of throwing. */
export function setKey(provider: Provider, key: string): SetKeyResult {
  const trimmed = key.trim();
  const shape = validateKeyShape(provider, trimmed);
  if (shape) return { ok: false, message: shape };
  if (typeof window === "undefined") return { ok: false, message: "Storage is not available here." };

  const next: StoredKey = { provider, key: trimmed };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return {
      ok: false,
      message:
        "This browser is not letting the page store anything. A private window or blocked site data will do that. The deterministic checks still run.",
    };
  }
  cache = next;
  cacheLoaded = true;
  emit();
  return { ok: true };
}

export function clearKey(): void {
  cache = null;
  cacheLoaded = true;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing stored means nothing to remove
  }
  emit();
}

/** First and last characters only, for showing which key is in place. */
export function maskKey(key: string): string {
  if (key.length <= 10) return `${key.slice(0, 3)}...`;
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Change notification, so any component can follow the key without prop
// drilling and a second tab clearing it is reflected here.
// ---------------------------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function onStorage(e: StorageEvent) {
  if (e.key !== null && e.key !== STORAGE_KEY) return;
  cache = readStorage();
  cacheLoaded = true;
  emit();
}
