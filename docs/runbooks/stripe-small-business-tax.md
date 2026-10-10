# Checkout-Steuerlogik — § 19 UStG / Stripe (10.10.2026)

## Entscheidung / Geltungsbereich

Die Pricing-SSoT (`shared/pricing.ts`) steht aktuell auf `PRICING_TAX_MODE='EXEMPT'`. Das ist die dokumentierte **Produktkonfiguration**, kein steuerlicher Nachweis des Finanzamts. PR #1748 (Umstellung der Rechtstexte auf `EU_STANDARD`) ist geschlossen und nicht gemergt. Ohne gesicherte steuerliche Klärung **keine Umstellung auf Regelbesteuerung** vornehmen.

Die Edge Function `stripe-checkout` leitet `automatic_tax.enabled` nun direkt aus der generierten Pricing-SSoT ab. `EXEMPT` deaktiviert automatische Stripe-Tax-Berechnung **nur für neue Checkout-Sessions**; `EU_STANDARD` darf erst nach geprüfter rechtlicher und Stripe-Konfiguration aktiviert werden.

## Umsetzungsgrenzen

- **Unverändert:** Stripe-Products/Prices, Checkout-Kaufmodi, Trial- und Entitlement-Logik, Datenbank und bestehende Subscriptions.
- **Unverändert:** Stripe-Tax-Registrierungen. Ein Deaktivieren im Code ist keine Abmeldung beim Finanzamt.
- **Nicht rückwirkend:** bereits ausgestellte Rechnungen, vorhandene Subscriptions mit `automatic_tax.enabled=true`, Dashboard-generierte Rechnungen und Payment Links werden durch diesen Fix nicht geändert.
- **Nicht implementiert:** automatisierter länderbezogener Steuer-/B2B-Check. Grenzüberschreitende SaaS-Verkäufe vor Live-Freigabe steuerlich klären; eine generelle EU-weite Steuerbefreiung wird nicht behauptet.

## Vor Live-Freigabe verpflichtend

1. Steuerstatus/ggf. Verzicht auf § 19, Rechnungen und bereits erzielte Umsätze **anhand der Finanzamtsunterlagen** bestätigen.
2. Den richtigen Stripe-Live-Account verbinden/prüfen: `Tax Settings`, alle Registrierungen, aktive Checkout-Sessions, bestehende Subscriptions und Rechnungen. Aktuell war über die Stripe-App **nur die Sandbox** zugänglich (10.10.2026: Tax `pending`, keine Registrierungen). Daraus folgt keine Aussage über Live.
3. Im Stripe-Dashboard in **Billing → Invoices → Templates/Settings** einen korrekten §-19-Hinweis für neue Rechnungen (auch wiederkehrende) hinterlegen und Test-PDF prüfen. Beispiel: `Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.` Das allein ersetzt keine fachliche Freigabe.
4. In Testumgebung End-to-End `payment` und `subscription` einschließlich Checkout-Betrag, PDF-Rechnung, Webhook-Fulfillment sowie Renewal/Cancel testen. Ein Sandbox-Kauf ist keine Live-Zahlung.
5. Vor Öffnung für ausländische Kunden B2B-/B2C- und OSS-Regelungen mit Steuerberatung klären oder länderbezogene Sales-Gates einführen.
6. PR #1819 ändert dieselbe Checkout-Datei. Fix **gezielt** nach dem Beta-Code integrieren, niemals dessen Datei durch die ältere `main`-Version ersetzen. CI/Review prüfen, **keinen Merge/Deploy ohne separate Freigabe**.

## Verifizierte Sandbox-Rechnungsvorschau (10.10.2026)

Stripe-Sandbox `RealSync Dynamics IA Sandbox`, `livemode=false`:
- Stripe Tax Settings: `pending`, fehlendes `head_office`; keine Tax-Registrierungen.
- Direkte API-Rechnungsvorschau (`in_1UOrphIEauIvbZDC8VZvEIYl`, **keine** finalisierte Rechnung/kein Checkout-E2E).
- Position: 79,00 EUR; `automatic_tax.enabled=false`; `total_taxes=[]`; Endbetrag 79,00 EUR.
- **Offener Befund:** `footer=null`, kein §-19-Hinweis; `invoice_pdf=null`, weil nur unverbindliche Preview.
- Einrichtung des korrekten Invoice-Footers/Invoice-Templates in der Sandbox und anschließend ein tatsächlicher Checkout-Test stehen aus. Der Preview-Erfolg beweist nicht, dass PR #1819 über Supabase deployt oder dass ein Abo-Zyklus funktioniert.

## Validierung

```sh
npx vitest run test/billing/stripe-checkout-tax-mode.test.ts
npm run check:pricing
npm run lint
```

Der Regressionstest stellt sicher, dass Website und Edge-SSoT übereinstimmen und dass `automatic_tax` nicht versehentlich hart auf `true` gesetzt wird. Tests wurden beim Commit über die Connector-Schnittstelle nicht automatisch ausgeführt.
