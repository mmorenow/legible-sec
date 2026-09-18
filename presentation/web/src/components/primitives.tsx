"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ */
/* useReveal — robust scroll reveal that CANNOT ship blank.            */
/* Default state is visible (SSR + crawlers + no-JS all see content).  */
/* On mount, only below-the-fold elements are hidden then animated in  */
/* via IntersectionObserver, with a hard fallback that forces visible. */
/* ------------------------------------------------------------------ */
export function useReveal() {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(true); // visible by default

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // already in or above the viewport → never hide it
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    setShown(false);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    // safety net: never leave content hidden, even if IO never fires
    const fallback = window.setTimeout(() => {
      setShown(true);
      io.disconnect();
    }, 2200);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return { ref, shown };
}

type Tag = "div" | "li" | "section" | "span";

export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: Tag;
}) {
  const reduce = useReducedMotion();
  const { ref, shown } = useReveal();
  const MotionTag = motion[as] as typeof motion.div;

  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }
  return (
    <MotionTag
      ref={ref as React.Ref<HTMLDivElement>}
      data-reveal
      className={className}
      initial={false}
      animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.6, ease: EASE, delay: shown ? delay : 0 }}
    >
      {children}
    </MotionTag>
  );
}

/* Stagger container is a plain passthrough; each item reveals on its own
   (robust), which reads as a natural cascade as the list scrolls in. */
export function Stagger({ children, className }: { children: ReactNode; className?: string; step?: number }) {
  return <div className={className}>{children}</div>;
}
export function StaggerItem({ children, className }: { children: ReactNode; className?: string; y?: number }) {
  return <Reveal className={className}>{children}</Reveal>;
}

/* ------------------------------------------------------------------ */
/* Counter — counts up when scrolled into view. Only animates a clean  */
/* single number (optionally with a comma group, decimal, or %/+/×     */
/* suffix). Anything else (ranges like "2011–26") renders as-is.       */
/* ------------------------------------------------------------------ */
export function Counter({ value, className }: { value: string; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  const match = value.replace(/,/g, "").match(/^([^\d]*)(\d+(?:\.\d+)?)([%+×x]?)$/);

  useEffect(() => {
    if (reduce || !match || !ref.current) {
      setDisplay(value);
      return;
    }
    const [, prefix, numStr, suffix] = match;
    const target = parseFloat(numStr);
    const decimals = (numStr.split(".")[1] || "").length;

    let raf = 0;
    let started = false;
    const run = () => {
      started = true;
      const t0 = performance.now();
      const dur = 1100;
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 4);
        const n = target * eased;
        const withCommas = Number(n.toFixed(decimals)).toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
        setDisplay(`${prefix}${withCommas}${suffix}`);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    // Same robust contract as useReveal: NEVER ship the blank state.
    // In or above the viewport → count up immediately (no waiting on IO).
    const el = ref.current;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
      setDisplay(`${prefix}0${suffix}`);
      run();
      return () => cancelAnimationFrame(raf);
    }

    // Below the fold → park at 0, animate on entry, and hard-fallback to the
    // real value if the observer never fires (mirrors useReveal's safety net).
    setDisplay(`${prefix}0${suffix}`);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started) {
          run();
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    const fallback = window.setTimeout(() => {
      if (!started) {
        setDisplay(value);
        io.disconnect();
      }
    }, 2200);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
    };
  }, [reduce, value]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span ref={ref} className={className}>{display}</span>;
}

/* ------------------------------------------------------------------ */
/* Beam — the cobalt "translation" pulse traveling left → right.       */
/* ------------------------------------------------------------------ */
export function Beam({ vertical = false, className }: { vertical?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div
      className={className}
      aria-hidden
      style={{
        position: "relative",
        overflow: "hidden",
        background: "var(--color-line-2)",
        ...(vertical ? { width: 2, height: "100%" } : { height: 2, width: "100%" }),
      }}
    >
      {!reduce && (
        <motion.span
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            ...(vertical
              ? { width: "100%", height: "40%", background: "linear-gradient(180deg, transparent, var(--color-accent), transparent)" }
              : { height: "100%", width: "34%", background: "linear-gradient(90deg, transparent, var(--color-accent), transparent)" }),
          }}
          initial={{ [vertical ? "y" : "x"]: "-120%" }}
          animate={{ [vertical ? "y" : "x"]: "320%" }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.4 }}
        />
      )}
    </div>
  );
}
