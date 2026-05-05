# Usage Increment

Records a usage event for `(tenant, entitlement_key)`, after enforcing both the
per-plan limit (from `product_entitlements`) and any global cap from
`usage_limits_config`.

## Setup

```bash
supabase db push                                       # applies the trigger
supabase functions deploy usage-increment
```

No extra secrets — the function reads `SUPABASE_URL`,
`SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from the runtime.

## Request

```http
POST /functions/v1/usage-increment
Authorization: Bearer <user JWT>
Content-Type: application/json

{
  "tenant_id":       "<uuid>",
  "entitlement_key": "limit.api_calls_monthly",
  "delta":           1,
  "metadata":        { "endpoint": "/v1/assets" }
}
```

`delta` defaults to `1`. Negative values record refunds; the trigger floors
`usage_totals.total` at 0.

## Responses

- **200** success — `{ ok: true, total, hard_limit, soft_limit, billing_mode, warning }`
- **402 QUOTA_EXCEEDED** — plan or global cap would be exceeded; nothing
  was written. Body includes `error.details` with `current`, `requested`, `limit`
  and `source: "plan" | "global"`.
- **400 BAD_REQUEST** — missing `tenant_id` / `entitlement_key`, or invalid
  `delta`.
- **403 FORBIDDEN** — the caller is not a member of the given tenant.

## Hot path

```
client → POST usage-increment
       → JWT verify
       → membership check (RLS)
       → consumeUsage()
            ├── current total from usage_totals
            ├── plan limit from tenant_entitlements()
            ├── global cap from usage_limits_config
            ├── INSERT usage_events  ─► trigger upserts usage_totals
            └── return snapshot
```

The DB trigger `usage_events_sync_trigger` is the **only** writer to
`usage_totals`. Edge functions never upsert it manually — that prevents
double-counting.

## Stripe metered billing (later)

For keys with `billing_mode = 'metered'` (currently `limit.api_calls_monthly`),
no hard plan-limit is enforced unless explicitly set in `usage_limits_config`.
A nightly cron sums `usage_events` per `(tenant, key)`, calls
`stripe.subscriptionItems.createUsageRecord(...)`, and Stripe handles the
overage charge. That cron is out of scope for v1.
