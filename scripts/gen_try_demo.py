"""Generate presentation/web/src/content/tryDemo.json: the /try instrument's
baked demo content. Every technical/executive string is extracted VERBATIM
from data/dataset/legible-pairs-v0.3.jsonl (elisions are marked with the
bracketed ellipsis "[…]"); nothing is paraphrased or invented. The in-browser
gate (src/lib/judge.ts, a validated port of src/legible/judge.py) runs live on
exactly these displayed strings, so every verdict shown is real.

Run from the repo root:  python3 scripts/gen_try_demo.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from legible.judge import run_deterministic  # noqa: E402

DATASET = ROOT / "data/dataset/legible-pairs-v0.3.jsonl"
JUDGE_DEMO = ROOT / "presentation/web/src/content/judgeDemo.json"
OUT = ROOT / "presentation/web/src/content/tryDemo.json"

rows = [json.loads(l) for l in DATASET.open()]
by_id = {r["pair_id"]: r for r in rows}


def span(pid: str, start_anchor: str, end_anchor: str | None = None, field: str = "technical_text") -> str:
    """A verbatim contiguous span of a pair's text, located by anchors."""
    text = by_id[pid][field]
    i = text.find(start_anchor)
    assert i >= 0, f"{pid}: start anchor not found: {start_anchor[:60]}"
    if end_anchor is None:
        return text[i:].strip()
    j = text.find(end_anchor, i)
    assert j >= 0, f"{pid}: end anchor not found: {end_anchor[:60]}"
    return text[i : j + len(end_anchor)].strip()


ELIDE = "\n[…] "

# ---------------------------------------------------------------- translate --
jd = json.loads(JUDGE_DEMO.read_text())
zeta = jd["cases"][0]  # the pair's real, verified executive_text + declared omissions

cf_src = span("postmortem__cloudflare__thanksgiving-2023#claim1", "They attempted to log into")
dz = by_id["ftc__drizly#p17"]
dz_src = (
    span("ftc__drizly#p17", "Drizly failed to use reasonable", "Among other things, Drizly failed to:")
    + "\n\n"
    + span("ftc__drizly#p17", "Securely store AWS and database login credentials", "asymmetric private keys);")
    + "\n\n[…] "
    + span("ftc__drizly#p17", "Prevent data loss by monitoring", "outside the company's network boundaries;")
)

translate = [
    {
        "key": "executive",
        "audience_label": "Executive sponsor",
        "audience_blurb": "engagement outcome, severity in plain words",
        "finding_label": "Rent-drain in a Solana gateway",
        "org": "trailofbits",
        "year": "2025",
        "severity": "High",
        "source_url": None,
        "source": zeta["source_text"],
        "translation": zeta["translation_text"],
        "omitted": zeta["omitted_details"],
        "attribution": "Trail of Bits · ZetaChain security review, 2025",
    },
    {
        "key": "board",
        "audience_label": "Board of directors",
        "audience_blurb": "the failed control and its consequence",
        "finding_label": "Consumer key, enterprise doors",
        "org": "CSRB",
        "year": "2023",
        "severity": None,
        "source_url": "https://www.cisa.gov/sites/default/files/2025-03/CSRBReviewOfTheSummer2023MEOIntrusion508.pdf",
        "source": by_id["CSRB-f81e5b0af4"]["technical_text"],
        "translation": by_id["CSRB-f81e5b0af4"]["executive_text"],
        "omitted": [],
        "attribution": "Cyber Safety Review Board · Storm-0558 review, 2023",
    },
    {
        "key": "customer",
        "audience_label": "Customer notice",
        "audience_blurb": "bounded assurance: what was and was not touched",
        "finding_label": "Thanksgiving 2023 intrusion",
        "org": "cloudflare",
        "year": "2023",
        "severity": None,
        "source_url": None,
        "source": cf_src,
        "translation": by_id["postmortem__cloudflare__thanksgiving-2023#claim1"]["executive_text"],
        "omitted": [],
        "attribution": "Cloudflare · Thanksgiving 2023 incident report",
    },
    {
        "key": "regulator",
        "audience_label": "Regulator",
        "audience_blurb": "the failure and the harm, on the record",
        "finding_label": "Credentials in GitHub repos",
        "org": "ftc",
        "year": "2022",
        "severity": None,
        "source_url": None,
        "source": dz_src,
        "translation": dz["executive_text"],
        "omitted": [],
        "attribution": "FTC · In the Matter of Drizly, complaint, 2022",
    },
    {
        "key": "developer",
        "audience_label": "Developer",
        "audience_blurb": "affected surface, conditions, concrete impact",
        "finding_label": "Template sandbox escape",
        "org": "GHSA",
        "year": "2023",
        "severity": "High",
        "source_url": "https://github.com/advisories/GHSA-wg6p-jmpc-xjmr",
        "source": by_id["GHSA-wg6p-jmpc-xjmr"]["technical_text"],
        "translation": by_id["GHSA-wg6p-jmpc-xjmr"]["executive_text"],
        "omitted": [],
        "attribution": "Backstage maintainers · GHSA-wg6p-jmpc-xjmr, 2023",
    },
]

# the in-browser gate must find these verdicts; assert them here at bake time
for c in translate:
    rep = run_deterministic(c["source"], c["translation"], omitted_details=c["omitted"])
    fails = [f for f in rep.flags if f.level == "fail" and f.check != "format_lint"]
    assert not fails, f"translate case {c['key']} has gate fails: {[(f.check, f.evidence) for f in fails]}"

# ------------------------------------------------------------------- review --
review = [
    {
        "key": c["key"],
        "label": c["label"],
        "note": c["note"],
        "source": c["source_text"],
        "draft": c["translation_text"],
        "omitted": c.get("omitted_details") or [],
    }
    for c in jd["cases"]
]

# ------------------------------------------------------------------ explain --
BF = "ppr__Bishop Fox__Bishop-Fox-Research-Report-Efficacy-of-micro-segmentation-V01#doc"
explain = [
    {
        "key": "lateral",
        "label": "Lateral movement",
        "mech_meta": "Bishop Fox · attack simulations against micro-segmentation, 2020",
        "mech": span(BF, "The assessment team observed that for a 100 workloads environment", "compared to the control environment (flat network scenario).")
        + ELIDE
        + span(BF, "In short, the tighter the micro-segmentation policy", "as they attempt to move laterally."),
        "rendering": span(BF, "Attackers spend a great deal of time on lateral movement", "picking up anything of value.", field="executive_text"),
        "highlight": "a burglar in a building where all the doors are open",
        "attribution": "Bishop Fox · Efficacy of Micro-Segmentation, research report for Illumio, 2020",
        "url": None,
    },
    {
        "key": "heartbleed",
        "label": "Heartbleed",
        "mech_meta": "OpenSSL heartbeat extension · CVE-2014-0160",
        "mech": span("wikipedia__heartbleed#mech", "The RFC 6520 Heartbeat Extension", "whatever else happened to be in the allocated memory buffer."),
        "rendering": by_id["wikipedia__heartbleed#mech"]["executive_text"].strip(),
        "highlight": "more data can be read than should be allowed",
        "attribution": "Wikipedia editors · Heartbleed · CC BY-SA",
        "url": "https://en.wikipedia.org/wiki/Heartbleed",
    },
    {
        "key": "log4shell",
        "label": "Log4Shell",
        "mech_meta": "Log4j 2 JNDI lookups · CVE-2021-44228",
        "mech": span("wikipedia__log4shell#mech", "The Java Naming and Directory Interface (JNDI)", "anywhere on the Internet.")
        + ELIDE
        + span("wikipedia__log4shell#mech", "In the default configuration, when logging a string", "queried and loaded as Java object data."),
        "rendering": by_id["wikipedia__log4shell#mech"]["executive_text"].strip(),
        "highlight": "execute arbitrary Java code",
        "attribution": "Wikipedia editors · Log4Shell · CC BY-SA",
        "url": "https://en.wikipedia.org/wiki/Log4Shell",
    },
]

# --------------------------------------------------------------- precedents --
def prec(pid: str, audience: str, audience_label: str, tech: str, exec_text: str | None = None, year: str | None = None, org_label: str | None = None):
    r = by_id[pid]
    return {
        "id": pid,
        "org": org_label or r["source_org"],
        "year": year or (str(r["report_year"]) if r.get("report_year") not in (None, 0, "0") else None),
        "severity": r.get("severity_original") or None,
        "audience": audience,
        "audience_label": audience_label,
        "tech": tech,
        "exec": (exec_text or r["executive_text"]).strip(),
        "url": r.get("source_url") or None,
    }


precedents = [
    # board
    prec("CSRB-8ba4cb3e4b", "board", "Board", span("CSRB-8ba4cb3e4b", "Initially, the consumer MSA system", "before the intrusion.")),
    prec("GAO-b3d537d503", "board", "Board", span("GAO-b3d537d503", "one test report we reviewed", "confidentiality, integrity, or availability of the system.")),
    prec("CSRB-0c3f2f8fbb", "board", "Board", span("CSRB-0c3f2f8fbb", "Some organizations also made use of", "communication separate from the primary channel),") + "…"),
    # executive summaries
    prec(
        "2023-06-dfinity-ckBTC-securityreview#s7-f1",
        "executive",
        "Executive summary",
        "KYT canister is centralized on third-party provider\n[…] "
        + span("2023-06-dfinity-ckBTC-securityreview#s7-f1", "The KYT canister relies entirely", "tightly integrated with it, creating") + "…",
    ),
    prec(
        "2025-03-otim-smart-wallet-securityreview#s11-f1",
        "executive",
        "Executive summary",
        "Lack of NFT callbacks\n[…] "
        + span("2025-03-otim-smart-wallet-securityreview#s11-f1", "In the current implementation, when an EOA upgrades", "token callbacks in the current implementation."),
    ),
    prec(
        "writeup_v2#37",
        "executive",
        "Executive summary",
        span("writeup_v2#37", "Astar's assets-erc20 precompile implements", "half the width the calldata argument is supposed to represent."),
        exec_text=span("writeup_v2#37", "In November 2023, a Zellic security researcher", "deployed on the Astar EVM.", field="executive_text"),
        year="2023",
        org_label="Zellic",
    ),
    # customer notices
    prec("postmortem__lastpass__notice-of-recent-security-incident-dec2022#claim1", "customer", "Customer notice", span("postmortem__lastpass__notice-of-recent-security-incident-dec2022#claim1", "This incident did not compromise your Master Password.", "gain access to our customers’ Master Password.")),
    prec("postmortem__dropbox__dropbox-sign-incident-2024#claim1", "customer", "Customer notice", span("postmortem__dropbox__dropbox-sign-incident-2024#claim1", "We reached out to all impacted users", "have been notified.")),
    prec("postmortem__sourcegraph__security-update-august-2023#claim0", "customer", "Customer notice", span("postmortem__sourcegraph__security-update-august-2023#claim0", "As more users discovered the proxy app", "accessing Sourcegraph APIs illegitimately.")),
    # regulators
    prec("ftc__drizly#p17", "regulator", "Regulator", span("ftc__drizly#p17", "Securely store AWS and database login credentials", "asymmetric private keys);"), year="2022"),
    prec("sec__solarwinds#adj76", "regulator", "Regulator", span("sec__solarwinds#adj76", "SolarWinds' Security Statement falsely claimed", "unauthorized use of passwords."), year="2023", org_label="SEC"),
    prec("ftc__chegg#p22", "regulator", "Regulator", span("ftc__chegg#p22", "The information collected by Chegg", "is highly sensitive."), year="2022", org_label="ftc"),
    # developer advisories
    prec("GHSA-jfh8-c2jp-5v3q", "developer", "Developer advisory", span("GHSA-jfh8-c2jp-5v3q", "JNDI features used in configuration", "when message lookup substitution is enabled.")),
    prec("GHSA-hqxw-f8mx-cpmw", "developer", "Developer advisory", span("GHSA-hqxw-f8mx-cpmw", "The /v2/_catalog endpoint was designed", "in certain implementations.")),
    prec("GHSA-446m-hmmm-hm8m", "developer", "Developer advisory", span("GHSA-446m-hmmm-hm8m", "Arbitrary file write in resource_create", "via calls to package_update.") + ELIDE + span("GHSA-446m-hmmm-hm8m", "Remote code execution via unsafe pickle loading", "file session store backend.")),
]

out = {
    "generated_by": "scripts/gen_try_demo.py",
    "note": "all technical/executive strings verbatim from legible-pairs-v0.3.jsonl; […] marks elision",
    "translate": translate,
    "review": review,
    "explain": explain,
    "precedents": precedents,
}
OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
print(f"wrote {OUT} · translate={len(translate)} review={len(review)} explain={len(explain)} precedents={len(precedents)}")
