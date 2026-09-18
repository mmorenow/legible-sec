"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";

/* Prose: the legible world's typesetter. The motor and the corpus emit
   executive prose with a light dusting of markdown (paragraphs, **bold**,
   `inline code`, simple lists); until now that text rendered raw, asterisks
   and all, in a mono terminal box. This renders it as real prose: sans,
   comfortable size, generous leading, air between paragraphs. It is NOT a
   CommonMark engine, on purpose: a tiny tokenizer that builds JSX directly
   (no dangerouslySetInnerHTML, nothing executable), sized to what the model
   actually writes. Mono survives only where mono belongs: inline `code`. */

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[]; start: number };

const BULLET = /^[-*•–]\s+(.*)$/;
const NUMBERED = /^(\d{1,3})[.)]\s+(.*)$/;
const HEADING = /^#{1,6}\s+(.*)$/;

/* Blank lines split blocks; inside a chunk, bullet/numbered lines open a
   list (a lead line followed by bullets with no blank line between is a
   pattern the model likes), and plain lines join into flowing paragraphs. */
function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const chunks = text.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  for (const chunk of chunks) {
    const lines = chunk
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    let para: string[] = [];
    let list: { ordered: boolean; start: number; items: string[] } | null = null;
    const flushPara = () => {
      if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
      para = [];
    };
    const flushList = () => {
      if (list)
        blocks.push(
          list.ordered ? { kind: "ol", items: list.items, start: list.start } : { kind: "ul", items: list.items }
        );
      list = null;
    };
    for (const line of lines) {
      const head = HEADING.exec(line);
      const bullet = BULLET.exec(line);
      const num = NUMBERED.exec(line);
      if (head) {
        flushPara();
        flushList();
        blocks.push({ kind: "h", text: head[1] });
      } else if (bullet) {
        flushPara();
        if (!list || list.ordered) {
          flushList();
          list = { ordered: false, start: 1, items: [] };
        }
        list.items.push(bullet[1]);
      } else if (num) {
        flushPara();
        if (!list || !list.ordered) {
          flushList();
          list = { ordered: true, start: parseInt(num[1], 10), items: [] };
        }
        list.items.push(num[2]);
      } else if (list) {
        // wrapped continuation of the previous list item
        list.items[list.items.length - 1] += ` ${line}`;
      } else {
        para.push(line);
      }
    }
    flushPara();
    flushList();
  }
  return blocks;
}

/* Inline pass: **bold**, `code`, *emphasis*. Bold wins over emphasis (the
   alternation tries ** first); emphasis requires a non-space right inside the
   asterisks so "5 * 3" stays arithmetic. Underscore emphasis is deliberately
   NOT parsed: snake_case identifiers live in this corpus. */
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^\s*][^*\n]*\*)/g;

const codeStyle: CSSProperties = {
  fontSize: "0.85em",
  background: "var(--color-surface-2)",
  color: "var(--color-ink-2)",
  padding: "0.08em 0.38em",
  borderRadius: 5,
};

function renderInline(text: string, keyBase: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    const key = `${keyBase}.${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={key} style={{ fontWeight: 640, color: "var(--color-ink)" }}>
          {renderInline(part.slice(2, -2), key)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={key} className="mono" style={codeStyle}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={key}>{renderInline(part.slice(1, -1), key)}</em>;
    }
    return <span key={key}>{part}</span>;
  });
}

export function Prose({
  text,
  size = "base",
}: {
  text: string;
  /** base: supporting prose (precedents, omissions); lead: the result itself */
  size?: "base" | "lead";
}) {
  const blocks = useMemo(() => parseBlocks(text ?? ""), [text]);
  if (!blocks.length) return null;
  return (
    <div
      className="flex flex-col"
      style={{
        fontSize: size === "lead" ? "clamp(15.5px, 1.6vw, 17px)" : "14.5px",
        lineHeight: 1.72,
        color: "var(--color-ink)",
        gap: "0.8em",
      }}
    >
      {blocks.map((b, i) => {
        if (b.kind === "h")
          return (
            <p key={i} style={{ fontWeight: 650, letterSpacing: "-0.01em", marginTop: i ? "0.3em" : 0 }}>
              {renderInline(b.text, `h${i}`)}
            </p>
          );
        if (b.kind === "ul")
          return (
            <ul key={i} className="flex flex-col gap-[0.45em]">
              {b.items.map((it, j) => (
                <li key={j} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="mt-[0.62em] h-[5px] w-[5px] shrink-0 rounded-full"
                    style={{ background: "var(--color-accent)", opacity: 0.55 }}
                  />
                  <span className="min-w-0">{renderInline(it, `u${i}.${j}`)}</span>
                </li>
              ))}
            </ul>
          );
        if (b.kind === "ol")
          return (
            <ol key={i} className="flex flex-col gap-[0.45em]">
              {b.items.map((it, j) => (
                <li key={j} className="flex items-baseline gap-2.5">
                  <span className="mono shrink-0 text-[0.78em]" style={{ color: "var(--color-accent-ink)" }}>
                    {b.start + j}.
                  </span>
                  <span className="min-w-0">{renderInline(it, `o${i}.${j}`)}</span>
                </li>
              ))}
            </ol>
          );
        return <p key={i}>{renderInline(b.text, `p${i}`)}</p>;
      })}
    </div>
  );
}
