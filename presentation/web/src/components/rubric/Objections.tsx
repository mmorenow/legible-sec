import { objections } from "@/content/evidence";
import { objectionsSection as copy } from "@/content/copy/rubric";

/* The objections, as a disclosure list.
 *
 * The attack is always visible; the answer is what opens. That order is
 * deliberate: a reader scrolling past sees eight unsoftened criticisms of the
 * method with the project's name on them, which is the opposite of what a sales
 * page does. Native <details>, so it works with the keyboard, works without
 * JavaScript, and its content is in the document for a reader or a crawler that
 * never opens it.
 */

export function Objections() {
  return (
    <ol className="mt-2">
      {objections.map((o, i) => (
        <li key={o.handle} id={o.handle} className="border-t" style={{ borderColor: "var(--color-line)" }}>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-start gap-3 rounded-[6px] py-5 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)] [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden
                className="mt-[7px] shrink-0 motion-safe:transition-transform motion-safe:duration-200 group-open:rotate-90"
                style={{ color: "var(--color-accent-ink)" }}
              >
                <svg width="9" height="12" viewBox="0 0 9 12" fill="none">
                  <path
                    d="M1.5 1.5 L7 6 L1.5 10.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div className="min-w-0">
                <span className="mono num text-[12.5px]" style={{ color: "var(--color-muted)" }}>
                  {String(i + 1).padStart(2, "0")} · {copy.objectionLabel}
                </span>
                <p
                  className="mt-1 max-w-[70ch] text-[16.5px] leading-[1.6]"
                  style={{ color: "var(--color-ink)" }}
                >
                  {o.objection}
                </p>
              </div>
            </summary>
            <div className="pb-6 pl-[21px]">
              <p className="mono text-[12px] uppercase tracking-[0.13em]" style={{ color: "var(--color-accent-ink)" }}>
                {copy.answerLabel}
              </p>
              <p
                className="mt-2 max-w-[72ch] text-[15.5px] leading-[1.6]"
                style={{ color: "var(--color-ink-2)" }}
              >
                {o.answer}
              </p>
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}
