#!/usr/bin/env python3
"""Bake the /try Explain analogy library from the register dataset.

Reads data/dataset/legible-register-v0.3.jsonl (kind == "analogy") plus the
three report-level analogies already curated in tryDemo.json, filters for
quality (confidence >= 0.7, not truncated, display-sane length), dedupes per
exact concept, and writes presentation/web/src/content/explainLibrary.json
with per-entry match tokens/phrases for the deterministic in-browser matcher.

Nothing is generated: every entry is a real, attributed analogy. Rerun when
the register dataset grows.
"""

import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
REGISTER = ROOT / "data" / "dataset" / "legible-register-v0.3.jsonl"
TRYDEMO = ROOT / "presentation" / "web" / "src" / "content" / "tryDemo.json"
OUT = ROOT / "presentation" / "web" / "src" / "content" / "explainLibrary.json"

MIN_CONF = 0.7
MAX_LEN = 1900

# single tokens too generic to be match evidence on their own
GENERIC = {
    "security", "key", "keys", "network", "data", "web", "attack", "attacks",
    "function", "functions", "model", "checking", "value", "tools", "files",
    "fast", "small", "large", "general", "purpose", "physical", "personal",
    "independent", "independence", "marginal", "behavior", "explained",
    "analogy", "incl", "without", "protect", "protection", "risk", "trust",
    "not", "just", "and", "the", "via", "what", "does", "can", "your", "own",
    "why", "uses", "used", "gaps", "between", "checks", "vs", "for", "with",
    "secret", "secrets", "box", "note", "letter", "open", "safe", "design",
    "shop", "orders", "line", "phone", "management", "adoption", "exposure",
    "errors", "corrected", "deleted", "protocols", "protocol", "handle",
    "like", "resistant", "misreading", "partial", "progress", "toward",
    "break", "unintended", "cracks", "exploited", "hackers", "technically",
    "following", "rules", "legality", "publishing", "browser", "email",
    "messaging", "storage", "pre", "shared", "double", "lock", "three",
    "pass", "proportional", "protected", "factors", "services", "contained",
    "decoy", "environments", "architecture", "compartmentalization", "what",
    "hide", "hid", "limits", "metadata", "traffic", "nested", "tunnels",
    "envelope", "sealed", "postcard", "locked", "diary", "denial", "access",
    "theft", "mail", "padlock", "exchange", "mad", "lib", "framing", "input",
    "clearing", "predictable", "manufactured", "emotion", "mechanism",
    "delivery", "list", "bouncer", "forwarding", "isolation", "recovering",
    "response", "time", "code", "impossible", "decode", "one", "way",
    # crypto-generic: only explicit aliases may carry these, or every
    # crypto-adjacent entry ties on them
    "encryption", "encrypted", "encrypt", "crypto", "cryptography",
    "cryptographic", "decrypt", "authentication", "secure", "based",
}

# concept-pattern (regex, case-insensitive) -> extra aliases (phrases or tokens)
ALIASES = [
    (r"man-in-the-middle", ["mitm", "man in the middle", "interception"]),
    (r"multi-factor", ["mfa", "2fa", "two factor", "multi factor"]),
    (r"ddos", ["ddos", "dos", "denial of service", "botnet"]),
    (r"sql injection", ["sqli", "sql injection", "injection"]),
    (r"^hashing|password hashing", ["hash", "hashing", "hashed", "password hash"]),
    (r"salting", ["salt", "salting", "salted"]),
    (r"buffer overflow", ["buffer overflow", "overflow", "memory corruption"]),
    (r"phishing", ["phishing", "phish", "spear phishing"]),
    (r"ransomware", ["ransomware", "ransom"]),
    (r"zero trust", ["zero trust", "perimeter", "castle and moat"]),
    (r"zero-knowledge", ["zkp", "zero knowledge"]),
    (r"zero-day", ["zero day", "0day", "zeroday"]),
    (r"public-key|public/private|asymmetric|passkeys", ["public key", "private key", "asymmetric", "rsa", "keypair"]),
    (r"\bsymmetric", ["symmetric", "aes"]),  # \b so "asymmetric" doesn't inherit "aes"
    (r"diffie", ["diffie hellman", "key exchange"]),
    (r"key exchange without", ["key exchange"]),
    (r"oauth", ["oauth", "delegated authorization", "valet"]),
    (r"jwt", ["jwt", "json web token", "token"]),
    (r"tls|ssl|https", ["tls", "ssl", "https", "certificate", "handshake"]),
    (r"pki|certificate auth", ["pki", "certificate authority"]),
    (r"vpn", ["vpn", "tunnel"]),
    (r"tor ", ["tor", "onion routing"]),
    (r"firewall", ["firewall", "nat", "port forwarding", "ports"]),
    (r"sandbox", ["sandbox", "sandboxing", "sandboxed"]),
    (r"honeypot", ["honeypot", "decoy"]),
    (r"air gap", ["air gap", "airgap", "air gapped"]),
    (r"^dns", ["dns", "domain name"]),
    (r"cookies", ["cookie", "cookies", "tracking"]),
    (r"session hijacking", ["session hijacking", "session", "logout"]),
    (r"aslr", ["aslr", "address space"]),
    (r"cve/cvss", ["cve", "cvss", "severity score"]),
    (r"prompt injection", ["prompt injection", "prompt", "llm", "jailbreak"]),
    (r"privilege escalation", ["privilege escalation", "privesc", "privilege"]),
    (r"social engineering", ["social engineering", "pretexting"]),
    (r"defense in depth|layered", ["defense in depth", "layered", "defence in depth"]),
    (r"segmentation", ["segmentation", "micro segmentation"]),
    (r"passkeys", ["passkey", "passkeys", "webauthn", "fido"]),
    (r"signature", ["signature", "signatures", "signing"]),
    (r"hsm", ["hsm", "hardware security module"]),
    (r"hardware security tokens", ["security key", "yubikey", "hardware token"]),
    (r"exploit vs\. payload", ["payload", "exploit", "malware"]),
    (r"threat actor", ["threat actor"]),
    (r"roll your own crypto", ["roll your own", "custom crypto", "homemade crypto"]),
    (r"blockchain", ["blockchain", "ledger", "immutability"]),
    (r"key management", ["key management"]),
    (r"data in transit", ["in transit", "plaintext", "cleartext", "unencrypted"]),
    (r"timing attack", ["timing attack", "side channel"]),
    (r"vulnerabilities as unintended", ["vulnerability", "vulnerabilities", "flaw"]),
    (r"https/encryption", ["encryption", "encrypted", "encrypt"]),
    (r"revocation", ["revocation", "revoked"]),
    (r"shared/predictable passwords", ["password reuse", "weak password", "default password"]),
    (r"password storage", ["password storage", "password"]),
    (r"crypto-in-the-browser", ["timing", "javascript crypto"]),
    (r"port scanning", ["port scan", "port scanning", "nmap"]),
    (r"password manager", ["password manager", "vault"]),
    (r"network authentication", ["wpa2", "sim", "wifi"]),
    (r"active man-in-the-middle", ["tampering", "eavesdropping"]),
    (r"rate limiting", ["rate limit", "rate limiting"]),
]

# the three report-level analogies curated for the old demo (real + attributed)
TRYDEMO_ALIASES = {
    "lateral": ["lateral movement", "lateral", "micro segmentation", "east west"],
    "heartbleed": ["heartbleed", "openssl"],
    "log4shell": ["log4shell", "log4j", "jndi"],
}


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def concept_label(concept: str) -> str:
    lab = re.split(r"\(| / | explained | via |;", concept)[0].strip().rstrip("/").strip()
    return (lab[:44] + "…") if len(lab) > 46 else lab


def match_terms(concept: str) -> list[str]:
    terms: list[str] = []
    for pat, aliases in ALIASES:
        if re.search(pat, concept, re.I):
            terms.extend(aliases)
    for tok in norm(concept).split():
        if len(tok) >= 3 and tok not in GENERIC:
            terms.append(tok)
    # dedupe, keep order (phrases first so they win visually in debugging)
    seen, out = set(), []
    for t in terms:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def main() -> None:
    rows = [json.loads(l) for l in REGISTER.open()]
    an = [
        r for r in rows
        if r.get("kind") == "analogy"
        and not r.get("truncated_suspect")
        and (r.get("judge_confidence") or 0) >= MIN_CONF
        and len(r["text"]) <= MAX_LEN
    ]
    # dedupe per exact concept: highest confidence, then shortest text
    best: dict[str, dict] = {}
    for r in sorted(an, key=lambda r: (-(r.get("judge_confidence") or 0), len(r["text"]))):
        best.setdefault(r["concept"], r)

    entries = []
    for r in best.values():
        domain = urlparse(r["source_url"]).netloc.replace("www.", "") if r.get("source_url") else None
        entries.append({
            "concept": concept_label(r["concept"]),
            "text": r["text"].strip(),
            "match": match_terms(r["concept"]),
            "attribution": f"{r['source']} · {domain}" if domain else r["source"],
            "license": r.get("license"),
            "url": r.get("source_url"),
            "confidence": r.get("judge_confidence"),
        })

    demo = json.loads(TRYDEMO.read_text())
    for c in demo.get("explain", []):
        entries.append({
            "concept": c["label"],
            "text": c["rendering"].strip(),
            "match": TRYDEMO_ALIASES.get(c["key"], [norm(c["label"])]),
            "attribution": c["attribution"],
            "license": None,
            "url": c.get("url"),
            "confidence": 1.0,
        })

    OUT.write_text(json.dumps({
        "generated_by": "scripts/gen_explain_library.py",
        "note": "real, attributed analogies from the LEGIBLE register dataset; nothing generated",
        "analogies": entries,
    }, ensure_ascii=False, indent=1))
    print(f"wrote {len(entries)} analogies -> {OUT}")


if __name__ == "__main__":
    main()
