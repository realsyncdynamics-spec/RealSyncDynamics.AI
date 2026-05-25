# Governance-Plattform — MVP Test-Harness

> **Zweck.** Reproduzierbar messen, ob die Governance-Pipeline
> (Detektor → Findings → Evidence → Report → Export) MVP-Reife hat.
> **Kein** Marketing-Test, **keine** abstrakte Bewertung — Pass/Fail
> kommt aus `vitest`-Assertions gegen einen fixierten Fixture-Satz.

| Datei | Rolle |
| --- | --- |
| `test/fixtures/governance-sites.json` | 6 simulierte Websites (5 mit definierten Risiken + 1 saubere Kontrolle), inkl. erwartete Findings, Kategorien, Severities und Evidence-Schema. |
| `test/governance-mvp.test.ts` | Vitest-Suite: simuliert Pipeline-Lauf, prüft Evidence/Report/Disclaimer/Export, misst Performance, vergleicht expected vs. actual mit FP/FN-Metrik. |
| `docs/testing/governance-platform-test-plan.md` | Dieser Plan: Ziel, Testdaten, Kriterien, Pass/Fail-Matrix, Metriken, nächste Schritte. |

Ausführen:

```bash
npm test -- governance-mvp
```

Exit-Code 0 ⇒ MVP-Contract erfüllt.

---

## 1 · Testziel

Der Test verifiziert die **Contracts**, gegen die echte Detektoren und
Pipeline-Komponenten laufen müssen, **bevor** die Plattform externe
Kunden bekommt:

1. Detektoren liefern Findings mit allen Pflichtfeldern
   (`tenant_id`, `scan_run_id`, `correlation_id`, `evidence_ref`, Zeitstempel).
2. `evidence_ref` ist parsebar (URL / sha256 / Storage / runtime-event),
   sha256-Hashes bestätigen den Quell-Content.
3. Der Report bündelt Findings korrekt: Score 0..100, Grade A–F, Top-N,
   Severity/Status/Kategorie-Breakdown — und enthält den Pflicht-Disclaimer
   „keine Rechtsberatung".
4. Export liefert valides JSON (round-trippable; PDF/Email bauen darauf auf).
5. Accuracy-Vergleich (expected vs. actual) detektiert False-Positives,
   False-Negatives und Severity-Drift zuverlässig.
6. Performance-Budget pro Stage wird eingehalten — pathologische
   Regressionen brechen den Test.

**Nicht in diesem Harness** (sondern in nachgelagerten e2e-Tests):

- Echte Edge-Function-Roundtrips gegen Supabase
- LM-Studio / AI-Gateway-Reachability (siehe `ai-gateway-smoke-test.md`)
- PDF-Renderer-Validierung (gehört in einen `@react-pdf/renderer`-Snapshot-Test)

---

## 2 · Testdaten

`test/fixtures/governance-sites.json` (Schema v1.0). Pro Site:

| Site | Risiko | erwarteter Detector | erwartete Severity | erwartete Kategorie | Anzahl Findings |
| --- | --- | --- | --- | --- | --- |
| `site-01-missing-privacy` | Fehlender Datenschutzlink | `gdpr-audit` | high | transparency | 1 |
| `site-02-pre-consent-tracker` | GTM lädt vor Consent + DPA-Lücke | `cookie-scanner` | critical / high | consent + tracker | 2 |
| `site-03-unknown-vendor` | Unbekannte Vendor-Domain | `cookie-scanner` | high | tracker | 1 |
| `site-04-ai-chatbot` | AI-Widget ohne Transparenz-Hinweis | `ai-act-classifier` | high | ai_act | 1 |
| `site-05-missing-impressum` | Impressum fehlt | `gdpr-audit` | high | transparency | 1 |
| `site-06-clean-control` | (Kontrolle, keine Risiken) | — | — | — | 0 |

Jeder erwartete Befund trägt **eines** von zwei Evidence-Schemata:

- **`url`** — externer Ref (`url:https://…`), Detector verweist auf die Quelle.
- **`sha256`** — content-addressed (`sha256:<64-hex>`), berechnet aus
  `evidence_source` der Fixture. Test rekonstruiert den Hash deterministisch
  und prüft Gleichheit.

Tenant-ID: `00000000-0000-4000-8000-00000000beef` (RFC-4122-konforme Test-UUID).

---

## 3 · Prüfkriterien

### 3.1 Evidence-Verifikation (`Evidence-Verifikation`)

| Kriterium | Assertion |
| --- | --- |
| `scan_run.id` ist UUID | `toMatch(/^[0-9a-f-]{36}$/i)` |
| `scan_run.tenant_id` gesetzt | gleich `FIXTURE.tenant_id` |
| `scan_run.correlation_id` gesetzt | UUID |
| `scan_run.started_at` + `completed_at` befüllt | `toBeTruthy()` |
| Jedes Finding trägt `tenant_id`, `scan_run_id`, `correlation_id` | `===` Lauf-IDs |
| Jedes Finding hat `evidence_ref` (≠ null, parsebar, kein `opaque`) | `parseEvidenceRef()` ≠ null |
| sha256-Evidenz hat 64-hex-Hash | `toMatch(/^[0-9a-f]{64}$/)` |
| sha256-Hash bestätigt Quelle | `=== sha256(evidence_source)` |

### 3.2 Report-Verifikation (`Report-Verifikation`)

| Kriterium | Assertion |
| --- | --- |
| Report wird gebaut | `buildReportPayload()` liefert Payload |
| Pflichtfelder vorhanden | `scan_run_id`, `tenant_id`, `score`, `grade`, `scanned_at` |
| Score in `[0,100]` | numerischer Bereich |
| Grade ∈ `{A,B,C,D,F}` | `toContain()` |
| Alle 5 Severity-Buckets gesetzt | auch bei 0 Findings |
| Top-N ≤ 10 und severity-absteigend sortiert | Rank-Vergleich |
| Disclaimer „keine Rechtsberatung" vorhanden | String-Match (de) |
| Export ist round-trip-fähiges JSON | `JSON.parse(JSON.stringify(…))` |
| Evidence-Catalog referenziert nur reale Finding-Ids | Set-Test |

### 3.3 Performance-Basics (`Performance-Basics`)

Pure-Logic-Stage-Budgets (großzügig, fangen pathologische O(n²)-Regressionen):

| Stage | Budget |
| --- | --- |
| Scan (Finding-Synthese) | < 200 ms |
| Record (in-memory Pipe) | < 50 ms |
| Report-Mapping | < 50 ms |
| JSON-Export | < 50 ms |
| Kumulativ alle 6 Sites | < 1 s |

> Reale Pipeline-Budgets (mit Supabase-Inserts, n8n-Trigger) gehören in
> einen separaten e2e-Test (Playwright), nicht hierher.

### 3.4 Accuracy (`Accuracy: expected vs actual`)

| Szenario | erwartetes Ergebnis |
| --- | --- |
| Ehrlicher Lauf vs. Fixture | 100 % match, 0 FP, 0 FN |
| Saubere Kontrollseite | 0 Findings, Score 100, Grade A |
| Detector emittiert Extra-Finding | FP = 1, FN = 0 |
| Detector lässt Finding fallen | FN = 1, FP = 0 |
| Detector ändert Severity (Drift) | FP = 1 + FN = 1 |

Die Metrik nutzt den Schlüssel `(category | severity | detector)` —
identisch zum erwarteten Detector-Output-Contract.

---

## 4 · Pass/Fail-Matrix

`describe('Pass/Fail-Matrix')` fasst alle Kriterien zu einer
Single-Source-of-Truth-Assertion zusammen. Eine Site fällt durch, wenn
**eines** der folgenden Kriterien verletzt ist:

- Finding-Count ≠ erwartet
- Pflichtfeld fehlt (`tenant_id`, `scan_run_id`, `evidence_ref`)
- `scan_run.severity_max` ≠ erwartet
- `report.score` ≠ pure-logic-Berechnung
- Disclaimer fehlt im Export
- FP oder FN ≠ 0

| Site | Evidence | Report | Disclaimer | Accuracy | Performance | Gesamt |
| --- | --- | --- | --- | --- | --- | --- |
| site-01-missing-privacy | Pass | Pass | Pass | Pass | Pass | **Pass** |
| site-02-pre-consent-tracker | Pass | Pass | Pass | Pass | Pass | **Pass** |
| site-03-unknown-vendor | Pass | Pass | Pass | Pass | Pass | **Pass** |
| site-04-ai-chatbot | Pass | Pass | Pass | Pass | Pass | **Pass** |
| site-05-missing-impressum | Pass | Pass | Pass | Pass | Pass | **Pass** |
| site-06-clean-control | Pass | Pass | Pass | Pass | Pass | **Pass** |

> Die Tabelle ist der **Soll-Zustand** für den Pure-Logic-Pfad. CI-Lauf
> aktualisiert sie nicht — wenn etwas hier auf Fail steht, ist es ein
> bekannter Defekt, der vor Merge behoben werden muss.

---

## 5 · Erwartete Findings (Detail)

### site-01-missing-privacy
- Detector `gdpr-audit` · severity `high` · category `transparency`
- Summary: „Datenschutzlink im Footer fehlt (Art. 13 DSGVO)."
- Evidence: `url:https://test-missing-privacy.example/#footer`

### site-02-pre-consent-tracker
- Detector `cookie-scanner` · severity `critical` · category `consent`
  - Summary: „Tracker (Google Tag Manager) feuert vor Consent-Banner — Verstoß gegen TTDSG §25."
  - Evidence: sha256 des `<script async src="…googletagmanager.com…">`-Tags
- Detector `cookie-scanner` · severity `high` · category `tracker`
  - Summary: „Drittvendor 'googletagmanager.com' geladen — fehlender DPA-Nachweis."
  - Evidence: `url:https://www.googletagmanager.com/gtag/js?id=G-XYZ`

### site-03-unknown-vendor
- Detector `cookie-scanner` · severity `high` · category `tracker`
- Summary: „Unbekannte Vendor-Domain 'unknown-analytics-vendor.io' — nicht im Vendor-Register."
- Evidence: `url:https://pixel.unknown-analytics-vendor.io/track.gif`

### site-04-ai-chatbot
- Detector `ai-act-classifier` · severity `high` · category `ai_act`
- Summary: „AI-Chatbot ohne sichtbare Transparenz-Kennzeichnung — Verstoß gegen EU AI Act Art. 50."
- Evidence: sha256 des Widget-`<div>`-Tags

### site-05-missing-impressum
- Detector `gdpr-audit` · severity `high` · category `transparency`
- Summary: „Impressum-Link fehlt im Footer — Verstoß gegen TMG §5 / DDG §5."
- Evidence: `url:https://test-missing-impressum.example/#footer`

### site-06-clean-control
- **Keine Findings erwartet.** `severity_max = null`, `score = 100`,
  `grade = A`. Dient als Negativ-Kontrolle gegen Detector-Halluzination.

---

## 6 · Metriken

Pro Lauf werden in der Suite gemessen:

- **`scan_ms`** — Zeit von Pipeline-Start bis alle Findings im Speicher
- **`record_ms`** — Pipeline-Stage „recordScanFinding" (in-memory: no-op)
- **`report_ms`** — `buildReportPayload()` (pure logic)
- **`export_ms`** — JSON-Envelope-Serialisierung (inkl. Disclaimer)
- Aggregat: kumulativer Lauf über alle 6 Sites

Schwellen siehe §3.3. Die Werte liegen typisch eine Größenordnung unter
Budget — Verstoß deutet auf Algorithmus-Regression (z. B. O(n·m)-Mapping
statt linear).

Zusätzlich pro Site:

- **`finding_count`** (ist == soll, sonst Fail)
- **`severity_max`** (ist == soll)
- **`score`** + **`grade`** (deterministisch aus Findings ableitbar)
- **`evidence_catalog.length`** (≤ `finding_count`, deduped)

---

## 7 · Nächste Verbesserungen

In aufsteigender Priorität:

1. **Erweitern um echte Detektor-Aufrufe.** Aktueller Harness simuliert
   den Detektor-Output. Folge-PR: `cookie-scan` und `gdpr-audit` gegen
   denselben Fixture-HTML-Sample-Satz laufen lassen und vergleichen.
   → neue Datei `test/edge/governance-mvp-detectors.test.ts` mit
   `runDetectorOnHtml(html)` als Adapter.
2. **Edge-Function-Roundtrip-Test.** Vitest-Suite, die gegen ein lokales
   Supabase-Profil (`scripts/test-db/up.sh`) tatsächlich Inserts + Reads
   durchführt — damit RLS-Regressionen sichtbar werden.
   → `npm run test:db -- governance-mvp-rls`
3. **PDF-Snapshot.** `audit-report-pdf` Edge Function gegen den
   ReportPayload jeder Site rendern, gegen Hash-Snapshot vergleichen.
4. **Performance-Profile (real).** Playwright-Lauf gegen Staging mit
   den Sites als statische Test-HTML auf einer Helper-Domain; messen
   p50/p95 für Scan + Report + Export inkl. Netz.
5. **AI-Detector-Drift.** Beim Hinzufügen neuer LLM-gestützter
   Detektoren (z. B. `ai-act-classifier-llm`): denselben Fixture-Satz
   einsetzen, Drift in Severity/Category gegen die Baseline tracken.
6. **Sub-Processor-Test-Set.** Weitere Fixtures für Stripe-, Sentry-,
   n8n-, LM-Studio-Vendor-Pfade — sobald diese als Findings auftauchen
   können (Sub-Processor-Notify, AI-Act-Annex-III, etc.).
7. **Accuracy-Schwellen pro Detector.** Sobald echte Detektoren laufen:
   pro Detector min. Precision/Recall in den Test einziehen, statt nur
   binärer Pass/Fail.
8. **Konsolidierter CI-Report.** GitHub Action ruft `npm test -- governance-mvp`
   + parse-Junit → kommentiert PR mit Pass/Fail-Matrix.

---

## 8 · Änderungs-Disziplin

- **Fixtures sind Vertrag.** Neue Detector-Regel ⇒ neue Site **oder**
  neue erwartete Findings in bestehender Site **vor** dem Code-Merge.
- **Keine erwarteten Werte stillschweigend lockern.** Wenn ein Test
  fehlschlägt, weil sich Realität geändert hat: Begründung im PR, dann
  Fixture aktualisieren — niemals Assertion abschalten.
- **Schemata bleiben rückwärtskompatibel.** Erhöhung des
  `$schema_version`-Felds nur, wenn das Fixture-JSON bricht; sonst
  additiv erweitern (neue Felder, alte bleiben gültig).
