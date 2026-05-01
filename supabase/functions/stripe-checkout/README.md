# Stripe Checkout

Creates a Stripe Checkout Session for upgrading a tenant to a paid plan.
The resulting subscription flows back into `public.subscriptions` via the
existing `stripe-webhook` function.

## Setup

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase functions deploy stripe-checkout
```

## Request

```http
POST /functions/v1/stripe-checkout
Authorization: Bearer <user JWT>
Content-Type: application/json

{
  "tenant_id": "<uuid>",
  "plan_key":  "silver",            // bronze | silver | gold | enterprise_public
  "return_url": "https://app.example.com"   // optional, falls back to Origin
}
```

## Response

- **200**
  ```json
  { "ok": true, "url": "https://checkout.stripe.com/c/pay/...", "session_id": "cs_..." }
  ```
  Redirect the browser to `url`.
- **400 BAD_REQUEST** — missing fields or `plan_key=free`.
- **400 PRICE_NOT_CONFIGURED** — no real Stripe Price wired for that plan.
- **403 FORBIDDEN** — caller is not owner/admin of the tenant.

## Wiring a Stripe Price

The function picks the first row in `public.products` where
`default_for_plan_key` matches and `stripe_price_id` is **not** a
`internal_default_*` sentinel.

```sql
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES
  ('price_1Pxxxxxxxxxxxxxxxxxxxxxx', 'Silver / 99€ pro Monat', 'silver'),
  ('price_1Pyyyyyyyyyyyyyyyyyyyyyy', 'Gold / 299€ pro Monat',  'gold');
```

Make sure each Stripe Price has `metadata.plan_key = '<plan_key>'` so the
webhook copies the correct value into `subscriptions.plan_key`.

## Customer reuse

Before creating a new Stripe Customer, the function checks whether the
tenant already has a `stripe_customer_id` in `public.subscriptions` and
reuses it. The customer always carries `metadata.tenant_id` so the
webhook can resolve back to the right row.
