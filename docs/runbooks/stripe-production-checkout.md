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

## Required DB rows

Table: `public.products`

```sql
SELECT
  default_for_plan_key,
  stripe_price_id,
  CASE
    WHEN stripe_price_id LIKE 'price_%' THEN 'OK'
    ELSE 'MISSING'
  END AS status
FROM public.products
ORDER BY created_at;
```

Expect `OK` for every active plan key. `MISSING` = price was seeded with a sentinel and never replaced with the live Stripe Price ID. The CheckoutPage renders `missing_price_id` for that plan.

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

## Manual end-to-end test (10 min)

1. Open `/pricing` (logged out)
2. Click **Starter** — redirects to `/welcome?next=/checkout/starter`
3. Sign up with a test mail or Google OAuth
4. After welcome → redirected to `/checkout/starter`
5. Expect Stripe hosted checkout (URL = `checkout.stripe.com/c/pay/cs_live_…`)
6. Complete with `4242 4242 4242 4242` (test mode only) or a real card if live
7. After redirect, confirm:
   ```sql
   SELECT id, status, stripe_subscription_id, current_period_end
   FROM public.subscriptions
   WHERE tenant_id = '<your-test-tenant>'
   ORDER BY created_at DESC LIMIT 1;
   ```
   Expect: `status = 'active'`, non-null `stripe_subscription_id`, `current_period_end` in the future.
8. Confirm webhook delivery in Supabase Edge logs:
   ```
   stripe-webhook · checkout.session.completed · 200
   ```

If step 7 succeeds but step 8 doesn't, the subscription was written through the success-redirect path. That works for a single test but leaves you blind to renewal events — the webhook MUST verify.

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

-- Recent webhook deliveries
SELECT source, event_type, status, created_at
FROM public.webhook_events
WHERE source = 'stripe' AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC LIMIT 20;
```

All three queries are read-only and tenant-scoped via RLS.
