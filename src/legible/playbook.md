TRANSLATION PLAYBOOK v1.0 — distilled from 4,513 professional translation pairs (LEGIBLE corpus).

THE CORE MOVE
1. Re-anchor the sentence. The finding is about code; your translation is about power:
   who can do what, to whom or what, under which conditions. Never open with the
   mechanism or component. Keep the one technical fact needed to believe the
   consequence; demote it to a subordinate clause ("by submitting a POST request
   to a view that only requires read permission").
2. Fold preconditions into the actor phrase: "any authenticated user", "an adversary
   on the network", "an attacker with physical access". Never as a trailing caveat
   clause, and never silently dropped when they change the risk.
3. Compress hard (target: one sentence per finding, ~25 words) by grouping findings
   that share a root cause and naming the class ("poor input validation", "memory
   safety issues"), citing each finding ID in parentheses.
4. Spend consequence language in proportion to severity: spell out the attack for
   critical/high findings; state low/informational findings factually, without
   manufactured alarm. Same temperature for everything = miscalibrated.

FIDELITY DISCIPLINE (non-negotiable)
5. Severity words are exact or absent. Use the source's band verbatim or don't name
   one. Softening severity is the failure regulators litigate.
6. Calibrate, never downgrade: you may say "difficult to exploit" or "not directly
   exploitable, because X" — difficulty stated, reason attached, band unchanged.
7. Numbers survive by decision-value: keep counts of affected users/records/systems,
   exposure durations, finding tallies — exactly, never rounded toward comfort.
   Delete code-level constants with the mechanism.
8. Bounded assurance: claim only what the evidence supports, with its boundary.
   "Investigation has shown no evidence of X" — never "X did not happen". Separate
   confirmed / believed / still under investigation.
9. Never invent. Every fact must trace to the finding. Do not add business-impact
   dollar claims the finding does not contain. Cite the finding ID so every claim
   stays auditable.

REGISTER AND FORMAT
10. Match the audience's rung: practitioner = mechanism + capability; technical
    leadership = capability + verdict; management/oversight = failed control +
    exact counts; customer/public = bounded assurance + concrete scoped action;
    investor = scope-with-candor + materiality status. Translate instance-jargon
    up to its risk class; vocabulary altitude follows the register, aboutness
    changes for all of them.
11. Document-level output opens with a scoped verdict ("generally robust; no
    high-severity findings") — the judgment only the full view can supply.
12. Standalone artifacts (email, memo, notice) must carry what a report's structure
    would have carried: severity named once, preconditions in the actor phrase,
    and exactly one closing action with owner and urgency proportional to severity.
    Inline per-finding summaries take no bolted-on action.
