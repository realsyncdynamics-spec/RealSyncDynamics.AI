# Produkt- und Pricing-Governance

Verbindliche Regeln für Preise, Pläne, Module und Berechtigungen.
Diese Seite beschreibt, **wo** die Wahrheit steht — nicht, welche Zahlen
gelten. Die Zahlen stehen ausschließlich in der Quelle.

## Positionierung

RealSyncDynamics.AI ist eine **AI Governance Runtime** für Unternehmen,
Agenturen, MSPs und Enterprise-Kunden.

Nicht: Datenschutz-Tool, DSGVO-Generator, Cookie-Scanner, Website-Checker.
Texte, Komponenten, APIs und Dashboards müssen diese Positionierung tragen.

## Single Source of Truth

```
shared/pricing.ts          ← die einzige Quelle
├── src/config/pricing.ts                          (Frontend-Projektion)
├── supabase/functions/_shared/pricing.generated.ts (Deno-Zwilling, generiert)
└── supabase/migrations/*_canonical_plan_catalog.sql (DB-Katalog, generiert)
```

`shared/pricing.ts` definiert:

- Plan-Namen, Plan-Keys und Reihenfolge
- Preise (monatlich und jährlich)
- Runtime-Limits (Bots, Antworten, Domains, Kanäle, Automation-Runs, Sitze,
  API-Aufrufe, Mandanten, Evidence-Speicher, Audit-Berichte, Bulk-Jobs)
- Modul-Freischaltungen je Produktbereich
- Berechtigungen (`permissions`)
- Feature-Listen, gegliedert in vier Gruppen
- Add-ons
- Runtime-Pipeline und Planempfehlung

Die Datei hat **keine Imports** und läuft unverändert in Browser, Node,
Vitest und Deno. Ein Portabilitätsschutz im Generator erzwingt das.

## Produktarchitektur

Drei Bereiche, definiert in `PRODUCT_AREAS`:

| Bereich      | Inhalt |
|--------------|--------|
| **GOVERN**   | DSGVO, EU AI Act, NIS2, DORA, ISO 27001, TISAX, Policy Engine, Evidence Vault, Audit Center, Risk Register, Monitoring, Compliance Reports |
| **AUTOMATE** | Scheduler, Workflows, n8n, Kodee, Bulk Jobs, Automation Engine, Alerts, Drift Detection, Remediation, Background Jobs |
| **ENGAGE**   | AI Bots, Voice, WhatsApp, Telegram, Website Chat, API, Webhooks, Human Handoff, Multi Channel Messaging |

## Pläne

### Abo-Leiter — genau sechs Pläne, in dieser Reihenfolge (`PLAN_ORDER`)

`free` · `starter` · `growth` · `agency` · `enterprise` · `partner`

Andere Abo-Namen sind unzulässig. Insbesondere existiert **kein Plan
„Scale"** mehr — er heißt seit dem Governance-Refactoring `partner`.
Bestandsdaten werden über `normalizePlanKey()` abgebildet; die Migration
`20260802001000_canonical_plan_catalog.sql` stellt die DB-Zeilen um.

### Einmalprodukte (`purchaseMode: 'one_time'`)

`governance_launch` — Governance Launch, 349 € einmalig.

Einmalprodukte sind **kein Rang der Abo-Leiter**. Sie stehen deshalb nicht
in `PLAN_ORDER` / `ORDERED_PLANS`, sondern in `ONE_TIME_PLANS`
(`ALL_PLANS_ORDERED` enthält beides). Konkret gilt:

| Aspekt | Verhalten |
|---|---|
| Preis | in `price.oneTimeEur`; `price.monthlyEur` ist 0, weil nichts wiederkehrend abgerechnet wird |
| `planRank()` | `-1` — nicht auf der Leiter |
| `isUpgrade()` | immer `false`, in beide Richtungen (unvergleichbar) |
| Monotonie-Invarianten | gelten nicht (nur entlang `PLAN_ORDER`) |
| Stripe | Checkout-Modus `payment`, kein `subscription_data`, kein Trial |
| Persistenz | Grant in `public.entitlement_grants` — **nicht** `subscriptions` |
| Entitlements | `tenant_entitlements()` vereinigt Abo + Grants per `MAX()` |
| Frontend-Grids | `ONE_TIME_PRICING_TIERS`, **nicht** `PUBLIC_PRICING_TIERS` |

Warum eine eigene Tabelle: Das Subscription-Modell ist „genau eine aktive
Subscription pro Tenant" (im Repo per `UNIQUE(tenant_id)` erzwungen). Ein
Einmalkauf dort würde das laufende Abo überschreiben. Zusätzlich wählt
`tenant_entitlements()` per `ORDER BY updated_at DESC LIMIT 1` ohnehin nur
EINE Subscription-Zeile — eine zweite Zeile wirkte also nicht additiv,
sondern verdrängend. Grants sind deshalb eine eigene Achse.

`entitlement_grants` ist bewusst generisch (`source`, `expires_at`): derselbe
Mechanismus trägt Einmalkäufe, manuelle Kulanz-Grants und befristete Aktionen.
Ein Grant verweist auf eine `products`-Zeile; deren `product_entitlements`
definieren, was er gewährt — es gibt keine zweite Rechte-Definition.
Idempotenz über `UNIQUE(source, purchase_reference)`.

Warum nicht in `PUBLIC_PRICING_TIERS`: diese Liste ist an mehreren Stellen
implizit die Abo-Leiter — `PlanUpgradeModal` leitet Upgrade/Downgrade aus
der Position via `findIndex()` ab. Ein Einmalprodukt darin wäre als „höher
als Partner" gewertet worden.

## Runtime-Architektur

Die Kette in `RUNTIME_PIPELINE` wird überall identisch dargestellt:

```
Website / API → Runtime Scan → Policy Engine → Evidence Vault
              → Risk Engine → Automation → Audit Export
```

## Feature-Gruppen

Jede Feature-Liste gehört genau einer der vier Gruppen an
(`FEATURE_GROUPS`): **Audit & Evidence**, **AI Governance**,
**Automation & Ops**, **Multi Tenant & Reseller**. Ungeordnete Listen sind
nicht zulässig.

## Berechtigungen

Zugriff wird **ausschließlich** aus dem Plan-Objekt abgeleitet:

```ts
hasPermission(plan, 'api')          // plan.permissions
hasModule(plan, 'evidence_vault')   // plan.modules
limitOf(plan, 'domains')            // plan.limits  (-1 = unbegrenzt)
withinLimit(plan, 'domains', used)
```

Verboten:

```ts
if (plan === 'agency') { … }        // ✗ Vergleich gegen Plan-Namen
if (['agency','enterprise'].includes(plan)) { … }  // ✗ eigene Plan-Liste
```

Der Grund ist nicht Stilistik: Plan-Listen verteilen sich über die Codebasis
und driften. Vor diesem Refactoring war der Evidence Vault im Pricing ab
Starter ausgewiesen, in der Navigation aber erst ab Agency sichtbar.

## Stripe

- Der Checkout validiert `plan_key` gegen die SSoT und weist Unbekanntes ab.
- Stripe-Price-IDs stehen **nicht** im Frontend und **nicht** in der SSoT.
  Sie werden serverseitig aus `public.products.default_for_plan_key` gelöst
  (`supabase/functions/stripe-checkout`).
- Der Webhook normalisiert jeden eingehenden Plan-Key, bevor er in
  `subscriptions.plan_key` landet.

### Katalog abgleichen

```
STRIPE_SECRET_KEY=sk_test_… npm run stripe:diff   # nur Diff, schreibt nichts
STRIPE_SECRET_KEY=sk_test_… npm run stripe:sync   # wendet an
```

Erst gegen den Testmodus, dann gegen Live. Das Skript ist idempotent und
setzt `metadata.plan_key` auf Produkten und Preisen, benennt Produkte
passend zum Katalog und legt fehlende Preise an.

Bewusst **nicht** automatisiert: Beträge bestehender Preise ändern (Stripe-
Preise sind unveränderlich — das wäre ein neuer Preis plus Migration
laufender Abos, also eine Geschäftsentscheidung), Produkte oder Preise
deaktivieren, bestehende Subscriptions umstellen. Solche Fälle meldet das
Skript als Hinweis.

## API

`GET /functions/v1/plans` liefert den Katalog. Jeder Plan hat dieselbe
Struktur — keine Sonderfälle für Free, Enterprise oder Partner:

```
id, key, yearlyKey, name, outcomeHeadline, technicalSubheadline,
price { monthly, yearly }, currency, interval, purchaseMode, trialDays,
limits, modules, permissions, automation, bots, channels,
policyPacks, features, addons, support
```

## Änderungen vornehmen

1. `shared/pricing.ts` bearbeiten — und nur dort.
2. `npm run sync:pricing` (erzeugt den Deno-Zwilling).
3. Bei Katalog-relevanten Änderungen: `npm run gen:plan-catalog` und den
   Block in eine **neue** Migration übernehmen (Migrationen sind
   unveränderlich, sobald sie deployt sind).
4. `npm run check:pricing` prüft beide abgeleiteten Artefakte.
5. `npm test` — `test/config/pricing-ssot.test.ts` und
   `test/config/pricing-no-legacy-names.test.ts` erzwingen Konsistenz.

## Was die Tests garantieren

- Genau sechs Abo-Pläne mit den vorgegebenen Preisen; jeder Plan ist
  entweder auf der Abo-Leiter oder ein Einmalprodukt
- Einmalprodukte: Preis in `oneTimeEur`, `planRank() === -1`, kein
  Trial-Parameter im Checkout-Ziel, in `isUpgrade()` unvergleichbar
- Kein Plan verspricht ein Limit ohne die zugehörige Berechtigung
  (API, Bulk Jobs; Behebungspläne mit dokumentierter Altabweichung)
- Kein Plan-Bezeichner enthält „scale"; keine Legacy-Namen im Code
- Module, Berechtigungen und Limits sind entlang der Plan-Reihenfolge
  monoton — ein höherer Plan kann nie weniger als ein niedrigerer
- Pläne referenzieren nur existierende Module und Add-ons
- Deno-Zwilling und Katalog-Migration sind synchron zur SSoT
- Checkout-Ziele passen zum Kaufmodus des Plans
- Die Planempfehlung aus dem Governance Score ist deterministisch
