# Stripe Meter Sync

Periodic job that turns the internal `usage_totals` for `billing_mode='metered'`
keys into Stripe usage records.

## Setup

```bash
SHARED=$(openssl rand -hex 32)
supabase secrets set STRIPE_METER_SHARED_SECRET="$SHARED"
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase functions deploy stripe-meter-sync --no-verify-jwt
```

The function validates `Authorization: Bearer $STRIPE_METER_SHARED_SECRET`
itself instead of going through Supabase JWT — that way external schedulers
can call it without minting user tokens.

## Wire one tenant

```sql
INSERT INTO public.metered_subscription_items
    (tenant_id, entitlement_key, stripe_subscription_item_id, stripe_unit_factor)
VALUES
    ('<tenant uuid>', 'limit.ai_tokens_monthly', 'si_1Pxxxxxxxxxxxxxxxxxxxxxx', 1),
    -- cost in cents → USD: factor 0.01
    ('<tenant uuid>', 'limit.ai_cost_monthly_cents', 'si_1Pyyyyyyyyyyyyyyyyyyyy', 0.01);
```

`stripe_unit_factor` lets you report internal counters in whatever unit the
Stripe Price expects (e.g. `cost_monthly_cents` × 0.01 → USD).

## Schedule

Pick one — all daily at ~ 02:00 UTC works:

### A) Supabase Schedules (recommended, in dashboard)

Database → Schedules → New schedule:
- Name: `stripe_meter_sync`
- Schedule: `0 2 * * *`
- HTTP request: `POST https://<ref>.functions.supabase.co/stripe-meter-sync`
  - Headers: `Authorization: Bearer <STRIPE_METER_SHARED_SECRET>`

### B) pg_cron + http extension

```sql
SELECT cron.schedule(
    'stripe_meter_sync',
    '0 2 * * *',
    $$
    SELECT net.http_post(
        url    := 'https://<ref>.functions.supabase.co/stripe-meter-sync',
        headers:= jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.stripe_meter_secret'))
    );
    $$
);
```

(Set `app.stripe_meter_secret` once via `ALTER DATABASE postgres SET app.stripe_meter_secret = '...';`.)

### C) GitHub Actions / Vercel Cron

`curl -X POST -H "Authorization: Bearer $SECRET"
   https://<ref>.functions.supabase.co/stripe-meter-sync`

## Idempotency

Each run posts `action: 'set'` with the absolute current-month quantity.
Re-running within the same minute is safe — Stripe replaces the record.
`usage_meter_sync` stores `last_quantity` per `(tenant, key, period_month)`
so unchanged tenants are skipped (no API call). Errors are recorded in
`usage_meter_sync.last_error` and visible to the tenant via RLS.

## Response

```json
{
  "ok": true,
  "period": "2026-04-01",
  "synced":  4,
  "skipped": 12,
  "errors":  0,
  "results": [{ "tenant_id": "...", "entitlement_key": "...", "quantity": 423, "status": "ok" }]
}
```
