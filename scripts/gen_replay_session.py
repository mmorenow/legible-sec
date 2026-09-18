"""LEGIBLE site, Phase 0: bake ONE real pipeline pass for the /try/ "replay mode"
fixture (DESIGN-PLAN.md §5.11, §7.1) — src/content/replaySession.json.

Runs the REAL motor (`legible.generate.get_backend` + the LanceDB RAG index at
`data/rag/lancedb`, 4,513 rows, v0.2) end to end: real retrieval, real
exemplars, a real assembled prompt. No fabricated data.

Backend: dry-run by default ($0, no API key required — the repo's money
gate is "$0 API spend without owner OK", and this script must never spend
without an explicit flag). Dry-run returns the assembled prompt instead of a
generated translation and skips the judge (matching `app/server.py`'s
documented dry-mode contract in DESIGN-PLAN.md §7.2). Pass --backend gemini
(with GEMINI_API_KEY exported) to bake a fuller replay with a real streamed
translation + judge report once the owner authorizes the spend — this
regenerates the same file shape, just with `translation`/`judge` populated
instead of null.

Usage:
    ../../.venv/bin/python scripts/gen_replay_session.py [--backend dry|gemini|openai|cloud]
Writes: presentation/web/src/content/replaySession.json
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src"))

from legible.generate import get_backend  # noqa: E402
from legible.judge import run_deterministic  # noqa: E402

OUT_PATH = REPO_ROOT / "presentation" / "web" / "src" / "content" / "replaySession.json"

# The site's flagship pair (matches src/content/data.ts examplePairs[0] and
# the "PyPI access control" sample chip in DESIGN-PLAN.md §7.1) — real
# verbatim technical_text from data/pairs/core_1to1_curated.jsonl,
# pair_id "2026-04-pypi-warehouse-securityreview#s8-f8", aligned conf 0.99.
FINDING_TEXT = (
    "The manage_organization_roles view handles both GET and POST requests "
    "under a single @view_config decorator with "
    "permission=Permissions.OrganizationsRead. On POST, "
    "_send_organization_invitation is called, creating an invitation without "
    "verifying write permission. Any organization member, regardless of "
    "role, can therefore invite new members with arbitrary roles, including "
    "Owner."
)
AUDIENCE_KEY = "client_exec"
FORMAT_KEY = "email"


def exemplar_to_dict(ex) -> dict:
    return {
        "pair_id": ex.pair_id,
        "source_org": ex.source_org,
        "severity_original": ex.severity_original,
        "vuln_class": ex.vuln_class,
        "technical_text": ex.technical_text,
        "executive_text": ex.executive_text,
        "source_url": ex.source_url,
        "filter_used": ex.filter_used,
        "score": ex.score,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend", default="dry", choices=["dry", "gemini", "openai", "cloud"])
    args = ap.parse_args()

    backend = get_backend(args.backend)
    print(f"backend: {backend.name}")
    result = backend.translate(FINDING_TEXT, AUDIENCE_KEY, FORMAT_KEY)

    judge = None
    if result.translation and not result.assembled_prompt:
        # only judge a REAL generated translation (dry-run has none to judge,
        # matching app/server.py's documented dry-mode contract, §7.2)
        report = run_deterministic(
            source=FINDING_TEXT,
            translation=result.translation,
            omitted_details=result.omitted_details,
            severity_conveyed=result.severity_conveyed,
            format_key=FORMAT_KEY,
            audience_key=AUDIENCE_KEY,
        )
        judge = {
            "ok": report.ok,
            "passed": report.passed,
            "flags": [
                {"check": f.check, "level": f.level, "message": f.message, "evidence": f.evidence}
                for f in report.flags
            ],
        }

    payload = {
        "generated_by": "scripts/gen_replay_session.py",
        "backend": backend.name,
        "finding": FINDING_TEXT,
        "audience_key": AUDIENCE_KEY,
        "format_key": FORMAT_KEY,
        "translation": result.translation,
        "severity_conveyed": result.severity_conveyed,
        "confidence": result.confidence,
        "omitted_details": result.omitted_details,
        "assembled_prompt": result.assembled_prompt,
        "exemplars": [exemplar_to_dict(e) for e in result.exemplars],
        "judge": judge,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH}  ({len(result.exemplars)} exemplars, "
          f"judge={'yes' if judge else 'no (dry-run)'})")


if __name__ == "__main__":
    main()
