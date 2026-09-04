# Resend vault-first

Companion to `resend-production-email.md`.

## Resolution order

1. `get_app_secret('resend_api_key')` from `vault.secrets`
2. `RESEND_API_KEY` env (local / CI only)

Implemented in `supabase/functions/_shared/mailer.ts`.

Callers (all go through the helper, no raw `api.resend.com`):

- `welcome-email`
- `audit-report-email`
- `newsletter-subscribe`
- `daily-digest`
- `invoice-email`
- `email-notify-send`
- `sales-lead` (Starter-Offer)
- `audit-drip-cron`
- `audit-monitor-cron`
- `audit-recheck-weekly`
- `sub-processor-notify`
- `rebuild-website`
- `stripe-webhook` (Checkout-Welcome)

Evidence Vault (customer hash-chain) is **not** this store.

## Provision key

```bash
curl -X POST "$SUPABASE_URL/functions/v1/vault-set-secret" \
  -H "Authorization: Bearer $VAULT_OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"resend_api_key","secret":"re_..."}'
```

Do not use the anon key. The function is fail-closed: operator token or service-role only, allowlisted names only, never echoes the secret.

## Smoke

```bash
curl -X POST "$SUPABASE_URL/functions/v1/welcome-email" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<uuid>"}'
```

Expect `{ ok: true, source: "vault" }` and delivery from `noreply@realsyncdynamicsai.de`.
