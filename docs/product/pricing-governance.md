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

Genau sechs Pläne, in dieser Reihenfolge (`PLAN_ORDER`):

`free` · `starter` · `growth` · `agency` · `enterprise` · `partner`

Andere Plan-Namen sind unzulässig. Insbesondere existiert **kein Plan
„Scale"** mehr — er heißt seit dem Governance-Refactoring `partner`.
Bestandsdaten werden über `normalizePlanKey()` abgebildet; die Migration
`20260802000000_canonical_plan_catalog.sql` stellt die DB-Zeilen um.

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

- Genau sechs Pläne mit den vorgegebenen Preisen
- Kein Plan-Bezeichner enthält „scale"; keine Legacy-Namen im Code
- Module, Berechtigungen und Limits sind entlang der Plan-Reihenfolge
  monoton — ein höherer Plan kann nie weniger als ein niedrigerer
- Pläne referenzieren nur existierende Module und Add-ons
- Deno-Zwilling und Katalog-Migration sind synchron zur SSoT
- Checkout-Ziele passen zum Kaufmodus des Plans
- Die Planempfehlung aus dem Governance Score ist deterministisch
