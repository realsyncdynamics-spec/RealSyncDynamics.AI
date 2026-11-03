---
description: WP14 Enterprise 1.498 €/Monat — Nachabgleich nach #1999 (SSoT, Stripe, Checkout, Entitlements, Anzeige, Steuerstatus). Nur prüfen und Restdrift melden.
---

# WP14 — Enterprise 1.498 €/Monat: Nachabgleich nach #1999

**Status:** Arbeitsauftrag. Neu gefasst am 03.11.2026 gegen `main@54105e4`.
Ersetzt die Fassung aus #2014, die noch von offenen PRs #1995/#1999 ausging.
**Entscheidungsgrundlage:** `docs/strategy/E-P1_ENTERPRISE_PREIS_NACHTRAG.md`.

## 0. Ausgangslage (belegt, 03.11.2026)

| Punkt | Stand | Beleg |
|---|---|---|
| #1995 | Geschlossen ohne Merge (01.11.). Inhalt ist über #1999 auf `main`. | GitHub |
| #1999 | Gemergt am 29.10. (`70b0329`), Commit-Text „Kein Deploy“. | `git log` |
| Öffentliche Anzeige live | `llms.txt` auf realsyncdynamicsai.de nennt „1.498 €/Monat netto“. Es wurde also deployt. | `curl …/llms.txt` am 03.11. |
| Offener Gegenspieler | #2128 (Draft): Steuermodus `EXEMPT` (§ 19 UStG), entfernt „netto“ und `netPriceLabel` bei Enterprise. Owner-Freigabe laut PR-Text am 02.11. | #2128 |

**Keine Doppelarbeit:** Es gibt keinen neuen Implementierungs-PR für den Preis. WP14 prüft den
gemergten Stand, belegt jede Ebene und meldet Restdrift. Korrekturen entstehen nur als eigene,
kleine PRs mit eigenem GO (siehe 4).

## 1. Verboten ohne separates GO

- Merge, Deploy, Push auf `main`, Rebase, Force-Push, PR schließen
- Stripe-Objekte anlegen, ändern oder archivieren; Bestandsabos umstellen
- Migrationen anlegen oder auf Prod anwenden
- Preise, Kontingente, Steuermodus oder Produktfunktionen ändern
- Eingriff in #2128 (fremder Branch): nur lesen und kommentieren, wenn der Owner das wünscht

Erlaubt: lesen, lokal prüfen, Stripe und Supabase **nur lesend**, Befunde in einem Draft-PR oder
als Bericht.

## 2. Abgleichmatrix

Je Zeile Ist-Wert mit Fundstelle eintragen. Erfüllt nur bei Übereinstimmung. Vorbefund vom
03.11. steht in der Spalte „Vorbefund“ und wird erneut geprüft, nicht übernommen.

| Ebene | Soll | Fundstelle | Vorbefund 03.11. |
|---|---|---|---|
| SSoT | `monthlyEur: 1_498`, `purchaseMode: 'checkout'`, `availability: 'self_service'`, `trialDays: 0`, `yearlyCheckoutUnavailable: true`, kein öffentlicher Jahrespreis | `shared/pricing.ts` (Enterprise-Block), Zwilling `supabase/functions/_shared/pricing.generated.ts` (`node scripts/sync-shared-pricing.mjs --check`) | erfüllt laut Code; `yearlyEur: 14_980` nur interner Wert, Anzeige prüfen |
| Stripe Live | Price `price_1UVxUrREjTWueUcGuSjqctMH`: aktiv, EUR, `unit_amount` 149800, monatlich, `interval_count` 1, `tax_behavior` exclusive, Produkt `prod_UxG9V9clbqV7qw` | `GET /v1/prices/{id}` (lesend) | nicht selbst geprüft; Angabe aus #1999 |
| Erwartung im Code | `PLAN_STRIPE_EXPECTATIONS.enterprise.productId.live` gesetzt; `test: null` bewusst? | `supabase/functions/stripe-checkout/price-match.ts` | live gesetzt, test `null` → Testmodus-Checkout klären |
| Katalog-DB | Genau eine `products`-Zeile `default_for_plan_key = 'enterprise'` mit neuer Price-ID, `id` unverändert | Migration `20261029150300_enterprise_live_price_1498.sql`; Prod: `supabase_migrations`-Liste und `select` auf `products` (lesend) | Migration auf `main`; Prod-Anwendung nicht geprüft |
| Checkout | Monat buchbar, Jahr gesperrt (`ENTERPRISE_SELF_SERVICE_BLOCKED = {'enterprise_yearly'}`), Abweichung → `PRICE_MISMATCH`/`PRODUCT_NOT_CONFIGURED`, keine Testphase | `supabase/functions/stripe-checkout/index.ts`, `ENTERPRISE_CHECKOUT_PRICE_WIRED`, `test/stripe-checkout-price-match.test.ts`, `test/contracts/stripe-price-guard.test.ts` | erfüllt laut Code; Edge-Deploy-Stand nicht geprüft |
| Entitlements | Endliche Kontingente; Ausnahmen begründet | `PLAN_ENTITLEMENTS.enterprise`, Migrationen `20261029150000`–`150200`, `npm run check:limits` | `limits.industrialOtSystems: -1` steht noch; prüfen, ob gewollt |
| Bot-Kostenbremse | Self-Service-Kauf führt zu nutzbaren, endlichen Werten oder zu einem festgelegten manuellen Schritt | `20261028100000_bot_usage_plan_caps.sql`, `20261030130000_bot_usage_plan_profile_wiring.sql` | Enterprise ohne Profil → Alarm „manuelle Konfiguration beim Onboarding“. Zuständigkeit und Frist offen (E-P1h) |
| Öffentliche Anzeige | Betrag 1.498 € überall gleich, Steuerzusatz nach E-P1i, kein „Preis auf Anfrage“, kein „1.249“ | `index.html` (JSON-LD), `public/llms.txt`, `src/config/seo.ts`, `src/i18n/pricingCopy.ts`, `src/i18n/handoff.ts`, `useLandingV6.ts`, `PricingPage.tsx`, `/contact-sales`, `/enterprise`, FAQ; `npm run check:offer-prices` | Drift: `seo.ts` `/contact-sales` sagt „Buchung derzeit auf Anfrage über den Vertrieb“ |
| CTA | Kaufweg und Kontaktweg klar getrennt, keine verbotenen CTA-Wörter (`AGENTS.md`) | `ctaLabel` in `shared/pricing.ts`, Preis-Karten | `ctaLabel: 'Enterprise anfragen'` bei `purchaseMode: 'checkout'`; prüfen, ob die Karte zum Checkout führt |
| Steuerstatus | Ein einziger Modus in SSoT, Anzeige, AGB und Stripe-Checkout | `PRICING_TAX_MODE` (heute `'EU_STANDARD'`), #2128, `LegalTerms.tsx` § 4 | **Widerspruch offen** (E-P1i): Ziel „netto“ vs. #2128 „§ 19 UStG“ |
| Kommentare | Keine veralteten Aussagen im Code | `shared/pricing.ts` („Fail-closed bis die Live-Price-ID … verdrahtet ist“) | veraltet seit `WIRED = true` |

## 3. Prüfungen

`npm run lint` · `npm test` (Suites zu Pricing, Checkout, Landing) · `npm run build` ·
`npm run check:offer-prices` · `npm run check:limits` · `npm run check:pricing` ·
`npm run check:landing-claims` · `npm run check:spa-routes` ·
`node scripts/sync-shared-pricing.mjs --check`.
Ohne `node_modules` laufen nur die Node-Skripte; dann Ergebnis als `TEILWEISE` melden.
Maßgeblich ist die CI auf dem Head. Übersprungen heißt nicht bestanden.

## 4. Restpunkte als eigene PRs (je eigenes GO, erst nach E-P1i)

1. Anzeige-Drift: `/contact-sales`-Text in `src/config/seo.ts`, veralteter Kommentar in
   `shared/pricing.ts`, `ctaLabel` je nach Entscheidung. Steuerzusatz erst nach E-P1i.
2. Policy- und Plan-Dokumente angleichen (Docs-PR, Owner-Freigabe):
   `.github/PR_TRIAGE_POLICY.md` Z. 69 („Enterprise öffentlich ‚Auf Anfrage‘ …“, „regelbesteuert“),
   `docs/claude/BETA_V5_WORKPLAN.md` Z. 81 (1.249 €), Kommentar in `.github/workflows/ci.yml`
   Z. 79 (1.249 €), `docs/strategy/MASTERPLAN_2026-2027.md` §5/§8 (1.249 €, „offene PRs“).
   Workflow-Datei nur mit Workflow-Freigabe.
3. Bot-Kostenbremse für Enterprise nach Antwort auf E-P1h.
4. `industrialOtSystems: -1` nur ändern, wenn der Owner endliche Werte festlegt.

## 5. Abnahme

- Matrix vollständig, jede Zeile mit Fundstelle und Ergebnis; Stripe- und Prod-DB-Zeilen nur mit
  lesendem Beleg als „erfüllt“.
- Jede Abweichung ist als Restpunkt mit Datei und Zeile benannt oder durch eine Owner-Antwort
  erledigt.
- Kein Preis, Kontingent, Steuermodus oder Produktverhalten wurde durch WP14 geändert.

## Nicht in diesem WP

Steuerliche Einordnung selbst (Owner/Berater), Umstellung von Bestandsabos, Jahrespreise,
Partner 1.999 €, Credits, SSO-Umsetzung (ADR 0007), Beta-Regeln.
