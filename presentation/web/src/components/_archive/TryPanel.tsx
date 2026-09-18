"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, CaretDown } from "@phosphor-icons/react";
import { health, translate, type Health, type TranslateResult, type TranslateBody } from "@/lib/legibleApi";
import replay from "@/content/replaySession.json";
import { useReveal } from "@/components/primitives";
import { FlagRow, GateRail } from "@/components/try/gate";
import { EvidenceLedger, toRegister, type EvidenceItem } from "@/components/try/evidence";
import { PrecedentsBand, toPrecedent } from "@/components/try/PrecedentsBand";
import { Prose } from "@/components/try/Prose";
import { SplitCanvas, SeamButton, WorldLabel } from "@/components/try/seam";

const EASE = [0.22, 1, 0.36, 1] as const;

/* TryPanel (§5.11 + §7): the local instrument, staged on the SPLIT-WORLD
   canvas (try/seam.tsx). The finding lives in the technical world (rust,
   mono, dense); the sentence lives in the legible world (cobalt, grotesk,
   air); the Translate action is mounted on the SEAM between them and firing
   it fires the crossing. The fidelity report and the retrieved precedents
   land below, centered on the seam axis, because the gate reads across it.
   In `live` mode it talks to the user's own motor (app/server.py on :8787)
   and renders every state (idle, loading, done, error, motor-offline). In
   `replay` mode it autoplays a baked real session (replaySession.json, a $0
   dry-run). It never fakes a result. */

// The dataset REGISTERS the model was actually trained on (audience_observed).
// Picking one here is picking what the model learned, not a role abstraction.
const AUDIENCES = [
  { key: "technical_leadership", label: "Technical leadership" },
  { key: "practitioner", label: "Practitioner (engineer)" },
  { key: "management", label: "Board / senior management" },
  { key: "customer", label: "Affected customers" },
  { key: "regulatory", label: "Regulator / legal" },
  { key: "public", label: "General public" },
] as const;

const SAMPLES: { label: string; text: string }[] = [
  {
    label: "PyPI access control",
    text: "Broken access control on organization role management\n\nSeverity: High\nType: Access Control\n\nThe manage_organization_roles view handles both GET and POST under a single @view_config without re-checking the caller's role on POST. A member holding the low-privileged 'billing' role can submit a crafted POST to promote their own account to 'owner', gaining full control of the organization's packages.",
  },
  {
    label: "AES-GCM static nonce",
    text: "Static nonce in AES-GCM token encryption\n\nSeverity: High\nType: Cryptography\nCWE: CWE-323\n\nThe session-token service initializes AES-GCM with a hardcoded 12-byte nonce shared across all encryptions. Reusing a nonce under the same key lets an attacker who captures two tokens recover the keystream and forge valid session tokens, bypassing authentication.",
  },
  {
    label: "ICS remote injection",
    text: "Unauthenticated command injection in ICS field gateway\n\nSeverity: Critical\nType: Command Injection\nCVSS: 9.8\n\nThe /diagnostics endpoint passes the 'ping_host' parameter to a shell without sanitization. An unauthenticated attacker on the OT network can inject commands to run arbitrary code on the controller, with direct physical-process impact.",
  },
];

// The live motor's judge (src/legible/judge.py) runs six checks, D1-D6 with
// format_lint, which is a different set from the in-tab gate's eight in
// lib/judge.ts: the motor has format_lint, the browser has claim_inflation,
// status_drift and negation_flip. The rail itself is the shared one from
// try/gate, so every mode stamps the same chip vocabulary.
// All six are STRING-LEVEL. None of them sees paraphrase, severity softened
// into a synonym, register fit, or whether the sentence ends in something
// actionable, so a clean rail is a non-detection and never a verification.
/* The MOTOR's judge, which is a different object from the browser gate. Python
   run_deterministic() runs these nine; the browser's lib/judge.ts runs eight, the
   same list without format_lint, because format rules need the audience contract
   the motor holds. Counting either one by hand is how the site came to claim six. */
const CHECKS = [
  "id_parity",
  "numeric_parity",
  "severity_drift",
  "entity_check",
  "caveat_parity",
  "claim_inflation",
  "status_drift",
  "negation_flip",
  "format_lint",
] as const;

/* ------------------------------- shared bits ------------------------------- */

/* The retrieved precedents, normalized onto the shared evidence surface
   (try/evidence.tsx): the same rows the Precedents ledger shows. */
function exemplarItems(result: TranslateResult): EvidenceItem[] {
  return result.exemplars.slice(0, 4).map((e, i) => {
    const raw = e.filter_used ? e.filter_used.replace(/^register=/, "") : null;
    return {
      id: e.pair_id ?? `exemplar-${i}`,
      org: e.source_org,
      severity: e.severity_original,
      register: raw ? toRegister(raw) ?? raw : null,
      tech: e.technical_text,
      exec: e.executive_text,
      url: e.source_url,
    };
  });
}

const isDryResult = (result: TranslateResult) => (result.backend || "").toLowerCase().includes("dry");
const resultSig = (result: TranslateResult) =>
  `${result.backend}|${(result.translation ?? result.assembled_prompt ?? "").slice(0, 40)}`;

/* The sentence, arriving OUT of the seam into the legible world (slides in
   from the membrane side). Owns only the right-field payload; the report and
   the receipts land in the below-band. */
function TranslationBlock({ result }: { result: TranslateResult }) {
  const reduce = useReducedMotion();
  const isDry = isDryResult(result);
  const sig = resultSig(result);
  return (
    <motion.div
      key={sig}
      initial={reduce ? false : { opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
    >
      {isDry ? (
        <>
          <p className="mono text-[11px]" style={{ color: "var(--color-accent-ink)" }}>
            assembled prompt · no model called
          </p>
          <pre
            className="mono mt-3 max-h-[300px] overflow-auto whitespace-pre-wrap rounded-[10px] p-3.5 text-[11.5px] leading-relaxed"
            style={{ background: "var(--color-surface-2)", color: "var(--color-ink-2)" }}
          >
            {result.assembled_prompt}
          </pre>
        </>
      ) : (
        <>
          <Prose text={result.translation} size="lead" />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {result.severity_conveyed ? (
              <span
                className="mono rounded-full px-2.5 py-1 text-[11px]"
                style={{ color: "var(--color-tech-ink)", background: "color-mix(in oklch, var(--color-tech) 12%, transparent)" }}
              >
                severity: {result.severity_conveyed}
              </span>
            ) : null}
            {result.confidence != null && String(result.confidence) !== "None" ? (
              <span
                className="mono rounded-full px-2.5 py-1 text-[11px]"
                style={{ color: "var(--color-muted)", border: "1px solid var(--color-line)" }}
              >
                confidence {result.confidence}
              </span>
            ) : null}
          </div>
          {result.omitted_details?.length ? (
            <details className="mt-3">
              <summary className="mono cursor-pointer text-[11px]" style={{ color: "var(--color-muted)" }}>
                Declared omissions ({result.omitted_details.length})
              </summary>
              <ul className="mt-1.5 flex flex-col gap-1">
                {result.omitted_details.map((o, i) => (
                  <li key={i} className="text-[12.5px]" style={{ color: "var(--color-ink-2)" }}>
                    {o}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
      <p className="mono mt-4 text-[10.5px]" style={{ color: "var(--color-muted)" }}>
        backend: {result.backend}
      </p>
    </motion.div>
  );
}

/* Below the worlds: the gate reads across the seam, so its verdict hangs from
   the seam axis; then the ledger of retrieved precedents straddles the same
   filament the result just crossed. */
function TranslateBelow({ result }: { result: TranslateResult }) {
  const reduce = useReducedMotion();
  const isDry = isDryResult(result);
  const sig = resultSig(result);
  const judge = result.judge;
  const fails = judge?.flags.filter((f) => f.level === "fail").length ?? 0;
  const warns = judge?.flags.filter((f) => f.level === "warn").length ?? 0;
  const arrive = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, ease: EASE, delay },
  });
  return (
    <div className="pt-2">
      {!isDry && judge ? (
        <motion.div key={`${sig}-gate`} {...arrive(0.3)} className="flex flex-col items-center">
          <span className="seam-connector" aria-hidden />
          <p
            className="mono mt-3 text-center text-[11.5px]"
            style={{ color: fails ? "var(--color-bad-ink)" : warns ? "var(--color-warn-ink)" : "var(--color-ok-ink)" }}
          >
            {fails
              ? `fidelity: ${fails} check${fails > 1 ? "s" : ""} failed${warns ? `, ${warns} warned` : ""} · every failure shows its strings`
              : warns
                ? `fidelity: no check failed, ${warns} warned`
                : `fidelity: ${CHECKS.length} checks ran, none fired · a pass means nothing was detected, not that nothing is wrong`}
          </p>
          <div className="mt-4">
            <GateRail report={judge} checks={CHECKS} center />
          </div>
          {judge.flags?.length ? (
            <div className="mx-auto mt-4 w-full max-w-[780px]">
              {judge.flags.map((f, i) => (
                <FlagRow key={i} flag={f} first={i === 0} />
              ))}
            </div>
          ) : null}
        </motion.div>
      ) : null}
      {/* the precedents wait behind the button: the sentence keeps the stage
          until the reader asks for its grounding. Keyed by sig so a fresh
          result folds the band back down. */}
      <motion.div key={`${sig}-ev`} {...arrive(isDry ? 0.3 : 0.45)} className={isDry ? "pt-4" : "pt-10"}>
        <PrecedentsBand
          items={result.exemplars.slice(0, 5).map(toPrecedent)}
          caption={`the precedents it stands on · ${result.exemplars.length} retrieved`}
        />
      </motion.div>
    </div>
  );
}

/* Legacy stacked output for the recorded session (replay is a film, not the
   split instrument): translation, report and receipts in one column. */
function OutputColumn({ result }: { result: TranslateResult }) {
  const reduce = useReducedMotion();
  const isDry = isDryResult(result);
  const sig = resultSig(result);
  const arrive = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, ease: EASE, delay },
  });
  return (
    <div className="flex flex-col gap-8">
      <motion.div key={`${sig}-t`} {...arrive(0)} className="pt-4" style={{ borderTop: "2px solid var(--color-accent)" }}>
        <TranslationBlock result={result} />
      </motion.div>
      {!isDry && (
        <motion.div key={`${sig}-f`} {...arrive(0.08)} className="pt-4" style={{ borderTop: "1px solid var(--color-line)" }}>
          <p className="mono text-[11px]" style={{ color: "var(--color-muted)" }}>
            fidelity report
          </p>
          <div className="mt-3">
            <GateRail report={result.judge} checks={CHECKS} />
          </div>
          {result.judge?.flags?.length ? (
            <div className="mt-4 flex flex-col">
              {result.judge.flags.map((f, i) => (
                <FlagRow key={i} flag={f} first={i === 0} />
              ))}
            </div>
          ) : null}
        </motion.div>
      )}
      <motion.div key={`${sig}-e`} {...arrive(isDry ? 0.08 : 0.16)} className="pt-4" style={{ borderTop: "1px solid var(--color-line)" }}>
        <p className="mono text-[11px]" style={{ color: "var(--color-muted)" }}>
          evidence panel · {result.exemplars.length} precedents
        </p>
        <div className="mt-2">
          <EvidenceLedger items={exemplarItems(result)} variant="panel" />
        </div>
      </motion.div>
    </div>
  );
}

/* --------------------------------- replay --------------------------------- */

const REPLAY = replay as unknown as TranslateResult & { finding: string; audience_key: string; format_key: string };

function ReplayView({ compact = false }: { compact?: boolean }) {
  const reduce = useReducedMotion();
  const { ref, shown } = useReveal();
  const [typed, setTyped] = useState(reduce ? REPLAY.finding.length : 0);
  const [revealed, setRevealed] = useState(reduce);

  useEffect(() => {
    if (reduce || !shown) return;
    const full = REPLAY.finding.length;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1200);
      setTyped(Math.floor(p * full));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => setRevealed(true), 250);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, shown]);

  return (
    <div ref={ref as React.Ref<HTMLDivElement>} className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
      {/* technical finding : loose under a rust rule; the finding box is the object */}
      <div className="pt-4" style={{ borderTop: "2px solid var(--color-tech)" }}>
        <p className="mono text-[10.5px]" style={{ color: "var(--color-tech-ink)" }}>
          technical finding · audience: {REPLAY.audience_key}
        </p>
        <pre
          className="mono mt-3 whitespace-pre-wrap rounded-[10px] border p-3 text-[12px] leading-relaxed"
          style={{ borderColor: "var(--color-tech-line)", background: "var(--color-surface)", color: "var(--color-ink-2)", minHeight: compact ? 120 : 160 }}
        >
          {REPLAY.finding.slice(0, typed)}
          {typed < REPLAY.finding.length && <span style={{ opacity: 0.5 }}>▍</span>}
        </pre>
      </div>
      <div style={{ opacity: revealed ? 1 : 0.2, transition: "opacity 0.5s" }}>
        {revealed && <OutputColumn result={REPLAY} />}
      </div>
    </div>
  );
}

/* --------------------------------- live ----------------------------------- */

const QUICKSTART = [
  ".venv/bin/pip install -r requirements-app.txt",
  "LEGIBLE_EMBED_DEVICE=cpu .venv/bin/uvicorn app.server:app --port 8787",
  "cd presentation/web && npm run dev",
];

function HealthStrip({ h }: { h: Health | null }) {
  const tone = h ? (h.model_loaded ? "var(--color-ok)" : "var(--color-warn)") : "var(--color-bad)";
  const text = h
    ? `motor: connected · backend: ${h.backend} · index: ${h.index_rows.toLocaleString()} rows${h.model_loaded ? "" : " · embedder warming"}`
    : "motor: offline";
  return (
    <div className="mono mt-4 flex items-center gap-2 text-[11px]" style={{ color: "var(--color-muted)" }}>
      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: tone }} />
      {text}
    </div>
  );
}

function IdleBlock() {
  return (
    <div>
      <div className="flex flex-col gap-2" aria-hidden>
        <span className="h-[3px] w-24 rounded-full" style={{ background: "var(--color-accent)", opacity: 0.75 }} />
        <span className="h-[3px] w-14 rounded-full" style={{ background: "var(--color-accent)", opacity: 0.35 }} />
        <span className="h-[3px] w-8 rounded-full" style={{ background: "var(--color-accent)", opacity: 0.16 }} />
      </div>
      <p className="mt-5 max-w-[44ch] text-[13.5px]" style={{ color: "var(--color-muted)" }}>
        One sentence for that reader, its fidelity report, and the precedents it stands on.
      </p>
    </div>
  );
}

function LoadingBlock({ warming }: { warming: boolean }) {
  return (
    <div>
      <div className="skeleton-shimmer h-4 w-3/4 rounded-[4px]" style={{ background: "var(--color-surface-2)" }} />
      <div className="skeleton-shimmer mt-3 h-4 w-2/3 rounded-[4px]" style={{ background: "var(--color-surface-2)" }} />
      <div className="skeleton-shimmer mt-3 h-4 w-1/3 rounded-[4px]" style={{ background: "var(--color-surface-2)" }} />
      <p className="mono mt-6 text-[11px]" style={{ color: "var(--color-muted)" }}>
        carrying it across · translated on your machine, judged before you read it
      </p>
      {warming ? (
        <p className="mono mt-2 text-[11px]" style={{ color: "var(--color-warn-ink)" }}>
          warming up the local embedder, first run takes about 20 seconds
        </p>
      ) : null}
    </div>
  );
}

function OfflineBlock({ onReplay }: { onReplay: () => void }) {
  return (
    <div>
      <p className="text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>
        The motor runs on your machine.
      </p>
      <p className="mt-2 text-[13.5px]" style={{ color: "var(--color-ink-2)" }}>
        Start it in three commands:
      </p>
      <div
        className="mono mt-3 flex flex-col gap-1.5 rounded-[10px] p-3.5 text-[11.5px] leading-relaxed"
        style={{ background: "var(--color-surface-2)", color: "var(--color-ink-2)" }}
      >
        {QUICKSTART.map((c) => (
          <span key={c}>$ {c}</span>
        ))}
      </div>
      <button
        onClick={onReplay}
        className="hov hov-bc hov-fg mono mt-4 rounded-full px-3.5 py-1.5 text-[12px] active:translate-y-px"
        style={{
          border: "1px solid var(--color-line-2)",
          color: "var(--color-ink-2)",
          ["--hv-bc" as string]: "var(--color-accent-line)",
          ["--hv-fg" as string]: "var(--color-ink)",
        }}
      >
        Watch a recorded session
      </button>
    </div>
  );
}

function LiveView({ initialFinding = "" }: { initialFinding?: string }) {
  const [h, setH] = useState<Health | null>(null);
  const [checked, setChecked] = useState(false);
  const [finding, setFinding] = useState(initialFinding);
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]["key"]>("technical_leadership");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [err, setErr] = useState("");
  const [showReplay, setShowReplay] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const r = await health();
      if (cancelled) return;
      setH(r);
      setChecked(true);
    };
    poll();
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const offline = checked && h == null;

  async function onTranslate() {
    if (!finding.trim() || status === "loading" || offline) return;
    setStatus("loading");
    setErr("");
    try {
      // the wire type predates the register schema; the motor accepts the
      // dataset's real register keys (audience_observed), which is what we send
      const r = await translate({ finding, audience: audience as unknown as TranslateBody["audience"], format: "email" });
      setResult(r);
      setStatus("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  // Replay mode replaces the WHOLE panel: never nested inside the live canvas,
  // so the interactive form can't render underneath the recording (TRY-06).
  if (showReplay) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="mono text-[11px]" style={{ color: "var(--color-muted)" }}>
            recorded session · dry run
          </p>
          <button
            type="button"
            onClick={() => setShowReplay(false)}
            className="hov hov-bc hov-fg mono rounded-full px-3 py-1 text-[11.5px] active:translate-y-px"
            style={{
              border: "1px solid var(--color-line-2)",
              color: "var(--color-ink-2)",
              ["--hv-bc" as string]: "var(--color-accent-line)",
              ["--hv-fg" as string]: "var(--color-ink)",
            }}
          >
            back to the instrument
          </button>
        </div>
        <ReplayView />
      </div>
    );
  }

  const ready = Boolean(finding.trim()) && !offline;

  /* the technical world: the finding, as filed */
  const left = (
    <div>
      <WorldLabel world="tech" title="technical" sub="the finding, as filed" htmlFor="try-finding" />
      <div className="mt-4 flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s.label}
            onClick={() => setFinding(s.text)}
            className="hov hov-bc hov-fg mono rounded-full px-2.5 py-1 text-[11px] active:translate-y-px"
            style={{
              color: "var(--color-ink-2)",
              border: "1px solid var(--color-line-2)",
              background: "var(--color-surface)",
              ["--hv-bc" as string]: "var(--color-tech)",
              ["--hv-fg" as string]: "var(--color-ink)",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <textarea
        id="try-finding"
        name="finding"
        value={finding}
        onChange={(e) => setFinding(e.target.value)}
        rows={11}
        placeholder="Broken access control on organization role management..."
        className="mono mt-3 w-full rounded-[10px] border p-3 text-[12.5px] leading-[1.7]"
        style={{ borderColor: "var(--color-tech-line)", background: "var(--color-surface)", color: "var(--color-ink)" }}
      />
      <p className="mono mt-1 text-[10.5px]" style={{ color: "var(--color-muted)" }}>
        description, severity, affected systems, caveats
      </p>
      <HealthStrip h={h} />
      {err ? (
        <p role="alert" className="mono mt-2 text-[11px]" style={{ color: "var(--color-bad)" }}>
          {err}
        </p>
      ) : null}
    </div>
  );

  /* the legible world: the reader lives here, and so does what they get */
  const right = (
    <div>
      <WorldLabel world="legible" title="legible" sub="the sentence, for its reader" />
      <div className="mono mt-4 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--color-muted)" }}>
        <label htmlFor="try-audience">written for</label>
        <div className="relative">
          <select
            id="try-audience"
            name="audience"
            value={audience}
            disabled={offline}
            onChange={(e) => setAudience(e.target.value as typeof audience)}
            className="appearance-none truncate rounded-[9px] border py-1.5 pl-2.5 pr-8 text-[12.5px]"
            style={{ borderColor: "var(--color-accent-line)", background: "var(--color-surface)", color: "var(--color-ink)", fontFamily: "var(--font-sans)" }}
          >
            {AUDIENCES.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
          <CaretDown size={13} weight="bold" aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--color-muted)" }} />
        </div>
      </div>
      <div className="mt-7" aria-live="polite">
        {offline ? (
          <OfflineBlock onReplay={() => setShowReplay(true)} />
        ) : status === "done" && result ? (
          <TranslationBlock result={result} />
        ) : status === "loading" ? (
          <LoadingBlock warming={h ? !h.model_loaded : false} />
        ) : (
          <IdleBlock />
        )}
      </div>
    </div>
  );

  return (
    <SplitCanvas
      state={status === "loading" ? "loading" : status === "done" && result ? "crossed" : "idle"}
      crossKey={result ? resultSig(result) : undefined}
      left={left}
      seam={
        <SeamButton
          label="translate"
          icon={<ArrowRight size={20} weight="bold" aria-hidden />}
          onClick={onTranslate}
          disabled={!ready}
          busy={status === "loading"}
        />
      }
      right={right}
      below={<div aria-live="polite">{status === "done" && result ? <TranslateBelow result={result} /> : null}</div>}
    />
  );
}

export function TryPanel({ mode, initialFinding }: { mode: "live" | "replay"; initialFinding?: string }) {
  return mode === "replay" ? <ReplayView compact /> : <LiveView initialFinding={initialFinding} />;
}
