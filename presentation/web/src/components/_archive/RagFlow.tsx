"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Waveform, Database, Article, Cpu, Scales, BookOpenText,
  SealCheck, FileMagnifyingGlass, ArrowDown,
} from "@phosphor-icons/react";
import * as f from "@/content/facts";
import { MOTOR_JUDGE_CHECKS } from "@/content/system";
import { retrievalSection as R } from "@/content/_archive/system-sections";
import { Reveal } from "@/components/primitives";

/* RagFlow (v3 diagram 1, the canonical two-lane RAG diagram, ours):

   INDEXING · once, offline          RETRIEVAL + GENERATION · each finding
   [every pair] -> [Qwen3 embed] -----------------------------.
                                                              v
   [you] -> [your finding] -> [Qwen3 embed] -- similarity --> [ LanceDB ]
                                                              (cylinder)
   [draft]    <- [gate]  <- [model] <- [prompt+playbook] <-- top-4 precedents
        `--------------------------------------------------------> back to you

   Crafted SVG + Phosphor. A query pulse flows in, the precedents flow back,
   the checked draft returns to the user. Reduced motion / no-JS: resolved.

   The pair count is interpolated from facts.ts, never typed: this diagram
   carried "4,513 pairs" in four places, one of them the aria-label, so the
   screen-reader copy stated a count the dataset had not had for two versions. */

type Ink = "tech" | "accent" | "ok" | "graphite";
const C: Record<Ink, { ink: string; fill: string; line: string }> = {
  tech: { ink: "var(--color-tech-ink)", fill: "var(--color-tech-soft)", line: "var(--color-tech-line)" },
  accent: { ink: "var(--color-accent-ink)", fill: "var(--color-accent-soft)", line: "var(--color-accent-line)" },
  ok: { ink: "var(--color-ok-ink)", fill: "var(--color-ok-soft)", line: "color-mix(in oklch, var(--color-ok) 40%, transparent)" },
  graphite: { ink: "var(--color-ink-2)", fill: "var(--color-surface-2)", line: "var(--color-line-2)" },
};

/* ---------- geometry (percent of the plate) ---------- */
const Y_INDEX = 20;   // indexing lane
const Y_QUERY = 52;   // query row
const Y_GEN = 80;     // generation row (right to left)
const CYL = { xL: 77, xR: 95, yT: 9, yB: 91 }; // the LanceDB cylinder
const X = {
  pairs: 12, embed1: 38,
  user: 7, finding: 21.5, embed2: 38,
  prompt: 58, lora: 43, judge: 30, sentence: 16,
  playbook: 58,
};
const T = 12;
/* one-shot: diagram 1 plays once on view and settles (v3 §3.5 motion law —
   the home loop budget belongs to the hero figure + workflow idle only).
   Every pulse keyframe starts and ends at opacity 0, so the resolved state
   is the fully drawn static diagram. */
const LOOP = { duration: T, repeat: 0, ease: "easeInOut" as const };

/* a mini stack of pair cards: rust line (finding) + cobalt line (translation) */
function PairStack() {
  return (
    <div className="relative" style={{ width: 52, height: 46 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute flex flex-col justify-center gap-[4px] rounded-[6px] px-2"
          style={{
            left: i * 5, top: i * 5, width: 42, height: 30,
            background: "var(--color-surface)", border: "1px solid var(--color-line-2)",
            boxShadow: "0 1px 3px oklch(0.25 0.02 260 / 0.08)", zIndex: 3 - i,
          }}
        >
          <span style={{ height: 3, width: "82%", borderRadius: 2, background: "var(--color-tech)" }} />
          <span style={{ height: 3, width: "58%", borderRadius: 2, background: "var(--color-accent)" }} />
        </span>
      ))}
    </div>
  );
}

/* a crisp two-tone person mark, hand-drawn SVG (the AI-generated ones glowed):
   slate head, cobalt shoulders, a small rust collar detail */
function UserMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="15.5" r="9.5" fill="var(--color-ink-2)" opacity="0.75" />
      <path d="M8 42c0-9 7.2-14.5 16-14.5S40 33 40 42v1.5H8Z" fill="var(--color-accent)" />
      <path d="M21.5 27.8h5l-1.6 4.4h-1.8Z" fill="var(--color-tech)" />
    </svg>
  );
}

function NodeCircle({ icon: Icon, ink, size = 48 }: { icon: React.ElementType; ink: Ink; size?: number }) {
  const c = C[ink];
  return (
    <div className="flex items-center justify-center rounded-full" style={{ width: size, height: size, background: c.fill, border: `1px solid ${c.line}` }}>
      <Icon size={size * 0.5} weight="duotone" style={{ color: c.ink }} />
    </div>
  );
}

function NodeLabel({ name, sub, anchor }: { name: string; sub?: string; anchor?: { label: string; href: string } }) {
  return (
    <div className="mt-1.5 flex flex-col items-center text-center">
      <span className="text-[12px] font-semibold leading-tight" style={{ color: "var(--color-ink)" }}>{name}</span>
      {sub && <span className="mono text-[9.5px] leading-tight" style={{ color: "var(--color-muted)" }}>{sub}</span>}
      {anchor && (
        <a href={anchor.href} className="mono mt-0.5 inline-flex items-center gap-0.5 text-[9.5px]" style={{ color: "var(--color-accent-ink)" }}>
          {anchor.label} <ArrowDown size={9} weight="bold" />
        </a>
      )}
    </div>
  );
}

/* absolute-positioned node, centered on its (x,y) */
function Station({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div className="absolute z-20 flex flex-col items-center" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)" }}>
      {children}
    </div>
  );
}

export function RagFlow() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 1200, h: 640 });
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const el = plateRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setBox({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (reduce) return;
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { setAnimate(true); io.disconnect(); } }, { rootMargin: "0px 0px -12% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  const px = (p: number) => (p / 100) * box.w;
  const py = (p: number) => (p / 100) * box.h;

  // cylinder geometry in px
  const cxL = px(CYL.xL), cxR = px(CYL.xR), cyT = py(CYL.yT), cyB = py(CYL.yB);
  const crx = (cxR - cxL) / 2, cxC = (cxL + cxR) / 2;
  const cry = 14;

  // edges (px space). generation row runs right -> left.
  const edges: { d: string; dash?: boolean; tone?: string }[] = [
    // indexing: pairs -> embed -> cylinder
    { d: `M ${px(X.pairs) + 34} ${py(Y_INDEX)} L ${px(X.embed1) - 32} ${py(Y_INDEX)}` },
    { d: `M ${px(X.embed1) + 32} ${py(Y_INDEX)} L ${cxL - 6} ${py(Y_INDEX)}` },
    // query row: user -> finding -> embed -> cylinder
    { d: `M ${px(X.user) + 30} ${py(Y_QUERY)} L ${px(X.finding) - 30} ${py(Y_QUERY)}` },
    { d: `M ${px(X.finding) + 30} ${py(Y_QUERY)} L ${px(X.embed2) - 32} ${py(Y_QUERY)}` },
    { d: `M ${px(X.embed2) + 32} ${py(Y_QUERY)} L ${cxL - 6} ${py(Y_QUERY)}` },
    // generation row: cylinder -> prompt -> lora -> judge -> sentence
    { d: `M ${cxL - 6} ${py(Y_GEN)} L ${px(X.prompt) + 34} ${py(Y_GEN)}`, tone: "var(--color-accent-line)" },
    { d: `M ${px(X.prompt) - 34} ${py(Y_GEN)} L ${px(X.lora) + 32} ${py(Y_GEN)}`, tone: "var(--color-accent-line)" },
    { d: `M ${px(X.lora) - 32} ${py(Y_GEN)} L ${px(X.judge) + 30} ${py(Y_GEN)}`, tone: "var(--color-accent-line)" },
    { d: `M ${px(X.judge) - 30} ${py(Y_GEN)} L ${px(X.sentence) + 32} ${py(Y_GEN)}`, tone: "var(--color-accent-line)" },
    // sentence -> back up to the user (routed left of the user node, into its side)
    { d: `M ${px(X.sentence) - 26} ${py(Y_GEN)} L ${px(3.0)} ${py(Y_GEN)} L ${px(3.0)} ${py(Y_QUERY) + 6} L ${px(X.user) - 30} ${py(Y_QUERY) + 6}`, tone: "var(--color-ok)", dash: true },
    // playbook feeder up into prompt
    { d: `M ${px(X.playbook)} ${py(94)} L ${px(X.playbook)} ${py(Y_GEN) + 36}`, dash: true, tone: "var(--color-accent-line)" },
    // the finding itself also feeds the prompt (elbow, dashed rust): less text, more arrow
    { d: `M ${px(X.finding)} ${py(Y_QUERY) + 36} L ${px(X.finding)} ${py(66)} L ${px(X.prompt)} ${py(66)} L ${px(X.prompt)} ${py(Y_GEN) - 40}`, dash: true, tone: "var(--color-tech-line)" },
  ];

  return (
    <div ref={rootRef}>
      <Reveal>
        <h2 className="h2 max-w-[22ch]" style={{ color: "var(--color-ink)" }}>{R.h2}</h2>
        <p className="lede mt-4 max-w-[70ch]">{R.lede}</p>
      </Reveal>

      {/* ================= desktop diagram ================= */}
      <Reveal delay={0.05}>
        <div
          ref={plateRef}
          className="plate relative mt-10 hidden lg:block"
          style={{ height: 640 }}
          role="img"
          aria-label={`A two-lane RAG diagram. Indexing, once: all ${f.formatCount(f.PAIRS)} pairs flow through the Qwen3 embedding model into the LanceDB vector database. Retrieval and generation, each finding: you paste a finding, it is embedded and searched against LanceDB; the top four human precedents come back, merge with the playbook into a prompt, the local model writes a draft, the deterministic gate runs ${MOTOR_JUDGE_CHECKS} checks over it, and the draft returns to you with whatever they flagged.`}
        >
          {/* lane titles + divider */}
          <span className="mono absolute z-10 text-[10px] uppercase tracking-wide" style={{ left: "3.5%", top: "5%", color: "var(--color-muted)" }}>
            indexing · once, offline
          </span>
          <span className="mono absolute z-10 text-[10px] uppercase tracking-wide" style={{ left: "3.5%", top: "37%", color: "var(--color-muted)" }}>
            retrieval + generation · each finding
          </span>

          {/* edges + cylinder (px space) */}
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden>
            <defs>
              <marker id="rag-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0.8 L7.2,4 L0,7.2 Z" fill="var(--color-line-2)" />
              </marker>
              <marker id="rag-arr-accent" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0.8 L7.2,4 L0,7.2 Z" fill="var(--color-accent)" opacity="0.55" />
              </marker>
              <marker id="rag-arr-ok" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0.8 L7.2,4 L0,7.2 Z" fill="var(--color-ok)" />
              </marker>
              <marker id="rag-arr-tech" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0.8 L7.2,4 L0,7.2 Z" fill="var(--color-tech)" opacity="0.6" />
              </marker>
            </defs>

            {/* lane divider (stops before the cylinder) */}
            <line x1={px(3.5)} y1={py(34)} x2={px(72)} y2={py(34)} stroke="var(--color-line)" strokeWidth={1} strokeDasharray="4 5" />

            {/* the LanceDB cylinder, spanning both lanes */}
            <path
              d={`M ${cxL} ${cyT + cry} L ${cxL} ${cyB - cry} A ${crx} ${cry} 0 0 0 ${cxR} ${cyB - cry} L ${cxR} ${cyT + cry}`}
              fill="var(--color-accent-soft)" stroke="var(--color-accent-line)" strokeWidth={1.25}
            />
            <ellipse cx={cxC} cy={cyT + cry} rx={crx} ry={cry} fill="color-mix(in oklch, var(--color-accent) 16%, white)" stroke="var(--color-accent-line)" strokeWidth={1.25} />
            {/* the vectors themselves: a deterministic dot field inside the drum */}
            {Array.from({ length: 54 }).map((_, i) => {
              const a = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
              const b = Math.sin(i * 39.346 + 11.135) * 24634.633;
              const u = a - Math.floor(a), v = b - Math.floor(b);
              // round to 2dp: Math.sin differs at the last bit between the SSR
              // (Node) and client (browser) runtimes, which would otherwise
              // desync cx/cy and trip a hydration mismatch.
              const dx = Math.round((cxL + 10 + u * (cxR - cxL - 20)) * 100) / 100;
              const dy = Math.round((cyT + cry + 14 + v * (cyB - cyT - 2 * cry - 28)) * 100) / 100;
              const r = 1.4 + ((i * 7) % 3) * 0.55;
              return <circle key={i} cx={dx} cy={dy} r={r} fill="var(--color-accent)" opacity={0.18 + ((i * 13) % 5) * 0.09} />;
            })}

            {/* edges */}
            {edges.map((e, i) => (
              <path
                key={i}
                d={e.d}
                fill="none"
                stroke={e.tone ?? "var(--color-line-2)"}
                strokeWidth={1.5}
                strokeDasharray={e.dash ? "4 4" : undefined}
                markerEnd={
                  e.tone === "var(--color-ok)" ? "url(#rag-arr-ok)"
                  : e.tone === "var(--color-tech-line)" ? "url(#rag-arr-tech)"
                  : e.tone ? "url(#rag-arr-accent)" : "url(#rag-arr)"
                }
              />
            ))}

            {/* cylinder glow when the query lands */}
            {animate && (
              <motion.ellipse
                cx={cxC} cy={cyT + cry} rx={crx} ry={cry}
                fill="none" stroke="var(--color-accent)" strokeWidth={1.5}
                animate={{ opacity: [0, 0, 0.8, 0, 0], scale: [1, 1, 1.06, 1, 1] }}
                transition={{ ...LOOP, times: [0, 0.3, 0.36, 0.42, 1] }}
                style={{ transformOrigin: `${cxC}px ${cyT + cry}px` }}
              />
            )}
          </svg>

          {/* edge labels */}
          <span className="mono absolute text-[9.5px]" style={{ left: "56%", top: `${Y_INDEX - 5}%`, color: "var(--color-muted)" }}>1,024-dim vectors</span>
          <span className="mono absolute text-[9.5px]" style={{ left: "55.5%", top: `${Y_QUERY - 5}%`, color: "var(--color-muted)" }}>similarity search</span>
          <span className="mono absolute text-[9.5px]" style={{ left: "64.5%", top: `${Y_GEN - 6}%`, color: "var(--color-accent-ink)" }}>top-4 precedents</span>
          <span className="mono absolute text-[9.5px]" style={{ left: "5.2%", top: "65%", color: "var(--color-ok-ink)" }}>back to you</span>

          {/* ---- indexing lane nodes ---- */}
          <Station x={X.pairs} y={Y_INDEX}>
            <PairStack />
            <NodeLabel name={`${f.formatCount(f.PAIRS)} pairs`} sub="finding + its translation" />
          </Station>
          <Station x={X.embed1} y={Y_INDEX}>
            <NodeCircle icon={Waveform} ink="accent" />
            <NodeLabel name="embedding" sub="Qwen3 · 1,024-dim" />
          </Station>

          {/* ---- query row nodes ---- */}
          <Station x={X.user} y={Y_QUERY}>
            <div className="flex items-center justify-center rounded-full" style={{ width: 52, height: 52, background: "var(--color-surface-2)", border: "1px solid var(--color-line-2)" }}>
              <UserMark size={32} />
            </div>
            <NodeLabel name="you" sub="paste a finding" />
          </Station>
          <Station x={X.finding} y={Y_QUERY}>
            <NodeCircle icon={FileMagnifyingGlass} ink="tech" />
            <NodeLabel name="your finding" sub="raw, technical" />
          </Station>
          <Station x={X.embed2} y={Y_QUERY}>
            <NodeCircle icon={Waveform} ink="accent" />
            <NodeLabel name="embedding" sub="same model" />
          </Station>

          {/* ---- generation row nodes (right to left) ---- */}
          <Station x={X.prompt} y={Y_GEN}>
            <NodeCircle icon={Article} ink="accent" />
            <NodeLabel name="prompt" />
          </Station>
          <Station x={X.lora} y={Y_GEN}>
            <NodeCircle icon={Cpu} ink="accent" />
            <NodeLabel name="plaintext-9b" sub="local model, unpublished" anchor={{ label: "the model", href: "/model/" }} />
          </Station>
          <Station x={X.judge} y={Y_GEN}>
            <NodeCircle icon={Scales} ink="ok" />
            <NodeLabel name="the gate" sub={`${MOTOR_JUDGE_CHECKS} deterministic checks`} />
          </Station>
          <Station x={X.sentence} y={Y_GEN}>
            <div className="relative">
              <NodeCircle icon={SealCheck} ink="ok" />
            </div>
            <NodeLabel name="the sentence" sub="drafted, then checked" />
          </Station>

          {/* playbook feeder */}
          <div className="absolute z-20 flex items-center gap-2" style={{ left: `${X.playbook}%`, top: "94%", transform: "translate(-50%,-50%)" }}>
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-accent-line)" }}>
              <BookOpenText size={13} weight="duotone" style={{ color: "var(--color-accent-ink)" }} />
              <span className="mono text-[9.5px]" style={{ color: "var(--color-accent-ink)" }}>playbook · 12 rules</span>
            </div>
          </div>

          {/* cylinder label */}
          <div className="absolute z-20 flex flex-col items-center text-center" style={{ left: `${(CYL.xL + CYL.xR) / 2}%`, top: "48%", transform: "translate(-50%,-50%)" }}>
            <Database size={24} weight="duotone" style={{ color: "var(--color-accent-ink)" }} />
            <span className="mt-1 text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>LanceDB</span>
            <span className="mono text-[9.5px]" style={{ color: "var(--color-muted)" }}>vector database</span>
            <span className="num mono mt-1 text-[9.5px]" style={{ color: "var(--color-accent-ink)" }}>{`${f.formatCount(f.PAIRS)} pairs embedded`}</span>
          </div>

          {/* ---- moving data ----
              owner call 2026-07-12: no rust dots in motion. The technical
              (rust) side of the diagram stays fully static; only the answer
              coming BACK moves (cobalt return + green home run). */}
          {animate && (
            <>
              {/* the return pulse: cylinder -> prompt -> LoRA -> judge -> sentence */}
              <motion.span
                aria-hidden className="absolute z-10 rounded-full"
                style={{ top: `${Y_GEN}%`, height: 9, width: 9, marginTop: -4.5, marginLeft: -4.5, background: "var(--color-accent)", boxShadow: "0 0 10px 2px color-mix(in oklch, var(--color-accent) 45%, transparent)" }}
                animate={{ left: [`${CYL.xL - 1}%`, `${CYL.xL - 1}%`, `${X.sentence}%`, `${X.sentence}%`], opacity: [0, 1, 1, 0] }}
                transition={{ ...LOOP, left: { ...LOOP, times: [0, 0.4, 0.68, 1] }, opacity: { ...LOOP, times: [0, 0.4, 0.68, 0.72] } }}
              />
              {/* home run: sentence -> back to you */}
              <motion.span
                aria-hidden className="absolute z-10 rounded-full"
                style={{ height: 8, width: 8, marginTop: -4, marginLeft: -4, background: "var(--color-ok)" }}
                animate={{
                  left: [`${X.sentence - 2}%`, `${X.sentence - 2}%`, "3.0%", "3.0%", `${X.user - 1.5}%`, `${X.user - 1.5}%`],
                  top: [`${Y_GEN}%`, `${Y_GEN}%`, `${Y_GEN}%`, `${Y_QUERY + 1}%`, `${Y_QUERY + 1}%`, `${Y_QUERY + 1}%`],
                  opacity: [0, 1, 1, 1, 1, 0],
                }}
                transition={{ ...LOOP, times: [0, 0.72, 0.78, 0.85, 0.9, 0.94] }}
              />
            </>
          )}
        </div>
      </Reveal>

      {/* ================= mobile: two labeled vertical groups ================= */}
      <div className="mt-8 flex flex-col gap-8 lg:hidden">
        <div>
          <p className="mono text-[10px] uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>indexing · once, offline</p>
          <div className="mt-3 flex items-center gap-3">
            <PairStack />
            <span style={{ color: "var(--color-line-2)" }}>&rarr;</span>
            <NodeCircle icon={Waveform} ink="accent" size={40} />
            <span style={{ color: "var(--color-line-2)" }}>&rarr;</span>
            <NodeCircle icon={Database} ink="accent" size={44} />
          </div>
          <p className="mono mt-2 text-[10.5px]" style={{ color: "var(--color-muted)" }}>{`${f.formatCount(f.PAIRS)} pairs`} &rarr; Qwen3 embedding &rarr; LanceDB</p>
        </div>
        <div>
          <p className="mono text-[10px] uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>retrieval + generation · each finding</p>
          <div className="mt-3 flex flex-col gap-2">
            {[
              ["you paste a raw finding", "UserCircle"],
              ["it is embedded with the same model", "Waveform"],
              ["similarity search pulls the top-4 human precedents", "Database"],
              ["finding + playbook + precedents become the prompt", "Article"],
              ["the local model writes a draft", "Cpu"],
              [`the gate runs ${MOTOR_JUDGE_CHECKS} deterministic checks, then it returns to you`, "Scales"],
            ].map(([txt], i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="num mono flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px]" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent-ink)" }}>{i + 1}</span>
                <span className="text-[13px]" style={{ color: "var(--color-ink-2)" }}>{txt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
