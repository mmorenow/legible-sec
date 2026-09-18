# Rúbrica v0.1 — Fidelidad y utilidad en la comunicación de hallazgos de seguridad

**Versión:** 0.1 (primera formalización) · **Fecha:** 2026-08-30
**Derivada de:** 237 documentos de la industria (11 situaciones × 6 tipos de fuente) + análisis del dataset propio de 3,727 pares técnico→ejecutivo. La trazabilidad completa de cada dimensión está en el Master Guide y en los CSV de extracción.

---

## 1. Qué evalúa esta rúbrica

Dado un **texto fuente** (hallazgo técnico, alerta, incidente, reporte) y una **traducción** (el texto dirigido a una audiencia distinta), la rúbrica responde: ¿la traducción es fiel al original y útil para su lector?

Dos ejes, medidos por separado, porque fallan por separado:

- **Eje F (Fidelidad):** lo que la traducción no puede perder ni distorsionar del original.
- **Eje U (Utilidad de decisión):** lo que la traducción le debe a su lector concreto.

Un texto puede ser 100% fiel y 0% útil, o utilísimo e infiel. Ambos son fallas.

## 2. Contrato de medición (cero autoridad falsa)

Cada check declara su capa de medición, y la capa define cuánta autoridad tiene el veredicto:

- **L0 (determinista):** reglas verificables con certeza. Solo reprueba mostrando la cadena exacta que lo hizo reprobar. Aprobar significa verificado de verdad.
- **L1 (NLI / embeddings):** respaldo frase a frase contra la fuente. Reporta con score de confianza.
- **L2 (juicio LLM):** juicios cualitativos. Siempre marcado como opinión, nunca como veredicto. Incluye la evidencia que motivó la opinión.
- **H (humano):** lo que ninguna capa automatiza con honestidad. La rúbrica lo declara en vez de fingir que lo mide.

Lo que una capa no puede decidir se deriva hacia arriba o se marca "requiere revisión", jamás se aprueba en silencio.

---

## 3. Las 8 dimensiones

### D1 · Contrato del lector — Eje U
**Pregunta:** ¿el texto responde las preguntas fijas que su lector tiene, en el orden en que las tiene?
**Fundamento:** cada situación tiene un lector con preguntas enumerables y muchas veces publicadas: el board (¿protegidos? ¿gastamos bien? ¿algo material que decidir? ¿qué necesitás de mí?), el regulador (checklist del ICO, comment letters de la SEC), el triager (7 campos), el próximo analista (evidencia, hipótesis, próxima acción), el afectado (¿qué hago yo?).
**Checks:**
- U1.1 (L0/L2): las preguntas obligatorias del género están respondidas o su ausencia declarada. Para géneros con checklist publicado (8-K, GDPR/ICO, triage) es L0 contra el checklist; para el resto, L2.
- U1.2 (L2): la respuesta a la pregunta principal aparece primero (veredicto/BLUF), no enterrada.
**Escala:** cobertura % de preguntas del género + pasa/falla en BLUF. **Evidencia:** la pregunta sin responder, o la posición del veredicto.

### D2 · Supervivencia de hechos con su marco — Eje F
**Pregunta:** ¿los hechos materiales sobreviven con su contexto de interpretación?
**Fundamento:** números, IDs, fechas, activos, versiones. Y el hallazgo nuevo del research: un número sin su marco de referencia (tendencia, target, comparación, método de cálculo) es información degradada. "47 servidores" que se vuelve "varios servidores" es omisión; "MFA al 92%" que pierde "con target 98% y bajando" es distorsión aunque el número sobreviva.
**Checks:**
- F2.1 (L0): números, cantidades, porcentajes, dinero, CVSS, IDs (CVE/CWE/GHSA/ICSA), fechas, hosts, versiones: sobreviven o se declaran omitidos.
- F2.2 (L0/L1): el marco de referencia de cada número material (tendencia, target, baseline, unidad) sobrevive o se declara.
- F2.3 (L1/L2): toda afirmación cuantitativa conserva respondible el "¿cómo se calculó?": la procedencia no desaparece.
**Escala:** % de hechos preservados, % de marcos preservados. **Evidencia:** lista de lo que sobrevivió, desapareció y perdió marco.

### D3 · Calibración de severidad y riesgo — Eje F · BIDIRECCIONAL
**Pregunta:** ¿la gravedad transmitida corresponde a la del original, sin suavizar NI inflar?
**Fundamento:** suavizar expone legalmente (SEC/SolarWinds) e inflar destruye credibilidad (threat fatigue, "the security leader who cried wolf", FUD) y contamina ecosistemas (caso curl CVE-2020-19909: severidad crítica asignada por terceros a un bug que no era de seguridad). Severidad ≠ prioridad (IEEE 1044): son juicios distintos y confundirlos es error.
**Checks:**
- F3.1 (L0): la banda de severidad declarada no cambia (Critical no se vuelve "tema menor" ni Low se vuelve "crítico").
- F3.2 (L2): el tono de riesgo corresponde a la banda (opinión marcada).
- F3.3 (L0/L2): severidad y prioridad no se confunden entre sí; si el texto convierte severidad en urgencia, lo justifica.
**Escala:** preservada / suavizada / inflada, por hallazgo. **Evidencia:** la frase que suaviza o infla.

### D4 · Incertidumbre declarada y contrato temporal — Eje F
**Pregunta:** ¿lo que no se sabe se declara, y el texto honra el reloj de su género?
**Fundamento:** la práctica convergente de 4+ géneros independientes: MITRE tiene vocabulario estándar para lo desconocido; la SEC exige declarar-ahora-enmendar-después y castiga el boilerplate; el ICO pone las 72h por encima de la completitud; los operadores maduros adoptan cadencia fija aunque no haya novedades ("seguimos probando el fix" es un update válido; el silencio es falla).
**Checks:**
- F4.1 (L1): cada salvedad y condición del original ("solo con acceso local", "sin evidencia de explotación") tiene contraparte o su omisión se declara.
- F4.2 (L0/L1): lo desconocido se declara como desconocido con lenguaje explícito; no hay afirmaciones que conviertan incertidumbre en certeza.
- F4.3 (L0): si el género tiene reloj o cadencia (72h, 4 días hábiles, próxima actualización), el texto declara su posición temporal: qué se sabe hoy, cuándo llega el próximo update.
- F4.4 (L1/L2): las garantías hacia arriba están calibradas: un tabletop no se reporta como capacidad probada de recovery; "no que sepamos" viene con "y así lo sabríamos".
**Escala:** % de salvedades con contraparte + pasa/falla temporal. **Evidencia:** la salvedad huérfana, la certeza fabricada, el reloj ignorado.

### D5 · Densidad y selección por materialidad — Ejes F+U · BIDIRECCIONAL
**Pregunta:** ¿el texto contiene lo material y solo lo material para su lector?
**Fundamento:** las dos fallas espejo documentadas en 4 situaciones independientes: el one-liner sin contexto y el dump de 800 líneas; subreportar rompe el matching y sobrereportar oscurece lo distintivo (MITRE); la sobrecarga asusta al lector de una carta de breach; "critical few" (NACD); los reportes de actividad aburren al board. La omisión deliberada y declarada es virtud; la omisión accidental de lo material es la falla.
**Checks:**
- F5.1 (L1/L2): en alineaciones 1:N, cada hallazgo material del original está cubierto o su exclusión declarada/justificada.
- U5.2 (L2): no hay relleno que diluya el mensaje (actividad en vez de riesgo, framework percentages en el cuerpo, background innecesario).
- F5.3 (L1): nada del texto carece de respaldo en la fuente (anti-invención; hereda del judge).
**Escala:** cobertura de lo material % + invenciones (pasa/falla). **Evidencia:** el hallazgo no cubierto, el relleno señalado, la frase sin respaldo.

### D6 · Registro y especificidad por audiencia — Eje U · BIDIRECCIONAL
**Pregunta:** ¿el nivel de abstracción, la jerga y la especificidad corresponden al actor que lee?
**Fundamento:** la falla es bidireccional en ambos extremos del gradiente: para el board, ni geek speak ni abstracción vacía (el síntoma observable: "preguntas perfunctorias"); para el ingeniero, la falla es la falta de resolución ("harden AD" es intención, no instrucción; la remediación real es la ruta exacta del GPO). Traducir no es simplificar: es cambiar la resolución al nivel que el actor necesita para actuar. Registro público: ni tecnicismo excluyente ni histrionismo.
**Checks:**
- U6.1 (L0): jerga prohibida por audiencia (listas por género: CVSS crudo en board deck, vaguedades en ticket).
- U6.2 (L2): el nivel de especificidad es accionable para el actor (el dev tiene el endpoint y el patrón de código; el director tiene la consecuencia de negocio).
- U6.3 (L2): tono sin histrionismo y sin eufemismo (conecta con D3).
**Escala:** 1-5 + violaciones de jerga (pasa/falla). **Evidencia:** el término, la vaguedad o el desajuste señalado.

### D7 · Desenlace accionable — Eje U
**Pregunta:** ¿el lector sabe qué se le pide o qué sigue?
**Fundamento:** "un hallazgo crítico sin remediación propuesta es una queja"; el patrón board termina en ask explícito; el reporting bueno termina en dueño + deadline + decisión; el ticket termina en fix verificable con paso de verificación; el handoff termina en próxima acción; la carta de breach incluye por ley el consejo protectivo al afectado (ICO).
**Checks:**
- U7.1 (L0/L1): existe el elemento de acción del género (ask, owner, next step, remediación, consejo protectivo) o su ausencia se declara.
- U7.2 (L2): la acción es ejecutable por el lector concreto (no "implement best practices").
**Escala:** pasa/falla + calidad 0-2. **Evidencia:** presencia/ausencia del elemento, o la acción no ejecutable.

### D8 · Forma del género — capa determinista pura
**Pregunta:** ¿el texto respeta las constantes de formato que su género tiene publicadas?
**Fundamento:** la industria ya definió números duros: memo de 2 páginas para board (NACD), 1 página en 24h para incidente material, 8-K en 4 días hábiles, 72h GDPR, cadencia 20-60 min en incidente activo, 5 secciones de cierre de alerta, 7 campos de triage, gramática CVE con taxonomía controlada de atacantes, handovers de 12+ ítems.
**Checks:**
- U8.1 (L0): límites de longitud del género.
- U8.2 (L0): campos/secciones obligatorios presentes.
- U8.3 (L0): plantillas controladas respetadas donde existen (CVE).
**Escala:** pasa/falla por regla. **Evidencia:** la regla y el valor medido.

---

## 4. Tabla de pesos por situación

3 = crítica (falla acá invalida el texto) · 2 = alta · 1 = presente pero secundaria.

| Dimensión | 01 Pentest | 02 Board | 03 Sitrep | 04 Postmortem | 05 Regulatorio | 06 Breach público | 07 Advisory/CVE | 08 Tickets | 09 SOC | 10 Risk/Budget | 11 Público |
|---|---|---|---|---|---|---|---|---|---|---|---|
| D1 Contrato del lector | 3 | 3 | 3 | 2 | 3 | 3 | 2 | 3 | 3 | 3 | 2 |
| D2 Hechos + marco | 3 | 2 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 2 | 1 |
| D3 Severidad (bidir) | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 2 | 3 | 2 |
| D4 Incertidumbre + tiempo | 2 | 2 | 3 | 2 | 3 | 3 | 2 | 1 | 2 | 2 | 1 |
| D5 Densidad/materialidad | 3 | 3 | 2 | 2 | 3 | 3 | 3 | 2 | 2 | 3 | 3 |
| D6 Registro/especificidad | 2 | 3 | 2 | 2 | 2 | 3 | 2 | 3 | 1 | 3 | 3 |
| D7 Desenlace accionable | 3 | 3 | 2 | 3 | 1 | 3 | 3 | 3 | 3 | 3 | 2 |
| D8 Forma del género | 2 | 3 | 2 | 2 | 3 | 2 | 3 | 2 | 2 | 1 | 1 |

Notas de lectura: en 05 el desenlace pesa poco porque el género es declarativo, pero D4 (temporal) y D2 son ley. En 09 el registro pesa poco (lector técnico par) pero D7 (próxima acción) es la esencia del handoff. En 11 los hechos finos ceden ante D5/D6: la selección y el registro son el juego, con el tradeoff de precisión declarado (mejor entendido simple que no entendido).

## 5. Agregación del veredicto

1. Las violaciones L0 de peso 3 reprueban el texto con su evidencia (rojo).
2. Las violaciones L1 se reportan con score; sobre umbral configurable, ámbar o rojo.
3. Los juicios L2 nunca reprueban solos: aconsejan (ámbar con opinión marcada).
4. Lo indecidible se declara "requiere revisión humana", nunca se aprueba en silencio.
5. El reporte final separa siempre los dos ejes: score de Fidelidad y score de Utilidad, no un promedio único que los mezcle.

## 6. Anexo: regla de analogías (para la biblioteca)

Toda analogía del sistema se anota con: (a) el concepto que ilumina, (b) la audiencia para la que funciona, (c) sus modos de falla conocidos (dónde el modelo mental deja de corresponder a la implementación real). Uso legítimo: formar el primer modelo mental. Uso ilegítimo: razonar sobre controles. Preferencia de explicación: explicación simple primero, narrativa/escenario segundo, analogía tercero.

## 7. Limitaciones declaradas de la v0.1

- Los pesos de la tabla son la primera calibración razonada desde el corpus; deben ajustarse con el ejercicio de los 30 pares del dataset propio y con anotación humana del test set.
- D1 y D6 dependen de listas por género (preguntas obligatorias, jerga prohibida) que existen como evidencia en el corpus pero aún no están compiladas como listas operativas.
- La recuperación de salvedades (F4.1) hereda el problema abierto del judge (bajo el umbral del 85%): mientras no llegue, ese check reporta "revisión asistida", no verificación.
- Situaciones operativas en tiempo real (03, 09) están respaldadas por menos especímenes que las formales; el sesgo del dataset propio hacia registro formal aplica igual acá.

### Addendum 2026-09-01 (al implementar la rúbrica en el checker)

- **La segunda limitación quedó cerrada, con un matiz.** Las listas por género ya
  están compiladas desde el corpus: 178 preguntas, 128 clases de jerga prohibida
  y 151 constantes de formato sobre 120 documentos, con cada cita verificada como
  subcadena literal de su fuente (`research/genre-lists/*.json`). Lo que queda no
  es cobertura sino autoridad: solo 5 de las 11 situaciones (02, 05, 06, 07, 08)
  tienen checklist publicada por un cuerpo con nombre. En las otras 6 un check
  fallado aconseja, no decide.
- **Contradicción interna encontrada, sin resolver.** D5 pesa 3 en siete de las
  once situaciones, pero ningún check determinista la alcanza y la regla de
  agregación 1 solo invalida un texto ante una violación de capa L0. Tal como
  está escrita, la ponderación que la rúbrica le asigna a D5 no puede activarse
  nunca. O la regla 1 necesita una vía que no pase por L0, o D5 necesita un check
  que sí lo haga. Registrado también como LIM-5 en `presentation/web/src/content/rubric.ts`
  y como D59-D62 en `research/08-decision-log.md`.
- **La capa de juicio (L2) ya corre**, contra la llave del propio visitante, y
  toda cita que devuelve el modelo se ancla contra el texto por coincidencia
  literal antes de mostrarse. Una cita que no aparece en el texto se marca, no se
  descarta. Ver D59.
