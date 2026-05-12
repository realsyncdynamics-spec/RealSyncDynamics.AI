# P0 Pilot Blockers — Operations Runbook

> **Status**: open as of 2026-05-12.
> **Owner**: founder (DB-Vault + Stripe + Resend dashboards). Engineering side is done.
> **Time budget**: ~25 minutes end-to-end.

These three items block the first paying pilot. Until all three are green, the platform can ingest events but cannot send transactional mail, cannot complete a real checkout, and cannot record Stripe webhook deliveries. None of them are code work — they're configuration that lives in third-party dashboards + Supabase Vault.

When this runbook is complete, paste the verification SQL at the bottom into the Supabase SQL editor and confirm all three lines return `OK`.

---

## Live state today (verified 2026-05-12)

```sql
SELECT name, length(secret) AS len, updated_at
FROM vault.secrets
ORDER BY name;
```

Returns:

| name | len | updated_at |
|---|---|---|
| market_scanner_token | 129 | 2026-05-05 |
| stripe_meter_shared_secret | 129 | 2026-05-06 |

**Missing**: `resend_api_key`, `stripe_secret_key`, `anthropic_api_key` (the last one blocks the governance-agent on PR #154 but isn't strictly pilot-blocking).

---

## P0-1 · Resend Vault Key (target: 5 min)

**Why it matters**: `welcome-email`, `audit-report-email`, `newsletter-subscribe`, `newsletter-confirm`, and `audit-recheck-weekly` Edge Functions read this key. Without it, every signup is silent — the user never sees the welcome mail, and Stripe Checkout success does not trigger our follow-up.

### Steps

1. Resend dashboard → **API Keys** → Create API Key
   - Name: `realsyncdynamicsai-prod-2026-05`
   - Permission: `Sending access` (not full access — principle of least privilege)
   - Domain restriction: `realsyncdynamicsai.de`
2. Copy the key (`re_…`) **immediately**. Resend will not show it again.
3. Provision into Supabase Vault via the `vault-set-secret` Edge Function:

   ```bash
   curl -X POST 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/vault-set-secret' \
     -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"name":"resend_api_key","secret":"re_..."}'
   ```

   Expected response: `{"ok":true,"name":"resend_api_key","updated":true}`.

4. Smoke-test by sending yourself a welcome mail:

   ```bash
   curl -X POST 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/welcome-email' \
     -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"to":"YOUR_EMAIL@realsyncdynamicsai.de","name":"Test"}'
   ```

   Check inbox. If 200 but no mail: check Resend dashboard → Logs.

### Rotation policy

Rotate every 90 days. Track in calendar. When rotating, generate the new key first, update vault, smoke-test, then revoke old.

---

## P0-2 · Stripe Live Secret Key (target: 5 min)

**Why it matters**: `stripe-checkout` and `stripe-portal` Edge Functions cannot mint live checkout sessions or billing portal sessions without this. Every paying customer signup fails today in production.

### Steps

1. Stripe dashboard → **Developers** → **API keys** → switch to **Live mode**.
2. Click **Reveal live key** for the Secret key (`sk_live_…`). Do not paste in chat, do not commit, do not screenshot.
3. Provision into Supabase Vault:

   ```bash
   curl -X POST 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/vault-set-secret' \
     -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"name":"stripe_secret_key","secret":"sk_live_..."}'
   ```

4. Smoke-test by creating a test checkout session against a known price ID:

   ```bash
   curl -X POST 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/stripe-checkout' \
     -H "Authorization: Bearer <USER_JWT>" \
     -H "Content-Type: application/json" \
     -d '{"plan_key":"starter"}'
   ```

   Expected: `{"ok":true,"url":"https://checkout.stripe.com/c/pay/cs_live_..."}`. Open the URL in incognito to confirm the page loads with the right product + price.

### Restricted key alternative (recommended)

For higher security, create a **Restricted Key** instead of the full Secret key:
- Permissions: `Checkout Sessions` (read+write), `Customers` (read+write), `Subscriptions` (read), `Billing Portal Sessions` (write), `Prices` (read), `Products` (read).
- Block: everything else (Charges, Payouts, Files, Webhooks).
- Use the restricted key as `stripe_secret_key` in Vault.

### Rotation policy

Rotate every 6 months or on personnel change. Stripe restricted keys cannot be partially rotated — the whole key changes.

---

## P0-3 · Stripe Webhook URL fix (target: 10 min)

**Why it matters**: `stripe-webhook` Edge Function processes `checkout.session.completed`, `customer.subscription.*`, `invoice.*` events. Without the live endpoint registered + signing secret matching, paid customers never get their subscription record written to `public.subscriptions`, and Stripe retries pile up in the Stripe dashboard "Failed events" queue.

### Steps

1. Stripe dashboard → **Developers** → **Webhooks** → **Live mode**.
2. If an existing endpoint points to a stale Vercel/Netlify URL, **disable** it (don't delete — keep the audit trail).
3. **Add endpoint**:
   - URL: `https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/stripe-webhook`
   - API version: latest stable (Stripe will default to current).
   - Events to send (minimal set):
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
4. Copy the **Signing secret** (`whsec_…`) — shown once during creation.
5. Provision into Vault under the name the Edge Function expects:

   ```bash
   curl -X POST 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/vault-set-secret' \
     -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"name":"stripe_webhook_secret","secret":"whsec_..."}'
   ```

6. Trigger a test event from Stripe → click **Send test webhook** → pick `checkout.session.completed`. Confirm `stripe-webhook` Function logs (Supabase dashboard → Edge Functions → stripe-webhook → Logs) show a 200 with `event_type=checkout.session.completed`.

7. Confirm DB write:

   ```sql
   SELECT id, status, stripe_event_id, created_at
   FROM webhook_events
   WHERE source = 'stripe' AND created_at > NOW() - INTERVAL '5 minutes'
   ORDER BY created_at DESC LIMIT 5;
   ```

   Expect at least one row.

### Failure-mode notes

- `400 invalid signature` → wrong `stripe_webhook_secret` in Vault. Re-copy from Stripe and re-provision.
- `404` → typo in URL. Confirm against `https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/stripe-webhook` exactly.
- `500` → check Function logs. Most common: DB constraint on `webhook_events` insert because the migration to add a new event-type was skipped.

---

## End-to-end verification

After all three steps, run this from the Supabase SQL editor:

```sql
SELECT
  CASE WHEN EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'resend_api_key' AND length(secret) > 30)
       THEN 'OK · resend_api_key' ELSE 'MISSING · resend_api_key' END AS resend,
  CASE WHEN EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'stripe_secret_key' AND length(secret) > 30)
       THEN 'OK · stripe_secret_key' ELSE 'MISSING · stripe_secret_key' END AS stripe_secret,
  CASE WHEN EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'stripe_webhook_secret' AND length(secret) > 30)
       THEN 'OK · stripe_webhook_secret' ELSE 'MISSING · stripe_webhook_secret' END AS stripe_webhook;
```

All three columns should say `OK · <name>`. Length check is loose by design — we never compare or display the actual secret value.

---

## Adjacent: bonus 5-minute keys (not P0, but unblocks the agent stack)

If you've got 5 more minutes after the three above, provision the LLM API key so PR #154 (governance-agent) can actually answer when it merges:

```bash
curl -X POST 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/vault-set-secret' \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"name":"anthropic_api_key","secret":"sk-ant-..."}'
```

This is P1, not P0: nothing in the pilot loop calls the agent yet.

---

## What this unblocks

| Once done | Capability live |
|---|---|
| P0-1 (Resend) | Signup welcome mail, audit-report mail, newsletter DOI, weekly audit-recheck digest |
| P0-2 (Stripe secret) | `/checkout` flow returns live `cs_live_…` URLs, customer portal works |
| P0-3 (Stripe webhook + secret) | Paid signups land in `public.subscriptions`, dunning / refund / cancel flows update DB |
| Bonus (Anthropic) | `governance-agent` Edge Function answers chat requests after PR #154 + #156 merge |

After all four, the end-to-end pilot loop is unblocked:
**Signup → Welcome mail → Onboarding → Asset/Policy → Ingest key → Extension/SDK → Events → Policy decisions → Approvals → Audit → Stripe checkout → Subscription → Welcome to paid.**
