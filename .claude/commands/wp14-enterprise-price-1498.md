---
description: WP14 Enterprise 1.498 €/Monat — Nachabgleich nach #1999/#2157 (SSoT, Stripe, Checkout, Entitlements, Anzeige, Steuer)
---

# WP14 — Enterprise-Preis 1.498 €/Monat: Nachabgleich

**Status:** Arbeitsauftrag, nicht gestartet. Neu gefasst am 14.11.2026 gegen `main@fce3719`.
Die Fassung vom 26./28.10. (#2014) ist überholt: #1999 und #2157 sind gemergt, #1995 und #2128 ohne
Merge geschlossen.
**Bezug:** `docs/strategy/E-P1_ENTERPRISE_PREIS_NACHTRAG.md`.

## Rahmen

Repository: realsyncdynamics-spec/RealSyncDynamics.AI. Lies zuerst `AGENTS.md`, `CLAUDE.md`,
`.github/PR_TRIAGE_POLICY.md`, den E-P1-Nachtrag sowie die Beschreibungen von #1999 und #2157.

**Keine Doppelarbeit.** Der Preis ist auf `main` umgesetzt (#1999), der Steuerstatus ebenfalls
(#2157, § 19 UStG). WP14 setzt nichts neu um. Es belegt, ob SSoT, Stripe, Checkout, Entitlements und
Anzeige übereinstimmen, und listet Abweichungen als Restpunkte. Jeder Restpunkt wird ein eigener,
kleiner PR mit eigener Freigabe. Kein Sammel-PR, kein neuer Implementierungs-PR für denselben Preis.

Verboten ohne separates GO:
- Merge, Deploy, Push auf `main`, Rebase, Force-Push
- Stripe-Objekte anlegen, ändern oder archivieren; Bestandsabos umstellen (nur lesende Abfragen)
- Migrationen anlegen oder auf Prod anwenden, `supabase db push`
- Preise, Kontingente, Steuermodus oder Produktfunktionen ändern

## Auftrag

### 1. Abgleichmatrix ausfüllen

Jede Zeile bekommt einen Ist-Wert mit Fundstelle und eine Herkunft: **Code**, **live gelesen** oder
**nicht geprüft**. Erfüllt ist eine Zeile nur bei belegtem Ist = Soll.

| Ebene | Soll | Fundstelle / Prüfweg |
|---|---|---|
| SSoT | `monthlyEur: 1_498`, `purchaseMode: 'checkout'`, `availability: 'self_service'`, kein `priceOnRequest`, `yearlyCheckoutUnavailable: true`, `trialDays: 0`, `netPriceLabel: false` | `shared/pricing.ts`; Zwilling `node scripts/sync-shared-pricing.mjs --check` |
| Stripe (Live) | `price_1UVxUrREjTWueUcGuSjqctMH`: aktiv, EUR, `unit_amount` 149800, `month`, `interval_count` 1, `tax_behavior` exclusive, Produkt `prod_UxG9V9clbqV7qw` | Nur lesend: Stripe-Dashboard oder `GET /v1/prices/{id}` durch den Owner. Ohne Zugriff: „nicht geprüft“. |
| Erwartung im Code (live) | `PLAN_STRIPE_EXPECTATIONS.enterprise` = `exclusive` + `productId.live: 'prod_UxG9V9clbqV7qw'` | `supabase/functions/stripe-checkout/price-match.ts` |
| Erwartung im Code (Testmodus) | `productId.test` ist heute `null`. Klären und belegen: Bricht ein Enterprise-Checkout im Stripe-Testmodus bewusst mit `PRODUCT_NOT_CONFIGURED` ab, oder fehlt ein Testprodukt? Ergebnis bestimmt Schritt 5.5. | `price-match.ts`, `test/stripe-checkout-price-match.test.ts` |
| Checkout | Enterprise monatlich buchbar; `enterprise_yearly` gesperrt; Abweichung Stripe/SSoT ⇒ `PRICE_MISMATCH` bzw. `PRODUCT_NOT_CONFIGURED`; keine Testphase; im `EXEMPT`-Modus kein `automatic_tax` | `supabase/functions/stripe-checkout/index.ts`, `supabase/functions/_shared/checkout-tax.ts`, `test/billing/checkout-tax.test.ts`, `test/contracts/stripe-price-guard.test.ts` |
| Katalog-DB | Genau eine aktive `products`-Zeile für Enterprise mit der neuen Price-ID, `id` unverändert | Migrationen `20261029150000`–`20261029150300`. Ob auf Prod angewendet: nur lesend prüfen oder „nicht geprüft“. |
| Entitlements | Endliche Kontingente laut `20261029150100`; KI-Kosten 25.000 Cent. Bewusst `-1` wie Agency: `limit.llm_queries_monthly`, `limit.agent_runs_monthly`. Zusätzlich prüfen und begründen: `website.scan_monthly_limit: -1`, `limits.industrialOtSystems: -1`. | `PLAN_ENTITLEMENTS.enterprise`, `npm run check:limits` |
| Bot-Kostenbremse | Ein Self-Service-Käufer hat nach dem Kauf nutzbare, endliche Minuten- und Euro-Werte | `20261028100000`, `20261030130000`: Enterprise ohne Profil, Kauf erzeugt Alarm. **Offen bis E-P1h.** Nichts ändern. |
| Öffentliche Anzeige | Überall „1.498 €/Monat“ mit § 19-Hinweis, kein „netto“/„zzgl. USt“, keine Reste von „1.249“ oder „Preis auf Anfrage“ als Preisangabe; „Enterprise anfragen“ nur als zusätzlicher Kontaktweg | `index.html`, `public/llms.txt`, `src/config/seo.ts`, `src/i18n/*`, `useLandingV6.ts`, `PricingPage.tsx`, `/contact-sales`, `/enterprise`. Ratsche: `check:offer-prices` |
| Steuerstatus | Ein Modus überall: `PRICING_TAX_MODE = 'EXEMPT'`, § 19-Hinweis in Anzeige, AGB und Checkout. Stripe-Price `exclusive` ohne Wirkung, solange kein `automatic_tax`. Bestandsabos mit `automatic_tax` lesend zählen. | `shared/pricing.ts`, `src/features/legal/LegalTerms.tsx`, `checkout-tax.ts` |
| Live-Anzeige | Wie Code, nur lesend | `GET https://realsyncdynamics-ai.pages.dev/llms.txt` und `/pricing`. Hinweis 14.11.: `realsyncdynamicsai.de/` liefert eine andere HTML-Seite, `/pricing` leitet auf `pages.dev` weiter. Befund melden, nicht beheben. |

### 2. Bekannte Restpunkte belegen (Stand 14.11.)

Bestätigen oder widerlegen, jeweils mit Fundstelle. Nicht beheben.

1. `.github/PR_TRIAGE_POLICY.md` Z. 69: „regelbesteuert, netto zzgl. 19 % USt“, „Enterprise öffentlich
   ‚Auf Anfrage‘“, „der frühere §-19-Hinweis gilt nicht mehr“ — alle drei veraltet.
2. `src/config/seo.ts:543`: „Buchung derzeit auf Anfrage über den Vertrieb“ — widerspricht `self_service`.
3. `shared/pricing.ts` Kommentar am Enterprise-`ctaLabel` („Fail-closed bis …“) und Kopfkommentar in
   `price-match.ts` („Noch nicht gesetzt“) — veraltet, ohne Wirkung.
4. `src/features/billing/PricingPage.tsx` Z. 23–24: Kommentar „Enterprise manuell fakturiert“ — veraltet.
5. CTA der Enterprise-Karte: `ctaLabel: 'Enterprise anfragen'` bei `purchaseMode: 'checkout'`. Führt der
   Hauptknopf zum Checkout oder nur zu `/contact-sales`? Gegen E-P1b und die CTA-Regel in `AGENTS.md` prüfen.
6. 1.249 € in `docs/strategy/MASTERPLAN_2026-2027.md` §5/§8, `docs/claude/BETA_V5_WORKPLAN.md` Z. 81,
   Kommentar `.github/workflows/ci.yml` Z. 79 (Workflow-Datei nur mit Workflow-Freigabe).
7. `productId.test: null` (siehe Matrix) — Ergebnis mit Begründung festhalten.
8. Hauptdomain liefert nicht den Repo-Build aus (siehe Matrix, Live-Anzeige) — nur melden.

### 3. Prüfen

`npm run lint` · `npm test` (mindestens die Suites aus Schritt 1) · `npm run build` ·
`check:offer-prices` · `check:limits` · `check:pricing` · `check:landing-claims` ·
`sync-shared-pricing --check`. Ohne `node_modules` (kein `npm install` durch Agenten) gelten diese
Prüfungen als **nicht ausgeführt**; maßgeblich ist dann die CI auf `main`. Übersprungen heißt nicht bestanden.

### 4. Ergebnis

Ein Bericht als Kommentar oder Docs-Datei im Draft-PR dieses WP: ausgefüllte Matrix, Restpunkte mit
Status (bestätigt/widerlegt/nicht geprüft), Vorschlag für die Reihenfolge der Folge-PRs.

### 5. Reihenfolge danach (jeweils eigenes GO)

1. Owner bestätigt E-P1i formal und entscheidet E-P1h (Bot-Werte für Enterprise).
2. Owner bestätigt E-P1e lesend in Stripe, klärt das Testmodus-Produkt und lässt den Prod-Stand der vier
   Migrationen sowie Abos mit `automatic_tax` lesend prüfen.
3. Text-PR für Restpunkte 2–5 (Claims/Preise ⇒ Einzel-Freigabe).
4. Docs-PR für Restpunkte 1 und 6 (Policy, Masterplan, Workplan, CI-Kommentar).
5. Nach Deploy nur lesend: `/pricing`, `/`, `llms.txt`; eine Enterprise-Checkout-Session ohne Abschluss,
   im Testmodus nur wenn Restpunkt 7 das erlaubt, sonst live mit Abbruch vor der Zahlung.
   **Kein echter Kauf.**

## Abnahme

- Matrix vollständig, jede Zeile mit Fundstelle und Herkunft.
- Kein Zustand, in dem ein Enterprise-Preis angezeigt wird, den der Checkout nicht einlösen kann.
- Keine Preise, Kontingente, Steuerlogik oder Funktionen durch WP14 geändert.

## Nicht in diesem WP

Steuerliche Einordnung selbst (Owner/Berater), Umstellung von Bestandsabos, Jahrespreise,
Partner 1.999 € (E-F4), Credits, SSO-Umsetzung (ADR 0007), Beta-Regeln, Bot-Profil für Enterprise
(E-P1h), Stripe-Änderungen, Auslieferung der Hauptdomain.
