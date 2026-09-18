"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Eye, EyeSlash, Key, Warning, X } from "@phosphor-icons/react";
import {
  PROVIDER_CONSOLE,
  PROVIDER_LABEL,
  PROVIDERS,
  clearKey,
  getKey,
  maskKey,
  setKey,
  subscribe,
  type Provider,
  type StoredKey,
} from "@/lib/keyStore";
import { keyGate } from "@/content/copy/tryIt";

/* The control that supplies the key the model layers need.
 *
 * It is a control, not an onboarding flow: no modal, no overlay, no persuasion.
 * The deterministic layer runs with no key at all, so the line above the button
 * states what is running and what is not, and stops there.
 */

/** The stored key, kept in sync across components and across tabs. */
export function useStoredKey(): StoredKey | null {
  return useSyncExternalStore(subscribe, getKey, () => null);
}

export function KeyGate({ className = "" }: { className?: string }) {
  const stored = useStoredKey();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const inputId = `keygate-key-${uid}`;
  const selectId = `keygate-provider-${uid}`;
  const errorId = `keygate-error-${uid}`;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function save() {
    const result = setKey(provider, value);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setValue("");
    setReveal(false);
    setError(null);
    setOpen(false);
  }

  function cancel() {
    setValue("");
    setReveal(false);
    setError(null);
    setOpen(false);
  }

  return (
    <div
      className={`rounded-[10px] border px-3.5 py-3 ${className}`}
      style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
    >
      {stored ? (
        <StoredRow stored={stored} onRemove={clearKey} />
      ) : open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="flex flex-wrap items-end gap-2.5">
            <div>
              <label htmlFor={selectId} className="mono block text-[10.5px]" style={{ color: "var(--color-muted)" }}>
                provider
              </label>
              <select
                id={selectId}
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value as Provider);
                  setError(null);
                }}
                className="mono mt-1 rounded-[10px] border px-2.5 py-2 text-[12.5px]"
                style={{ borderColor: "var(--color-line-2)", background: "var(--color-surface)", color: "var(--color-ink)" }}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[220px] flex-1">
              <label htmlFor={inputId} className="mono block text-[10.5px]" style={{ color: "var(--color-muted)" }}>
                key
              </label>
              <div
                className="mt-1 flex items-center rounded-[10px] border pr-1 focus-within:outline-2 focus-within:outline-offset-[3px]"
                style={{
                  borderColor: error ? "var(--color-bad-ink)" : "var(--color-line-2)",
                  background: "var(--color-surface)",
                  outlineColor: "var(--color-accent)",
                }}
              >
                <input
                  ref={inputRef}
                  id={inputId}
                  name="legible-provider-key"
                  type={reveal ? "text" : "password"}
                  value={value}
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError(null);
                  }}
                  placeholder={PROVIDERS.find((p) => p.id === provider)?.keyHint}
                  className="mono w-full bg-transparent px-2.5 py-2 text-[12.5px] outline-none focus-visible:outline-none"
                  style={{ color: "var(--color-ink)" }}
                />
                <button
                  type="button"
                  onClick={() => setReveal((r) => !r)}
                  aria-pressed={reveal}
                  aria-label={reveal ? "Hide the key" : "Show the key"}
                  className="hov hov-fg rounded-[8px] p-1.5"
                  style={{ color: "var(--color-muted)", ["--hv-fg" as string]: "var(--color-ink-2)" }}
                >
                  {reveal ? <EyeSlash size={15} weight="bold" /> : <Eye size={15} weight="bold" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!value.trim()}
                className="hov mono rounded-[10px] px-3 py-2 text-[12.5px] active:translate-y-px disabled:opacity-45"
                style={{ background: "var(--color-accent)", color: "white" }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancel}
                className="hov hov-fg mono rounded-[10px] px-2 py-2 text-[12.5px]"
                style={{ color: "var(--color-muted)", ["--hv-fg" as string]: "var(--color-ink-2)" }}
              >
                Cancel
              </button>
            </div>
          </div>

          {error ? (
            <p
              id={errorId}
              role="alert"
              className="mt-2.5 flex items-start gap-1.5 text-[12px]"
              style={{ color: "var(--color-bad-ink)" }}
            >
              <Warning size={13} weight="bold" className="mt-[3px] shrink-0" aria-hidden />
              <span>{error}</span>
            </p>
          ) : null}

          <p className="mono mt-2.5 text-[10.5px]" style={{ color: "var(--color-muted)" }}>
            {keyGate.storedNote(PROVIDER_LABEL[provider])}{" "}
            <a
              href={PROVIDER_CONSOLE[provider]}
              target="_blank"
              rel="noopener"
              className="hov hov-fg"
              style={{ color: "var(--color-accent-ink)", ["--hv-fg" as string]: "var(--color-accent)" }}
            >
              {keyGate.consoleLinkLabel}
            </a>
            {provider === "openai" ? keyGate.openaiNote : null}
          </p>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="mono flex items-baseline gap-2 text-[11px]" style={{ color: "var(--color-muted)" }}>
            <span
              className="inline-block h-2 w-2 shrink-0 translate-y-[1px] rounded-full"
              style={{ background: "var(--color-ok)" }}
              aria-hidden
            />
            <span>{keyGate.runningNote}</span>
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="hov hov-bc hov-fg mono inline-flex shrink-0 items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12px] active:translate-y-px"
            style={{
              color: "var(--color-ink-2)",
              border: "1px solid var(--color-line-2)",
              ["--hv-bc" as string]: "var(--color-accent-line)",
              ["--hv-fg" as string]: "var(--color-ink)",
            }}
          >
            <Key size={13} weight="bold" aria-hidden />
            Add a key
          </button>
        </div>
      )}
    </div>
  );
}

function StoredRow({ stored, onRemove }: { stored: StoredKey; onRemove: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <p className="mono flex items-baseline gap-2 text-[11px]" style={{ color: "var(--color-muted)" }}>
        <span
          className="inline-block h-2 w-2 shrink-0 translate-y-[1px] rounded-full"
          style={{ background: "var(--color-accent)" }}
          aria-hidden
        />
        <span>
          <span style={{ color: "var(--color-ink-2)" }}>
            {PROVIDER_LABEL[stored.provider]} · {maskKey(stored.key)}
          </span>{" "}
          · entailment and judgement are running · stored in this browser only
        </span>
      </p>
      <button
        type="button"
        onClick={onRemove}
        className="hov hov-bc hov-fg mono inline-flex shrink-0 items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12px] active:translate-y-px"
        style={{
          color: "var(--color-ink-2)",
          border: "1px solid var(--color-line-2)",
          ["--hv-bc" as string]: "var(--color-bad-ink)",
          ["--hv-fg" as string]: "var(--color-bad-ink)",
        }}
      >
        <X size={12} weight="bold" aria-hidden />
        Remove
      </button>
    </div>
  );
}
