"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

/* HeroMerge (v3 hero, full-bleed, no card): a real security finding is shown in
   plain black. Then every word arcs toward the centre, blurs and shifts to
   cobalt (a smudge with a soft glow), and the translation blooms out of it.
   Voice tabs (CFO / Analogy / Engineer / Board / The fix) re-run the merge on
   demand; a small dial switches the finding. Nothing auto-cycles. SSR / no-JS /
   reduced-motion render the resolved frame (translation shown). */

const TYPES = ["CFO", "Analogy", "Engineer", "Board", "The fix"] as const;

type Finding = { category: string; label: string; technical: string; execs: string[] };

const FINDINGS: Finding[] = [
  {
    category: "Identity",
    label: "Monitoring gap · Azure / Entra ID",
    technical:
      "Security monitoring is configured but unowned. Microsoft Defender for Cloud is enabled on the subscription and Entra ID sign-in-risk and audit alerts flow to a shared mailbox, but no one is assigned to triage them: there is no on-call rotation, no runbook, and no review cadence. Over the last 90 days, 214 high-severity alerts were raised and not one was acknowledged, investigated, or closed.",
    execs: [
      "We are paying for top-tier security monitoring, but no one is actually watching the alerts, so a real break-in could sit unnoticed for weeks.",
      "It is like installing the best security cameras money can buy, and then never assigning anyone to watch the monitors.",
      "Defender and Entra ID risk alerts fire into an unwatched mailbox: no owner, no on-call, no runbook, 214 high-severity alerts unacknowledged in 90 days. Route them into a ticketing queue with an on-call rotation and response SLAs.",
      "High exposure. Detection exists on paper but not in practice, so mean time to respond is effectively infinite and an incident could dwell undetected. This is a governance and staffing gap, not a tooling gap.",
      "Assign an owner and an on-call rotation, route alerts into a ticketing system with response SLAs, and add a weekly review. No new tools, just accountability.",
    ],
  },
  {
    category: "Logging",
    label: "No audit trail · payments service",
    technical:
      "The payments service writes application logs to the local container filesystem only. There is no central log aggregation, logs are lost when a pod restarts, and retention is under 24 hours. After a suspected fraud incident last quarter, responders had no record of who accessed what, and the investigation stalled within a day.",
    execs: [
      "When something goes wrong, we have almost no record of what happened, so we cannot say how bad it was or who we need to notify.",
      "It is like a bank with no ledger: the day after a robbery, no one can say what was taken, or when, or by whom.",
      "Logs are ephemeral and local: no aggregation, sub-24h retention, no tamper protection. Ship structured audit events to a central, append-only store with a year of retention.",
      "We cannot investigate or prove what happened in an incident, which blocks breach notification and any regulatory defense. This is an evidentiary gap that turns a small event into an unbounded one.",
      "Send logs to a central, append-only store with one year of retention, and record a structured audit event for every sensitive action. A few days of work.",
    ],
  },
  {
    category: "Web app",
    label: "Default admin creds · internet-facing",
    technical:
      "The Jenkins build console is reachable from the public internet and still accepts the shipped default credentials, admin / admin, with no network restriction and no MFA. From there an attacker can run arbitrary build steps, read the stored deployment secrets, and push code straight to production.",
    execs: [
      "A control panel that can push code to our production systems was open to the internet with the password it shipped with.",
      "It is like bolting a heavy vault to the wall but leaving the factory combination, zero-zero-zero-zero, printed on the door.",
      "Internet-facing Jenkins with default admin/admin, no allowlist, no MFA. Rotate the credential, put it behind SSO and an IP allowlist, disable anonymous access, and audit for prior use.",
      "Critical. An internet-exposed system can push code to production with a guessable password; assume it could lead to full compromise. This should be fixed today, not scheduled.",
      "Change the default password now, put the console behind SSO and an IP allowlist, and require MFA. Hours, not days.",
    ],
  },
];

const TIMING = { dwell: 2800, merge: 1050, bloom: 780 };
const EASE_INOUT = "cubic-bezier(0.77, 0, 0.175, 1)";
const EASE_OUT = "cubic-bezier(0.19, 1, 0.22, 1)";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export function HeroMerge() {
  const reduce = useReducedMotion();
  const [live, setLive] = useState(false);
  const [fIdx, setF] = useState(0);
  const [rIdx, setR] = useState(0);

  const finding = FINDINGS[fIdx];
  const words = useMemo(() => finding.technical.split(/\s+/).filter(Boolean), [fIdx]);
  const sentWords = useMemo(() => finding.execs[rIdx].split(" "), [fIdx, rIdx]);

  const wallRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const sentenceRef = useRef<HTMLParagraphElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const underlineRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => { if (!reduce) setLive(true); }, [reduce]);

  useLayoutEffect(() => {
    const tab = tabRefs.current[rIdx], u = underlineRef.current;
    if (tab && u) { u.style.transform = `translateX(${tab.offsetLeft}px)`; u.style.width = `${tab.offsetWidth}px`; }
  }, [rIdx, live]);

  // the merge timeline (re-runs whenever the finding or voice changes)
  useEffect(() => {
    const wall = wallRef.current, glow = glowRef.current, sentence = sentenceRef.current, stage = stageRef.current;
    if (!wall || !glow || !sentence || !stage) return;
    if (reduce || !live) return;

    const wordEls = Array.from(wall.querySelectorAll<HTMLElement>(".mrg-word"));
    const sentEls = Array.from(sentence.querySelectorAll<HTMLElement>(".mrg-sentence-word"));
    let cancelled = false;

    // reset to the raw-finding state (also kills any leftover fill:forwards blur)
    wall.getAnimations().forEach((a) => a.cancel());
    wall.style.filter = "blur(0px)";
    wordEls.forEach((el) => { el.getAnimations().forEach((a) => a.cancel()); el.style.transform = "none"; el.style.opacity = "1"; el.style.color = ""; });
    glow.getAnimations().forEach((a) => a.cancel()); glow.style.opacity = "0";
    sentence.getAnimations().forEach((a) => a.cancel()); sentence.style.filter = "blur(0px)";
    sentEls.forEach((el) => { el.getAnimations().forEach((a) => a.cancel()); el.style.opacity = "0"; el.style.transform = "none"; });

    (async () => {
      await raf(); await raf(); if (cancelled) return;
      await wait(TIMING.dwell); if (cancelled) return;

      const sr = stage.getBoundingClientRect(), br = sentence.getBoundingClientRect();
      const cx = (br.left + br.right) / 2 - sr.left, cy = (br.top + br.bottom) / 2 - sr.top;
      glow.style.left = `${cx}px`; glow.style.top = `${cy}px`;

      // words collapse in arcs toward the centre, blur, and shift black -> cobalt
      wall.animate([{ filter: "blur(0px)" }, { filter: "blur(4px)" }], { duration: TIMING.merge, easing: EASE_INOUT, fill: "forwards" });
      wordEls.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const dx = cx - ((r.left + r.right) / 2 - sr.left), dy = cy - ((r.top + r.bottom) / 2 - sr.top);
        el.animate(
          [
            { transform: "translate(0,0) scale(1)", color: "#16181D", opacity: 1, offset: 0 },
            { transform: `translate(${dx * 0.32}px,${dy * 0.72}px) scale(0.86)`, color: "#5B54D6", opacity: 0.62, offset: 0.5 },
            { transform: `translate(${dx}px,${dy}px) scale(0.66)`, color: "#2A5BFF", opacity: 0, offset: 1 },
          ],
          { duration: TIMING.merge, delay: Math.min(i * 4, 220), easing: EASE_INOUT, fill: "forwards" }
        );
      });
      glow.animate([{ opacity: 0 }, { opacity: 0.55, offset: 0.62 }, { opacity: 0 }], { duration: TIMING.merge + 320, easing: "ease", fill: "forwards" });

      await wait(Math.round(TIMING.merge * 0.56)); if (cancelled) return;

      // the translation blooms out of the smudge
      sentence.animate([{ filter: "blur(9px)" }, { filter: "blur(0px)" }], { duration: TIMING.bloom, easing: EASE_OUT, fill: "forwards" });
      sentEls.forEach((el, i) => {
        el.animate(
          [{ opacity: 0, transform: "translateY(9px) scale(0.97)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
          { duration: TIMING.bloom, delay: i * 26, easing: EASE_OUT, fill: "forwards" }
        );
      });
      // no auto-advance: rest on the sentence
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fIdx, rIdx, live, reduce]);

  const prevFinding = () => setF((fIdx - 1 + FINDINGS.length) % FINDINGS.length);
  const nextFinding = () => setF((fIdx + 1) % FINDINGS.length);

  const chevron = "flex h-[23px] w-[23px] items-center justify-center rounded-full border transition-colors";

  return (
    <div className={live ? undefined : "mrg-poster"}>
      {/* spine: voice tabs (left) + finding dial (right) */}
      <div className="mb-3.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        {/* single row always: horizontal scroll below sm so the sliding
            underline (absolute, offsetLeft-tracked) can never misalign on wrap */}
        <div className="relative flex max-w-full items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <span className="pointer-events-none absolute bottom-0 left-0 right-0 h-px" style={{ background: "var(--color-line)" }} />
          <span ref={underlineRef} className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded" style={{ width: 0, background: "var(--color-accent)", transition: "transform .42s cubic-bezier(.22,1,.36,1), width .42s cubic-bezier(.22,1,.36,1)" }} />
          {TYPES.map((t, i) => (
            <button
              key={t}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              onClick={() => setR(i)}
              className="flex-none whitespace-nowrap px-3 pb-3 pt-1.5 text-[0.95rem] font-semibold leading-none transition-colors"
              style={{ fontVariantCaps: "all-small-caps", letterSpacing: "0.09em", color: i === rIdx ? "var(--color-accent)" : "var(--color-muted)" }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* the finding dial */}
        <div className="flex flex-col items-end gap-1.5 pb-1.5">
          <div className="flex items-center gap-2.5">
            <button type="button" aria-label="previous finding" onClick={prevFinding} className={chevron}
              style={{ borderColor: "var(--color-line-2)", color: "var(--color-muted)" }}>
              <CaretLeft size={13} weight="bold" />
            </button>
            {/* label truncates between the fixed chevrons so the next-finding
                control is always reachable at 375px */}
            <div className="mono flex min-w-0 items-baseline gap-2">
              <span className="flex-none text-[9.5px] uppercase tracking-[0.09em]" style={{ color: "var(--color-line-2)" }}>finding</span>
              <span className="flex-none whitespace-nowrap text-[12px] font-semibold" style={{ color: "var(--color-ink)" }}>{finding.category}</span>
              <span className="truncate text-[11px]" style={{ color: "var(--color-muted)", maxWidth: "clamp(72px, 24vw, 220px)" }}>{finding.label}</span>
            </div>
            <button type="button" aria-label="next finding" onClick={nextFinding} className={chevron}
              style={{ borderColor: "var(--color-line-2)", color: "var(--color-muted)" }}>
              <CaretRight size={13} weight="bold" />
            </button>
          </div>
          <div className="flex gap-[5px]">
            {FINDINGS.map((_, i) => (
              <button key={i} type="button" aria-label={`finding ${i + 1}`} onClick={() => setF(i)}
                className="h-[6px] w-[6px] rounded-full transition-all"
                style={{ background: i === fIdx ? "var(--color-accent)" : "var(--color-line-2)", transform: i === fIdx ? "scale(1.15)" : "none" }} />
            ))}
          </div>
        </div>
      </div>

      {/* stage (full-bleed): raw finding -> smudge -> the born sentence */}
      <div ref={stageRef} className="relative" style={{ minHeight: "clamp(300px, 38vh, 400px)" }}>
        <div ref={wallRef} className="mrg-wall" aria-label={finding.technical}>
          {words.map((w, i) => (
            <span key={i}><span className="mrg-word">{w}</span>{" "}</span>
          ))}
        </div>
        <div ref={glowRef} className="mrg-glow" aria-hidden />
        <div className="mrg-overlay">
          <p ref={sentenceRef} className="mrg-sentence">
            {sentWords.map((w, i) => (<span key={i} className="mrg-sentence-word">{w}</span>))}
          </p>
        </div>
      </div>
    </div>
  );
}
