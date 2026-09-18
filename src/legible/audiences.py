"""LEGIBLE P3: audience-role specs and format contracts (prompt layer).

Per D30, the business-ROLE axis (board / CFO / IT manager / client exec) lives
here, in the prompt layer — never as dataset labels. The dataset supplies
observed REGISTERS; these specs steer generation toward a named role.

Each spec is a few load-bearing bullets: what this reader decides, what they
need, what to leave out. Kept terse on purpose — they prepend the cached
system prefix (research/04 §4).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AudienceSpec:
    key: str
    label: str
    # register in the dataset whose exemplars best match this role (D30 mapping)
    retrieval_register: str
    cares_about: tuple[str, ...]
    does_not_need: tuple[str, ...]
    jargon_blacklist: tuple[str, ...]  # terms that must not appear unexplained (judge D6)


# Keyed by the dataset REGISTERS the model was actually trained on (audience_observed
# values in the index). The UI exposes these directly so what the user picks is what
# the model learned. `retrieval_register` = the register itself → the RAG ladder
# prefilters exemplars from that same register.
AUDIENCES: dict[str, AudienceSpec] = {
    "technical_leadership": AudienceSpec(
        key="technical_leadership",
        label="Technical leadership",
        retrieval_register="technical_leadership",
        cares_about=(
            "the security impact in system terms and what an attacker can achieve",
            "affected components, severity with its rating, and exploit preconditions",
            "the remediation direction and its priority",
        ),
        does_not_need=(
            "board-level business framing",
            "step-by-step reproduction payloads",
        ),
        jargon_blacklist=(),  # technical vocabulary is expected here
    ),
    "practitioner": AudienceSpec(
        key="practitioner",
        label="Practitioner (engineer)",
        retrieval_register="practitioner",
        cares_about=(
            "exactly which component and version are affected, and how to verify",
            "the concrete fix, its owner, and its deadline",
            "severity with its CVSS band and any active-exploitation status, unchanged",
        ),
        does_not_need=(
            "business-risk framing beyond one sentence",
        ),
        jargon_blacklist=(),  # technical vocabulary is fine here
    ),
    "management": AudienceSpec(
        key="management",
        label="Board / senior management",
        retrieval_register="management",
        cares_about=(
            "business exposure in plain terms: revenue, operations, reputation",
            "quantified scope (counts, systems, time bound) and cost of fixing vs the incident",
            "regulatory / disclosure consequences and the decision being asked",
        ),
        does_not_need=(
            "exploit mechanics, tool names, protocol internals",
            "internal hostnames, IPs, code identifiers",
        ),
        jargon_blacklist=(
            "ssrf", "xss", "csrf", "rce", "deserialization", "endpoint",
            "nonce", "heap", "buffer overflow", "privilege escalation",
        ),
    ),
    "customer": AudienceSpec(
        key="customer",
        label="Affected customers",
        retrieval_register="customer",
        cares_about=(
            "whether their data or accounts were affected, in plain language",
            "what they should do, and what the vendor has already done",
            "honest severity, without alarm or minimization",
        ),
        does_not_need=(
            "technical mechanics, identifiers, internal system names",
        ),
        jargon_blacklist=(
            "ssrf", "xss", "csrf", "rce", "deserialization", "endpoint",
            "nonce", "heap", "privilege escalation",
        ),
    ),
    "regulatory": AudienceSpec(
        key="regulatory",
        label="Regulator / legal",
        retrieval_register="regulatory",
        cares_about=(
            "the facts material to disclosure: what happened, scope, and timeline",
            "severity and any evidence of exploitation, stated precisely",
            "controls and remediation relevant to compliance obligations",
        ),
        does_not_need=(
            "marketing tone or reassurance",
        ),
        jargon_blacklist=("ssrf", "xss", "csrf", "rce", "deserialization"),
    ),
    "public": AudienceSpec(
        key="public",
        label="General public",
        retrieval_register="public",
        cares_about=(
            "what happened and why it matters, in everyday language",
            "whether they are affected and what to do",
            "honest, non-technical severity",
        ),
        does_not_need=(
            "any technical vocabulary or identifiers",
        ),
        jargon_blacklist=(
            "ssrf", "xss", "csrf", "rce", "deserialization", "endpoint",
            "nonce", "heap", "buffer overflow", "privilege escalation", "cve",
        ),
    ),
}


@dataclass(frozen=True)
class FormatContract:
    key: str
    label: str
    instructions: str
    max_words: int | None
    bullet_limit: int | None
    words_per_bullet: int | None


FORMATS: dict[str, FormatContract] = {
    "email": FormatContract(
        key="email",
        label="Email paragraph",
        instructions="One short email-ready paragraph. No greeting, no sign-off. At most 150 words.",
        max_words=150,
        bullet_limit=None,
        words_per_bullet=None,
    ),
    "slide": FormatContract(
        key="slide",
        label="Slide bullets",
        instructions="Exactly 3 bullets, each 20 words or fewer. Lead with the risk, end with the action.",
        max_words=None,
        bullet_limit=3,
        words_per_bullet=20,
    ),
    "one_pager": FormatContract(
        key="one_pager",
        label="One-pager paragraph",
        instructions="A single briefing paragraph of 120-180 words: impact, evidence, recommended action.",
        max_words=180,
        bullet_limit=None,
        words_per_bullet=None,
    ),
}
