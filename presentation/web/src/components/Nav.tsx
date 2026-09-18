"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUpRight, List, X } from "@phosphor-icons/react";
import { meta } from "@/content/data";
import { nav } from "@/content/copy/site";

export function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  /* The panel is what gets focus on open. Without this, a keyboard or screen
     reader user pressed the button, `aria-expanded` flipped, and focus stayed
     on `body`: the menu opened somewhere they could not get to except by
     tabbing forward through it blind. Escape closes and returns focus to the
     button, which is the other half of the same contract. */
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isHome = pathname === "/";
  const wordmarkHref = isHome ? "#top" : "/";

  return (
    <header
      style={{ zIndex: "var(--z-nav)" as unknown as number }}
      className={`fixed inset-x-0 top-0 transition-[background,border-color,backdrop-filter] duration-300 ${
        scrolled || open ? "border-b" : "border-b border-transparent"
      }`}
    >
      <div
        className="transition-colors duration-300"
        style={{
          background: scrolled || open ? "color-mix(in oklch, var(--color-bg) 78%, transparent)" : "transparent",
          backdropFilter: scrolled || open ? "saturate(1.4) blur(12px)" : "none",
          borderColor: scrolled || open ? "var(--color-line)" : "transparent",
        }}
      >
        <nav className="wrap-wide flex items-center justify-between" style={{ height: 66 }}>
          <a href={wordmarkHref} className="flex items-baseline gap-2.5" aria-label={nav.wordmarkAriaLabel}>
            <span className="text-[19px] font-extrabold tracking-[-0.03em]" style={{ color: "var(--color-ink)" }}>
              {nav.wordmark}
            </span>
            <span className="mono text-[11px]" style={{ color: "var(--color-muted)" }}>
              {meta.version}
            </span>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            {nav.links.map((l) => {
              const active = pathname === l.href;
              return (
                <a
                  key={l.href}
                  href={l.href}
                  className="text-[14.5px] transition-colors hover:text-[color:var(--color-ink)]"
                  style={{ color: active ? "var(--color-ink)" : "var(--color-muted)", fontWeight: active ? 600 : 400 }}
                >
                  {l.label}
                </a>
              );
            })}
          </div>

          <div className="flex flex-none items-center gap-2">
            {/* The filled accent button that stood here said "Load the dataset" and
                pointed at the literal string "#placeholder". Nothing is published,
                so there is nothing to point at and no button to render. */}
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="nav-mobile-menu"
              aria-label={open ? nav.menuCloseLabel : nav.menuOpenLabel}
              className="inline-flex items-center justify-center rounded-full p-2 md:hidden"
              style={{ color: "var(--color-ink)" }}
            >
              {open ? <X size={19} weight="bold" /> : <List size={19} weight="bold" />}
            </button>
          </div>
        </nav>

        {open && (
          <div id="nav-mobile-menu" ref={panelRef} className="md:hidden">
            <div className="wrap-wide flex flex-col py-2">
              {nav.links.map((l, i) => {
                const active = pathname === l.href;
                return (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="py-3 text-[15px]"
                    style={{
                      color: active ? "var(--color-ink)" : "var(--color-muted)",
                      fontWeight: active ? 600 : 400,
                      borderTop: i === 0 ? "none" : "1px solid var(--color-line)",
                    }}
                  >
                    {l.label}
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
