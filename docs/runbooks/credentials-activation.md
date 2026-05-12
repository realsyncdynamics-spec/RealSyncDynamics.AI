# Credentials Activation Runbook

End-to-end activation of the two external API surfaces that gate every
revenue and notification flow in RealSyncDynamics.AI: **Stripe** (payments,
subscriptions, webhooks) and **Resend** (transactional email).

**Target operator:** anyone with Supabase project owner + Stripe + Resend
dashboard access. Estimated wall-clock: **3 minutes** assuming the keys are
already issued.

**Architecture context** (verified live):

```
Frontend   GitHub Pages (185.199.108-111.153, valid TLS until 2026-06-10)
Backend    Supabase Edge Functions (project ebljyceifhnlzhjfyxup)
Payments   Stripe (test mode, account acct_1T4YGdLZeNDuqgFK)
Email      Resend
```

No VPS, no Cloudflare, no separate hosting layer — keep mental model clean.

---

## Why this is needed

Two operational facts, both observable in production:

1. `STRIPE_SECRET_KEY` in the Edge Function env is the placeholder string
   `sk_live_PLACEHOLDER_KEY` (length 16, Stripe rejects with `Invalid API
   Key provided`). Every Stripe API call from Edge silently fails or
   no-ops.
2. `RESEND_API_KEY` is unset in env and absent from `vault.secrets`. Every
   transactional-email Edge Function (`audit-report-email`,
   `welcome-email`, `daily-digest`, `newsletter-subscribe`, `audit-drip-cron`,
   `audit-monitor-cron`, `audit-recheck-weekly`, `sub-processor-notify`,
   `rebuild-website`, `stripe-webhook`) returns
   `{ skipped: "no_api_key" }`.

DB-level evidence:

| Stage              | Generated | Activated |
|--------------------|-----------|-----------|
| `gdpr_audits`      | 16        | **0 mails sent** |
| `ceo_briefs`       | 12        | **0 sent** |
| `sales_leads`      | 18        | **0 followed up** |
| `outreach_contacts`| 8         | **0 contacted** |
| `subscriptions`    | 0         | — |
| `webhook_events`   | 0         | — (URL points at dead host) |

The Stripe webhook endpoint is also still pointed at the dead domain
`proof-sync-core.com`; Stripe stops retrying queued events 7 days after
first failure.

---

## Step 1 — Resend (~60 seconds)

1. Open https://resend.com/api-keys
2. Create (or reuse) an API key with **Full access** scope. Name it
   `supabase-prod-realsync`. Copy the `re_…` string — Resend only shows it
   once.
3. Persist to the Supabase vault (preferred over env var so future Edge
   deploys pick it up without a redeploy):

   ```sql
   select public.set_app_secret('resend_api_key', 're_PASTE_HERE');
   ```

   Run via Supabase SQL editor (https://supabase.com/dashboard/project/ebljyceifhnlzhjfyxup/sql/new).

4. Verify the vault read path works:

   ```sql
   select length(decrypted_secret) as len,
          substring(decrypted_secret from 1 for 3) as prefix
   from vault.decrypted_secrets where name = 'resend_api_key';
   ```

   Expect: `len ≈ 40`, `prefix = "re_"`.

---

## Step 2 — Stripe secret key (~30 seconds)

1. Open https://dashboard.stripe.com/test/apikeys
2. Under **Standard keys → Secret key**, click **Reveal test key** and
   copy the `sk_test_…` string.
3. Persist to the vault under the canonical name:

   ```sql
   select public.set_app_secret('stripe_secret_key', 'sk_test_PASTE_HERE');
   ```

4. Verify:

   ```sql
   select length(decrypted_secret) as len,
          substring(decrypted_secret from 1 for 8) as prefix
   from vault.decrypted_secrets where name = 'stripe_secret_key';
   ```

   Expect: `len > 100`, `prefix = "sk_test_"`.

---

## Step 3 — Fix the Stripe webhook URL (~30 seconds)

The dead endpoint `https://proof-sync-core.com/api/webhooks/stripe` must
become `https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/stripe-webhook`.

Two equivalent paths — pick one.

### 3a — One-shot via the deployed admin function

The `stripe-webhook-fixer` Edge Function reads `stripe_secret_key` from
vault (which Step 2 just populated), lists endpoints, and PATCHes any
endpoint whose URL contains the dead host.

```bash
SHARED="$(
  curl -sS -X POST \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    "https://ebljyceifhnlzhjfyxup.supabase.co/rest/v1/rpc/get_app_secret" \
    -d '{"secret_name":"stripe_meter_shared_secret"}' \
  | jq -r '.'
)"

# 1) Dry-run: list every endpoint
curl -sS -X POST \
  -H "Authorization: Bearer $SHARED" \
  -H "Content-Type: application/json" \
  "https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/stripe-webhook-fixer" \
  -d '{"action":"list"}' | jq .

# 2) Fix any endpoint whose URL contains proof-sync-core.com
curl -sS -X POST \
  -H "Authorization: Bearer $SHARED" \
  -H "Content-Type: application/json" \
  "https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/stripe-webhook-fixer" \
  -d '{
    "action": "fix",
    "dead_host": "proof-sync-core.com",
    "new_url": "https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/stripe-webhook"
  }' | jq .
```

`get_app_secret` requires service role — the anon key path above will
fail unless the RPC is exposed. If it does, use the SQL editor instead:
`select public.get_app_secret('stripe_meter_shared_secret');` and paste
the value into `SHARED=` directly.

### 3b — Manual via Stripe Dashboard

1. https://dashboard.stripe.com/test/webhooks
2. Open the existing endpoint pointing at `proof-sync-core.com`.
3. **Update details → URL** → paste:
   ```
   https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/stripe-webhook
   ```
4. Save.
5. If you want a fresh signing secret, regenerate it; otherwise the existing
   `STRIPE_WEBHOOK_SECRET` continues to verify signatures correctly.

Events the endpoint must subscribe to (verify after the URL update):

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

---

## Step 4 — Verify end-to-end

### 4a — Edge Function reachability + signature path

```bash
# Should respond HTTP 400 "signature verify failed" — this is correct
# (proves the function is alive and validating Stripe signatures).
curl -sS -X POST \
  -H "Content-Type: application/json" \
  -H "stripe-signature: probe" \
  -d '{"probe":true}' \
  -w "\nHTTP=%{http_code}\n" \
  "https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/stripe-webhook"
```

### 4b — Send a real test event from Stripe

In the Stripe Dashboard webhook detail page, click **Send test webhook →
checkout.session.completed → Send**. Within ~5 seconds:

```sql
select id, type, processed_at
from public.webhook_events
order by processed_at desc nulls last
limit 5;
```

Expect at least one row with a `checkout.session.completed` event id.

### 4c — Fire one audit report email

Pick an unsent audit:

```sql
select id, domain, email
from public.gdpr_audits
where email_sent_at is null and fetched_status = 200
order by created_at desc
limit 1;
```

Trigger it:

```bash
curl -sS "https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/audit-report-email?id=PASTE_UUID_HERE"
```

Expect: `{ "ok": true, "sent_id": "...", "to": "..." }` (not
`skipped: "no_api_key"`).

Verify the DB-side idempotency flag flipped:

```sql
select email_sent_at from public.gdpr_audits where id = 'PASTE_UUID_HERE';
```

### 4d — Backfill the 15 remaining audits

```sql
select
  'curl -sS "https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/audit-report-email?id='
  || id
  || '"'
  as cmd
from public.gdpr_audits
where email_sent_at is null and fetched_status = 200
order by created_at;
```

Copy the output, paste into a shell, run. Each call is idempotent
(`already_sent` skip if re-invoked). 16 mails total; expected runtime
< 30 seconds.

---

## Success criteria — all four must be green

- [ ] `select count(*) from vault.decrypted_secrets where name in ('resend_api_key','stripe_secret_key');` returns **2**
- [ ] `curl …/stripe-webhook-fixer action:list` shows zero endpoints with `proof-sync-core.com` in the URL
- [ ] `select count(*) from public.webhook_events;` is **> 0** after a Stripe test event
- [ ] `select count(*) filter (where email_sent_at is not null) from public.gdpr_audits;` is **≥ 16**

If any of those four fails, see the relevant step's verify block. The
function-level logs are accessible at
https://supabase.com/dashboard/project/ebljyceifhnlzhjfyxup/functions
→ pick the function → **Logs** tab.

---

## Rollback

The runbook is purely additive — there is nothing to roll back at the
infrastructure layer. If for any reason you need to remove a vault
secret:

```sql
delete from vault.secrets where name = 'resend_api_key';
delete from vault.secrets where name = 'stripe_secret_key';
```

Functions will revert to their `skipped: "no_api_key"` no-op state.

The Stripe Dashboard endpoint URL can be reverted to any other URL at any
time — Stripe doesn't gate it.
