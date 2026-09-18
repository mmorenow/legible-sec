#!/usr/bin/env node
/*
 * check_site_copy.mjs - the house style guard for user-facing copy.
 *
 * LEGIBLE's whole claim is fidelity: it measures whether a security finding
 * survives translation without losing facts, severity or caveats. A site that
 * oversells that is a site that contradicts it. Two house rules have existed
 * for a long time and kept regressing, because "do not sound like we are
 * selling something" is not reviewable in a diff. A grep is.
 *
 * This script is that grep. It reads `src/**`, ignores anything that is not
 * user-facing, and fails on the copy patterns we have decided the site does
 * not use. See `scripts/BANNED.md` for the why of each rule.
 *
 * Usage:
 *   node scripts/check_site_copy.mjs            scan the whole site
 *   node scripts/check_site_copy.mjs src/lib    scan only these paths
 *   node scripts/check_site_copy.mjs --strict   make warnings fail too
 *
 * Exit code 1 on any ERROR, 0 when clean or warnings only. Zero dependencies,
 * plain Node ESM, no network.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

/* ------------------------------------------------------------------ */
/* Rule 2: the banned phrase list.                                     */
/*                                                                     */
/* It lives here, in the script, so adding to it is a reviewable       */
/* one-line diff. An entry is either a bare string or [phrase, reason].*/
/* Always write the reason. A guard that says WHY it failed gets       */
/* obeyed; one that just says "banned" gets deleted by the next person */
/* it inconveniences.                                                  */
/*                                                                     */
/* Matching is case-insensitive and literal (no regex), over           */
/* whitespace-collapsed text, so a phrase still matches when it wraps  */
/* across lines in JSX.                                                */
/* ------------------------------------------------------------------ */
const BANNED_PHRASES = [
  ["the model that speaks CFO", "Slogan. The project measures fidelity, it does not sell a persona."],
  ["with receipts", "Marketing shorthand. Name the evidence instead."],
  ["Never generated.", "Absolute claim in a full stop. Say what the provenance check actually covers."],
  ["cannot bluff", "Claims an impossibility the system cannot demonstrate."],
  ["Built by agents", "Boast about the process, not a fact about the artifact."],
  ["Load the dataset", "Call to action for something that is not published. See src/content/status.ts."],
  ["Explore the full dataset", "Brochure verb, and the dataset is not published."],
  ["Open the instrument", "Brochure verb dressed up as a product name."],
  ["Meet plaintext-9b", "Product-launch register. The model is a component, not a character."],
  ["lands closest to the human gold", "A result framed as a win. Report the number and its interval."],
  ["One finding in. One faithful sentence out.", "Tagline, and it promises fidelity as a guarantee."],
];

/* ------------------------------------------------------------------ */
/* What gets read                                                      */
/* ------------------------------------------------------------------ */
const SCAN_ROOTS = ["src"];

// Deliberately retired code. It is kept as a record of what the site used to
// say, so it is allowed to still say it.
const EXCLUDED_DIRS = [
  "src/components/_archive",
  "src/content/_archive",
  "node_modules",
  ".next",
  "out",
];

// `.json` under src/ is data, not copy, so it is simply never collected.
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const CSS_EXT = new Set([".css"]);

const EM_DASH = "—";
const JSX_TEXT_MAX = 25; // characters, whitespace collapsed

/* ------------------------------------------------------------------ */
/* The scanner                                                         */
/*                                                                     */
/* Every rule here is about copy a visitor can read. Comments are not  */
/* copy: this repo documents its own history in comments, and several  */
/* of those comments necessarily quote the exact phrases the rules     */
/* ban ("a filled button here said 'Load the dataset' and pointed at   */
/* the literal string '#placeholder'"). A guard that flagged those     */
/* would be asking a contributor to delete the explanation of the bug  */
/* in order to keep the check that prevents the bug.                   */
/*                                                                     */
/* So: strip comments first, then scan. That single decision is also   */
/* the whole of the `#placeholder` exemption in rule 4. There is no    */
/* filename special case, and any file may document the old bug.       */
/*                                                                     */
/* Two products come out of one pass over the source:                  */
/*   `noComments` - comments replaced by blanks. Rules 1, 2 and 4 read */
/*                  this, so they still see string and JSX contents.   */
/*   `masked`     - additionally, the inside of every string, template */
/*                  and regex literal is blanked. Rule 3 reads this,   */
/*                  so what is left between JSX tags is JSX text and   */
/*                  nothing else.                                      */
/* Both are the same length as the source, so an offset maps back to a */
/* line number in the original file.                                   */
/*                                                                     */
/* This is a lexer, not a parser, and it makes one deliberate safety   */
/* choice: an unterminated quote or regex is abandoned at the end of   */
/* its line (JS forbids both from spanning one), so a stray apostrophe */
/* in prose costs at most one line of accuracy, never the rest of the  */
/* file.                                                               */
/* ------------------------------------------------------------------ */

const BLANK = "\u0001"; // stands in for hidden literal content

// After these characters a `/` opens a regex literal rather than dividing.
// `>` is left out on purpose: in TSX it far more often closes a tag with
// prose after it than it divides.
const REGEX_PRECEDERS = new Set("(,=:[!&|?{};+-*%^~\n".split(""));
const REGEX_KEYWORDS = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
  "case", "do", "else", "yield", "await",
]);

function scanSource(src) {
  const n = src.length;
  const noComments = new Array(n);
  const masked = new Array(n);

  // `copy` keeps a character in both outputs, `hide` keeps it only in
  // `noComments`, `drop` removes it from both (that is what a comment is).
  const copy = (i) => { noComments[i] = src[i]; masked[i] = src[i]; };
  const hide = (i) => { noComments[i] = src[i]; masked[i] = BLANK; };
  const drop = (i) => { const c = src[i] === "\n" ? "\n" : " "; noComments[i] = c; masked[i] = c; };

  let prevSig = "\n";  // last significant code character
  let prevWord = "";   // last identifier seen in code position
  let i = 0;

  const regexAllowed = () => REGEX_PRECEDERS.has(prevSig) || REGEX_KEYWORDS.has(prevWord);

  while (i < n) {
    const c = src[i];

    // line comment
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") drop(i++);
      continue;
    }
    // block comment
    if (c === "/" && src[i + 1] === "*") {
      drop(i++); drop(i++);
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) drop(i++);
      if (i < n) { drop(i++); drop(i++); }
      prevSig = " ";
      continue;
    }
    // string literal
    if (c === '"' || c === "'") {
      copy(i++);
      while (i < n && src[i] !== c && src[i] !== "\n") {
        if (src[i] === "\\" && i + 1 < n) { hide(i++); hide(i++); continue; }
        hide(i++);
      }
      if (i < n && src[i] === c) copy(i++); // otherwise abandoned at the newline
      prevSig = c; prevWord = "";
      continue;
    }
    // template literal, including nested ${ } which returns to code
    if (c === "`") {
      copy(i++);
      let depth = 0;
      while (i < n) {
        if (depth === 0 && src[i] === "\\" && i + 1 < n) { hide(i++); hide(i++); continue; }
        if (depth === 0 && src[i] === "`") { copy(i++); break; }
        if (depth === 0 && src[i] === "$" && src[i + 1] === "{") { copy(i++); copy(i++); depth = 1; continue; }
        if (depth > 0) {
          // Inside ${...} we are back in code. Brace counting is enough for
          // this repo: interpolations here call helpers, they do not nest
          // another template with a brace inside a string.
          if (src[i] === "{") depth++;
          else if (src[i] === "}") depth--;
          copy(i++);
          continue;
        }
        hide(i++);
      }
      prevSig = "`"; prevWord = "";
      continue;
    }
    // regex literal
    if (c === "/" && regexAllowed()) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n && src[j] !== "\n") {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "[") inClass = true;
        else if (src[j] === "]") inClass = false;
        else if (src[j] === "/" && !inClass) { closed = true; break; }
        j++;
      }
      if (closed) {
        copy(i++);
        while (i < j) hide(i++);
        copy(i++); // the closing slash
        while (i < n && /[a-z]/.test(src[i])) copy(i++); // flags
        prevSig = "/"; prevWord = "";
        continue;
      }
      // not a regex after all: fall through and treat it as one code character
    }

    // identifier, taken whole so `prevWord` is usable
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) { copy(j); j++; }
      prevWord = src.slice(i, j);
      prevSig = src[j - 1];
      i = j;
      continue;
    }

    copy(i);
    if (c === "\n") prevSig = "\n";
    else if (!/\s/.test(c)) { prevSig = c; prevWord = ""; }
    i++;
  }

  return { noComments: noComments.join(""), masked: masked.join("") };
}

// CSS has one comment form and no string ambiguity worth modelling.
function scanCss(src) {
  const out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  return { noComments: out, masked: out };
}

/* ------------------------------------------------------------------ */
/* Rule 3: prose sitting inline in a component                         */
/*                                                                     */
/* Copy that lives in a component scatters and drifts: the same        */
/* sentence ends up in two files with two different numbers in it.     */
/* Prose belongs in `src/content/copy/*`.                              */
/*                                                                     */
/* On the masked source, the run between a tag's closing `>` and the   */
/* next `<` or `{` is JSX text and nothing else. String attributes     */
/* (aria-label, alt, title) are already blanked, so they cannot reach  */
/* this rule at all. What is left to filter is TypeScript generics,    */
/* whose `<T>` looks exactly like a tag: what follows one is code, and */
/* code is full of characters this site's prose never contains.        */
/* ------------------------------------------------------------------ */

const NOT_PROSE = /[;=()[\]`$\\|]/;

function findJsxText(masked) {
  const hits = [];
  const n = masked.length;
  let i = 0;

  while (i < n) {
    if (masked[i] !== "<") { i++; continue; }
    if (!/[A-Za-z_$>/]/.test(masked[i + 1] ?? "")) { i++; continue; }

    // walk to the `>` that closes this tag, stepping over { } attribute
    // expressions
    let j = i + 1;
    let brace = 0;
    while (j < n) {
      const c = masked[j];
      if (c === "{") brace++;
      else if (c === "}") brace--;
      else if (c === ">" && brace === 0) break;
      j++;
    }
    if (j >= n) break;

    // the run of JSX text that follows the tag
    let k = j + 1;
    while (k < n && masked[k] !== "<" && masked[k] !== "{") k++;
    const text = masked.slice(j + 1, k).replace(/\s+/g, " ").trim();

    if (
      text.length > JSX_TEXT_MAX &&
      /[A-Za-z]{2}/.test(text) &&
      text.includes(" ") &&
      !text.includes(BLANK) &&
      !NOT_PROSE.test(text)
    ) {
      hits.push({ index: j + 1, text });
    }
    i = j + 1;
  }
  return hits;
}

/* ------------------------------------------------------------------ */
/* Walking the tree                                                    */
/* ------------------------------------------------------------------ */
function isExcluded(rel) {
  const norm = rel.split(path.sep).join("/");
  return EXCLUDED_DIRS.some((dir) => norm === dir || norm.startsWith(dir + "/"));
}

function collect(target, acc) {
  const abs = path.resolve(ROOT, target);
  if (isExcluded(path.relative(ROOT, abs))) return acc;
  let st;
  try { st = statSync(abs); } catch { return acc; }
  if (st.isDirectory()) {
    for (const entry of readdirSync(abs).sort()) collect(path.join(abs, entry), acc);
    return acc;
  }
  const ext = path.extname(abs);
  if (CODE_EXT.has(ext) || CSS_EXT.has(ext)) acc.push(abs);
  return acc;
}

function lineStarts(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") starts.push(i + 1);
  return starts;
}

function lineOf(starts, index) {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid; else hi = mid - 1;
  }
  return lo + 1;
}

/* ------------------------------------------------------------------ */
/* The rules                                                           */
/* ------------------------------------------------------------------ */
const RULES = {
  emDash: {
    level: "error",
    title: "Em-dash in user-facing copy",
    why: "House rule. The site uses commas, colons and full stops. Comments may use anything.",
  },
  banned: {
    level: "error",
    title: "Banned phrase",
    why: "Promotional register, or a claim the project cannot back. The list is in this script.",
  },
  inlineProse: {
    level: "warn",
    title: `JSX text over ${JSX_TEXT_MAX} characters inside a component`,
    why: "Copy belongs in src/content/copy/*, where it can be read and revised in one place.",
  },
  placeholder: {
    level: "error",
    title: "Literal #placeholder outside a comment",
    why: "A link or a button is a claim. Unpublished things render as text: see src/content/status.ts.",
  },
};

const findings = { emDash: [], banned: [], inlineProse: [], placeholder: [] };

function record(rule, file, line, detail, extra) {
  findings[rule].push({ file, line, detail, ...extra });
}

const argv = process.argv.slice(2);
// `--strict` promotes warnings to errors. Rule 3 is a warning because the site
// carries a real backlog of inline prose; when that backlog is cleared, wire
// --strict into the build and the warning becomes the gate.
const STRICT = argv.includes("--strict");
const targets = argv.filter((a) => !a.startsWith("-"));
const files = [];
for (const t of targets.length ? targets : SCAN_ROOTS) collect(t, files);

const phrases = BANNED_PHRASES.map((entry) => {
  const [phrase, reason] = Array.isArray(entry) ? entry : [entry, ""];
  return { phrase, reason, needle: phrase.toLowerCase().replace(/\s+/g, " ").trim() };
});

for (const abs of files) {
  const rel = path.relative(ROOT, abs).split(path.sep).join("/");
  const src = readFileSync(abs, "utf8");
  const isCss = CSS_EXT.has(path.extname(abs));
  const { noComments, masked } = isCss ? scanCss(src) : scanSource(src);
  const starts = lineStarts(src);
  const lines = src.split("\n");

  // Rule 1: em-dash
  for (let i = 0; i < noComments.length; i++) {
    if (noComments[i] === EM_DASH) {
      const line = lineOf(starts, i);
      record("emDash", rel, line, lines[line - 1]);
    }
  }

  // Rule 2: banned phrases. Whitespace is collapsed first so a phrase still
  // matches when JSX has wrapped it across lines. `offsets` keeps the source
  // index of every surviving character so the report points at a real line.
  const offsets = [];
  let flat = "";
  let lastWasSpace = false;
  for (let i = 0; i < noComments.length; i++) {
    const ch = noComments[i];
    if (/\s/.test(ch)) {
      if (lastWasSpace || flat.length === 0) continue;
      flat += " "; offsets.push(i); lastWasSpace = true;
    } else {
      flat += ch; offsets.push(i); lastWasSpace = false;
    }
  }
  const flatLower = flat.toLowerCase();
  for (const { phrase, reason, needle } of phrases) {
    let at = flatLower.indexOf(needle);
    while (at !== -1) {
      const line = lineOf(starts, offsets[at]);
      record("banned", rel, line, lines[line - 1], { phrase, reason });
      at = flatLower.indexOf(needle, at + needle.length);
    }
  }

  // Rule 3: inline prose, components only
  if (!isCss && rel.startsWith("src/components/")) {
    for (const hit of findJsxText(masked)) {
      record("inlineProse", rel, lineOf(starts, hit.index), hit.text);
    }
  }

  // Rule 4: #placeholder outside a comment
  const lowered = noComments.toLowerCase();
  let at = lowered.indexOf("#placeholder");
  while (at !== -1) {
    const line = lineOf(starts, at);
    record("placeholder", rel, line, lines[line - 1]);
    at = lowered.indexOf("#placeholder", at + 1);
  }
}

/* ------------------------------------------------------------------ */
/* Report: grouped by rule, then by file, every hit as path:line       */
/* ------------------------------------------------------------------ */
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const bold = (s) => (color ? "\u001b[1m" + s + "\u001b[0m" : s);
const dim = (s) => (color ? "\u001b[2m" + s + "\u001b[0m" : s);

function clip(s, max = 96) {
  const one = String(s).replace(/\s+/g, " ").trim();
  return one.length > max ? one.slice(0, max - 1) + "…" : one;
}

let errors = 0;
let warnings = 0;
const out = [];

for (const key of Object.keys(RULES)) {
  const rule = RULES[key];
  const hits = findings[key];
  if (hits.length === 0) continue;
  const level = STRICT ? "error" : rule.level;
  if (level === "error") errors += hits.length; else warnings += hits.length;

  out.push("");
  out.push(bold(`${level === "error" ? "ERROR" : "WARN "}  ${rule.title}  (${hits.length})`));
  out.push(dim(`       ${rule.why}`));

  const byFile = new Map();
  for (const h of hits) {
    if (!byFile.has(h.file)) byFile.set(h.file, []);
    byFile.get(h.file).push(h);
  }
  for (const [file, list] of [...byFile.entries()].sort((a, z) => a[0].localeCompare(z[0]))) {
    out.push("");
    out.push(`  ${file}`);
    for (const h of list.sort((x, y) => x.line - y.line)) {
      out.push(`    ${file}:${h.line}`);
      if (h.phrase) out.push(`      banned "${h.phrase}": ${h.reason}`);
      out.push(`      ${dim(clip(h.detail))}`);
    }
  }
}

const scanned = `${files.length} file${files.length === 1 ? "" : "s"}`;
if (out.length === 0) {
  console.log(`check:copy  clean  (${scanned})`);
  process.exit(0);
}

console.log(out.join("\n"));
console.log("");
console.log(bold(`check:copy  ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}  (${scanned})`));
console.log(dim("  What each rule is for: presentation/web/scripts/BANNED.md"));
process.exit(errors > 0 ? 1 : 0);
