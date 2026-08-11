# 16 — Test Coverage

## 1. Bestand

```
$ npm test
 Test Files  226 passed | 20 skipped (246)
      Tests  2867 passed | 104 skipped | 96 todo (3067)
   Duration  144.66s
```

```
$ npm run lint      # tsc --noEmit, strict
 exit 0
```

| Art | Anzahl | Läuft in CI |
|---|---|---|
| Vitest-Unit/Integration | 2867 | ✅ `ci.yml` |
| **DB-Tests (`test/runtime/db/`)** | **18 Dateien** | ❌ **nein** |
| Playwright — Katalog-Suite (`tests/e2e/`) | **9 Specs** | ✅ `e2e.yml` |
| **Playwright — App-Suite (`e2e/`)** | **38 Specs** | ❌ **nein** |
| Migrations-Validierung | ✅ | ✅ `ci.yml` (append-only-Prüfung) |
| Edge-Function-Syntax | ✅ | ✅ `ci.yml` |
| Edge-Function-Drift | ⚠️ | ✅ aber **stiller No-op** (F-06) |
| Pricing-Parität | ✅ | nicht in `ci.yml` |

---

## 2. Die entscheidende Lücke

Playwright läuft in CI — aber nur zur Hälfte. `e2e.yml` führt `npm run test:e2e`
aus, das über `playwright.catalog.config.ts` ausschließlich `tests/e2e/` abdeckt:
**9 Specs** gegen einen lokalen Preview-Build (öffentliche Routen, Navigation,
Consent, Checkout, AI-Act, Audit, Rechtstexte, Fehlerbehandlung). Das ist eine
ordentliche Absicherung der öffentlichen Oberfläche — der Consent-Test arbeitet
sogar mit Dummy-Pixel-IDs, damit das Gating scharf gemessen wird statt trivial
zu bestehen.

**Nicht abgedeckt sind die 38 Specs in `e2e/`** (`npm run e2e`,
`playwright.config.ts`) — genau die App-interne Suite: `governance-workflow`,
`governance-memory`, `governance-evidence`, `evidence-vault-export`,
`provenance-external-verification`, `workspace`, `tenant-admin`, `onboarding`,
`api-endpoints`, `api-webhook-management`, `feature-oauth2-api`,
`partners`, `phase2`–`phase6`. Diese Suite prüft die authentifizierten Module,
also exakt jene Funktionalität, die laut F-01 in Produktion fehlt.

Dazu die Tests, die die Sicherheitsinvarianten prüfen — sie **existieren bereits**
und laufen in keinem Workflow:

| Datei | Prüft |
|---|---|
| `test/runtime/db/rls.db.test.ts` | **Tenant-Isolation** |
| `test/runtime/db/hash-chain.db.test.ts` | Kettenintegrität |
| `test/runtime/db/hash-chain-corruption.db.test.ts` | Manipulationserkennung |
| `test/runtime/db/append-only.db.test.ts` | UPDATE/DELETE-Ablehnung |
| `test/runtime/db/entitlement-grants.db.test.ts` | **Berechtigungen (F-03)** |
| `test/runtime/db/cost-caps.db.test.ts` | Kostengrenzen |
| `test/runtime/db/subject-ref.db.test.ts` | Pseudonymisierung |
| `test/runtime/db/replay-cursor.db.test.ts` | Event-Replay |
| `test/runtime/db/partitioning.db.test.ts` | Partitionierung |
| + 9 weitere | |

`grep -rn 'test:db\|runtime/db\|TEST_DB_URL' .github/workflows/` → **keine Treffer**

Die Infrastruktur ist da (`scripts/test-db/up.sh`, `npm run test:db`). Es fehlt der
CI-Job. Das ist die **billigste große Verbesserung** im gesamten Audit: ein
Workflow-Block von ~15 Zeilen aktiviert 18 Sicherheitstests, ein zweiter die
38 App-E2E-Specs.

---

## 3. Ungetestete kritische Pfade

| Pfad | Testabdeckung |
|---|---|
| Öffentliche Routen, Consent, Checkout-Einstieg, Rechtstexte | ✅ `tests/e2e/` läuft in CI |
| Authentifizierte Module (Governance, Evidence, Workspace, API) | ⚠️ 38 Specs vorhanden, laufen nicht |
| Authentifizierung der Edge Functions | ❌ **kein Test prüft „`Bearer invalid` → 401"** — deshalb blieb F-04 unentdeckt |
| Autorisierung (Tenant A → Tenant B über Functions) | ❌ |
| RLS-Vollständigkeit („jede Tabelle hat RLS") | ❌ — ein Einzeiler hätte alle 35 aus F-08 gefunden |
| Policy-Rollenbindung (`USING(true)` ohne `TO`) | ❌ — hätte F-09 gefunden |
| Deployment-Parität Repo ↔ Produktion | ⚠️ vorhanden, aber No-op (F-06) — hätte F-01 gefunden |
| Stripe-Webhook Cross-Tenant | ❌ |
| Evidenz-Löschung / Wiederherstellung | teilweise |
| Export-Vollständigkeit | teilweise |
| KI-Agent-Tool-Grenzen | ❌ |
| API-Key-Lebenszyklus | teilweise |
| Admin-Funktionen | ❌ |

---

## 4. Geforderte Sicherheitsinvarianten

| Invariante | Test vorhanden | Läuft |
|---|---|---|
| „Tenant A erreicht nie Tenant B" | ✅ `rls.db.test.ts` | ❌ |
| „Pixel feuern nicht vor Consent" | ✅ `tests/e2e/consent.spec.ts` | ✅ |
| „Nicht-Admin kann keine Admin-Aktion" | ❌ | — |
| „Gelöschte Evidenz kann nicht still neu entstehen" | ✅ `append-only.db.test.ts` | ❌ |
| „Stripe-Webhook kann keinen fremden Tenant ändern" | ❌ | — |
| „Service-Role gelangt nie in den Browser" | ❌ (statisch verifiziert: sauber) | — |
| „Jede Public-Tabelle hat RLS" | ❌ | — |
| „Jede Edge Function authentifiziert" | ❌ | — |

---

## 5. Bewertung

**Testing: 58/100.**

Menge und Qualität der geschriebenen Tests sind gut — 2867 grüne Unit-Tests, eine
in CI laufende Playwright-Katalog-Suite für die öffentliche Oberfläche, saubere
Struktur und echte DB-Tests für die schwierigen Invarianten.

Das Problem ist die **Ausführung des schwierigen Teils**: die 18 DB-Sicherheitstests
und die 38 App-internen E2E-Specs laufen in keinem Workflow, und kein Test deckt die
Authentifizierungsschicht der Edge Functions ab — deshalb konnte F-04 unentdeckt
bleiben.

Ein grünes CI hat hier über Monate mehr Sicherheit suggeriert, als tatsächlich
geprüft wurde.
