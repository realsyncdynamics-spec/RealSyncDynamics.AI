# Skill Registry

## Zweck

Die Skill Registry ist die zentrale Liste der LLM-Skill-Profile, die in
RealSyncDynamics.AI verfuegbar sind. Jeder Eintrag definiert:

- **Triggers** (Keywords/Phrasen) fuer das Routing
- **Use-Cases** als deklarierte Einsatzgebiete
- **Guardrails** (verbindliche Output-Regeln)
- **Risiko-Klasse** (low / medium / high)
- Flags fuer `requiresWebResearch`, `requiresUserData`, `reviewRequired`

Es gibt **kein** automatisches Ausfuehren in dieser PR. Die Registry plus
Router plus Prompt-Builder bilden den Vorbau einer spaeteren Agent-Runtime.
Skills selbst sind reine TypeScript-Helper unter `src/lib/skills/<key>.ts`.

## Aktuelle Skills

| Key                                 | Risiko | Web | UserData | Review |
| ----------------------------------- | ------ | --- | -------- | ------ |
| `data-exploration`                  | medium | -   | x        | -      |
| `finance-audit-support`             | high   | -   | x        | x      |
| `legal-compliance`                  | high   | x   | -        | x      |
| `legal-contract-review`             | high   | -   | x        | x      |
| `marketing-performance-analytics`   | low    | -   | x        | -      |
| `sales-call-prep`                   | medium | x   | x        | -      |
| `sales-draft-outreach`              | medium | x   | x        | x      |

Bewusst **nicht** dupliziert: `cx-ticket-triage` (lebt in einer separaten
Initiative ausserhalb dieser Registry).

## Routing

`src/lib/skills/router.ts` exportiert `routeSkill(input)`:

```ts
const r = routeSkill('Berechne CTR und ROAS der letzten Kampagne');
// → { selectedSkill: 'marketing-performance-analytics',
//     confidence: 0.x, reason, candidates, requiresWebResearch,
//     riskLevel, guardrails }
```

Das Routing ist eine reine Keyword/Phrase-Heuristik. **Kein LLM-Call, kein
externer Roundtrip** — der Router laeuft synchron, deterministisch und ist
in Tests fixierbar.

## Guardrails

Wiederverwendete Guardrails sind als Konstanten in `registry.ts` definiert:

- `NO_LEGAL_OPINION` — Legal-Skills liefern keine Rechtsberatung.
- `NO_AUDIT_OPINION` — Finance/Audit-Skill liefert keine Pruefungsmeinung.
- `NO_AUTO_SEND` — Outreach-Drafts werden niemals automatisch versendet.
- `NO_FABRICATED_FACTS` — Sales-Skills duerfen keine Firmen-/Personenfakten
  erfinden; Unbekanntes wird als Hypothese markiert.
- `BENCHMARKS_ORIENTATION` — Marketing-Benchmarks sind nur Orientierung.
- `NO_RAW_SENSITIVE_DATA` — Data-/Audit-/Legal-Skills wiederholen keine
  sensiblen Rohdaten im Output; Aggregate/Hashes bevorzugen.

Der `promptBuilder` haengt alle Guardrails des gewaehlten Skills explizit
in den System-Prompt und markiert `reviewRequired`.

## Warum Legal/Finance nicht autonom handeln

Skills der Klasse `high` sind ausnahmslos `reviewRequired = true`. Sie:

- erstellen Checklisten und Strukturhilfen
- klassifizieren Befunde/Klauseln nach Schweregrad
- empfehlen Stichprobengroessen als **Faustwerte**

Sie **liefern keine** Rechts- oder Audit-Meinung, schreiben keine
Schriftsaetze und versenden nichts. Der menschliche Reviewer ist
verbindlicher Bestandteil des Workflows.

## API

`supabase/functions/skills/`:

- `GET /functions/v1/skills` → `{ ok: true, skills: SkillDef[] }`
- `POST /functions/v1/skills`, Body `{ input: string }` →
  `{ ok: true, selectedSkill, confidence, reason, requiresWebResearch,
     riskLevel, candidates, guardrails }`

Edge-Function dupliziert die Registry bewusst (Edge-Functions koennen nicht
aus `src/` importieren). Der Router-Algorithmus ist identisch und durch
Tests gespiegelt.

## UI

`/skills` rendert die Registry inkl. Badges (`Web Research`, `User Data`,
`High Risk`, `Review Required`), Suchfeld und Router-Testfeld mit
Prompt-Vorschau. Die UI fuehrt keine Skills aus.

## Tests

- `test/skills/registry.test.ts` — Vollstaendigkeit, Pflichtfelder,
  Risiko-→-Review-Invariante, Anwesenheit der jeweiligen Guardrails.
- `test/skills/router.test.ts` — Routing fuer jeden Skill ueber min. einen
  Trigger; Konfidenzberechnung.
- `test/skills/promptBuilder.test.ts` — Prompt enthaelt Label + alle
  Guardrails; Review-Hinweis bei `reviewRequired`.
- `test/skills/pureFunctions.test.ts` — Smoke + Invarianten der reinen
  Helper-Funktionen.
- `scripts/qa-skills-smoke.ts` — End-to-End-Smoke der oberen Schichten,
  ausfuehrbar via `npm run qa:skills`.

## Marketing-Runtime-Binding

Der Skill `marketing-performance-analytics` haengt nicht nur an reinen
KPI-Formeln, sondern bindet die Marketing-Analytics-Runtime
(`src/core/marketing-analytics/`) direkt ein:

- `prepareMarketingEvent(event)` — wendet `sanitizeMetadata` an und setzt
  Defaults (Currency, occurred_at) bevor ein Event in die Agents fliesst.
- `detectKpiAnomaly(values)` — duenne Bruecke auf `detectAnomaly`, fuer
  Tagesmetriken im Skill-Kontext.
- `runComplianceDrift(events)` — `ComplianceDriftAgent` mit auto-sanitisierten
  Events; ergaenzt die Standard-Skill-Guardrail (`BENCHMARKS_ORIENTATION`).
- `runRevenueAttribution(events, model, from, to)` — `RevenueAttributionAgent`
  mit defensiv validiertem Modell.
- `buildMarketingAnalyticsReport(events, model, from, to, optimizations)` —
  high-level Orchestrator: Attribution + Compliance-Drift + priorisierte
  Optimierungen + Skill-Guardrail in einem Aufruf.

Der `ComplianceDriftAgent` liefert weiterhin sein eigenes
`COMPLIANCE_DISCLAIMER` ("Keine Rechtsberatung"). Das Skill-Binding
ueberschreibt es nicht und ergaenzt nur die marketing-spezifische
Benchmarks-Guardrail.

## Spaetere Erweiterung zur Agent-Runtime

Diese Registry ist absichtlich Daten + reine Funktionen + Routing. Die
spaetere Agent-Runtime (siehe Phase 1.1, PR #190) bindet Skills ueber den
Executor an Approval-Gates: Risiko `high` → automatisch Approval-Gate;
`requiresUserData` → Audit-Trail-Pflicht; `reviewRequired` → Output landet
zuerst im Draft-State, nie direkt im Versand.
