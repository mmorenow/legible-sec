#!/usr/bin/env python3
"""Compile the mined genre lists into typed site content.

Input:  research/genre-lists/01.json .. 11.json  (one file per communication
        situation, mined from research/expert-corpus)
Output: presentation/web/src/content/genres.ts

The compiler does three things and nothing else:

1. Verifies every quote against the corpus file it cites. A quote that cannot
   be located is a hard error: the whole point of the lists is that a check
   which fails a text can show who says so. Verification is tolerant of
   markdown markup (emphasis, bullets, link syntax) and of elisions written
   as "...", because the corpus is markdown and the miner elided long
   passages, but it never accepts a paraphrase.

2. Derives the mechanical handles the deterministic checks need:
   - prohibited jargon: whether the term is a literal string, a literal string
     under a condition, or a class of language with no string to match,
   - length constants: the number and the unit, and whether that unit can be
     measured from plain text at all,
   - field constants: the enumeration of sections, when the mined rule or
     value actually enumerates them.
   Everything the rules cannot classify stays unclassified. Nothing is
   invented, and no quote is ever rewritten.

3. Emits the TypeScript, with every source, sourceFile and quote carried
   through verbatim.

Run:  python3 scripts/gen_genres.py [--check]
      --check verifies the quotes and prints the counts without writing.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LISTS_DIR = ROOT / "research" / "genre-lists"
CORPUS_DIR = ROOT / "research" / "expert-corpus"
OUT_PATH = ROOT / "presentation" / "web" / "src" / "content" / "genres.ts"

SITUATION_COUNT = 11


# --------------------------------------------------------------------------
# quote verification
# --------------------------------------------------------------------------

MD_LINK = re.compile(r"\[([^\]]*)\]\([^)]*\)")


def compact(text: str) -> str:
    """Letters and digits only, lowercased, markdown links flattened.

    Markdown emphasis, bullets, table pipes and escaped brackets all vanish,
    so a quote taken from rendered prose still matches the raw file.
    """
    return re.sub(r"[^a-z0-9]", "", MD_LINK.sub(r"\1", text.replace("…", "...")).lower())


def verify_quote(quote: str, document: str) -> str | None:
    """Return how the quote was located, or None if it is not in the document."""
    doc = compact(document)
    if compact(quote) in doc:
        return "verbatim"
    segments = [compact(part) for part in quote.replace("…", "...").split("...")]
    segments = [seg for seg in segments if seg]
    if not segments:
        return None
    position = 0
    ordered = True
    for seg in segments:
        found = doc.find(seg, position)
        if found < 0:
            ordered = False
            break
        position = found + len(seg)
    if ordered:
        return "elided"
    if all(seg in doc for seg in segments):
        return "elided_unordered"
    return None


# --------------------------------------------------------------------------
# prohibited jargon: literal, conditional, or a class of language
# --------------------------------------------------------------------------

# The prohibition is stated on a condition, so presence of the term is not by
# itself the violation.
CONDITION_MARKERS = [
    "used as", "used when", "used to", "used alone", "applied to", "presented as",
    "presented without", "phrased as", "carried unchanged", "assumed known",
    "as a priority value", "as its own evidence", "as a proxy", "as a model for",
    "as raw hours", "as a raw number", "as the framing", "as the lead",
    "as the summary", "as a verdict", "as leverage", "as an actual result",
    "as the impact", "in recommendations", "in the opening", "in the advisory prose",
    "inside the cve description", "in the description", "that are not", "when it was",
    "when the rating",
]

# The term names a class of language, not a string that can be searched for.
CLASS_NOUNS = [
    "jargon", "acronym", "acronyms", "terminology", "vocabulary", "language",
    "prose", "detail", "details", "names", "codenames", "counts", "count",
    "lists", "list", "figures", "metaphors", "concepts", "phrasing", "advice",
    "assurances", "requests", "speculation", "silence", "vagueness", "register",
    "posture", "summary", "summaries", "reports", "notes", "formats", "dump",
    "verbs", "adjectives", "abstraction", "claims", "number",
]
CLASS_MARKERS = [
    "generally", "in general", "as a class", "and similar", "and other",
    "generic", "kind of", "widest", "broadest", "possible", "named ",
    "any ", "every ", "all ",
]

# The term describes the language instead of quoting it, so there is no string.
CLAUSE_MARKERS = [
    " that ", " where ", " which ", " without ", " with no ", " buried in ",
    " asserted ", " framed ",
]
GERUND_STARTS = ["omitting", "treating", "blaming", "scaring", "punting", "using", "showing"]

EXAMPLE_MARKERS = [", for example ", ", such as ", ", as in "]

# re.escape() escapes spaces, which is not valid in a JavaScript regex under the
# unicode flag, so the escaping is done here for the characters that matter.
REGEX_SPECIAL = set("\\^$.|?*+()[]{}/")


def escape_regex(text: str) -> str:
    return "".join("\\" + char if char in REGEX_SPECIAL else char for char in text)

# Where the derivation rules are wrong, the correction is written down here
# rather than hidden in a heuristic. Keyed by (situation, term).
JARGON_OVERRIDES: dict[tuple[str, str], dict] = {
    # The ban is on the shape of the version string, which is a regex, not a word.
    ("07", "a leading v in a version string, as in v1.2.3"): {
        "kind": "literal",
        "patterns": [r"v\d+(?:\.\d+)+"],
    },
}


def split_condition(term: str) -> tuple[str, str | None]:
    """Split a term into the string to look for and the condition on it."""
    lowered = term.lower()
    best = None
    for marker in CONDITION_MARKERS:
        index = lowered.find(marker)
        if index > 0 and (best is None or index < best[0]):
            best = (index, marker)
    if best is None:
        return term.strip(), None
    head = term[: best[0]].rstrip().rstrip(",").rstrip()
    tail = term[best[0]:].strip()
    if not head:
        return term.strip(), None
    return head, tail


def looks_like_a_class(core: str) -> bool:
    lowered = " " + core.lower() + " "
    if any(marker in lowered for marker in CLASS_MARKERS):
        return True
    if any(marker in lowered for marker in CLAUSE_MARKERS):
        return True
    if lowered.split()[0] in GERUND_STARTS:
        return True
    words = re.findall(r"[a-z]+", core.lower())
    return any(word in CLASS_NOUNS for word in words)


def patterns_for(core: str) -> list[str]:
    """Regex sources for a literal term, already escaped."""
    variants = [core]
    # "Mean Time to Contain, or MTTC" carries two names for one thing.
    for separator in [", or ", " or ", " plus "]:
        if separator in core:
            variants = [part.strip() for part in core.split(separator) if part.strip()]
            break
    else:
        # "MTTD and MTTR", "SIEM and EDR": acronym pairs are two terms.
        parts = [part.strip() for part in core.split(" and ")]
        if len(parts) > 1 and all(re.fullmatch(r"[A-Z]{2,6}", part) for part in parts):
            variants = parts
        elif "," in core:
            head = core.split(",")[0].strip()
            words = head.split()
            # A one word head is too general to search for unless it is an acronym.
            if head and len(words) <= 3 and (len(words) > 1 or head.isupper()):
                variants = [head, core]
    seen: list[str] = []
    for variant in variants:
        cleaned = variant.strip().strip(".").strip()
        # A leading article only narrows the match: "the detonation chamber"
        # should still be found in "a detonation chamber".
        stripped = re.sub(r"^(?:a|an|the)\s+", "", cleaned, flags=re.IGNORECASE)
        if len(stripped.split()) >= 2:
            cleaned = stripped
        if cleaned and cleaned not in seen:
            seen.append(cleaned)
    return [escape_regex(item) for item in seen]


def classify_jargon(situation: str, entry: dict) -> dict:
    term = entry["term"]
    override = JARGON_OVERRIDES.get((situation, term))
    if override:
        return dict(override)

    # The miner recorded a few entries that the source offers as a replacement
    # rather than as a ban. Those can never fail a text.
    if "rather than a ban" in entry["why"]:
        return {
            "kind": "conceptual",
            "reason": "the source lists this as a replacement, not as a ban",
        }

    lowered = term.lower()
    for marker in EXAMPLE_MARKERS:
        index = lowered.find(marker)
        if index > 0:
            head = term[:index].rstrip().rstrip(",")
            example = term[index + len(marker):].strip()
            if example:
                return {
                    "kind": "conditional",
                    "patterns": patterns_for(example),
                    "condition": head,
                }

    core, condition = split_condition(term)
    if looks_like_a_class(core):
        return {
            "kind": "conceptual",
            "reason": "the source bans a class of language, not a string",
        }
    if condition:
        return {"kind": "conditional", "patterns": patterns_for(core), "condition": condition}
    return {"kind": "literal", "patterns": patterns_for(core)}


# --------------------------------------------------------------------------
# format constants: length limits and field enumerations
# --------------------------------------------------------------------------

LENGTH_RX = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:(?:to|-|–)\s*(\d+(?:\.\d+)?)\s*)?"
    r"(words?|pages?|sentences?|slides?|minutes?)",
    re.IGNORECASE,
)
# Only these two units are countable in a plain text draft.
MEASURABLE_UNITS = {"words", "sentences"}

NOT_A_FIELD_LIST = ["vocabulary", " vs ", "one of", "either", "for example"]

FIELD_OVERRIDES: dict[tuple[str, str], list[str]] = {
    # "Sections what went well, what went badly, where we got lucky": the rule
    # enumerates without a colon, so the generic split cannot see it.
    ("04", "3 named sections"): ["what went well", "what went badly", "where we got lucky"],
}

TRAILING_CLAUSE = re.compile(r"\s+(?:are|is|must|per|so|because)\s+.*$", re.IGNORECASE)
LEADING_FILLER = re.compile(r"^(?:the|a|an|its|and|all)\s+", re.IGNORECASE)


def parse_length(value: str) -> dict | None:
    match = LENGTH_RX.search(value)
    if not match:
        return None
    numbers = [float(n) for n in (match.group(1), match.group(2)) if n]
    unit = match.group(3).lower()
    if not unit.endswith("s"):
        unit += "s"
    return {
        "unit": unit,
        "max": max(numbers),
        "measurable": unit in MEASURABLE_UNITS,
    }


def clean_field(raw: str) -> str:
    field = raw.strip().strip(".").strip()
    field = TRAILING_CLAUSE.sub("", field)
    field = LEADING_FILLER.sub("", field)
    return field.strip()


def split_fields(text: str) -> list[str]:
    parts = [part for part in re.split(r"[,;]", text) if part.strip()]
    if len(parts) < 2:
        parts = [part for part in text.split(" and ") if part.strip()] if " and " in text else []
    if len(parts) < 2:
        return []
    # A leading count ("2 fields, Close Code and Closure Notes") is not a field.
    if re.fullmatch(r"\d+\s+\w+", parts[0].strip()):
        parts = parts[1:]
        if len(parts) == 1 and " and " in parts[0]:
            parts = parts[0].split(" and ")
    fields = []
    for part in parts:
        if re.match(r"^\s*\d", part):
            return []
        cleaned = clean_field(part)
        if not cleaned or not re.search(r"[a-zA-Z]", cleaned):
            return []
        fields.append(cleaned)
    return fields if len(fields) >= 2 else []


def parse_fields(situation: str, constant: dict) -> list[str]:
    override = FIELD_OVERRIDES.get((situation, constant["value"]))
    if override:
        return override
    haystack = (constant["rule"] + " " + constant["value"]).lower()
    if any(marker in haystack for marker in NOT_A_FIELD_LIST):
        return []
    fields = split_fields(constant["value"])
    if fields:
        return fields
    if ":" in constant["rule"]:
        return split_fields(constant["rule"].split(":", 1)[1])
    return []


# --------------------------------------------------------------------------
# emit
# --------------------------------------------------------------------------


def ts(value) -> str:
    """A TypeScript literal for a JSON-ish value, safe to embed anywhere.

    The corpus quotes security prose, so angle brackets and ampersands are
    escaped as \\uXXXX: the same rule the pair browser learned the hard way.
    """
    text = json.dumps(value, ensure_ascii=False)
    for char, escaped in (("<", "\\u003c"), (">", "\\u003e"), ("&", "\\u0026"),
                          ("\u2028", "\\u2028"), ("\u2029", "\\u2029")):
        text = text.replace(char, escaped)
    return text


@dataclass
class Counts:
    questions: int = 0
    mandatory: int = 0
    jargon: int = 0
    literal: int = 0
    conditional: int = 0
    conceptual: int = 0
    constants: int = 0
    length: int = 0
    length_measurable: int = 0
    fields: int = 0
    fields_enumerated: int = 0
    clock: int = 0
    template: int = 0
    verbatim: int = 0
    elided: int = 0


HEADER = """/* GENERATED FILE, DO NOT EDIT BY HAND.
   Written by scripts/gen_genres.py from research/genre-lists/01..11.json,
   which were mined from the 237 document corpus in research/expert-corpus.
   To change a list, change the JSON and run the script again.

   What this file is: the eleven per genre lists that rubric dimensions D1 and
   D6 depend on, plus the format constants D8 depends on. Every entry carries
   its source, its file and the quote that proves it, because a check that
   fails a text has to be able to show who says so. The quotes are verbatim:
   the compiler verifies each one against the corpus file it cites and refuses
   to write this file if one cannot be located.

   checklistStatus is the load bearing field. "published" means a named body
   publishes a normative list for this situation, so a check may carry L0
   authority. "conventional" means practitioners converge but nobody published
   a norm, so the same check drops to advisory. */

"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify and count, do not write")
    args = parser.parse_args()

    counts = Counts()
    documents: dict[str, str] = {}
    problems: list[str] = []
    genres = []

    for number in range(1, SITUATION_COUNT + 1):
        path = LISTS_DIR / f"{number:02d}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        situation = data["situation"]
        if situation != f"{number:02d}":
            problems.append(f"{path.name}: situation field is {situation!r}")
        if data["checklistStatus"] not in ("published", "conventional"):
            problems.append(f"{path.name}: unknown checklistStatus {data['checklistStatus']!r}")

        for group in ("questions", "prohibitedJargon", "formatConstants"):
            for entry in data[group]:
                source_file = entry["sourceFile"]
                if source_file not in documents:
                    corpus_path = CORPUS_DIR / source_file
                    if not corpus_path.exists():
                        problems.append(f"{situation}: missing corpus file {source_file}")
                        documents[source_file] = ""
                    else:
                        documents[source_file] = corpus_path.read_text(
                            encoding="utf-8", errors="replace"
                        )
                located = verify_quote(entry["quote"], documents[source_file])
                if located is None:
                    problems.append(
                        f"{situation}: quote not found in {source_file}: {entry['quote'][:80]!r}"
                    )
                elif located == "verbatim":
                    counts.verbatim += 1
                else:
                    counts.elided += 1

        questions = []
        for entry in data["questions"]:
            counts.questions += 1
            counts.mandatory += 1 if entry["mandatory"] else 0
            questions.append(
                {
                    "question": entry["question"],
                    "mandatory": bool(entry["mandatory"]),
                    "source": entry["source"],
                    "sourceFile": entry["sourceFile"],
                    "quote": entry["quote"],
                }
            )

        jargon = []
        for entry in data["prohibitedJargon"]:
            counts.jargon += 1
            match = classify_jargon(situation, entry)
            counts.literal += 1 if match["kind"] == "literal" else 0
            counts.conditional += 1 if match["kind"] == "conditional" else 0
            counts.conceptual += 1 if match["kind"] == "conceptual" else 0
            jargon.append(
                {
                    "term": entry["term"],
                    "why": entry["why"],
                    "sourceFile": entry["sourceFile"],
                    "quote": entry["quote"],
                    "match": match,
                }
            )

        constants = []
        for entry in data["formatConstants"]:
            counts.constants += 1
            kind = entry["kind"]
            constant = {
                "rule": entry["rule"],
                "kind": kind,
                "value": entry["value"],
                "sourceFile": entry["sourceFile"],
                "quote": entry["quote"],
            }
            if kind == "length":
                counts.length += 1
                limit = parse_length(entry["value"]) or parse_length(entry["rule"])
                if limit:
                    constant["limit"] = limit
                    counts.length_measurable += 1 if limit["measurable"] else 0
            elif kind == "fields":
                counts.fields += 1
                fields = parse_fields(situation, entry)
                if fields:
                    constant["fields"] = fields
                    counts.fields_enumerated += 1
            elif kind == "clock":
                counts.clock += 1
            elif kind == "template":
                counts.template += 1
            else:
                problems.append(f"{situation}: unknown format constant kind {kind!r}")
            constants.append(constant)

        genres.append(
            {
                "id": f"S{situation}",
                "number": situation,
                "name": data["name"],
                "reader": data["reader"],
                "checklistStatus": data["checklistStatus"],
                "checklistNote": data["checklistNote"],
                "questions": questions,
                "prohibitedJargon": jargon,
                "formatConstants": constants,
            }
        )

    if problems:
        print("REFUSING TO WRITE. Problems found:", file=sys.stderr)
        for problem in problems:
            print("  " + problem, file=sys.stderr)
        return 1

    print(
        f"situations {len(genres)} | questions {counts.questions} "
        f"({counts.mandatory} mandatory) | jargon {counts.jargon} "
        f"(literal {counts.literal}, conditional {counts.conditional}, "
        f"class {counts.conceptual}) | constants {counts.constants} "
        f"(length {counts.length}, {counts.length_measurable} measurable; "
        f"fields {counts.fields}, {counts.fields_enumerated} enumerated; "
        f"clock {counts.clock}; template {counts.template})"
    )
    print(f"quotes verified: {counts.verbatim} verbatim, {counts.elided} with elisions")

    if args.check:
        return 0

    body = [HEADER]
    body.append('import type { SituationId } from "./rubric";\n\n')
    body.append(TYPES)
    body.append("export const genreLists: Record<SituationId, GenreList> = {\n")
    for genre in genres:
        body.append(f"  {genre['id']}: {ts(genre)},\n")
    body.append("};\n")
    body.append(TAIL)
    OUT_PATH.write_text("".join(body), encoding="utf-8")
    print(f"wrote {OUT_PATH.relative_to(ROOT)}")
    return 0


TYPES = """/** Whether a named body publishes a normative list for this situation. */
export type ChecklistStatus = "published" | "conventional";

/** The measurement authority a deterministic check may claim on a genre. */
export type GenreAuthority = "L0" | "L2";

export type GenreQuestion = {
  question: string;
  /** The source states this one as required, not as a good idea. */
  mandatory: boolean;
  source: string;
  sourceFile: string;
  quote: string;
};

/**
 * How a prohibited term can be looked for in a draft.
 * literal: presence of the string is the violation.
 * conditional: the string is real but the source bans it only in a case a
 *   regex cannot see, so a match is reported for confirmation, never as a fail.
 * conceptual: the source bans a class of language. There is no string, so this
 *   is declared to the reader and passed to the model layer.
 */
export type JargonMatch =
  | { kind: "literal"; patterns: string[] }
  | { kind: "conditional"; patterns: string[]; condition: string }
  | { kind: "conceptual"; reason: string };

export type ProhibitedTerm = {
  term: string;
  why: string;
  sourceFile: string;
  quote: string;
  match: JargonMatch;
};

export type FormatConstantKind = "length" | "clock" | "fields" | "template";

/** A parsed length limit. Only words and sentences can be counted in a draft. */
export type LengthLimit = {
  unit: "words" | "sentences" | "pages" | "slides" | "minutes";
  max: number;
  measurable: boolean;
};

export type FormatConstant = {
  rule: string;
  kind: FormatConstantKind;
  value: string;
  sourceFile: string;
  quote: string;
  /** Present on length constants whose value names a number and a unit. */
  limit?: LengthLimit;
  /** Present on field constants that actually enumerate their sections. */
  fields?: string[];
};

export type GenreList = {
  id: SituationId;
  /** The two digit number the rubric, the corpus and the mined files all use. */
  number: string;
  name: string;
  reader: string;
  checklistStatus: ChecklistStatus;
  checklistNote: string;
  questions: GenreQuestion[];
  prohibitedJargon: ProhibitedTerm[];
  formatConstants: FormatConstant[];
};

"""

TAIL = """
export const genreListArray: GenreList[] = Object.values(genreLists);

/**
 * The authority a deterministic check may claim on this genre. On a genre with
 * no published norm a check advises, it does not rule.
 */
export function authorityFor(status: ChecklistStatus): GenreAuthority {
  return status === "published" ? "L0" : "L2";
}

export function genreFor(situation: SituationId): GenreList {
  return genreLists[situation];
}
"""


if __name__ == "__main__":
    raise SystemExit(main())
