# Rollback Runbook

Concrete one-liners and decision trees for "production is broken — get it back to a known-good state in under 5 minutes." Companion to [`production-runtime.md`](production-runtime.md).

This runbook assumes you have:

- Repo write access to `realsyncdynamics-spec/RealSyncDynamics.AI`
- Supabase dashboard access to project `ebljyceifhnlzhjfyxup`
- SSH to the Hostinger VPS at `187.77.89.1` (key in `~/.ssh/`)
- The `gh` CLI authenticated

If any of those are missing, **stop here and acquire them before an incident**. Do not learn during the incident.

---

## Decision tree — start here

```
Production reported broken
        │
        ▼
Is realsyncdynamicsai.de returning HTTP 200?
   ├── no  → §1  Frontend down
   └── yes → continue
        │
        ▼
Is a Supabase Edge Function 401/500-ing?
   ├── 401 → §2a  verify_jwt config missed
   ├── 500 → §2b  Edge Function error
   └── no  → continue
        │
        ▼
Is the database returning unexpected schema?
   ├── yes → §3  Migration mishap
   └── no  → continue
        │
        ▼
Are sub-domain services down (chat / ollama / n8n)?
   ├── yes → §4  VPS sub-services
   └── no  → §5  Other / unknown
```

---

## §1 — Frontend down (`realsyncdynamicsai.de` not 200)

### 1a. Pinpoint where it's broken

```bash
# DNS resolves to a Hostinger IP?
dig +short realsyncdynamicsai.de A
# expected: ~187.77.x.x (Hostinger)

# Traefik reachable (TLS handshake works)?
curl -sI https://realsyncdynamicsai.de/  | head -5
# expected: HTTP/2 301 OR 200, server: GitHub.com OR Traefik

# GitHub Pages serving the actual bytes?
curl -sI https://realsyncdynamics-spec.github.io/RealSyncDynamics.AI/ | head -5
# expected: HTTP/2 200, server: GitHub.com
```

Three layers, three failure modes:

| Symptom | Root cause | Mitigation |
|---|---|---|
| DNS doesn't resolve | DNS dropped at registrar | Restore at registrar; propagation ~5 min |
| DNS resolves but TLS handshake fails | Cert renewal stalled on the VPS | `ssh deploy@187.77.89.1` then §1b |
| TLS works, 301 to GH Pages, GH Pages 404 | Pages deploy broke | §1c |
| TLS works, 301 to GH Pages, GH Pages 200 but stale | Pages deploy old version | §1c |

### 1b. Traefik / VPS layer

```bash
ssh deploy@187.77.89.1
cd /var/www/kodee-stack
docker compose ps                    # which services are up?
docker compose logs --tail=200 traefik | grep -iE 'error|fail|expir'
docker compose restart traefik       # forces cert-reload + route refresh
```

If `traefik` itself won't start, see `deploy/ollama-traefik/docker-compose.yml` in the repo for the canonical compose. Pull the latest, restart, smoke.

### 1c. GitHub Pages — roll back to the previous good build

```bash
# List recent Pages deploys
gh run list \
  --workflow=deploy-pages.yml \
  --repo realsyncdynamics-spec/RealSyncDynamics.AI \
  --limit 5

# Re-run a specific previous-good run
gh run rerun <run-id> --repo realsyncdynamics-spec/RealSyncDynamics.AI

# Confirm propagation (Pages CDN, ~2 min)
sleep 120 && curl -sI https://realsyncdynamicsai.de/ | head -5
```

Pages does **not** support blue/green or pinned versions — `gh run rerun` builds the older commit fresh and serves it. If the older commit's source no longer exists on `main`, see §1d.

### 1d. Source rollback (when GH Pages re-run isn't an option)

```bash
# Find the last commit that produced a good production
git log --oneline -20

# Revert the offending commit(s) with a *new* commit (never history-rewrite main)
git revert <bad-sha>                 # or 'git revert <a>..<b>' for a range
git push origin main

# This triggers deploy-pages.yml automatically.
```

For the SPA, a forward-revert is always preferable to a `--force` push. Pages caches respond to commit shas, not branch tips.

---

## §2 — Supabase Edge Function broken

### 2a. 401 after deploy (`verify_jwt` config didn't apply)

This means `supabase/config.toml` says `verify_jwt = false` for the function but the deploy didn't honour it.

```bash
# Trigger Deploy workflow manually with functions=true
gh workflow run deploy.yml \
  --repo realsyncdynamics-spec/RealSyncDynamics.AI \
  --field deploy_functions=true

# Watch
gh run watch \
  --repo realsyncdynamics-spec/RealSyncDynamics.AI \
  $(gh run list --workflow=deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')

# Smoke after run completes
curl -sS -o /dev/null -w "%{http_code}\n" -X POST \
  -H 'content-type: application/json' \
  -d '{"url":"x"}' \
  https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/<function-name>
# expected: 400 (not 401)
```

### 2b. 500 / internal error from one Edge Function

```bash
# Confirm which function
curl -v -X POST .../functions/v1/<name> 2>&1 | tail -20

# Roll back the source for *that one function* only — surgical revert
git log --oneline -- supabase/functions/<name>/
git checkout <previous-good-sha> -- supabase/functions/<name>/
git commit -m "revert(functions): pin <name> to <sha>"
git push origin main

# Trigger function-only deploy
gh workflow run deploy.yml \
  --repo realsyncdynamics-spec/RealSyncDynamics.AI \
  --field deploy_functions=true
```

Tail live logs from the Supabase dashboard during this — `Project → Edge Functions → <name> → Logs`.

### 2c. AI Gateway rate-limit kicking in for legitimate traffic

Symptoms: spike of 429s with `RATE_LIMITED` body. If the per-feature budget is too tight for a campaign or batch, temporarily raise it via env:

```bash
# In Supabase dashboard → Project Settings → Edge Functions → Vars:
# Override FEATURE_LIMITS for a specific feature key via a runtime env
# (only effective if the function reads it; currently it reads from
# the in-bundle DEFAULT_LIMITS constant — for a real raise, edit
# src/core/ai-gateway/rateLimit.ts → FEATURE_LIMITS and deploy).
```

**No env-only override for `ai-gateway` rate-limit at this time.** The fastest path is: bump the FEATURE_LIMITS constant in `src/core/ai-gateway/rateLimit.ts` (and the Deno mirror), commit, push, wait for `deploy.yml` to redeploy the function (~3 min).

---

## §3 — Database / migration mishap

### 3a. A migration applied that should not have

**Critical:** never `git revert` a migration file. That leaves the DB in a state newer than the source-of-truth and the next push will fail or, worse, succeed with a corrupt sync state.

The correct path is **always a forward-fix migration**.

```bash
# Create a new migration that reverses the bad one
TS=$(date -u +%Y%m%d%H%M%S)
cat > supabase/migrations/${TS}_revert_<topic>.sql <<'SQL'
BEGIN;
-- Reverse the changes from <bad migration filename> here.
-- Drop the table, restore the previous column type, recreate the
-- old function, etc. Match the exact inverse of what went wrong.
COMMIT;
SQL

git add supabase/migrations/${TS}_revert_<topic>.sql
git commit -m "revert(db): undo <topic> from <bad-sha>"
git push origin main
```

`deploy.yml` will pick it up and push it.

### 3b. `db push` itself failing in CI

Common cause: a migration on the remote DB that isn't in the local `supabase/migrations/` folder ("branch noise" from a developer environment).

Look at `deploy.yml` step **"Repair remote-only migrations"** — that's the long `--status reverted` list. To add a new offending ID:

```bash
# Find the migration ID that fails (the deploy log names it)
# Append it to the `supabase migration repair --status reverted ...` line
# in .github/workflows/deploy.yml

# Then commit + push; deploy.yml retries cleanly on next run
```

### 3c. Supabase project paused (billing / autopause)

Symptoms: every Edge Function 503, dashboard says "project paused."

This is **not** a rollback — it's a billing reactivation. Restore in the Supabase dashboard:

```
dashboard.supabase.com/project/ebljyceifhnlzhjfyxup
  → Settings → Billing → Restore project
```

Restoration typically ~2 min. No data loss; just downtime equal to the pause duration.

---

## §4 — VPS sub-services down (chat / ollama / n8n)

The frontend is on Pages, but the **`chat.realsyncdynamicsai.de` / `ollama.realsyncdynamicsai.de` / `n8n.realsyncdynamicsai.de`** subdomains live on the VPS. If those are 502/timeout:

```bash
ssh deploy@187.77.89.1
cd /var/www/kodee-stack

# What's broken?
docker compose ps
docker compose logs --tail=200 <service-name>

# Quick recovery — restart the offending service
docker compose restart kodee-chat        # or kodee-ollama / n8n / traefik

# If the container won't come up at all
docker compose down <service-name>
docker compose up -d <service-name>

# Disk full? Common reason for Ollama dying
df -h
docker system prune -f                   # cleans dangling images/layers
```

**Disk-full caveat:** Ollama model files are large (~5-30 GB each). If `/var` is at 90 %+, the runtime stops accepting new requests silently. Prune docker first, then check `/var/lib/ollama/models/` for old/unused weights.

---

## §5 — Other / unknown

### 5a. Stripe webhook stuck

If Stripe events aren't reaching the platform (`stripe-webhook` returns 4xx repeatedly), and Stripe is retrying:

```bash
# Pause Stripe retries from the dashboard temporarily
# dashboard.stripe.com → Developers → Webhooks → <endpoint> → Disable

# Fix the function or the secret rotation that caused the 401/403
# Resume the endpoint from the dashboard
# Stripe will retry queued events for ~3 days
```

Never delete-and-recreate the endpoint — that resets the `whsec_…` signing secret and you lose verification of in-flight events.

### 5b. Wrong DNS — accidental change at registrar

DNS rollback isn't a `git` operation:

```
Log into the registrar UI (Hostinger / Cloudflare / wherever DNS is hosted)
  → DNS records → A record for realsyncdynamicsai.de
  → Set back to 187.77.89.1 (Hostinger VPS)
  → AAAA record similarly, if present
  → Save; propagation 1-60 min depending on TTL
```

If the original DNS values are uncertain, the canonical reference is in `deploy-frontend.yml` (VPS_SSH_HOST secret) and `.env.example` (any documented host references).

### 5c. Cert renewal stalled (Traefik / Let's Encrypt)

Symptoms: browser cert-warning even though Traefik is running.

```bash
ssh deploy@187.77.89.1
cd /var/www/kodee-stack

# Inspect Traefik's ACME state
docker compose exec traefik cat /letsencrypt/acme.json | jq '.cert-resolver.Certificates[] | .domain'

# Force renewal by deleting the cached cert (Traefik refetches on next request)
docker compose exec traefik sh -c 'rm /letsencrypt/acme.json && touch /letsencrypt/acme.json && chmod 600 /letsencrypt/acme.json'
docker compose restart traefik

# Watch: a fresh cert appears within ~60s of the first inbound HTTPS request
docker compose logs -f traefik | grep -i 'certificate\|acme'
```

ACME rate-limits: Let's Encrypt allows 5 duplicate cert issuances per 7 days per identical hostname set. If you've already burned through rebuilds, switch the cert resolver to staging temporarily, validate, then back to prod.

---

## Smoke tests after every rollback

Run these in order. **Any failure = rollback did not work; revert the rollback and call for help.**

```bash
# 1. Frontend reachable
curl -sI -L https://realsyncdynamicsai.de/ | grep -E 'HTTP|server'
# expected: HTTP/2 200, server: GitHub.com

# 2. Production-readiness suite (7 critical surfaces)
cd <repo-root> && npm run check:production
# expected: All 7 checks passed.

# 3. Trust + Pilot routes specifically (sitemap was the fix in PR #251)
curl -sI https://realsyncdynamicsai.de/trust          | head -1
curl -sI https://realsyncdynamicsai.de/pilot-readiness | head -1
# expected: both HTTP/2 200

# 4. Public Edge Function reachable + verify_jwt applied
curl -sS -o /dev/null -w "%{http_code}\n" -X POST \
  -H 'content-type: application/json' -d '{"url":"x"}' \
  https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/gdpr-audit
# expected: 400 (not 401, not 5xx)

# 5. Tenant chat (auth-gated) — manual: log in as a tenant member,
#    open /governance, ask the assistant a question, expect a reply
```

Five greens = production is back. Anything red = stop, document, escalate.

---

## What this runbook does NOT cover

- Customer-data restoration from backup. That's a Supabase dashboard operation; see `docs/runbooks/dr-restore.md` (if/when it exists).
- Stripe refund / chargeback flow. That's a billing-ops procedure, not a deployment one.
- AI provider key rotation. See `docs/runbooks/credentials-activation.md`.
- SSL cert *purchase* (we don't buy — Let's Encrypt only).

Anything in scope of "the bits don't reach the user" — that's this runbook. Anything else — find the specific runbook or ask in `#ops`.
