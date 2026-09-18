"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  FileMagnifyingGlass, UserCircle, Bug, Database, MagnifyingGlass, Files, Article,
  BookOpenText, Quotes, Cpu, Laptop, WifiSlash, Scales, ChatCircleText, SealCheck,
  ArrowRight, ArrowUpRight, type Icon,
} from "@phosphor-icons/react";
import { workflowSection } from "@/content/_archive/system-sections";
import { Reveal } from "@/components/primitives";

/* Workflow (v3 §4.3): the whole machine in one glance, on white, every station
   alive with an icon medallion. Also the page's table of contents.

   The verdict choreography (one keyframed loop, period T): a cobalt pulse
   travels station 1 to the judge and STOPS; it holds while the six gate dots
   flick green one by one; when the sixth lands the pulse turns green (the
   verdict) and travels on to the output, where the seal stamps. SSR / no-JS /
   reduced motion render the fully resolved rail (all gates green, no pulse). */

const ICONS: Record<string, Icon> = {
  FileMagnifyingGlass, UserCircle, Bug, Database, MagnifyingGlass, Files, Article,
  BookOpenText, Quotes, Cpu, Laptop, WifiSlash, Scales, ChatCircleText, SealCheck,
};

type InkKey = "tech" | "accent" | "ok";
const INK: Record<InkKey, { ink: string; fill: string; line: string }> = {
  tech: { ink: "var(--color-tech-ink)", fill: "var(--color-tech-soft)", line: "var(--color-tech-line)" },
  accent: { ink: "var(--color-accent-ink)", fill: "var(--color-accent-soft)", line: "var(--color-accent-line)" },
  ok: { ink: "var(--color-ok-ink)", fill: "var(--color-ok-soft)", line: "color-mix(in oklch, var(--color-ok) 40%, transparent)" },
};

const STATIONS = workflowSection.stations;
const CX = [8.5, 25, 41.5, 58, 74.5, 91];
const JUDGE = 4; // judge station index
const OUTPUT = 5; // output station index
const CY = 14; // spine height (percent): floats above the medallions, separated
const MED_Y = 44; // medallion centers (percent)
const LABEL_Y = 66; // label block top (percent): dropped from 63 to open a clean gate-dot slot
const DOT_Y = 57; // gate-dot grid top (percent): centered in the medallion-to-label gap

// keep the same eased loop language the other rail pulses use (RagFlow / hero).
// A numeric ease array is mis-read as per-segment easings when `times` is set,
// which de-times every non-transform track, so use the named string ease and
// drive position with `left` (a non-transform) so all tracks stay in sync.
const T = 13; // full loop period
const LOOP = { duration: T, repeat: Infinity, ease: "easeInOut" as const };

// pulse position as `left` percentages: station 1 -> judge (hold) -> output
const PULSE_LEFT = [CX[0], CX[0], CX[JUDGE], CX[JUDGE], CX[JUDGE], CX[OUTPUT], CX[OUTPUT], CX[OUTPUT], CX[0]].map((v) => `${v}%`);

const A = "var(--color-accent)"; // cobalt (in transit)
const OK = "var(--color-ok)"; // green (verdict: pass)
const GRAY = "var(--color-line-2)"; // idle gate

/* ---- one keyframed timeline over T (times normalized 0..1) ----
   0.03 faded in at station 1, 0.42 arrive judge, 0.42 to 0.47 the six gates
   flick green, 0.50 the pulse turns green (the verdict) and resumes, 0.63 arrive
   output and seal, 0.74 gone. Position rides `left` and the verdict colour rides
   `background` because motion mis-times the `color` property in this version. */
const PULSE_T = [0, 0.03, 0.42, 0.47, 0.5, 0.63, 0.68, 0.74, 1];
const PULSE_OP = [0, 1, 1, 1, 1, 1, 1, 0, 0];
const PULSE_COLOR = [A, A, A, A, OK, OK, OK, OK, A];

const SPINE_T = [0, 0.03, 0.42, 0.5, 0.63, 0.7, 0.78, 1];
const SPINE_PL = [0, 0, 0.8, 0.8, 1, 1, 1, 0];
const SPINE_OP = [0, 0.85, 0.85, 0.85, 0.85, 0.85, 0, 0];

// medallion lift arrivals (stations 0..4), as the pulse reaches each
const MF = [0.03, 0.1275, 0.225, 0.3225, 0.42];

const GATE_STAGGER = 0.006; // ~78ms between the six gate flicks
const GATE_FLICK = 0.016; // flick duration

function medallionLift(mf: number) {
  const t = [0, mf - 0.03, mf, mf + 0.06, 1];
  return {
    animate: {
      y: [0, 0, -3, 0, 0],
      filter: ["brightness(1)", "brightness(1)", "brightness(1.07)", "brightness(1)", "brightness(1)"],
    },
    transition: { ...LOOP, y: { ...LOOP, times: t }, filter: { ...LOOP, times: t } },
  };
}

/* an icon medallion: 64px wash circle + duotone glyph (satellites retired) */
function Medallion({ station, size = 64 }: { station: (typeof STATIONS)[number]; size?: number }) {
  const c = INK[station.ink];
  const Glyph = ICONS[station.icon];
  return (
    <div
      className="flex items-center justify-center rounded-full"
      style={{ width: size, height: size, background: c.fill, border: `1px solid ${c.line}` }}
    >
      {Glyph ? <Glyph size={30} weight="duotone" style={{ color: c.ink }} /> : null}
    </div>
  );
}

function StationLabels({ station }: { station: (typeof STATIONS)[number] }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-[13.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
        {station.name}
      </span>
      <span className="mt-1 max-w-[15ch] text-[12.5px] leading-snug" style={{ color: "var(--color-muted)" }}>
        {station.caption}
      </span>
      <a
        href={station.href}
        className="mono mt-2 inline-flex items-center gap-1 text-[11px] transition-colors"
        style={{ color: "var(--color-accent-ink)" }}
      >
        {station.anchorLabel}
        <ArrowUpRight size={11} weight="bold" />
      </a>
    </div>
  );
}

/* the six judge gate dots (station 5). When the pulse arrives and holds, they
   flick green one by one (~78ms stagger, a little pop each), stay lit through the
   seal, then reset. Idle / no-JS: all green (the resolved verdict). */
function GateDots({ animate }: { animate: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {Array.from({ length: 6 }).map((_, i) => {
        const tf = 0.42 + i * GATE_STAGGER; // this gate flicks as the pulse holds
        return (
          <motion.span
            key={i}
            className="rounded-full"
            style={{ height: 6, width: 6, background: animate ? GRAY : OK }}
            {...(animate
              ? {
                  animate: {
                    background: [GRAY, GRAY, OK, OK, GRAY, GRAY],
                    scale: [1, 1, 1.4, 1, 1],
                  },
                  transition: {
                    ...LOOP,
                    background: { ...LOOP, times: [0, tf, tf + GATE_FLICK, 0.78, 0.86, 1] },
                    scale: { ...LOOP, times: [0, tf, tf + GATE_FLICK / 2, tf + GATE_FLICK, 1] },
                  },
                }
              : {})}
          />
        );
      })}
    </div>
  );
}

export function Workflow() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 1100, h: 360 });
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const el = railRef.current;
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
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setAnimate(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  const spineY = (CY / 100) * box.h;
  const x0 = (CX[0] / 100) * box.w;
  const x5 = (CX[5] / 100) * box.w;
  const spineD = `M ${x0} ${spineY} L ${x5} ${spineY}`;

  return (
    <div ref={rootRef}>
      <Reveal>
        <h2 className="h2 max-w-[24ch]" style={{ color: "var(--color-ink)" }}>
          {workflowSection.h2}
        </h2>
        <p className="lede mt-4 max-w-[70ch]">{workflowSection.lede}</p>
      </Reveal>

      {/* ---- desktop rail ---- */}
      <div
        ref={railRef}
        className="relative mt-12 hidden lg:block"
        style={{ height: 400 }}
        role="img"
        aria-label="Six stations left to right: a rust finding, an evidence retrieval, a merged prompt, a local translator, a six-check judge, and a sealed output. A pulse flows through them and stops at the judge, where the six checks pass green one by one; the pulse turns green as the verdict and travels on to seal the output."
      >
        {/* spine + arrows + traveling pulse */}
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden>
          <path d={spineD} fill="none" stroke="var(--color-line-2)" strokeWidth={2} strokeLinecap="round" />
          {/* connector ticks: spine down to each medallion */}
          {CX.map((x, i) => (
            <line
              key={i}
              x1={(x / 100) * box.w} y1={spineY + 6}
              x2={(x / 100) * box.w} y2={(MED_Y / 100) * box.h - 38}
              stroke="var(--color-line)" strokeWidth={1}
            />
          ))}
          {animate && (
            <motion.path
              key={`${box.w}x${box.h}`}
              d={spineD}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2}
              strokeLinecap="round"
              animate={{ pathLength: SPINE_PL, opacity: SPINE_OP }}
              transition={{ ...LOOP, pathLength: { ...LOOP, times: SPINE_T }, opacity: { ...LOOP, times: SPINE_T } }}
            />
          )}
        </svg>
        {/* direction arrows at spine midpoints */}
        {CX.slice(0, -1).map((x, i) => (
          <ArrowRight key={i} size={14} weight="bold" style={{ position: "absolute", left: `${(x + CX[i + 1]) / 2}%`, top: `${CY}%`, transform: "translate(-50%,-50%)", color: "var(--color-line-2)" }} />
        ))}
        {/* traveling pulse: mover carries position (`left`) + opacity; the dot and
            its halo animate `background` for the verdict colour. All tracks are
            non-transform so they stay in sync (motion de-times a mixed transform
            track, and mis-times the `color` property, hence `left` + `background`). */}
        {animate && (
          <motion.span
            aria-hidden
            className="absolute z-10"
            style={{ top: `${CY}%`, height: 11, width: 11, marginTop: -5.5, marginLeft: -5.5 }}
            animate={{ left: PULSE_LEFT, opacity: PULSE_OP }}
            transition={{ ...LOOP, left: { ...LOOP, times: PULSE_T }, opacity: { ...LOOP, times: PULSE_T } }}
          >
            <motion.span
              className="absolute rounded-full"
              style={{ inset: -8, filter: "blur(5px)", opacity: 0.5 }}
              animate={{ background: PULSE_COLOR }}
              transition={{ ...LOOP, background: { ...LOOP, times: PULSE_T } }}
            />
            <motion.span
              className="absolute inset-0 block rounded-full"
              animate={{ background: PULSE_COLOR }}
              transition={{ ...LOOP, background: { ...LOOP, times: PULSE_T } }}
            />
          </motion.span>
        )}

        {/* stations */}
        {STATIONS.map((s, i) => {
          const isJudge = s.key === "judge";
          const isOutput = i === OUTPUT;
          // outer div holds the static centering transform; the inner motion.div
          // owns the animated transform, so the two never clobber each other
          const lift = !animate
            ? {}
            : isOutput
              ? { animate: { y: [0, 0, -3, 0, 0], filter: ["brightness(1)", "brightness(1)", "brightness(1.08)", "brightness(1)", "brightness(1)"] }, transition: { ...LOOP, y: { ...LOOP, times: [0, 0.6, 0.63, 0.66, 1] }, filter: { ...LOOP, times: [0, 0.6, 0.63, 0.66, 1] } } }
              : medallionLift(MF[i]);
          return (
            <div key={s.key} className="absolute flex flex-col items-center" style={{ left: `${CX[i]}%`, top: 0, bottom: 0, width: "16%", transform: "translateX(-50%)" }}>
              {/* medallion, below the spine, lifts + brightens as the pulse passes */}
              <div className="absolute z-20" style={{ top: `${MED_Y}%`, transform: "translateY(-50%)" }}>
                <motion.div {...lift}>
                  <div className="relative flex flex-col items-center">
                    <Medallion station={s} />
                    {/* the seal stamps onto the output when the green verdict arrives */}
                    {isOutput && animate && (
                      <motion.span
                        className="absolute grid place-items-center rounded-full"
                        style={{ right: -5, bottom: -5, height: 24, width: 24, background: "var(--color-surface)", border: "1px solid color-mix(in oklch, var(--color-ok) 32%, transparent)", boxShadow: "0 1px 3px color-mix(in oklch, var(--color-ink) 12%, transparent)" }}
                        animate={{ scale: [1.18, 1.18, 1, 1, 1, 1.18], opacity: [0, 0, 1, 1, 0, 0] }}
                        transition={{ ...LOOP, scale: { ...LOOP, times: [0, 0.63, 0.69, 0.85, 0.93, 1] }, opacity: { ...LOOP, times: [0, 0.63, 0.69, 0.85, 0.93, 1] } }}
                      >
                        <SealCheck size={16} weight="fill" style={{ color: "var(--color-ok-ink)" }} />
                      </motion.span>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* judge gate dots: centered in the gap between the medallion and the
                  label (kept out of the medallion group so the medallion stays
                  aligned and the dots keep clean air above and below) */}
              {isJudge && (
                <div className="absolute flex w-full justify-center" style={{ top: `${DOT_Y}%` }}>
                  <GateDots animate={animate} />
                </div>
              )}

              {/* labels below the medallions */}
              <div className="absolute w-full" style={{ top: `${LABEL_Y}%` }}>
                <StationLabels station={s} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- mobile vertical rail ---- */}
      <div className="mt-10 flex flex-col gap-0 lg:hidden">
        {STATIONS.map((s, i) => {
          const c = INK[s.ink];
          const Glyph = ICONS[s.icon];
          const last = i === STATIONS.length - 1;
          return (
            <div key={s.key} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center rounded-full" style={{ width: 44, height: 44, background: c.fill, border: `1px solid ${c.line}` }}>
                  {Glyph ? <Glyph size={22} weight="duotone" style={{ color: c.ink }} /> : null}
                </div>
                {!last && <span className="w-px flex-1" style={{ background: "var(--color-line-2)", minHeight: 34 }} />}
              </div>
              <div className="flex-1 pb-6">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold" style={{ color: "var(--color-ink)" }}>{s.name}</span>
                  <a href={s.href} className="mono inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--color-accent-ink)" }}>
                    {s.anchorLabel}
                    <ArrowUpRight size={11} weight="bold" />
                  </a>
                </div>
                <p className="mt-1 text-[13px] leading-snug" style={{ color: "var(--color-muted)" }}>{s.caption}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
