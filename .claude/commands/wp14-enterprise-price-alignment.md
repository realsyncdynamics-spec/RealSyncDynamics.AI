---
description: WP14 Enterprise-Preis 1.498 €/Monat netto durchgängig abgleichen (SSoT, Stripe, Checkout, Entitlements, Anzeige)
---

# WP14 — Enterprise-Preisabgleich 1.498 €

**Art:** Abgleich- und Abschlussauftrag. Kein Neubau. · **Branch:** `feat/wp14-enterprise-price-alignment`
**Voraussetzung:** Owner-Entscheid E-P1 laut `docs/strategy/E-P1_NACHTRAG_ENTERPRISE_PREIS.md` (§3 Fragen A–F).
Ohne diese Antworten beschränkt sich die Session auf Schritt 1 (Bestandsaufnahme im PR-Text).

## Rahmen (gilt für jede WP-Session)

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, `.github/PR_TRIAGE_POLICY.md`, `docs/strategy/E-P1_NACHTRAG_ENTERPRISE_PREIS.md`.

Ein Arbeitspaket pro Session. Eigener Branch von origin/main. Ein PR, Squash.

Verboten ohne separates GO:
- Deploy, Merge, Push auf main
- Supabase-Migration anwenden (`db push`), Stripe-Objekte anlegen oder ändern, Cloudflare/Worker/KV
- Price- oder Produkt-IDs raten. Nur vom Owner verifizierte IDs eintragen.

Immer:
- Keine Service-Role im Browser. Keine Secrets im Repo.
- Ein Preis, eine Quelle: Beträge kommen aus `shared/pricing.ts`. Keine festen Beträge in Komponenten, Texten oder Tests.
- Nur die im WP genannten Dateien ändern. Keine Repo-weiten Refactors.

Prüfung: `npm run lint` · `npm test` (betroffene Suites) · `npm run build` ·
`npm run check:pricing` · `check:offer-prices` · `check:landing-claims` · `check:entitlements` ·
`check:limits` · `check:plan-gates` · `check:context`. Nicht ausführbar → im PR begründen.

PR-Text: geänderte Dateien · Abgleichtabelle (Schicht → vorher → nachher → Beleg) · offene Owner-Punkte · Checks.

## Doppelarbeit vermeiden

Die Umsetzung liegt bereits in zwei offenen PRs. Dieses WP baut sie **nicht** neu.

| PR | Inhalt | Stand 26.10.2026 |
|---|---|---|
| #1995 `feat/enterprise-stripe-1498` | SSoT 1.498 €, Self-Service-Checkout mit Preisprüfung (`price-match.ts`, `PRICE_MISMATCH`, `PRODUCT_NOT_CONFIGURED`), endliche Enterprise-Kontingente (3 Migrationen), Runbook `docs/runbooks/enterprise-stripe-1498.md` | ready, Konflikt mit `main`, Price-ID und Produkt-ID fehlen |
| #1999 `claude/blissful-fermat-t1t2pp` | gestapelt auf #1995: Beta nur Starter/Growth/Agency, Anzeige „1.498 €/Monat netto“ auf allen öffentlichen Seiten | Draft, Konflikt mit `main` |

Weg: zuerst #1995 auf aktuellen `main` bringen und abschließen, danach #1999. Ein neuer PR entsteht nur,
wenn der Owner #1995/#1999 schließt; dann deren Commits übernehmen statt neu schreiben.

## Auftrag

**1. Bestandsaufnahme (immer, auch ohne Owner-Entscheid).** Für jede Schicht den Ist-Wert auf `main`,
in #1995/#1999 und in Produktion (read-only) erfassen:

| Schicht | Ort auf `main` (Stand `5c3e718`) | Zielzustand |
|---|---|---|
| SSoT | `shared/pricing.ts` Enterprise: `monthlyEur: 1_249`, `priceOnRequest: true`, `purchaseMode: 'inquiry'`, `availability: 'contract'` | `monthlyEur: 1_498`, buchbar laut Entscheid B |
| Generierte Kopie | `supabase/functions/_shared/pricing.generated.ts` | per `npm run sync:pricing`, nie von Hand |
| Stripe | Enterprise-Price `price_1USabS…` für 1.249 € (`20261020130000`); Produkt in Prod „Enterprise (inquiry · no self-service checkout)“ | neue Price: EUR, `149800` Cent, monatlich, `interval_count = 1`, `tax_behavior = exclusive`, aktiv, Live |
| Checkout | `supabase/functions/stripe-checkout/index.ts`: `ENTERPRISE_SELF_SERVICE_BLOCKED` → `ENTERPRISE_CONTRACT_ONLY` | laut Entscheid B; Preisprüfung aus #1995 vor jeder Session |
| Entitlements/Limits | `PLAN_ENTITLEMENTS.enterprise` in `shared/pricing.ts`; Kontingente teils `-1` (Vertrag) | laut Entscheid D; Migrationen aus #1995 nur nach GO |
| Anzeige | `src/config/pricing.ts`, `src/features/billing/PricingPage.tsx`, `src/components/landing/v6/useLandingV6.ts`, `src/i18n/handoff.ts` (`pricingFoot`), `src/pages/Faq.tsx`, `src/pages/solutions/{SaaS,Agencies}Solution.tsx`, `index.html`, `public/llms.txt`, `src/config/seo.ts` (JSON-LD) | „1.498 €/Monat netto“ aus der SSoT, Steuerhinweis aus `PRICING_TAX_NOTE` |
| Regeln | `.github/PR_TRIAGE_POLICY.md` Zeile „Enterprise-Preis: 1.249 €“ | Owner passt die Policy an (nicht dieses WP) |

**2. #1995 abschließen** (nach Entscheid A–C):
- `origin/main` per Merge einbringen, Konflikte lokal lösen (`docs/MERGE_CONFLICT_CONCEPT.md`). Kein Rebase auf dem fremden Branch.
- Verifizierte Price-ID und Produkt-ID eintragen (`PLAN_STRIPE_EXPECTATIONS.enterprise`), Migration aus der Vorlage
  `docs/runbooks/enterprise-stripe-1498.migration.sql.template` mit neuem Timestamp erzeugen. Anwenden nur mit GO.
- Steuermodus prüfen: „netto“ setzt `PRICING_TAX_MODE = 'EU_STANDARD'` voraus (auf `main` gesetzt).

**3. #1999 abschließen:** nach #1995 auf `main` bringen; jede Stelle mit „Enterprise auf Anfrage“,
„nach Vertrag“ oder 1.249 € liest den Betrag aus der SSoT. Kontaktweg „Enterprise anfragen“ bleibt.

**4. Abgleich-Test ergänzen** (falls in #1995 nicht vorhanden): ein Test, der SSoT-Betrag,
`PLAN_STRIPE_EXPECTATIONS.enterprise` (Cent, Währung, Intervall, `tax_behavior`) und die öffentliche
Anzeige gegeneinander prüft. Kein fester Betrag im Test außer gegen die SSoT.

**5. Nachweis im PR:** Abgleichtabelle aus Schritt 1 mit „nachher“-Spalte; offene Owner-Punkte einzeln.

## Abnahme

- SSoT, generierte Kopie, Stripe-Erwartung, Checkout-Verhalten und jede öffentliche Anzeige nennen denselben Betrag.
- Kein Fundort mehr mit 1.249 € außer Kommentaren mit Historie (im PR auflisten).
- Checkout lehnt bei abweichender Stripe-Price ab, statt falsch abzurechnen.
- Alle Prüfungen oben grün auf dem PR-Head, nicht nur lokal.

## Nicht in diesem WP

Jahrespreise (bleiben `yearlyCheckoutUnavailable`), Partner-Plan (E-F4), Änderungen an anderen Stufen,
Änderung der Triage-Policy, Rechtstexte/AGB, Deploy.
