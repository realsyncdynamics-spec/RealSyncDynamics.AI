# Cloudflare Secrets Management Guide

**Status**: Active | **Last Updated**: 2026-07-23

## Overview

This guide explains how to manage sensitive credentials for RealSyncDynamics.AI across three deployment contexts:

1. **Development**: `.env.local` (gitignored)
2. **GitHub Actions CI**: GitHub Actions Secrets
3. **Production**: Cloudflare Secrets Vault (for Workers)

---

## Secrets Classification

### Public Configuration (Not Secret)
- `SUPABASE_URL` — Public Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Public anon key (frontend access)
- `LOG_LEVEL` — Logging verbosity
- `RATE_LIMIT_*` — Rate limiting thresholds

### Sensitive Secrets (Vault Only)
- `SUPABASE_SERVICE_ROLE_KEY` — Full DB access, backend only
- `ANTHROPIC_API_KEY` — Claude API key
- `STRIPE_SECRET_KEY` — Payment API key
- `RESEND_API_KEY` — Email service key
- `OPENAI_API_KEY` — OpenAI fallback (optional)

### Environment-Specific

| Secret | Dev | GitHub Actions | Cloudflare Vault |
|--------|-----|-----------------|------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | Secret | ✅ |
| `ANTHROPIC_API_KEY` | `.env.local` | Secret | ✅ |
| `STRIPE_SECRET_KEY` | Test key | Test secret | ✅ Live key |
| `RESEND_API_KEY` | Test key | Test secret | ✅ Live key |

---

## Development Setup

### 1. Create `.env.local` (gitignored)

```bash
# .env.local (NEVER COMMIT)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Never use in frontend
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_test_...
VITE_SENTRY_DSN=https://...@sentry.io/...
```

### 2. Load in Supabase Local Development

```bash
# Load env vars into local Supabase stack
supabase start  # Reads from .env.local automatically
```

### 3. Test Locally

```bash
npm run dev  # Vite picks up VITE_* vars for frontend
# Backend (Supabase functions) read from .env.local for other secrets
```

---

## GitHub Actions Secrets

### 1. Set Repository Secrets

Go to **Repository → Settings → Secrets and variables → Actions**

Add these secrets:

```
SUPABASE_URL                    → https://your-project.supabase.co
VITE_SUPABASE_URL               → https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY          → eyJhbGc...
VITE_SENTRY_DSN                 → https://...@sentry.io/...
VITE_STRIPE_PRICE_STARTER       → price_1234...
VITE_STRIPE_PRICE_GROWTH        → price_5678...
VITE_STRIPE_PRICE_AGENCY        → price_9012...
VITE_STRIPE_PRICE_SCALE         → price_3456...
VITE_STRIPE_PRICE_STARTER_YEARLY → price_7890...
VITE_STRIPE_PRICE_GROWTH_YEARLY  → price_2345...
VITE_STRIPE_PRICE_AGENCY_YEARLY  → price_6789...
VITE_STRIPE_PRICE_SCALE_YEARLY   → price_0123...

CLOUDFLARE_API_TOKEN            → (for Pages deploy)
CLOUDFLARE_ACCOUNT_ID           → (for Pages deploy)
```

### 2. Workflow Integration

In `.github/workflows/deploy-cloudflare-pages.yml`:

```yaml
env:
  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
  VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

**Note**: Service role keys and API keys for backend stay in Supabase Edge Functions environment (not GitHub Actions).

---

## Cloudflare Secrets Vault (Production)

### 1. Store Secrets in Cloudflare Dashboard

```bash
# Via CLI:
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
# → Prompts for value, stores encrypted in Cloudflare Vault

wrangler secret put ANTHROPIC_API_KEY --env production
wrangler secret put STRIPE_SECRET_KEY --env production
wrangler secret put RESEND_API_KEY --env production
```

### 2. Store Multiple Secrets at Once

```bash
# Create a JSON file with secrets (NEVER commit this)
cat > secrets.json << 'EOF'
{
  "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGc...",
  "ANTHROPIC_API_KEY": "sk-ant-...",
  "STRIPE_SECRET_KEY": "sk_live_...",
  "RESEND_API_KEY": "re_..."
}
EOF

# Bulk deploy (non-interactive, safe for CI)
wrangler secret:bulk put secrets.json --env production

# Clean up
rm secrets.json
```

### 3. Access Secrets in Workers Code

```typescript
// worker.ts
export default {
  async fetch(request: Request, env: Env) {
    // Static vars (non-secret):
    const logLevel = env.LOG_LEVEL;  // "info"
    
    // Secrets (encrypted at rest, decrypted at runtime):
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const anthropicKey = env.ANTHROPIC_API_KEY;
    
    // Return response
    return new Response(`Configured for ${logLevel}`);
  }
};
```

### 4. Environment Type Definition

```typescript
// worker-env.d.ts
interface Env {
  // Static vars
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  RATE_LIMIT_WINDOW_MS: string;
  RATE_LIMIT_MAX_REQUESTS: string;
  
  // Secrets (undefined in development, populated in production)
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  
  // KV Namespaces
  POLICY_CACHE: KVNamespace;
  RATE_LIMIT_STATE: KVNamespace;
  
  // R2 Buckets
  EVIDENCE_VAULT: R2Bucket;
}
```

---

## Secret Rotation

### 1. Rotate API Key (Anthropic, Stripe, etc.)

1. Generate new key in service provider dashboard
2. Store new key in Cloudflare:
   ```bash
   wrangler secret put ANTHROPIC_API_KEY --env production
   ```
3. Old key continues to work until removed from provider
4. Remove old key from provider after confirming no errors in logs

### 2. Rotate Database Password (Supabase)

1. Change password in Supabase → Database → Settings
2. Update `SUPABASE_SERVICE_ROLE_KEY` (if token-based) or connection string
3. Re-deploy functions:
   ```bash
   supabase functions deploy --project-id <proj-id>
   ```

### 3. Monitor Secret Expiry

Set calendar reminders for rotating long-lived secrets (quarterly for production):
- Stripe API keys (regenerate annually)
- Anthropic API tokens (check expiration policy)
- Database passwords (change semi-annually)

---

## Troubleshooting

### Secret Not Available in Worker

**Symptom**: `env.ANTHROPIC_API_KEY` is undefined in Worker

**Solution**:
1. Verify secret is deployed:
   ```bash
   wrangler secret list --env production
   ```
2. Confirm Worker environment matches secret environment:
   ```bash
   # In wrangler.toml
   [env.production]
   ```
3. Redeploy Worker:
   ```bash
   wrangler deploy --env production
   ```

### Secret Leaks in Logs

**Immediate Action**:
1. Rotate the leaked secret immediately
2. Review Sentry logs for any exposed values
3. Check Cloudflare WAF logs for unauthorized access

**Prevention**:
- Never log env vars directly
- Redact API keys in error messages:
  ```typescript
  const masked = key.slice(0, 7) + '***' + key.slice(-4);
  console.log(`Using key: ${masked}`);
  ```

### Development vs Production Secret Mismatch

**Symptom**: Works locally but fails in production

**Causes**:
- Using test API key in `.env.local`, live key in Cloudflare
- Missing secret in Cloudflare Vault
- Typo in secret name

**Fix**:
```bash
# List all secrets in production
wrangler secret list --env production

# Compare with .env.local
grep -v '^#\|^$' .env.local | cut -d= -f1 | sort
```

---

## Security Best Practices

### ✅ DO

- ✅ Store secrets in Cloudflare Vault for production
- ✅ Use GitHub Actions Secrets for CI builds
- ✅ Rotate secrets quarterly
- ✅ Use separate keys for dev/test/production
- ✅ Log secret names, never values
- ✅ Audit secret access in Cloudflare dashboard

### ❌ DON'T

- ❌ Commit `.env.local` or any secrets file to git
- ❌ Expose secrets in error messages or logs
- ❌ Hardcode secrets in source code
- ❌ Share secrets via Slack, email, or unencrypted channels
- ❌ Reuse production secrets in development
- ❌ Grant access to production secrets to everyone

---

## Automated Rotation (Future)

```bash
# Planned: GitHub Action for quarterly secret rotation
# .github/workflows/rotate-secrets.yml (not yet implemented)

name: Rotate Production Secrets
on:
  schedule:
    - cron: '0 0 1 * *'  # First day of each month

jobs:
  rotate:
    runs-on: ubuntu-latest
    steps:
      - name: Rotate Anthropic API key
        run: |
          # 1. Generate new key via Anthropic API
          # 2. Deploy to Cloudflare Vault
          # 3. Verify in production
          # 4. Revoke old key
```

---

## References

- [Cloudflare Secrets Documentation](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

**Last Updated**: 2026-07-23  
**Owner**: RealSyncDynamics Engineering  
**Status**: Production Ready
