# Golden Dataset Plan — RealSyncDynamics.AI

**Erstellt:** 2026-05-26
**Modus:** Plan ohne Implementierung. Ziel: kontrollierte Test-Surfaces, gegen die jeder Detection-Run reproduzierbar dieselben Findings produziert. Keine Live-Scanner-Aufrufe.

---

## 1. Warum ueberhaupt ein Golden Dataset?

Das Repo hat einen Scanner (`services/playwright-scanner`) und eine Edge-Function (`supabase/functions/cookie-scan`) mit ~58 hardcoded Tracker-Patterns plus Privacy-Analytics- und CMP-Listen. Ob diese Detection-Logik *stabil* ist, ist heute nicht ueberpruefbar:

- Es gibt keine Test-Fixtures pro Tracker-Pattern
- Es gibt keine erwarteten Outputs pro Test-URL
- `test/contracts/audit-contract.test.ts` testet das Daten-Schema, nicht die Detection-Qualitaet
- Aenderungen an `TRACKER_PATTERNS` (z.B. neuer Tracker, geaendertes RegEx) koennen unbemerkt Regressions verursachen

Ein Golden Dataset macht jedes Detection-Update messbar: vorher/nachher-Diff der Findings ueber alle Test-Surfaces.

---

## 2. Minimaler Datensatz fuer v1

Drei kontrollierte HTML-Surfaces, alle als statische Files im Repo gepflegt — keine Abhaengigkeit zu externen URLs (die sich aendern koennen).

### 2.1 `test/fixtures/golden/control-clean/`

Saubere Kontrollseite ohne Tracker, ohne Cookies, ohne CMP. Erwartete Detection: 0 Findings.

| Datei | Inhalt |
|---|---|
| `index.html` | Minimal-HTML, nur eigene CSS/JS, `Content-Security-Policy: default-src 'self'` |
| `expected.json` | `{ trackers: [], cookies: [], privacy_analytics: [], score: 100, severity: "pass" }` |
| `README.md` | Was diese Surface bewusst NICHT enthaelt |

### 2.2 `test/fixtures/golden/risk-pre-consent-tracker/`

DSGVO-Risikoseite: laedt Google Analytics + Meta Pixel bevor ein Consent gesetzt wurde, hat kein CMP. Erwartete Detection: ≥ 2 Findings (`pre_consent_tracker` schwere `high`).

| Datei | Inhalt |
|---|---|
| `index.html` | `<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX">` und `fbq('init', '...')` direkt im `<head>` |
| `expected.json` | Liste der erwarteten Tracker-IDs + Severities + erwartete `evidence_level` |
| `README.md` | Welche Regel(n) hier ausloesen sollen |

### 2.3 `test/fixtures/golden/edge-case-cmp-without-block/`

Edge-Case: Seite hat zwar ein CMP geladen (z.B. Cookiebot-Snippet), aber das CMP blockt Tracker nicht — d.h. der GA-Tag laeuft trotzdem pre-consent. Erwartete Detection: Tracker-Finding bleibt bestehen, CMP-Presence ist Bonus-Information aber neutralisiert das Finding nicht.

| Datei | Inhalt |
|---|---|
| `index.html` | Cookiebot-Snippet + GA-Tag, beide unconditional geladen |
| `expected.json` | Tracker-Finding + `cmp_present: true` + `cmp_effective: false` |
| `README.md` | Warum das die haeufige Fehl-Annahme ist („Cookiebot ist drauf, also OK") |

---

## 3. Schema einer `expected.json`

Vorlage, damit alle drei Surfaces dieselbe Struktur haben — Reviewer kann auf einen Blick „Diff" lesen:

```json
{
  "fixture_id": "risk-pre-consent-tracker",
  "fixture_version": "1.0.0",
  "expected_findings": [
    {
      "rule_id": "pre_consent_tracker",
      "rule_version": "1.0.0",
      "severity": "high",
      "tracker_id": "google_analytics",
      "evidence_level": "observed",
      "verification_status": "verified",
      "confidence_score": 0.95
    },
    {
      "rule_id": "pre_consent_tracker",
      "rule_version": "1.0.0",
      "severity": "high",
      "tracker_id": "meta_pixel",
      "evidence_level": "observed",
      "verification_status": "verified",
      "confidence_score": 0.95
    }
  ],
  "expected_score_range": [0, 30],
  "expected_severity": "critical",
  "expected_report_fields": {
    "trackers_loaded_pre_consent": 2,
    "consent_manager_detected": false,
    "consent_manager_effective": false
  }
}
```

Die Felder `evidence_level`, `verification_status`, `confidence_score`, `rule_version` referenzieren das Confidence/Evidence-Model — siehe `docs/product/confidence-evidence-model.md`. Falls dieses Modell noch nicht im Schema persistiert ist, koennen diese Felder vorerst leer bleiben.

---

## 4. Wie Tests ausgefuehrt werden — Vorschlag

(Implementierung gehoert nicht in diesen PR — das hier ist nur das Soll-Design.)

Variante A: Vitest gegen den Detection-Code direkt, statische Fixture-HTML als Eingabe.

```ts
import { detectTrackers } from '../../../services/playwright-scanner/src/scanner.ts';
import { readFile } from 'node:fs/promises';
import expected from './fixtures/golden/risk-pre-consent-tracker/expected.json';

test('risk-pre-consent-tracker matches expected findings', async () => {
  const html = await readFile('test/fixtures/golden/risk-pre-consent-tracker/index.html', 'utf8');
  const result = detectTrackers(html);

  expect(result.trackers.length).toBeGreaterThanOrEqual(2);
  expect(result.score).toBeLessThanOrEqual(expected.expected_score_range[1]);

  for (const ef of expected.expected_findings) {
    const actual = result.trackers.find((t) => t.id === ef.tracker_id);
    expect(actual, `tracker ${ef.tracker_id} not detected`).toBeDefined();
    expect(actual.severity).toBe(ef.severity);
  }
});
```

Variante B: Playwright serviert die Fixtures als localhost-HTTP, dann laeuft der Scanner end-to-end gegen `http://127.0.0.1:<port>/risk-pre-consent-tracker/`. Hoeherer Realismus, langsamer.

Variante A reicht fuer v1 — die Detection-Logik arbeitet auf HTML-String-Patterns, nicht auf gerenderten DOMs.

---

## 5. Was ein Golden-Run nachweist (und was nicht)

**Nachweis:**

- Detection-Engine erkennt die deklarierten Tracker
- Score liegt im erwarteten Bereich
- Severities sind stabil
- Bei einem zukuenftigen `confidence_score`-Feld: liegt im erwarteten Range

**Kein Nachweis:**

- Vollstaendigkeit der Detection ueber alle echten Websites
- Rechtliche Bewertung der Findings
- Korrektheit der EU-AI-Act- oder DSGVO-Interpretation

→ Sprache in Reports: „im aktuellen Scan erkannt", nicht „garantiert vollstaendig".

---

## 6. Pflege-Pfad

| Anlass | Was passiert |
|---|---|
| Neuer Tracker in `TRACKER_PATTERNS` | Neue Fixture in `test/fixtures/golden/` mit Single-Tracker-HTML + `expected.json`. CI-Test schlaegt fehl, wenn Detection nicht greift |
| `rule_version` bumped | `expected.json` ggf. anpassen — Diff im PR macht Aenderung sichtbar |
| Falsche Detection in Produktion entdeckt | Erst Fixture nachbauen (Bug-Reproduktion), dann Detection-Fix, dann Fixture als Regression-Test |

---

## 7. Out-of-Scope fuer dieses Dokument

- Implementierung der Fixtures (separater PR, nach Operator-Stabilisierung)
- Implementierung des Confidence/Evidence-Schemas (siehe `confidence-evidence-model.md`)
- CI-Workflow-Aenderungen
- Erweiterung der Detection-Regeln

Dieses Dokument ist Plan, kein Code.
