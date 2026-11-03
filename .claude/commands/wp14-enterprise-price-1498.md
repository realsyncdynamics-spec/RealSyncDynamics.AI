---
description: WP14 Enterprise 1.498 €/Monat netto — Nachabgleich nach #1999 (SSoT, Stripe, Checkout, Entitlements, Anzeige)
---

# WP14 — Enterprise-Preis 1.498 €/Monat netto: Nachabgleich

**Status:** Arbeitsauftrag, nicht gestartet. Neu gefasst am 03.11.2026 gegen `main@54105e4`.
Die Fassung vom 26./28.10. (#2014) ist überholt: #1999 ist gemergt, #1995 ohne Merge geschlossen.
**Bezug:** `docs/strategy/E-P1_ENTERPRISE_PREIS_NACHTRAG.md`.
**Voraussetzung für Textänderungen:** Owner-Entscheidung E-P1i (Steuerbezeichnung). Prüfen (Schritt 1–3)
darf vorher laufen.

## Rahmen

Repository: realsyncdynamics-spec/RealSyncDynamics.AI. Lies zuerst `AGENTS.md`, `CLAUDE.md`,
`.github/PR_TRIAGE_POLICY.md`, den E-P1-Nachtrag sowie die Beschreibungen von #1999 und #2128.

**Keine Doppelarbeit.** Der Preis ist auf `main` umgesetzt (#1999, gemergt 29.10.2026). WP14 setzt nichts
neu um. Es belegt, ob SSoT, Stripe, Checkout, Entitlements und Anzeige übereinstimmen, und listet
Abweichungen als Restpunkte. Jeder Restpunkt wird ein eigener, kleiner PR mit eigener Freigabe.
Kein Sammel-PR, kein neuer Implementierungs-PR für denselben Preis.

Verboten ohne separates GO:
- Merge, Deploy, Push auf `main`, Rebase, Force-Push
- Stripe-Objekte anlegen, ändern oder archivieren (nur lesende Abfragen)
- Migrationen anlegen oder auf Prod anwenden, `supabase db push`
- Preise, Kontingente, Steuermodus oder Produktfunktionen ändern
- Arbeit an #2128 (Steuer) oder an dessen Dateien; Überschneidungen nur melden

## Auftrag

### 1. Abgleichmatrix ausfüllen

Jede Zeile bekommt einen Ist-Wert mit Fundstelle und eine Herkunft: **Code**, **live gelesen** oder
**nicht geprüft**. Erfüllt ist eine Zeile nur bei belegtem Ist = Soll.

| Ebene | Soll | Fundstelle / Prüfweg |
|---|---|---|
| SSoT | `monthlyEur: 1_498`, `purchaseMode: 'checkout'`, `availability: 'self_service'`, kein `priceOnRequest`, `yearlyCheckoutUnavailable: true`, `trialDays: 0` | `shared/pricing.ts`; Zwilling `node scripts/sync-shared-pricing.mjs --check` |
| Stripe (Live) | `price_1UVxUrREjTWueUcGuSjqctMH`: aktiv, EUR, `unit_amount` 149800, `month`, `interval_count` 1, `tax_behavior` exclusive, Produkt `prod_UxG9V9clbqV7qw` | Nur lesend: Stripe-Dashboard oder `GET /v1/prices/{id}` durch den Owner. Ohne Zugriff: „nicht geprüft“. |
| Erwartung im Code | `PLAN_STRIPE_EXPECTATIONS.enterprise` = `exclusive` + obiges Produkt | `supabase/functions/stripe-checkout/price-match.ts` |
| Checkout | Enterprise monatlich buchbar; `enterprise_yearly` gesperrt; Abweichung Stripe/SSoT ⇒ `PRICE_MISMATCH` bzw. `PRODUCT_NOT_CONFIGURED`; keine Testphase | `supabase/functions/stripe-checkout/index.ts`, `test/stripe-checkout-price-match.test.ts`, `test/contracts/stripe-price-guard.test.ts` |
| Katalog-DB | Genau eine aktive `products`-Zeile für Enterprise mit der neuen Price-ID, `id` unverändert | Migrationen `20261029150000`–`20261029150300`. Ob auf Prod angewendet: nur lesend prüfen oder „nicht geprüft“. |
| Entitlements | Endliche Kontingente laut `20261029150100`; KI-Kosten 25.000 Cent. Bewusst `-1` wie Agency: `limit.llm_queries_monthly`, `limit.agent_runs_monthly`. Zusätzlich prüfen und begründen: `website.scan_monthly_limit: -1`, `industrialOtSystems: -1`. | `PLAN_ENTITLEMENTS.enterprise`, `npm run check:limits` |
| Bot-Kostenbremse | Ein Self-Service-Käufer hat nach dem Kauf nutzbare, endliche Minuten- und Euro-Werte | `20261028100000`, `20261030130000`: Enterprise ohne Profil, Kauf erzeugt Alarm. **Offen bis E-P1h.** Nichts ändern. |
| Öffentliche Anzeige | Überall derselbe Betrag 1.498 €, keine Reste von „1.249“ oder „Preis auf Anfrage“ als Preisangabe; „Enterprise anfragen“ nur als zusätzlicher Kontaktweg | `index.html`, `public/llms.txt`, `src/config/seo.ts`, `src/i18n/*`, `useLandingV6.ts`, `PricingPage.tsx`, `/contact-sales`, `/enterprise`. Ratsche: `check:offer-prices` |
| Steuerbezeichnung | Einheitlich nach E-P1i: „netto zzgl. USt“ (`EU_STANDARD`) **oder** § 19-Hinweis (`EXEMPT`, #2128). Nie beides nebeneinander. | `PRICING_TAX_MODE`, `pricingTaxNote`, `netPriceLabel` |
| Live-Anzeige | Wie Code, nur lesend | `GET https://realsyncdynamicsai.de/llms.txt`, JSON-LD der Startseite, `/pricing` |

### 2. Bekannte Restpunkte belegen (Stand 03.11.)

Bestätigen oder widerlegen, jeweils mit Fundstelle. Nicht beheben.

1. `.github/PR_TRIAGE_POLICY.md` Z. 69: „Enterprise öffentlich ‚Auf Anfrage‘, bis … ID existiert“ — veraltet.
2. `src/config/seo.ts:543`: „Buchung derzeit auf Anfrage über den Vertrieb“ — widerspricht `self_service`.
3. `shared/pricing.ts` Kommentar am Enterprise-`ctaLabel` („Fail-closed bis …“) und Kopfkommentar in
   `price-match.ts` („Noch nicht gesetzt“) — veraltet, ohne Wirkung.
4. `src/features/billing/PricingPage.tsx` Z. 23–24: Kommentar „Enterprise manuell fakturiert“ — veraltet.
5. CTA-Ziel der Enterprise-Karte: führt der Hauptknopf zum Checkout oder nur zu `/contact-sales`?
   Gegen E-P1b und die CTA-Regel in `AGENTS.md` prüfen.
6. 1.249 € in `docs/strategy/MASTERPLAN_2026-2027.md` §5/§8, `docs/claude/BETA_V5_WORKPLAN.md` Z. 81,
   Kommentar `.github/workflows/ci.yml` Z. 79.
7. Überschneidung mit #2128: dieselben Dateien (`shared/pricing.ts`, `seo.ts`, `index.html`, `llms.txt`,
   `handoff.ts`). Restpunkte 2–4 erst nach der Entscheidung zu #2128 anfassen.
8. Überschneidung mit #2108 (`stripe-checkout`, MOON-Hardware): Enterprise-Pfad darf dadurch nicht
   verändert werden. Nur melden.

### 3. Prüfen

`npm run lint` · `npm test` (mindestens die Suites aus Schritt 1) · `npm run build` ·
`check:offer-prices` · `check:limits` · `check:pricing` · `check:landing-claims` ·
`sync-shared-pricing --check`. Ohne `node_modules` (kein `npm install` durch Agenten) gelten diese
Prüfungen als **nicht ausgeführt**; maßgeblich ist dann die CI auf `main`. Übersprungen heißt nicht bestanden.

### 4. Ergebnis

Ein Bericht als Kommentar oder Docs-Datei im Draft-PR dieses WP: ausgefüllte Matrix, Restpunkte mit
Status (bestätigt/widerlegt/nicht geprüft), Vorschlag für die Reihenfolge der Folge-PRs.

### 5. Reihenfolge danach (jeweils eigenes GO)

1. Owner entscheidet E-P1i (Steuer) und E-P1h (Bot-Werte für Enterprise).
2. Owner bestätigt E-P1e lesend in Stripe und lässt den Prod-Stand der vier Migrationen lesend prüfen.
3. Text-PR für Restpunkte 2–5 (Claims/Preise ⇒ Einzel-Freigabe), passend zu E-P1i.
4. Docs-PR für Restpunkt 1 und 6 (Policy, Masterplan, Workplan, CI-Kommentar).
5. Nach Deploy nur lesend: `/pricing`, `/`, `llms.txt`; eine Enterprise-Checkout-Session ohne Abschluss
   (Testmodus oder Abbruch), **kein echter Kauf**.

## Abnahme

- Matrix vollständig, jede Zeile mit Fundstelle und Herkunft.
- Kein Zustand, in dem ein Enterprise-Preis angezeigt wird, den der Checkout nicht einlösen kann.
- Keine Preise, Kontingente, Steuerlogik oder Funktionen durch WP14 geändert.

## Nicht in diesem WP

Steuermodus (#2128), Jahrespreise, Partner 1.999 € (E-F4), Credits, SSO-Umsetzung (ADR 0007),
Beta-Regeln, Bot-Profil für Enterprise (E-P1h), Stripe-Änderungen.
