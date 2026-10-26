# Runbook — Enterprise Stripe 1.498 €/Monat netto

Ziel: Live-Checkout für `plan_key=enterprise` mit
Betrag 1.498 € (netto), `tax_behavior=exclusive`, ohne Testphase.

## Ist-Stand (Stand 2026-10-25)

| Feld | Wert |
|------|------|
| SSoT-Preis (`shared/pricing.ts`) | 1.498 €/Monat netto |
| Alte Live-Price in `public.products` | `price_1USabSREjTWueUcGzUEzTaie` (1.249 €, `exclusive`, seit Migration `20261020130000`; vorher `price_1UEmHq…`, davor `price_1TxLd…`) |
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

1. **Migration anlegen:** `docs/runbooks/enterprise-stripe-1498.migration.sql.template`
   nach `supabase/migrations/<Timestamp>_enterprise_stripe_price_1498.sql` kopieren.
   - Zeitstempel nach der letzten Migration auf `main` wählen.
     `npm run check:migration-collisions` darf keine Kollision mit offenen PRs melden.
   - `price_REPLACE_ME` durch die verifizierte Live-Price-ID ersetzen.
   - Die Vorlage stellt **in place** um (wie `20261020130000`). Die
     `products`-Zeile behält ihre `id` und damit alle `product_entitlements`.
     Eine neue Zeile hätte keine Kontingente.
   - Sie bricht ab, wenn nicht genau ein Enterprise-Datensatz mit neuer ID und
     neuem Namen übrig bleibt. Das gilt auch bei Wiederholung.
   - Solange die Datei nur Vorlage ist, liegt sie bewusst **nicht** unter
     `supabase/migrations/`. `deploy.yml` wendet Migrationen nach dem Merge an,
     und `Migration validation` spielt jede Datei dort ein. Mit dem Platzhalter
     bricht die Vorlage ab und würde CI und Deploy blockieren.
2. **Erwartetes Stripe-Produkt eintragen:**
   `supabase/functions/stripe-checkout/price-match.ts`
   - `PLAN_STRIPE_EXPECTATIONS.enterprise.productId.live` auf die verifizierte Product-ID setzen.
   - Optional `.test` setzen. Bleibt es `null`, ist der Test-Checkout weiter gesperrt.
3. **Prüfen:** CI (`unit` inkl. `test/stripe-checkout-price-match.test.ts`,
   `Migration validation`). Danach manueller Smoke-Test
   `POST /stripe-checkout` mit `plan_key=enterprise`: Session-URL, kein
   `PRICE_MISMATCH`.

**Merge, Anwendung der Migration auf Produktion und Produktionsdeploy brauchen
jeweils eine separate Freigabe.**
