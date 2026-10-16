# VAT-Umstellung Stripe (Regelbesteuerung ab 2026-10-15) — Änderungsplan LIVE

Status: PLAN, nicht ausgeführt. Konto `acct_1TYVIyREjTWueUcG` (live). Keine Schreibaktion durch Agents.

## 1. Neue Preise (je bestehendes Produkt, `currency=eur`, `recurring.interval=month`, `tax_behavior=exclusive`)
| Plan | unit_amount | Produkt | ersetzt (inklusiv/unspezifiziert) |
|---|---|---|---|
| Starter | 7900 | Produkt von price_1UEmHi… | price_1UEmHiREjTWueUcGX2cfEi25 |
| Growth | 24900 | Produkt von price_1UEmHm… | price_1UEmHmREjTWueUcGiCQMB8H4 |
| Agency | 69900 | Produkt von price_1UEmHo… | price_1UEmHoREjTWueUcGqeO4LGud |

Trial: bleibt im Code (`subscription_data.trial_period_days`, 14 Tage laut SSoT), nicht am Preis.
`lookup_key` vorschlagen: `starter_monthly_excl`, `growth_monthly_excl`, `agency_monthly_excl`.
Produkt-`tax_code`: `txcd_10103001` (SaaS – business use) prüfen.

## 2. Verdrahtung
`legal-review/vat-exclusive-prices.sql` mit den neuen IDs ausführen (public.products.default_for_plan_key).

## 3. Archivieren (`active=false`) — erst NACH Verdrahtung + Smoke-Checkout
- price_1UEmHiREjTWueUcGX2cfEi25 (Starter alt)
- price_1UEmHmREjTWueUcGiCQMB8H4 (Growth alt)
- price_1UEmHoREjTWueUcGqeO4LGud (Agency alt)
- price_1UEmHqREjTWueUcG0oqZkb5O (Enterprise, Inquiry, nie Self-Service) — archivieren, Enterprise per Angebot/Invoice
- price_1UEmHsREjTWueUcGFlIItOiz (Partner, legacy/PLAN_RETIRED) — archivieren
- price_1UEmHtREjTWueUcGhjY7Gvhp (Governance Launch, einmalig) — nur archivieren, wenn Netto-Ersatz entschieden (Betrag netto? offene Frage)
Achtung: laufende Abos auf alten Preisen bleiben bestehen (Archivieren stoppt sie nicht); Migration bestehender Abos separat entscheiden.

## 4. Stripe Tax
- Registrierungen prüfen: DE `standard` + `oss_union` aktiv, Startdatum ≤ Umstellungsdatum.
- Origin address = Neuhaus am Rennweg (Impressum).
- Default tax behavior: `exclusive`; Default tax code SaaS.
- Rechnungseinstellungen: Steuernummer/USt-IdNr. als Account-Tax-ID; alte §-19-Fußzeile in Default-Footer entfernen.
- Reverse Charge EU-B2B: über `tax_id_collection` + Stripe Tax automatisch.

## 5. Kontoeinstellungen
- Öffentlicher Anzeigename „RealSync Dynamics IA“ → „RealSync Dynamics AI“ (Tippfehler; erscheint auf Checkout/Rechnungen).
- Adaptive Pricing: zeigt Nicht-EUR-Kunden Preise in USD/Lokalwährung → deaktivieren, solange nur DE-Markt (TAX_CHECKED_MARKETS=['DE']) und Preise als EUR-netto kommuniziert werden.

## 6. Altlast
- Offene Rechnung vom 25.08. (249 €, nie bezahlt, Abo gekündigt): Kandidat für **void** (nicht „uncollectible“), da ohne Leistung/Zahlung; ID im Dashboard prüfen.
