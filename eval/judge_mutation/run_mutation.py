"""Fase 1 — mutation testing del judge determinista (research/AUDITORIA §3, Fase 1).

Metodología (honesta, documentada):
  Para cada clase de mutación construimos pares (base, mutante) donde la BASE es una
  traducción fiel que PASA el check objetivo, y el MUTANTE aplica UNA corrupción.
  recall = fracción de mutantes donde el check objetivo FALLA.
  Solo se cuentan pares testeables (mutación aplicable + base pasa el check objetivo).
  Donde el texto ejecutivo natural no suele portar la propiedad (IDs CVE), se
  inyecta una base fiel (marcado como base_injected=True).

  Clases MECÁNICAS: generadas a escala desde el dataset (regex).
  Clases SEMÁNTICAS + CONTROL: set semilla curado a mano (fixtures inline), porque
  requieren parafraseo real y Fase 1 es $0 (sin API).

Salida: reports/fase1_judge_mutation.md (lo escribe el caller) + stdout con las tablas.
"""
from __future__ import annotations

import json
import pathlib
import random
import re
import sys
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
from legible.judge import (  # noqa: E402
    run_deterministic, _extract_ids, _extract_numbers, _id_spans,
    _severity_signal, CAVEAT_MARKERS,
)

DATASET = ROOT / "data/dataset/legible-pairs-v0.3.jsonl"
FINDING_LEVEL = {"id_anchor", "same_section_1to1", "ghsa_impact", "board_extract"}
BAND_NAME = {4: "critical", 3: "high", 2: "medium", 1: "low", 0: "info"}


def target_fails(check: str, source, translation, omitted=None, severity=None) -> bool:
    """Does the given check FAIL on this (source, translation)?"""
    rep = run_deterministic(source, translation, omitted_details=omitted,
                            severity_conveyed=severity)
    return any(f.check == check and f.level == "fail" for f in rep.flags)


# ------------------------------------------------------------------ MECÁNICAS

def gen_mechanical(rows):
    """Yield dicts: {cls, target, source, base, mutant, base_injected, severity_base, severity_mut}."""
    out = []
    for r in rows:
        src = (r.get("technical_text") or "").strip()
        exe = (r.get("executive_text") or "").strip()
        if not src or not exe or len(exe) < 40:
            continue
        sev_orig = (r.get("severity_original") or "").strip().lower()

        # --- D1 id_swap (base inyectada; aislar: 1 solo ID y NO ya presente en exec) ---
        ids = sorted(_extract_ids(src))
        if len(ids) == 1 and ids[0] not in exe:
            idv = ids[0]
            base = f"{exe} (tracked as {idv})"
            mutant = exe  # el mutante omite el ID sin declararlo ni citarlo
            out.append(dict(cls="id_swap", target="id_parity", source=src,
                            base=base, mutant=mutant, base_injected=True))

        # --- D2 number_shift (natural: número presente en src Y exec) ---
        src_nums = _extract_numbers(src, _id_spans(src))
        shared = [n for n in src_nums if n in exe]
        if shared and not target_fails("numeric_parity", src, exe):
            n = shared[0]
            # cambiar el número por otro claramente distinto
            new = "4718" if n != "4718" else "8231"
            mutant = re.sub(rf"(?<![\d.]){re.escape(n)}(?![\d.])", new, exe)  # todas las ocurrencias
            out.append(dict(cls="number_shift", target="numeric_parity", source=src,
                            base=exe, mutant=mutant, base_injected=False))

        # --- D4 entity_invent (inserta IP no presente en la fuente) ---
        if not target_fails("entity_check", src, exe) and "10.13.37.42" not in src:
            mutant = f"{exe} The affected host was 10.13.37.42."
            out.append(dict(cls="entity_invent", target="entity_check", source=src,
                            base=exe, mutant=mutant, base_injected=False))

        # --- D3 severity_down / severity_up (vía severity_conveyed declarado) ---
        ssig = _severity_signal(src)
        if ssig is not None:
            band = ssig[0]
            if band >= 2:  # hay margen para bajar
                out.append(dict(cls="severity_down", target="severity_drift", source=src,
                                base=exe, mutant=exe, base_injected=False,
                                severity_base=BAND_NAME[band], severity_mut=BAND_NAME[band - 2 if band-2>=0 else 0]))
            if band <= 3:  # hay margen para subir (inflar) → esperado NO atrapado
                out.append(dict(cls="severity_up", target="severity_drift", source=src,
                                base=exe, mutant=exe, base_injected=False,
                                severity_base=BAND_NAME[band], severity_mut=BAND_NAME[band + 1]))

        # --- D5 caveat_delete_verbatim (borra la oración-caveat del exec) ---
        low_src = src.lower()
        marker = next((m for m in CAVEAT_MARKERS if m in low_src), None)
        if marker:
            # base: exec + una contraparte literal del caveat (para que la base pase)
            src_sent = next((s for s in re.split(r"(?<=[.!?])\s+", src) if marker in s.lower()), None)
            if src_sent:
                base = f"{exe} {src_sent.strip()}"
                if not target_fails("caveat_parity", src, base):
                    mutant = exe  # se borra la contraparte
                    if target_fails("caveat_parity", src, mutant) or True:
                        out.append(dict(cls="caveat_delete_verbatim", target="caveat_parity",
                                        source=src, base=base, mutant=mutant, base_injected=True))
    return out


def score_mechanical(cases):
    stats = defaultdict(lambda: {"testable": 0, "caught": 0})
    for c in cases:
        sev_b = c.get("severity_base"); sev_m = c.get("severity_mut")
        base_fail = target_fails(c["target"], c["source"], c["base"], severity=sev_b)
        if base_fail:
            continue  # base no pasa el check → no testeable
        mut_fail = target_fails(c["target"], c["source"], c["mutant"], severity=sev_m)
        stats[c["cls"]]["testable"] += 1
        stats[c["cls"]]["caught"] += int(mut_fail)
    return stats


# ------------------------------------------------------------------ SEMÁNTICAS
# Set semilla curado a mano. Cada fixture: (source, base fiel, mutante, target).
# base debe pasar el check; el mutante introduce la corrupción semántica.

SEM = {
    "caveat_drop_paraphrase": [  # buena paráfrasis pero SIN el caveat → D5 debería fallar
        ("SSRF is exploitable only if the attacker already holds a valid session token.",
         "An attacker who is already logged in could abuse this to make the server issue internal requests.",
         "This flaw lets an attacker make the server issue internal requests.", "caveat_parity"),
        ("The RCE requires local access to the management interface.",
         "Someone with hands-on access to the admin console could run code on the box.",
         "This lets someone run arbitrary code on the box.", "caveat_parity"),
        ("Exploitation is only possible when debug mode is enabled in production.",
         "If the team left debug mode on in production, an attacker could read secrets.",
         "An attacker could read the application secrets.", "caveat_parity"),
        ("The bypass works only if MFA is not enforced on the tenant.",
         "For tenants that never turned on MFA, the login step can be skipped.",
         "The login step can be skipped by an attacker.", "caveat_parity"),
        ("Data exposure requires physical access to an unlocked device.",
         "With a stolen, unlocked phone in hand, someone could pull the stored tokens.",
         "Someone could pull the stored tokens from the phone.", "caveat_parity"),
        ("This is theoretical; we did not find a working exploit path in the timebox.",
         "In principle the weakness exists, though we could not weaponize it during the review.",
         "The weakness lets an attacker take over the account.", "caveat_parity"),
        ("Injection is possible only when the legacy v1 API is still routed.",
         "Sites that still expose the old v1 API could be injected.",
         "The application can be injected by an attacker.", "caveat_parity"),
        ("The attack requires the victim to click a crafted link (user interaction).",
         "If a user is tricked into clicking a malicious link, their session is exposed.",
         "The user's session is exposed to the attacker.", "caveat_parity"),
        ("Escalation is mitigated by the existing seccomp profile in the default deployment.",
         "In the default setup the seccomp profile blunts this, but a custom config removes that guard.",
         "An attacker can escalate privileges on the host.", "caveat_parity"),
        ("Only accounts with the auditor role can reach the vulnerable endpoint.",
         "An attacker who holds the auditor role could hit the weak endpoint.",
         "An attacker could hit the weak endpoint and extract records.", "caveat_parity"),
        ("The finding is low likelihood: it needs a race window under heavy load.",
         "It would take a lucky race under heavy traffic, so it is unlikely in practice.",
         "An attacker can corrupt the ledger balance.", "caveat_parity"),
        ("Disclosure only occurs if verbose error messages are turned on.",
         "When verbose errors are enabled, stack traces leak to the client.",
         "Stack traces are leaked to the client.", "caveat_parity"),
    ],
    "invented_impact": [  # inserta impacto ausente, SIN intensificadores léxicos → claim_inflation debería fallar (predicción: no)
        ("A reflected XSS exists in the search parameter.",
         "The search box reflects unsanitized input, allowing script execution in the victim's browser.",
         "The search box reflects unsanitized input, which could lead to regulatory fines and loss of customer trust.", "claim_inflation"),
        ("An open redirect exists on the /out endpoint.",
         "The /out endpoint can send users to an attacker-chosen site.",
         "The /out endpoint can send users to an attacker-chosen site, exposing the company to SEC disclosure obligations.", "claim_inflation"),
        ("A verbose error page discloses the framework version.",
         "An error page reveals which framework version is running.",
         "An error page reveals the framework version, which would cause customers to churn to competitors.", "claim_inflation"),
        ("Missing rate limiting on the login endpoint.",
         "The login endpoint does not throttle repeated attempts.",
         "The login endpoint does not throttle attempts, putting the firm at risk of a class-action lawsuit.", "claim_inflation"),
        ("A CSRF token is missing on the profile-update form.",
         "The profile form lacks a CSRF token, so a crafted page could change a user's details.",
         "The profile form lacks a CSRF token, which would trigger a mandatory breach notification to regulators.", "claim_inflation"),
        ("Directory listing is enabled on the static assets host.",
         "The assets server lists its directory contents to anyone.",
         "The assets server lists its contents, which could bankrupt the subsidiary through fines.", "claim_inflation"),
        ("Session cookies lack the Secure attribute.",
         "Session cookies are sent without the Secure flag.",
         "Session cookies lack the Secure flag, exposing the board to personal liability.", "claim_inflation"),
        ("The API returns full stack traces on 500 errors.",
         "The API returns stack traces when it hits a server error.",
         "The API returns stack traces, which will lead to delisting from the app store.", "claim_inflation"),
        ("An outdated TLS 1.0 cipher suite is still accepted.",
         "The server still accepts the old TLS 1.0 protocol.",
         "The server still accepts TLS 1.0, guaranteeing a failed SOC 2 audit and lost enterprise deals.", "claim_inflation"),
        ("Username enumeration is possible via the password-reset timing.",
         "Reset-password timing reveals whether a username exists.",
         "Reset timing reveals valid usernames, which will result in multimillion-dollar GDPR penalties.", "claim_inflation"),
    ],
    "negation_flip_semantic": [  # invierte significado sin palabras de negación → negation_flip debería fallar (predicción: no)
        ("We found no evidence of exploitation in the logs.",
         "The logs show no signs that anyone exploited this.",
         "The logs show limited evidence that this was exploited.", "negation_flip"),
        ("There is no indication that customer data was accessed.",
         "Nothing suggests customer data was reached.",
         "There are early indications that customer data may have been reached.", "negation_flip"),
        ("No successful compromise was observed during the engagement.",
         "We did not see any successful compromise.",
         "Some degree of compromise was observed during the engagement.", "negation_flip"),
        ("The audit found no sign of unauthorized access.",
         "There was no sign of anyone getting in without authorization.",
         "The audit found traces consistent with unauthorized access.", "negation_flip"),
        ("No data was exfiltrated as far as the review could determine.",
         "As best the review could tell, nothing was taken.",
         "The review suggests a portion of data was likely taken.", "negation_flip"),
        ("There is no evidence the backdoor was ever triggered.",
         "Nothing shows the backdoor being used.",
         "There is partial evidence the backdoor was triggered.", "negation_flip"),
    ],
    "status_drift": [  # potencial → ocurrido / arreglado → activo → status_drift debería fallar
        ("An attacker could exploit this to read arbitrary files.",
         "An attacker could abuse this to read files they should not.",
         "Attackers exploited this and exfiltrated internal files.", "status_drift"),
        ("This flaw could allow credential theft if chained with phishing.",
         "Combined with phishing, this could let someone steal credentials.",
         "Attackers stole employee credentials through this flaw.", "status_drift"),
        ("The issue has been patched in release 2.4.1.",
         "This was fixed in version 2.4.1.",
         "The system remains vulnerable and is still unpatched.", "status_drift"),
        ("An attacker could potentially escalate to root.",
         "There is a path an attacker could use to reach root.",
         "An attacker escalated to root and encrypted the servers.", "status_drift"),
        ("If exploited, this would permit account takeover.",
         "Exploited, it would allow taking over accounts.",
         "Customer accounts were taken over via this issue.", "status_drift"),
    ],
    "negation_flip_lexical": [  # inversión con palabras de negación explícitas → negation_flip debería atrapar
        ("We found no evidence of exploitation in the wild.",
         "There is no evidence anyone exploited this in the wild.",
         "Attackers actively exploited this and stole session tokens.", "negation_flip"),
        ("There is no indication of compromise in the environment.",
         "No indication of compromise was found.",
         "The environment was compromised and data was exfiltrated.", "negation_flip"),
        ("No evidence of access to the credential store was found.",
         "We saw no evidence of access to the credential store.",
         "Attackers accessed the credential store and drained it.", "negation_flip"),
    ],
    "control_good_paraphrase": [  # caveat CONSERVADO pero reformulado → D5 NO debería fallar (mide FP)
        ("SSRF is exploitable only if the attacker already holds a valid session token.",
         "", "An already-authenticated attacker — one who holds a valid session token — could make the server issue internal requests.", "caveat_parity"),
        ("The RCE requires local access to the management interface.",
         "", "Someone with local, hands-on access to the management interface could run code.", "caveat_parity"),
        ("Exploitation is only possible when debug mode is enabled in production.",
         "", "This can only be exploited when debug mode is left enabled in production.", "caveat_parity"),
        ("The bypass works only if MFA is not enforced on the tenant.",
         "", "The bypass only works on tenants where MFA is not enforced.", "caveat_parity"),
        ("Data exposure requires physical access to an unlocked device.",
         "", "Exposing the data requires physical access to a device that is already unlocked.", "caveat_parity"),
        ("This is theoretical; we did not find a working exploit path in the timebox.",
         "", "This remains theoretical — we did not find a working exploit within the review window.", "caveat_parity"),
        ("The attack requires the victim to click a crafted link (user interaction).",
         "", "The attack needs the victim to be tricked into clicking a crafted link.", "caveat_parity"),
        ("Only accounts with the auditor role can reach the vulnerable endpoint.",
         "", "Only accounts that hold the auditor role can reach the vulnerable endpoint.", "caveat_parity"),
        ("The finding is low likelihood: it needs a race window under heavy load.",
         "", "This is low-likelihood: it needs a narrow race window under heavy load.", "caveat_parity"),
        ("Disclosure only occurs if verbose error messages are turned on.",
         "", "Disclosure happens only when verbose error messages are turned on.", "caveat_parity"),
        ("Escalation is mitigated by the existing seccomp profile in the default deployment.",
         "", "In the default deployment the existing seccomp profile mitigates escalation.", "caveat_parity"),
        ("Injection is possible only when the legacy v1 API is still routed.",
         "", "Injection is only possible while the legacy v1 API is still routed.", "caveat_parity"),
        ("Escalation requires admin privileges on the host to begin with.",
         "", "Escalation requires the attacker to already hold admin privileges on the host.", "caveat_parity"),
        ("The leak occurs only when the app runs with elevated entitlements.",
         "", "The leak only happens when the app is granted elevated entitlements.", "caveat_parity"),
        ("Exploitation is unlikely to succeed without a valid API key.",
         "", "Without a valid API key, exploitation is unlikely to succeed.", "caveat_parity"),
    ],
}


def score_semantic():
    stats = defaultdict(lambda: {"testable": 0, "caught": 0, "fp": 0, "base_fp": 0, "n": 0})
    for cls, fixtures in SEM.items():
        for src, base, mutant, target in fixtures:
            if cls == "control_good_paraphrase":
                # paráfrasis CERCANA (preserva marcadores) — FP "fácil"
                stats[cls]["testable"] += 1
                stats[cls]["fp"] += int(target_fails(target, src, mutant))
            else:
                stats[cls]["n"] += 1
                # la BASE es una paráfrasis fiel que conserva el caveat/impacto:
                # si el check falla en ella = falso positivo REALISTA
                base_fail = bool(base) and target_fails(target, src, base)
                stats[cls]["base_fp"] += int(base_fail)
                if base_fail:
                    continue  # base no pasa → no testeable para recall
                stats[cls]["testable"] += 1
                stats[cls]["caught"] += int(target_fails(target, src, mutant))
    return stats


def main():
    rows = [json.loads(l) for l in open(DATASET)]
    fl = [r for r in rows if r.get("alignment_method") in FINDING_LEVEL]
    random.seed(13)
    random.shuffle(fl)
    pool = fl[:1200]  # muestra amplia para las mecánicas

    mech_cases = gen_mechanical(pool)
    mech = score_mechanical(mech_cases)
    sem = score_semantic()

    print(f"pool finding-level: {len(fl)} (usados {len(pool)}) | casos mecánicos generados: {len(mech_cases)}\n")
    print(f"{'clase':28} {'nivel':10} {'testables':>9} {'atrapados':>9} {'recall':>7}")
    order = [("id_swap","mecánica"),("number_shift","mecánica"),("entity_invent","mecánica"),
             ("severity_down","mecánica"),("severity_up","mecánica"),("caveat_delete_verbatim","mecánica"),
             ("negation_flip_lexical","semántica"),("status_drift","semántica"),
             ("caveat_drop_paraphrase","semántica"),("invented_impact","semántica"),
             ("negation_flip_semantic","semántica")]
    result = {}
    for cls, lvl in order:
        s = mech.get(cls) or sem.get(cls)
        if not s: continue
        t, c = s["testable"], s["caught"]
        rec = (c/t*100) if t else float("nan")
        result[cls] = (t, c, rec)
        print(f"{cls:28} {lvl:10} {t:>9} {c:>9} {rec:>6.1f}%")
    # FP de D5: dos niveles de dificultad de paráfrasis
    ctrl = sem["control_good_paraphrase"]
    easy_fp = ctrl["fp"]/ctrl["testable"]*100 if ctrl["testable"] else float("nan")
    cdp = sem["caveat_drop_paraphrase"]
    real_fp = cdp["base_fp"]/cdp["n"]*100 if cdp["n"] else float("nan")
    print(f"\nFALSOS POSITIVOS de caveat_parity (D5), por distancia de paráfrasis:")
    print(f"  paráfrasis CERCANA (preserva marcadores): {ctrl['fp']}/{ctrl['testable']} = {easy_fp:.1f}% FP")
    print(f"  paráfrasis REALISTA (reformula la condición): {cdp['base_fp']}/{cdp['n']} = {real_fp:.1f}% FP")

    print("\n=== vs Anexo C (predicciones del consultor) ===")
    def g(k): return result.get(k,(0,0,float('nan')))[2]
    print(f"C1  recall D1 id & D2 num > 95%      -> id_swap {g('id_swap'):.0f}% | number_shift {g('number_shift'):.0f}%")
    print(f"C2  recall D5 caveat_paraphrase <50% -> {g('caveat_drop_paraphrase'):.0f}%")
    print(f"C3  FP D5 > 25% (realista)           -> {real_fp:.0f}%  (cercana: {easy_fp:.0f}%)")
    print(f"C4  recall claim_inflation inv <40%  -> {g('invented_impact'):.0f}%")

    # persistir json para el reporte
    outp = ROOT / "eval/judge_mutation/results.json"
    json.dump({"result": result, "fp_easy": easy_fp, "fp_real": real_fp,
               "control_n": ctrl["testable"], "cdp_n": cdp["n"], "cdp_base_fp": cdp["base_fp"],
               "n_mech_cases": len(mech_cases), "pool": len(pool)},
              open(outp, "w"), indent=2)
    print(f"\n-> {outp}")


if __name__ == "__main__":
    main()
