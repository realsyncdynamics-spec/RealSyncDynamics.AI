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
| **Playwright E2E** | **47 Specs** | ❌ **nein** |
| Migrations-Validierung | ✅ | ✅ `ci.yml` (append-only-Prüfung) |
| Edge-Function-Syntax | ✅ | ✅ `ci.yml` |
| Edge-Function-Drift | ⚠️ | ✅ aber **stiller No-op** (F-06) |
| Pricing-Parität | ✅ | nicht in `ci.yml` |

---

## 2. Die entscheidende Lücke

Die Tests, die genau die Sicherheitsinvarianten prüfen, um die es in diesem Audit
geht, **existieren bereits** — und laufen in keinem Workflow:

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

`grep -rln 'test:db' .github/workflows/` → **keine Treffer**
`grep -rln 'playwright test' .github/workflows/` → **keine Treffer**

Die Infrastruktur ist da (`scripts/test-db/up.sh`, `npm run test:db`). Es fehlt der
CI-Job. Das ist die **billigste große Verbesserung** im gesamten Audit: ein
Workflow-Block von ~15 Zeilen aktiviert 18 Sicherheitstests und 47 E2E-Specs.

---

## 3. Ungetestete kritische Pfade

| Pfad | Testabdeckung |
|---|---|
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
| „Nicht-Admin kann keine Admin-Aktion" | ❌ | — |
| „Gelöschte Evidenz kann nicht still neu entstehen" | ✅ `append-only.db.test.ts` | ❌ |
| „Stripe-Webhook kann keinen fremden Tenant ändern" | ❌ | — |
| „Service-Role gelangt nie in den Browser" | ❌ (statisch verifiziert: sauber) | — |
| „Jede Public-Tabelle hat RLS" | ❌ | — |
| „Jede Edge Function authentifiziert" | ❌ | — |

---

## 5. Bewertung

**Testing: 55/100.**

Menge und Qualität der geschriebenen Tests sind gut — 2867 grüne Tests, saubere
Struktur, echte DB-Tests für die schwierigen Invarianten. Das Problem ist
ausschließlich die **Ausführung**: Die anspruchsvollsten Tests laufen nie, und die
vorhandenen decken die Authentifizierungsschicht der Edge Functions nicht ab.

Ein grünes CI hat hier über Monate Sicherheit suggeriert, die nicht geprüft wurde.
