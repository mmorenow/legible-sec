import { meta } from "@/content/data";
import { footer } from "@/content/copy/site";

/* The site footer.
 *
 * It used to be the second half of `Access`, which meant a page only had a
 * footer if it also had a reason to show the availability plate: /model,
 * /benchmark and /try ended in mid-air. It is its own component now, and every
 * route renders it. `/model` is reachable from here and nowhere else, labelled
 * archived, which is the state the claim ledger records for it.
 *
 * No hooks, no motion: this is a server component on purpose. */

export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--color-line)" }}>
      <div className="wrap-wide flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[17px] font-extrabold tracking-[-0.03em]" style={{ color: "var(--color-ink)" }}>{footer.wordmark}</span>
            <span className="mono text-[11px]" style={{ color: "var(--color-muted)" }}>{meta.version}</span>
          </div>
          <p className="mt-1.5 max-w-[52ch] text-[12.5px]" style={{ color: "var(--color-muted)" }}>
            {footer.note}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
          {footer.links.map((l) => (
            <a key={l.href} href={l.href} style={{ color: "var(--color-muted)", ["--hv-fg" as string]: "var(--color-ink)" }} className="hov hov-fg">{l.label}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}
