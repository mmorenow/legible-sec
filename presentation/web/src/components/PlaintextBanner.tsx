"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Cpu, WifiSlash, Laptop, Package, Cube } from "@phosphor-icons/react";
import { loraSection as L, modelNameplate as N, modelAccess as M } from "@/content/system";
import { banner } from "@/content/copy/model";
import { useReveal } from "./primitives";

const EASE = [0.22, 1, 0.36, 1] as const;

/* PlaintextBanner v6 — "the positional decode" (owner-directed). The hero IS
   the pun: one commanding mono line renders the model name as its own
   ciphertext. Two clean phases:
   PHASE 1 — twelve fixed 2ch slots, nothing moves: byte k swaps IN PLACE to
   the letter it encodes ("70"->p, "6c"->l ... "2d"->-, "39"->9, "62"->b),
   left to right, one by one, a quiet blur-crossfade per slot. Mid-sequence
   the line reads "p l a i 6e 74 ..." with decoded letters sitting exactly
   where their bytes were; the "-9b" slots resolve cobalt.
   PHASE 2 — only after the 12th swap: one single closing gesture. The spaced
   letters tighten into the true wordmark: every slot narrows to letter width
   at once while a rAF tracker scales the line to the width it now needs, so
   it can never overflow at any viewport and lands at full size.
   Plays once; click the settled wordmark to replay. SSR / no-JS / reduced-
   motion render the resolved wordmark, never the hex (poster-first). The h1
   always exposes real text via aria-label; every glyph is aria-hidden. */

const PAIRS = N.hex.split(" "); // "70" "6c" ... one byte per letter
const LETTERS = ["p", "l", "a", "i", "n", "t", "e", "x", "t", "-", "9", "b"];

const CELL_HEX = "2ch"; // the fixed slot, all of phase 1
const CELL_FIN = "1ch"; // natural mono letter width, after the closer
const GAP = "0.28ch";

// timeline (seconds) — plays once, ease-out family throughout
const T_HEXIN = 0.34; // the cipher materializes
const T_SWAP = 0.95; // first in-place swap (the cipher holds readable until here)
const SWAP_STEP = 0.14; // left-to-right cadence, one slot at a time
const SWAP_DUR = 0.22; // one swap: byte out, letter in, same slot
const T_COLLAPSE = T_SWAP + 11 * SWAP_STEP + SWAP_DUR + 0.35; // ~3.06s, after a held beat
const COLLAPSE_DUR = 0.58; // the single closing gesture
const SETTLE_MS = 4300; // rAF fit-tracker lifetime

const CHIPS = [
  { icon: Cpu, label: "9B parameters" },
  { icon: WifiSlash, label: "runs offline" },
  { icon: Package, label: "4-bit MLX" },
  { icon: Laptop, label: "16 GB laptop" },
  { icon: Cube, label: "Apple silicon" },
];

export function PlaintextBanner() {
  const reduce = useReducedMotion();
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const sizerRef = useRef<HTMLSpanElement>(null);

  // poster-first: playKey 0 = resolved wordmark (SSR / no-JS / reduced). On
  // mount we measure the hex layout, set the fit-scale, and bump the key so
  // the line remounts live and the decode plays exactly once. Each subsequent
  // bump (click on the settled wordmark) replays it.
  const [playKey, setPlayKey] = useState(0);
  const [fit, setFit] = useState(1);
  const live = playKey > 0 && !reduce;

  useEffect(() => {
    if (reduce) return;
    const h1 = h1Ref.current;
    const sizer = sizerRef.current;
    if (!h1 || !sizer) return;
    const avail = h1.clientWidth;
    const hexW = sizer.getBoundingClientRect().width;
    setFit(hexW > 0 ? Math.min(1, (avail * 0.995) / hexW) : 1);
    setPlayKey((k) => k + 1);
  }, [reduce]);

  // Fit tracker: the line is scaled to whatever fraction of the column its
  // CURRENT natural width needs, read live each frame. During phase 1 the
  // slot widths never change, so the scale holds perfectly still — nothing
  // shifts while the bytes swap. During the phase-2 collapse the width
  // shrinks and the scale rides up toward 1 inside that same single motion,
  // so the line can never overflow on any viewport.
  useEffect(() => {
    const line = lineRef.current;
    const h1 = h1Ref.current;
    if (!line || !h1) return;
    if (!live) {
      line.style.transform = "scale(1)";
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const avail = h1.clientWidth;
      const nat = line.offsetWidth; // untransformed layout width (sum of slots)
      const s = nat > 0 ? Math.min(1, (avail * 0.995) / nat) : 1;
      line.style.transform = `scale(${s})`;
      if (now - t0 < SETTLE_MS) raf = requestAnimationFrame(tick);
      else line.style.transform = "scale(1)";
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, playKey]);

  const replay = () => {
    if (!reduce) setPlayKey((k) => k + 1);
  };

  const { ref: chipsRef, shown } = useReveal();
  const chipOn = reduce || shown;
  const chipIn = (i: number) => ({
    initial: false as const,
    animate: chipOn ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 },
    transition: { duration: 0.4, ease: EASE, delay: chipOn ? 0.15 + i * 0.05 : 0 },
  });

  return (
    <div className="relative">
      {/* THE DECODE — bytes swapping to letters in place, then one closer */}
      <h1
        ref={h1Ref}
        aria-label="plaintext-9b"
        onClick={replay}
        className="mono font-bold select-none"
        style={{
          position: "relative",
          fontSize: "clamp(2.9rem, 7vw, 5rem)",
          lineHeight: 1.04,
          letterSpacing: "-0.01em",
          color: "var(--color-ink)",
        }}
      >
        <span
          key={playKey}
          ref={lineRef}
          aria-hidden="true"
          className="inline-flex items-baseline"
          style={{
            transformOrigin: "left center",
            transform: `scale(${live ? fit : 1})`,
            whiteSpace: "nowrap",
            willChange: "transform",
          }}
        >
          {LETTERS.map((ch, k) => {
            const swapAt = T_SWAP + k * SWAP_STEP; // this slot's moment
            const hexTotal = swapAt + SWAP_DUR; // its byte: in -> hold -> out
            const accent = k >= 9; // "-9b" resolves cobalt
            return (
              <motion.span
                key={k}
                className="grid"
                // the letter's 1ch track centers in the slot; the byte layer is
                // zero-width in-flow so it can NEVER size the track (a 2ch track
                // would park every letter half a ch right of true)
                style={{ justifyItems: "center", justifyContent: "center" }}
                {...(live
                  ? {
                      // PHASE 2 only: every slot narrows at once, one gesture
                      initial: { width: CELL_HEX, marginRight: GAP },
                      animate: { width: CELL_FIN, marginRight: "0ch" },
                      transition: { duration: COLLAPSE_DUR, ease: EASE, delay: T_COLLAPSE },
                    }
                  : { initial: false, animate: { width: CELL_FIN, marginRight: "0ch" } })}
              >
                {/* the letter, arriving exactly where its byte sat */}
                <motion.span
                  className="col-start-1 row-start-1"
                  style={{ color: accent ? "var(--color-accent)" : "var(--color-ink)" }}
                  {...(live
                    ? {
                        initial: { opacity: 0, scale: 0.92, filter: "blur(4px)" },
                        animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
                        transition: { duration: SWAP_DUR, ease: EASE, delay: swapAt },
                      }
                    : { initial: false, animate: { opacity: 1, scale: 1, filter: "blur(0px)" } })}
                >
                  {ch}
                </motion.span>
                {/* the byte it replaces, dissolving in the same slot */}
                {live && (
                  <motion.span
                    className="col-start-1 row-start-1"
                    style={{ width: 0, display: "flex", justifyContent: "center", color: "var(--color-muted)" }}
                    initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
                    animate={{
                      opacity: [0, 1, 1, 0],
                      y: [8, 0, 0, 0],
                      filter: ["blur(6px)", "blur(0px)", "blur(0px)", "blur(4px)"],
                    }}
                    transition={{
                      duration: hexTotal,
                      times: [0, T_HEXIN / hexTotal, swapAt / hexTotal, 1],
                      // per-segment easing: materialize, HOLD SOLID, fade at
                      // exactly this slot's swap moment (a single ease here
                      // would drag every fade forward = all-at-once wash)
                      ease: [EASE, "linear", EASE],
                    }}
                  >
                    {PAIRS[k]}
                  </motion.span>
                )}
              </motion.span>
            );
          })}
        </span>

        {/* hidden sizer: the hex layout at full slot width, measured once so
            the live line starts at a scale that always fits the column */}
        <span
          ref={sizerRef}
          aria-hidden="true"
          className="inline-flex items-baseline"
          style={{ position: "absolute", left: 0, top: 0, visibility: "hidden", pointerEvents: "none", whiteSpace: "nowrap" }}
        >
          {PAIRS.map((pair, k) => (
            <span key={k} className="grid" style={{ width: CELL_HEX, marginRight: GAP }}>
              {pair}
            </span>
          ))}
        </span>
      </h1>

      <p className="lede mt-10 max-w-[60ch]">
        {banner.lede}
      </p>

      <div ref={chipsRef as React.Ref<HTMLDivElement>} className="mt-9 flex flex-wrap gap-2.5">
        {CHIPS.map(({ icon: Icon, label }, i) => (
          <motion.span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium"
            style={{ border: "1px solid var(--color-line)", background: "var(--color-surface)", color: "var(--color-ink-2)" }}
            {...chipIn(i)}
          >
            <Icon size={14} weight="duotone" style={{ color: "var(--color-accent-ink)" }} />
            {label}
          </motion.span>
        ))}
        <motion.span className="mono inline-flex items-center rounded-full px-3 py-1.5 text-[11.5px]" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent-ink)", border: "1px solid var(--color-accent-line)" }} {...chipIn(CHIPS.length)}>
          base · {L.specLedger.find((r) => r.k === "base")?.v ?? "Qwen3.5-9B"}
        </motion.span>
      </div>

      {/* No CTA button and no one-line command: nothing is published on
          Hugging Face and the GGUF/Ollama path was never built, so a filled
          button or a `run` line here would be a promise nobody can keep.
          One plain line of fact instead. */}
      {/* Stated before the specifications, not after them, because a reader who
          leaves halfway should still have been told. */}
      <p
        className="mt-8 max-w-[62ch] rounded-[10px] border border-dashed p-3.5 text-[13.5px] leading-relaxed"
        style={{ borderColor: "var(--color-line-2)", color: "var(--color-ink-2)" }}
      >
        {M.archivedNote}
      </p>
      <p className="mono mt-4 text-[12.5px]" style={{ color: "var(--color-muted)" }}>{M.weightsNote}</p>

    </div>
  );
}
