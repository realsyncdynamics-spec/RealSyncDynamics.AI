---
description: WP14 Enterprise 1.498 €/Monat netto — SSoT, Stripe, Checkout, Entitlements und Anzeige abgleichen (Abschluss von #1995/#1999)
---

# WP14 — Enterprise-Preis 1.498 €/Monat netto abgleichen

**Status:** Arbeitsauftrag, noch nicht gestartet. Erstellt am 26.10.2026 auf `main@5c3e718`.
**Voraussetzung:** Owner-Entscheidung E-P1 ist schriftlich bestätigt
(`docs/strategy/E-P1_ENTERPRISE_PREIS_NACHTRAG.md`, Abschnitt „Zu bestätigen“).
**Branches:** keine neuen. Gearbeitet wird auf den Heads von #1995
(`feat/enterprise-stripe-1498`) und #1999 (`claude/blissful-fermat-t1t2pp`).

## Rahmen

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, `.github/PR_TRIAGE_POLICY.md`, den E-P1-Nachtrag sowie die Beschreibungen
und Kommentare von #1995 und #1999. Das Runbook `docs/runbooks/enterprise-stripe-1498.md` liegt nur
auf dem Branch von #1995.

**Keine Doppelarbeit.** Die Umsetzung von 1.498 € existiert bereits:

| PR | Inhalt | Stand 26.10.2026 |
|---|---|---|
| #1995 | SSoT 1.498 €, Self-Service-Checkout mit Preisprüfung (`price-match.ts`), endliche Kontingente (3 Migrationen), Anzeige, Runbook und SQL-Vorlage für die Stripe-Price-ID | Ready for review. CI auf `c0c7ae8` grün. Konflikt mit `main` in `src/i18n/pricingCopy.ts`. 6 Commits hinter `main`. |
| #1999 | Gestapelt auf #1995: Beta nur für Starter/Growth/Agency, restliche „Enterprise auf Anfrage“-Texte, 404-Middleware | Draft. Pflicht-CI übersprungen. Konflikte in `src/i18n/pricingCopy.ts` und `src/product/implementation-status.ts`. |

WP14 setzt nichts neu um. Es bringt diese zwei PRs auf einen geprüften, widerspruchsfreien Stand
und belegt den Abgleich. Ein dritter Implementierungs-PR für denselben Preis wird nicht angelegt.

Verboten ohne separates GO:
- Merge, Deploy, Push auf `main`
- Stripe-Objekte anlegen, ändern oder archivieren
- `supabase db push` oder eine Migration auf Prod anwenden
- Rebase, Amend oder Force-Push auf diesen Branches (nur Merge von `origin/main`)
- Preise, Kontingente oder Funktionen über den Stand von #1995/#1999 hinaus ändern

## Auftrag

### 1. Stand einholen (nur lesen)
- `origin/main` in beide Branches mergen und Konflikte lösen. Beim Stand vom 26.10. betrifft das
  `src/i18n/pricingCopy.ts` und `src/product/implementation-status.ts`.
- Seit der Basis der PRs auf `main` neu: #2003 (Enterprise-SSO als Coming Soon, `shared/pricing.ts`),
  #2004 (Landing v6 ist wieder Startseite, `useLandingV6.ts`), #2005. Die SSO-Kennzeichnung aus #2003 muss
  im Ergebnis erhalten bleiben.
- Generierte Dateien werden nur über Skripte neu erzeugt: `npm run sync:pricing` und
  `npm run sync:spa-routes`. Nicht von Hand bearbeiten.

### 2. Abgleichmatrix ausfüllen
Für jede Zeile wird der Ist-Wert mit Fundstelle belegt. Erfüllt ist eine Zeile nur, wenn Ist und Soll
übereinstimmen. Die Matrix gehört in die PR-Beschreibung von #1995.

| Ebene | Soll | Fundstelle |
|---|---|---|
| SSoT | `monthlyEur: 1_498`. Kein `priceOnRequest`. `yearlyCheckoutUnavailable: true`. Kein öffentlicher Jahrespreis. `trialDays` 0 bzw. keine Testphase. | `shared/pricing.ts`, Zwilling `supabase/functions/_shared/pricing.generated.ts` (`sync-shared-pricing --check`) |
| Stripe (Live) | Preis aktiv, EUR, `unit_amount` 149800, `recurring.interval` month, `interval_count` 1, `tax_behavior` exclusive, richtiges Produkt | Owner liefert Price-ID und Product-ID. Prüfung nur lesend (Stripe-Dashboard oder `GET /v1/prices/{id}`). |
| Erwartungen im Code | `PLAN_STRIPE_EXPECTATIONS.enterprise.productId` ist gesetzt (heute `null`; Kandidat laut #1995: `prod_UxG9V9clbqV7qw`, unverifiziert) | `supabase/functions/stripe-checkout/price-match.ts` |
| Katalog-DB | Genau eine `products`-Zeile für Enterprise (`default_for_plan_key = 'enterprise'`) mit der neuen Price-ID. Die `id` bleibt in place erhalten, damit die `product_entitlements` erhalten bleiben. | Vorlage `docs/runbooks/enterprise-stripe-1498.migration.sql.template` (aus der Vorlage wird erst mit verifizierter ID und neuem Timestamp eine Migration) |
| Checkout | Enterprise ist nicht mehr durch `ENTERPRISE_SELF_SERVICE_BLOCKED` gesperrt. Jede Abweichung zwischen Stripe und SSoT führt zu `PRICE_MISMATCH` bzw. `PRODUCT_NOT_CONFIGURED`. Keine Testphase. Kein Jahres-Checkout. | `supabase/functions/stripe-checkout/index.ts`, `test/stripe-checkout-price-match.test.ts`, `test/contracts/stripe-price-guard.test.ts` |
| Entitlements | Endliche Kontingente statt `-1`, darunter KI-Kosten 250 €/Monat. Laut #1995 gibt es live 0 Enterprise-Abos; das wird vor dem Merge erneut gezählt. | Migrationen `20261024090000`, `20261024090100`, `20261025001345`, `PLAN_ENTITLEMENTS`, `npm run check:limits` |
| Öffentliche Anzeige | Überall „1.498 €/Monat netto“. Kein „Preis auf Anfrage“ und kein „1.249“ mehr. „Enterprise anfragen“ bleibt als Kontaktweg. | `index.html` (JSON-LD), `public/llms.txt`, `src/config/seo.ts`, `src/i18n/pricingCopy.ts`, `src/i18n/handoff.ts`, `useLandingV6.ts`, `PricingPage.tsx`, `/contact-sales`, `/enterprise`, FAQ. Ratsche: `npm run check:offer-prices` |
| Steuerhinweis | Neben „netto“ steht der Regelbesteuerungs-Hinweis. `PRICING_TAX_MODE` ist auf `main` bereits `'EU_STANDARD'`. | `shared/pricing.ts` (`pricingTaxNote`). **Befund auf `main`:** `src/i18n/handoff.ts` `pricingFoot` nennt noch § 19 UStG (Kleinunternehmer). #1999 fasst `pricingFoot` an. Prüfen, ob dort auch der Steuertext korrigiert wird. Sonst als Restpunkt melden. |

### 3. Migrations-Timestamps prüfen
Die drei Migrationen aus #1995 tragen Zeitstempel vom 24./25.10. Auf `main` ist die letzte
`20261026081109`. Gilt die Regel aus der Merge-Checkliste („Timestamp nach der letzten Datei auf `main`“),
werden sie mit `npm run migrate:rename` angehoben, ohne den Inhalt zu ändern. Danach
`check:migration-collisions` ausführen. `check-migration-drift` meldet Migrationen, die 7 Tage nach dem Merge
noch nicht auf Prod angewendet sind. Deshalb wird das Anwenden zusammen mit dem Merge geplant.

### 4. Ohne IDs kein öffentlicher Preis
Laut #1995 zeigt die Seite ohne Price-ID und Product-ID 1.498 € an, während der Checkout jeden Kauf
ablehnt. Das ist ein öffentlicher Preis ohne Kaufpfad. Genau dagegen steht die Ratsche
`check:offer-prices` (`.github/workflows/ci.yml`). Abnahmebedingung: Merge und Deploy von #1995
erst, wenn beide IDs verifiziert sind und die Katalog-Migration gemeinsam mit dem Merge angewendet wird.
Bis dahin bleibt `main` unverändert bei „auf Anfrage“.

### 5. Prüfen
`npm run lint` · `npm test` (betroffene Suites) · `npm run build` · `check:offer-prices` ·
`check:limits` · `check:pricing` · `check:migration-collisions` · `check:landing-claims` ·
`check:spa-routes` (Skript kommt mit #1999). #1995 und anschließend #1999 auf „Ready for review“ stellen, damit die Pflicht-CI
läuft. Übersprungene Prüfungen gelten nicht als bestanden.

### 6. Reihenfolge nach dem WP (jeweils eigenes GO)
1. Owner bestätigt E-P1 und liefert die Price-ID und die Product-ID.
2. #1995: IDs eintragen, Migration aus der Vorlage erzeugen, CI grün → Merge-GO → Migration auf Prod → Deploy-GO.
3. Nach dem Deploy nur lesend prüfen: Anzeige auf `/pricing` und `/`. Die Checkout-Session für
   Enterprise wird mit `PRICE_MISMATCH = nein` erzeugt (Stripe-Testmodus oder Session ohne Abschluss),
   **kein echter Kauf**.
4. #1999 auf den neuen `main` bringen → CI grün → Merge-GO → Deploy-GO.
5. Erst danach in einem eigenen Docs-PR mit Owner-Freigabe: Den festen Preis in
   `.github/PR_TRIAGE_POLICY.md` (heute „1.249 € ist die höchste Stufe“, § 19-UStG-Hinweis), in `AGENTS.md`
   (Zeile 47) und in `docs/claude/BETA_V5_WORKPLAN.md` (Zeile 76) angleichen, außerdem den CI-Kommentar in
   `.github/workflows/ci.yml` (Zeile 79). WP14 ändert diese Dateien nicht.

## Abnahme
- Die Abgleichmatrix ist vollständig. Jede Zeile hat eine Fundstelle und keine offene Abweichung.
- Es gibt nirgends mehr einen Zustand, in dem ein Enterprise-Preis angezeigt wird, der Checkout ihn aber
  nicht einlösen kann.
- Es wurden keine Preise, Kontingente oder Funktionen über #1995/#1999 hinaus geändert.

## Nicht in diesem WP
Jahrespreise, Partner 1.999 € (E-F4), Credits, SSO-Umsetzung (ADR 0007), Änderungen an den Beta-Regeln über
#1999 hinaus und Anpassungen der Policy- oder Agent-Dokumente (siehe Schritt 6.5).
