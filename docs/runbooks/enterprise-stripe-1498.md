# Runbook — Enterprise Stripe 1.498 €/Monat netto

**Abhängig von #1982.** Ziel: Live-Checkout für `plan_key=enterprise` mit
Betrag 1.498 € (netto), `tax_behavior=exclusive`, ohne Testphase.

## Ist-Stand (Stand 2026-10-25)

| Feld | Wert |
|------|------|
| SSoT-Preis (`shared/pricing.ts`) | 1.498 €/Monat netto |
| Alte Live-Price in `public.products` | `price_1TxLdLREjTWueUcGRaXie8Vs` (1.249 €) |
| Live-Produkt-Kandidat | `prod_UxG9V9clbqV7qw` (aus Migration `20260912055500`) |
| `PLAN_STRIPE_EXPECTATIONS.enterprise.productId` | `live: null`, `test: null` → Checkout: `PRODUCT_NOT_CONFIGURED` |
| Jahres-Checkout | weiterhin gesperrt (`enterprise_yearly`) |

Ohne neue Price-ID und ohne verifizierte Product-ID darf der Checkout
**nicht** freigegeben werden (sonst `PRICE_MISMATCH` oder stiller Altpreis).

## Schritte in Stripe (Live)

1. Produkt öffnen bzw. bestätigen: Kandidat `prod_UxG9V9clbqV7qw`.
2. **Neuen** recurring Price anlegen (nicht den 1.249-€-Price umbenennen):
   - Betrag: **1498,00 EUR** → `unit_amount = 149800`
   - Intervall: `month`, `interval_count = 1`
   - `tax_behavior = exclusive`
   - `active = true`
   - livemode
3. Price-ID notieren (`price_…`).
4. Optional Test-Umgebung: analoger Price + Product unter `sk_test_`.

## Verifikation (CLI / Dashboard)

```text
unit_amount     == 149800
currency        == eur
recurring       == month / interval_count 1
active          == true
livemode        == true  (Live-Key)
tax_behavior    == exclusive
product         == <verifizierte prod_…>
```

## Code nach Verifikation

1. Vorlage `docs/runbooks/enterprise-stripe-1498.migration.sql.template`
   nach `supabase/migrations/<Timestamp>_enterprise_stripe_price_1498.sql`
   kopieren, Timestamp nach der letzten Migration auf `main`
   - `price_REPLACE_ME` durch echte Live-Price-ID ersetzen
   - `DO`-Block muss genau einen Enterprise-Default mit neuer ID + Name sehen
   - Die Vorlage liegt bewusst nicht unter `supabase/migrations/`: Mit dem
     Platzhalter bricht sie ab, und `Migration validation` spielt jede Datei
     dort ein.
2. `supabase/functions/stripe-checkout/price-match.ts`
   - `PLAN_STRIPE_EXPECTATIONS.enterprise.productId.live` = verifizierte Product-ID
   - optional `.test` setzen, sonst bleibt Test-Checkout gesperrt
3. CI: unit (price-match), Migration validation, manueller Smoke
   `POST /stripe-checkout` mit `plan_key=enterprise` → Session-URL, kein `PRICE_MISMATCH`

## Reihenfolge Merge

1. #1982 (SSoT + Quotas + Checkout-Logik ohne Live-Price)
2. Dieser PR (nur nach echten IDs)
3. #1983 rebasen (Beta-Texte)

**Merge und Produktionsdeploy brauchen separate Freigabe.**
