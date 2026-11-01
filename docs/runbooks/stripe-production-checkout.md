# Stripe Production Checkout Runbook

> Pairs with `docs/runbooks/p0-pilot-blockers.md` (P0-2 + P0-3) and `src/features/billing/stripeDiagnostics.ts`.

## Goal

End-to-end live: **Pricing → Checkout → Stripe → Webhook → Subscription → Entitlements**.

If any segment breaks, the diagnostic table in `stripeDiagnostics.ts` returns a categorised status that the UI surfaces to the operator.

## Required Vault secrets

Project: `ebljyceifhnlzhjfyxup` · Schema: `vault.secrets`

| Name | Purpose | Min length |
|---|---|---|
| `stripe_secret_key` | `sk_live_…` for `stripe-checkout` / `stripe-portal` Edge Functions | 100+ |
| `stripe_webhook_secret` | `whsec_…` for HMAC verification in `stripe-webhook` | 60+ |
| `stripe_meter_shared_secret` | (already provisioned 2026-05-06) for metered-usage sync | 100+ |

Provision via the `vault-set-secret` Edge Function. See `p0-pilot-blockers.md` for the curl command.

Alternatively, mirror the two Stripe secrets from your environment into the
Vault with `scripts/provision-stripe-vault.sh` (reads `STRIPE_SECRET_KEY` +
`STRIPE_WEBHOOK_SECRET` from env, writes via `public.set_app_secret`, never logs
the values, validates key prefixes). Requires `SUPABASE_PROJECT_ID` and
`SUPABASE_SERVICE_ROLE_KEY` in the environment. Run with `DRY_RUN=1` first to
preview without writing.

## Required DB rows

Table: `public.products`

Live catalog (`acct_1TYVIyREjTWueUcG`) — USab* active net prices, `tax_behavior=exclusive` (`20261020130000`; replaced the tax-incl. UEm* series from `20260913000000` on 2026-10-20):

| plan_key | stripe_price_id | notes |
|---|---|---|
| `starter` | `price_1USabFREjTWueUcGDg9wod9W` | €79/mo |
| `growth` | `price_1USabNREjTWueUcGu814PvJc` | €249/mo |
| `agency` | `price_1USabPREjTWueUcGbaNG5WeB` | €699/mo |
| `enterprise` | `price_1USabSREjTWueUcGzUEzTaie` | inquiry |
| `partner` | `price_1USabUREjTWueUcGk8ao5bWw` | legacy Scale |
| `governance_launch` | `price_1USabjREjTWueUcG45xZUZgM` | €349 once |

No yearly Stripe prices; yearly rows keep non-`price_*` sentinels.

```sql
SELECT
  default_for_plan_key,
  stripe_price_id,
  CASE
    WHEN stripe_price_id LIKE 'price_%' THEN 'OK'
    ELSE 'MISSING'
  END AS status
FROM public.products
WHERE default_for_plan_key IN (
  'starter','growth','agency','enterprise','partner','governance_launch'
)
ORDER BY default_for_plan_key;
```

Expect `OK` for the six keys above. Self-service Checkout Sessions are minted only for starter/growth/agency.

## Webhook endpoint

```
https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/stripe-webhook
```

### Required events

| Event | Why |
|---|---|
| `checkout.session.completed` | Initial subscription write to `public.subscriptions` |
| `customer.subscription.created` | Backfill if checkout used existing customer |
| `customer.subscription.updated` | Plan changes, quantity changes, status transitions |
| `customer.subscription.deleted` | Cancel + entitlement downgrade |
| `invoice.payment_succeeded` | Refresh `current_period_end`, reset usage meters |
| `invoice.payment_failed` | Mark subscription past-due, surface dunning warning in UI |

Disable everything else — extra events cost replay-budget and increase the surface for signature failures.

## Post-checkout → dashboard → domain bind

Happy path after hosted Checkout succeeds:

1. Stripe `success_url` → `/checkout/success?session_id=…&plan_key=…`
2. `CheckoutSuccess` uses the shared Supabase client (persisted session), waits for tenant, calls `stripe-checkout-verify`, invalidates entitlements cache, refreshes `TenantProvider`
3. Redirect → `/app/dashboard?subscription=…&plan=…` (or `/welcome?next=/checkout/success?…` if auth missing — no second login)
4. Dashboard post-checkout CTA → `/app/websites` (DomainManager Preview)
5. Cancel → `/checkout/cancelled` → CTA `/#pricing`

Check-in: `/welcome`. Check-out: BrowserTopBar **Abmelden** → `signOut()` → `/`.

### Domain bind (Preview)

- UI: `DomainManager` on `/app/websites` (ensures a `website_projects` row)
- API: `website-domain-manager` with JWT + membership check
- Custom domains stay `pending`/`validating` until Cloudflare Vault/ops is live — do **not** treat public DNS resolve as live activation

Still blocked for live custom DNS: Cloudflare secrets in Vault + production migration apply + webhook confirmation (same blockers as Stripe section below).

## Manual end-to-end test (10 min)

1. Open `/pricing` (logged out) or landing `/#pricing`
2. Click **Starter** — redirects to `/checkout/starter`; if logged out → `/welcome?next=/checkout/starter`
3. Sign up with a test mail or Google OAuth
4. After welcome → redirected to `/checkout/starter`
5. Expect Stripe hosted checkout (URL = `checkout.stripe.com/c/pay/cs_live_…`)
6. Complete with `4242 4242 4242 4242` (test mode only) or a real card if live
7. Land on `/checkout/success` then `/app/dashboard?subscription=…&plan=starter`
8. Confirm:
   ```sql
   SELECT id, status, stripe_subscription_id, current_period_end
   FROM public.subscriptions
   WHERE tenant_id = '<your-test-tenant>'
   ORDER BY created_at DESC LIMIT 1;
   ```
   Expect: `status = 'active'`, non-null `stripe_subscription_id`, `current_period_end` in the future.
9. Confirm webhook delivery in Supabase Edge logs:
   ```
   stripe-webhook · checkout.session.completed · 200
   ```
10. Open `/app/websites` → attach domain (Preview banner visible)

If step 8 succeeds but step 9 doesn't, the subscription was written through a secondary path or delayed webhook. Renewal events still require the webhook.

## Failure modes

### `PRICE_NOT_CONFIGURED`

`public.products.stripe_price_id` is still a sentinel like `price_TODO` or `price_starter`. The Edge Function refuses to mint a checkout session.

**Fix**: copy real Price ID from Stripe Dashboard → Products → [plan] → Pricing section. UPDATE the products row.

### `STRIPE_SECRET_KEY missing`

Edge Function returns `503` with `STRIPE_NOT_CONFIGURED`.

**Fix**: provision via `vault-set-secret` (see P0 runbook). Re-deploy Edge Function NOT required — secrets are read per-invocation via `get_app_secret()` RPC.

### `WEBHOOK_SIGNATURE_FAILED`

`stripe_webhook_secret` in Vault doesn't match the Signing Secret Stripe shows for the endpoint. Easy to mis-paste — Stripe uses a leading `whsec_` prefix.

**Fix**: re-copy from Stripe Dashboard → Developers → Webhooks → [endpoint] → Signing secret → reveal → copy. Re-provision in Vault.

### Subscription not updated after a renewal

Webhook endpoint exists but `invoice.payment_succeeded` is missing from the event list.

**Fix**: Stripe Dashboard → Webhook endpoint → Add `invoice.payment_succeeded` and `invoice.payment_failed`.

### Live test charges accidentally going to live mode

You're in Live mode in the dashboard but Test card numbers don't work. Stripe rejects with `card_declined`.

**Fix**: deliberate. Live mode only accepts real cards. Use Test mode for QA.

## Restricted Key alternative (recommended for prod)

Replace `sk_live_…` with a **Restricted Key** with this permission scope:

- Checkout Sessions: read + write
- Customers: read + write
- Subscriptions: read
- Billing Portal Sessions: write
- Prices: read
- Products: read
- Everything else: **none** (no Charges, no Payouts, no Files, no Account, no Webhook-Endpoint management)

Restricted Keys cannot be partially rotated — but they also can't be used to siphon money or list/destroy other Stripe objects if leaked.

## Rotation

| Secret | Cadence | Procedure |
|---|---|---|
| `stripe_secret_key` | 6 months or on personnel change | Generate new in Stripe → Vault update → smoke-test → revoke old |
| `stripe_webhook_secret` | On every webhook-endpoint change | Stripe rotates automatically when endpoint is recreated |

## Verification SQL (read-only)

```sql
-- Are all plans wired?
SELECT default_for_plan_key,
       CASE WHEN stripe_price_id LIKE 'price_%' THEN 'OK' ELSE 'MISSING' END AS status
FROM public.products;

-- Recent subscriptions in last 7 days
SELECT tenant_id, plan_key, status, stripe_subscription_id, created_at
FROM public.subscriptions
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Recent webhook deliveries (Stripe event id, event type, receive time)
SELECT id, type, processed_at
FROM public.webhook_events
WHERE processed_at > NOW() - INTERVAL '24 hours'
ORDER BY processed_at DESC LIMIT 20;

-- Last delivery overall (an empty 24 h window is normal without traffic)
SELECT max(processed_at) AS last_event, count(*) AS total
FROM public.webhook_events;
```

All three queries are read-only. `public.webhook_events` has only the
columns `id` (Stripe event id), `type`, `payload` and `processed_at`; there is
no `source`/`status`/`created_at`. It is deny-by-default under RLS (service
role and super-admin read only), so run these in the SQL editor or with a
super-admin session, not as a normal tenant user.


## Enterprise 1.498 €/Monat netto (ehemals docs/runbooks/enterprise-stripe-1498.md)


Ziel: Live-Checkout für `plan_key=enterprise` mit
Betrag 1.498 € (netto), `tax_behavior=exclusive`, ohne Testphase.

### Ist-Stand (Stand 2026-10-25)

| Feld | Wert |
|------|------|
| SSoT-Preis (`shared/pricing.ts`) | 1.498 €/Monat netto |
| Alte Live-Price in `public.products` | `price_1USabSREjTWueUcGzUEzTaie` (1.249 €, `exclusive`, seit Migration `20261020130000`; vorher `price_1UEmHq…`, davor `price_1TxLd…`) |
| Live-Produkt-Kandidat | `prod_UxG9V9clbqV7qw` (aus Migration `20260912055500`) |
| `PLAN_STRIPE_EXPECTATIONS.enterprise.productId` | `live: null`, `test: null` → Checkout: `PRODUCT_NOT_CONFIGURED` |
| Jahres-Checkout | weiterhin gesperrt (`enterprise_yearly`) |

Ohne neue Price-ID und ohne verifizierte Product-ID darf der Checkout
**nicht** freigegeben werden (sonst `PRICE_MISMATCH` oder stiller Altpreis).

### Schritte in Stripe (Live)

1. Produkt öffnen bzw. bestätigen: Kandidat `prod_UxG9V9clbqV7qw`.
2. **Neuen** recurring Price anlegen (nicht den 1.249-€-Price umbenennen):
   - Betrag: **1498,00 EUR** → `unit_amount = 149800`
   - Intervall: `month`, `interval_count = 1`
   - `tax_behavior = exclusive`
   - `active = true`
   - livemode
3. Price-ID notieren (`price_…`).
4. Optional Test-Umgebung: analoger Price + Product unter `sk_test_`.

### Verifikation (CLI / Dashboard)

```text
unit_amount     == 149800
currency        == eur
recurring       == month / interval_count 1
active          == true
livemode        == true  (Live-Key)
tax_behavior    == exclusive
product         == <verifizierte prod_…>
```

### Code nach Verifikation

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
