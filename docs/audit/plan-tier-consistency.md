# Audit: Plan-Tier-Konsistenz

Stand: 2026-06-15 · Nur Recherche, keine Code-Änderungen.

## Zusammenfassung

Im Code existieren **drei parallele, teilweise inkompatible Tier-Namensschemata**, plus ein
separates Tier-System für Website-Rebuilds. Die Datenbank enthält Entitlement-Bindings für
**alle** Schemata gleichzeitig (additiv migriert, nichts entfernt). Der kritischste Fund:
`automationSkills.ts` nutzt für 5 von 6 Skills Tier-Namen, die im aktuellen
Marketing-/Billing-Schema gar nicht mehr existieren.

## Die Schemata

| Schema | Tier-Liste | Quelle | Status |
|---|---|---|---|
| **A — Marketing/SaaS (kanonisch)** | `free, starter, growth, agency, scale, enterprise` | `src/config/pricing.ts` (Type `TierId`), `src/lib/billing/planAccess.ts` (`PlanKey = TierId`) | Aktiv, von Pricing-Seite + Feature-Matrix + Tests verwendet |
| **B — Legacy C2PA/Provenance** | `free, bronze, silver, gold, enterprise_public` | `src/core/billing/types.ts` (`PlanKey`), `src/core/billing/plan-config.ts` (`PLAN_CONFIG`) | Legacy, sollte abgelöst werden |
| **C — MVP/Chat (hardcoded)** | `free, bronze, silver, gold, platinum` | `src/core/auth/entitlements.ts` (`PlanLevel`), `currentPlan` hardcoded auf `'gold'` (Z. 42) | Legacy/MVP, eigene Feature-Liste |
| **D — Website-Rebuild** | `managed, premium, enterprise` | `supabase/functions/checkout-website-rebuild/index.ts` (`TIER_PLAN_KEY`, Z. 46–50) | Separates Produkt, kein Konflikt mit A–C |

## Kritischer Fund: `automationSkills.ts` nutzt Schema B-Namen

`src/content/automationSkills.ts` — `planRequired`-Werte pro Skill:

| Zeile | Skill | `planRequired` | Schema |
|---|---|---|---|
| 64 | DSGVO Audit Skill | `'free'` | A ✓ (gültig in beiden) |
| 80 | Dokumenten Skill | `'bronze'` | B — **existiert nicht in Schema A** |
| 97 | Meeting Compliance Skill | `'silver'` | B — **existiert nicht in Schema A** |
| 115 | Screenshot Feedback Skill | `'silver'` | B — **existiert nicht in Schema A** |
| 132 | Lead Risk Skill | `'bronze'` | B — **existiert nicht in Schema A** |
| 149 | Support Skill | `'gold'` | B — **existiert nicht in Schema A** |

→ 5 von 6 Skills referenzieren Tiers, die im kanonischen Pricing (`pricing.ts`,
`planAccess.ts`) nicht definiert sind. Je nachdem, gegen welches Schema die UI die
Freischaltung prüft, werden Skills für alle Nutzer entweder fälschlich gesperrt oder
fälschlich freigegeben.

## Feature-Gate-Hierarchien

**`src/lib/billing/planAccess.ts`** (Schema A, kanonisch) — Vererbungskette:
```
free       → (isoliert)
starter    → (isoliert)
growth     → erbt starter
agency     → erbt growth (+ starter)
scale      → erbt agency (+ growth, starter)
enterprise → erbt agency (+ growth, starter) — NICHT scale
```

**`src/core/auth/entitlements.ts`** (Schema C, MVP/Legacy) — eigene Feature-Liste
(`use_chat_basic`, `use_extension`, `use_c2pa_assets`, `use_workflows`, `use_byo_api_keys`),
`currentPlan` ist hardcoded auf `'gold'` (Zeile 42) — unabhängig vom echten Plan des Nutzers.

## Datenbank (Supabase Migrations)

- `20260430200000_entitlements_normalization.sql` (Z. 148–226): seedet Schema-B-Plan-Keys
  (`free, bronze, silver, gold, enterprise_public`) inkl. Entitlement-Bindings.
- `20260618000000_pricing_tier_alignment.sql` (Z. 48–162): seedet zusätzlich Schema-A-Plan-Keys
  (`starter, growth, agency, scale, enterprise`) — **additiv**, Schema B wurde nicht entfernt.

→ `public.products.default_for_plan_key` enthält aktuell **9 Plan-Keys** parallel
(`free`, `bronze`, `silver`, `gold`, `enterprise_public`, `starter`, `growth`, `agency`,
`scale`, `enterprise` — Achtung: 10 gezählt, `free` zählt nur einmal).

## Stripe-Mapping

`src/core/billing/stripe-mapping.ts` (Z. 2–17) enthält Price-IDs nur für:

| Plan-Key | Stripe Price-ID |
|---|---|
| `free_audit` | `price_1TVbcMCNKcHrCAICoX7QYcxA` |
| `starter` | `price_1TVbdCCNKcHrCAICUiJEMfyf` |
| `growth` | `price_1TVbdbCNKcHrCAICBr5X3NmN` |
| `agency` | `price_1TVbduCNKcHrCAICT0IYHOmB` |

→ **`scale` (1.999€) und `enterprise` haben keinen Stripe-Price-Eintrag.** Scale-CTA geht
laut Pricing-Audit ohnehin auf `/contact-sales?tier=scale` (manuell), aber sobald
Self-Serve-Checkout für Scale kommt, fehlt hier das Mapping.

`stripe-checkout` Edge Function (`supabase/functions/stripe-checkout/index.ts`) ist generisch
und akzeptiert beliebige `plan_key`-Strings, solange ein passender `products`-Eintrag mit
`default_for_plan_key` existiert (Z. 97) — sie würde also auch `bronze`/`silver`/`gold`
"funktionierend" durchlassen, weil diese DB-Einträge noch existieren.

## Test-Befunde

- `test/contracts/audit-contract.test.ts` prüft `PRICING_TIERS.ids` gegen
  `['agency', 'enterprise', 'free', 'growth', 'scale', 'starter']` (Schema A) ✓
- `test/lib/planAccess.test.ts` testet ausschließlich Schema A — **keine Tests für
  bronze/silver/gold**, der Mismatch in `automationSkills.ts` wird also nicht durch CI erfasst.

## Kollisions-Tabelle (Priorität)

| Datei | Zeile(n) | Problem | Schwere |
|---|---|---|---|
| `src/content/automationSkills.ts` | 80, 97, 115, 132, 149 | `planRequired` nutzt Schema-B-Namen (bronze/silver/gold), kanonisches Schema A kennt diese nicht | **CRITICAL** |
| `src/core/billing/types.ts` | 1–6 | `PlanKey`-Type definiert Schema B statt Schema A | **HIGH** |
| `src/core/billing/stripe-mapping.ts` | 1–17 | Kein Mapping für `scale`, `enterprise` | **HIGH** |
| `src/core/auth/entitlements.ts` | 1–53 | Eigenes Schema C, `currentPlan` hardcoded `'gold'`, unabhängige Feature-Liste | **MEDIUM** |
| Supabase `products` Tabelle | — | 9–10 Plan-Keys aus 2 Schemata parallel aktiv | **MEDIUM** |

## Offene Fragen für Entscheidung (nicht in diesem Audit beantwortet)

1. Ist Schema B/C (`src/core/billing/*`, `src/core/auth/entitlements.ts`) bereits totes Code
   oder wird es noch von aktiven Features (C2PA/Provenance, Chat/Workflows) genutzt?
2. Soll das Mapping für `automationSkills.ts` lauten: `bronze → starter`, `silver → growth`,
   `gold → agency` (wie in der vorherigen Analyse vorgeschlagen)? Das ist eine inhaltliche
   Entscheidung (welcher Skill soll ab welchem Paket verfügbar sein), keine reine
   Umbenennung.
3. Sollen die Legacy-Plan-Keys (`bronze`, `silver`, `gold`, `enterprise_public`) aus der
   DB entfernt/migriert werden, oder bleiben sie für bestehende Bestandskunden nötig?
