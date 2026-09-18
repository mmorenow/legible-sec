# What `check:copy` enforces, and why

```
npm run check:copy              # the whole site
node scripts/check_site_copy.mjs src/components/Hero.tsx
node scripts/check_site_copy.mjs --strict     # warnings fail too
```

Exit code 1 on any error, 0 when clean or when only warnings fired. Plain Node,
no dependencies, no network.

## Why a script exists at all

LEGIBLE's entire claim is fidelity. It measures whether a security finding
survives translation into executive language without losing facts, severity or
caveats. A site that oversells that measurement contradicts the thing it is
measuring, and the owner has said so plainly: "it looks like we're selling
something. Don't."

Two house rules have existed for a long time and kept coming back anyway:

1. No em-dash in user-facing copy.
2. No promotional register.

The second one is the problem. "Don't sound like we're selling something" is a
judgement, and a judgement is not reviewable in a diff. Nobody catches it on the
fourth pass over a file they have already read three times. A grep is reviewable.
So the rules that can be mechanised are mechanised here, and the ones that cannot
stay a matter of taste and stay the reviewer's job. This file is not a
replacement for reading the copy.

## The one design decision worth knowing

**Comments are not copy, so comments are never checked.**

The scanner strips comments before any rule runs. This is not a convenience. This
repo documents its own history in comments, and several of those comments have to
quote the exact strings the rules ban:

```js
{/* The filled accent button that stood here said "Load the dataset" and
    pointed at the literal string "#placeholder". Nothing is published,
    so there is nothing to point at and no button to render. */}
```

A guard that flagged that comment would be asking a contributor to delete the
explanation of a bug in order to keep the check that prevents the bug. It would
be deleted itself within a week, and rightly.

Stripping comments first is also the whole of the `#placeholder` exemption in
rule 4. There is no allow-list of filenames. Any file may explain the old bug;
no file may reintroduce it.

The same pass produces a second view of the source in which the interior of every
string, template and regex literal is blanked out. What is left between JSX tags
is JSX text and nothing else, which is what rule 3 reads. That is why rule 3 never
trips over `useState<Record<string, string>>` and never sees an `aria-label`.

The scanner is a lexer, not a parser. It makes one deliberate safety choice: an
unterminated quote or regex is abandoned at the end of its line, since JavaScript
forbids either from spanning one. A stray apostrophe in prose therefore costs at
most one line of accuracy instead of derailing the rest of the file.

## Excluded from the scan

- `src/components/_archive/**` and `src/content/_archive/**`. Deliberately retired
  code, kept as a record of what the site used to say, so it is allowed to still
  say it.
- `*.json` under `src/`. That is data, not copy.

---

## Rule 1: em-dash (ERROR)

A literal U+2014 in a string literal or in JSX text.

House style. The site uses commas, colons and full stops. The em-dash is the
punctuation of a confident aside, and this site does not have confident asides.
Middle dots (`·`) are the house separator for mono captions.

Comments may use em-dashes freely, and most of the ones in this repo do.

## Rule 2: banned phrases (ERROR)

Case-insensitive, literal, matched over whitespace-collapsed text so a phrase is
still caught when JSX has wrapped it across two lines.

**The list lives in `check_site_copy.mjs`, not in this file**, so that adding to it
is a reviewable one-line diff sitting next to the code that enforces it. An entry
is `["phrase", "reason"]`. Always write the reason. A guard that says WHY it failed
gets obeyed; one that just says "banned" gets deleted by the next person it
inconveniences, and the reason is what tells that person what to write instead.

The seed list came out of an audit of this site. The entries fall into three kinds,
and a new entry should be one of them:

- **Slogans and taglines.** `the model that speaks CFO`,
  `One finding in. One faithful sentence out.`, `Meet plaintext-9b`. A research
  instrument does not have a tagline. Say what the thing is.
- **Brochure verbs on unpublished things.** `Load the dataset`,
  `Explore the full dataset`, `Open the instrument`. A button is a claim.
  Everything a visitor can reach is registered in `src/content/status.ts`, and
  anything that is not `shipped` renders as text with its note, never as a link.
  These strings were once the labels on buttons pointing at the literal href
  `#placeholder`.
- **Claims the project cannot back.** `with receipts`, `Never generated.`,
  `cannot bluff`, `Built by agents`, `lands closest to the human gold`. Each of
  these states as a fact something the evidence only partially supports:
  provenance is checked on the fraction of pairs that carry a source URL, not on
  all of them; a benchmark result is a number with an interval, not a podium
  finish. Report the number and its coverage.

To add one:

```js
["the phrase", "one line saying what to write instead"],
```

To retire one, delete the line. That is also a reviewable diff, which is the point.

## Rule 3: inline prose in a component (WARNING)

JSX text longer than 25 characters, whitespace collapsed, inside
`src/components/**`.

Copy that lives in a component scatters and drifts. The same sentence ends up in
two files with two different numbers in it, and the numbers stop agreeing with
`src/content/facts.ts`. Prose belongs in `src/content/copy/*`, where all of it can
be read in one sitting and revised in one place.

**This is a warning, not an error, and that is on purpose.** Two reasons:

1. The site currently carries a real backlog of inline prose across live
   components. Turning that red today would make `check:copy` fail on every run
   for reasons unrelated to truth or register, and the whole guard would be
   switched off within a day. Rules 1, 2 and 4 are about what the site *says*;
   rule 3 is about where the sentence *lives*. Only the first kind should be able
   to stop a build.
2. Some hits are legitimately inline: a caption that is half a sentence because an
   interpolated number splits it, or a diagram label that only makes sense next to
   the shape it labels.

Run `--strict` to promote warnings to errors.

**The backlog was cleared on 2026-09-01** and `--strict` is now the default: the
`check:copy` script passes it, and `npm run check` runs the copy guard, the
judge mapping harness and `tsc --noEmit` in one command. It is deliberately NOT
wired into `next build`, because a build that fails on a 26 character JSX string
gets worked around within a day. Run `npm run check` before you commit.

Measured on the tree at the time of writing, every hit was genuine JSX prose:
no TypeScript generic and no `aria-label` was ever mistaken for copy, because
neither is JSX text.

## Rule 4: literal `#placeholder` (ERROR)

Anywhere outside a comment.

Before `src/content/status.ts` existed, this site advertised a dataset that was not
published, behind a filled call to action pointing at the literal string
`#placeholder`, and described a model artifact that was never built. Those were not
copy mistakes; they were a missing data structure. `status.ts` is that structure,
and `linkFor()` returns an href only when a claim is actually shipped, so there is
no longer a placeholder to point at.

This rule is the tripwire on the way back. If `#placeholder` shows up in a string
again, someone has routed around the ledger.

---

## Adding a rule

Add an entry to `RULES` with a `level` of `"error"` or `"warn"` and a `why` that
reads like advice rather than an accusation, push findings with `record()`, and it
appears in the grouped report automatically. Keep `why` to one line: it is printed
under every failure, and a wall of text there is a wall of text people learn to
skip.

Prefer `"warn"` for anything about structure or placement, and reserve `"error"`
for statements that would make the site say something untrue or something it is
trying not to be.
