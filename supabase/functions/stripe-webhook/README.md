# Stripe Webhook

Idempotent receiver for Stripe events.

## Setup

```bash
# Function secrets
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Deploy without JWT auth — Stripe verifies via signature header instead
supabase functions deploy stripe-webhook --no-verify-jwt
```

In the Stripe dashboard, point a webhook endpoint at
`https://<project-ref>.supabase.co/functions/v1/stripe-webhook` and subscribe to:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Tenant linkage (required)

We sync subscriptions by `metadata.tenant_id`. **Set this on the Stripe Customer
(preferred) or directly on the Subscription** when you create/update them from
your checkout flow:

```ts
await stripe.customers.create({
  email: user.email,
  metadata: { tenant_id: tenantId },
});
```

Without `tenant_id` the webhook handler returns 500 and Stripe retries. Add the
metadata, then resend the event from the dashboard.

## Plan key linkage

Set `metadata.plan_key` on each Stripe **Price** to one of the keys defined in
`src/core/billing/types.ts` (`free`, `bronze`, `silver`, `gold`,
`enterprise_public`). The webhook copies that into `subscriptions.plan_key`,
which the entitlements resolver consumes.

## Idempotency

Every event is inserted into `public.webhook_events` first; duplicates short-
circuit with `{ duplicate: true }`. If business logic fails after insert, we
delete the row so Stripe will retry. The table has deny-by-default RLS — only
this function (service role) reads / writes it.
