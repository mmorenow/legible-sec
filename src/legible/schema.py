"""Candidate-pair record — the pre-verification shape of a dataset pair.

A candidate becomes a dataset pair (GAMEPLAN §4.4, 27 fields) only after the
LLM verification pass (alignment step 0/3). Fields here are the subset the
extractors can populate mechanically; the verifier adds confidence/label.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict


@dataclass
class CandidatePair:
    pair_id: str
    source_doc_id: str            # e.g. "tob/2026-01-bron-mcp-securityreview"
    source_org: str               # trailofbits | cure53 | cisa | ...
    doc_type: str                 # pentest_report | security_audit | cisa_advisory | ...
    technical_text: str           # the finding unit (title + body)
    technical_context: str        # finding title / section heading
    executive_text: str           # the exec claim span
    audience_observed: str        # practitioner | technical_leadership | management | public
    alignment_method: str         # id_anchor | same_section_1to1 | embed+llm
    alignment_type: str           # 1:1 | 1:N | N:1
    cited_ids: list[str] = field(default_factory=list)
    finding_numbers: list[int] = field(default_factory=list)
    severity_original: str = ""
    exec_span_kind: str = "prose"  # prose | bullet_list | doc_level
    needs_llm_verify: bool = True
    notes: str = ""

    def to_jsonl(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False)
