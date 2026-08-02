# RealSyncDynamics.AI: Production Blockers & Action Items

**Date:** 2026-08-01 | **Status:** Phase 2 Production-Ready | **Go-live Target:** 2026-08-02

---

## Executive Summary

The project is **architecturally ready** for production (Phase 2 complete), but deployment is blocked by **3 critical P0 issues** requiring manual intervention outside git/code.

**Current State:**
- ✅ Frontend: Vite dev server running successfully on localhost:3000
- ✅ TypeScript: Zero compilation errors (`npm run lint` passes)
- ✅ 49 open PRs (ready for consolidation & merge)
- ❌ **3 critical blockers preventing production deployment**
- ❌ **Database migration drift** blocking `supabase db push`

**Earliest Safe Go-Live:** 2026-08-02 (after blockers resolved)

---

## P0 Blockers (Must Fix Before Production)

### 1. Missing Supabase Vault Secrets ⛔

**Status:** Unresolved since ~2026-05-12 (~3 months)

**Missing Keys:**
- `resend_api_key` — Email delivery completely disabled
- `stripe_secret_key` — Stripe checkout returns HTTP 500
- `stripe_webhook_secret` — Webhook validation fails

**Current Impact:**
- **Email Delivery:** 0/67 audits have `email_sent_at` set (email-drip non-functional)
- **Stripe:** `vault.secrets.stripe_secret_key` contains placeholder `sk_live_PLACEHOLDER_KEY`
  - Subscriptions table: 0 active subscriptions
  - Webhook events: 0 received (only ping tests)
  - Live checkout: HTTP 500 on payment button

**Action Required (User/Ops Team):**
```bash
# Step 1: Get keys from provider dashboards
1. Log into https://resend.com → Dashboard → API Keys → Copy "live" key
2. Log into https://dashboard.stripe.com → Developers → API Keys → Copy "Secret Key"
3. Log into https://dashboard.stripe.com → Developers → Webhooks → Copy "Signing secret"

# Step 2: Store in Supabase Vault
supabase link --project-ref ebljyceifhnlzhjfyxup
supabase secrets set resend_api_key="re_..."
supabase secrets set stripe_secret_key="sk_live_..."
supabase secrets set stripe_webhook_secret="whsec_..."

# Step 3: Backfill pending email audits
supabase functions deploy audit-report-email --project-ref ebljyceifhnlzhjfyxup
# Run backfill script (TBD: exists in scripts/ or manual SQL)
```

**Effort:** 15-30 min (once keys acquired from Resend + Stripe dashboards)
**Blocker Type:** External (requires third-party API keys)

---

### 2. Database Migration Drift ⛔

**Status:** RE-DIAGNOSED 2026-08-02 against the live DB (`ebljyceifhnlzhjfyxup`).
The original diagnosis below was **wrong**. Corrected version follows.

#### ❌ What the original diagnosis said (do NOT act on this)

> Orphan migration version `20260510` (8-digit vs 14-digit) blocks `db push`.
> Fix: `supabase migration repair --status reverted 20260510`

**This is incorrect and the suggested command is harmful.** Verified facts:

- `20260510_ai_governance_core.sql` **does exist** in `supabase/migrations/`.
- Its 8-digit name is **deliberate**, not an accident. It is explicitly
  allowlisted in two guard scripts as a legacy bootstrap file:
  - `scripts/check-migration-drift.mjs` → `LEGACY_VERSIONS = new Set(['00001', '20260510'])`
  - `scripts/pre-deploy-lint.mjs` → `LEGACY_FILENAME_ALLOWLIST`
- All five tables it creates (`ai_systems`, `ai_policies`, `ai_evidence_events`,
  `ai_runtime_events`, `ai_evidence_retention`) exist in prod and the version is
  recorded as applied.

Running `migration repair --status reverted 20260510` would delete a valid
history row and make the next `db push` re-run that DDL against a live schema.
The file happens to be idempotent (`create ... if not exists`, `create or
replace`, `drop trigger if exists`, zero bare `create policy`), so it would
probably survive — but it is pointless churn against prod for a non-problem.

#### ✅ The actual drift

`supabase db push` is blocked by **11 remote-only versions** — migrations applied
straight to prod and never committed. This is exactly the incident
`scripts/check-migration-drift.mjs` was written to catch after 2026-05-28.

| Version | Name | Local file? |
|---|---|---|
| 20260628121531 | bots_foundation | ❌ (local uses 20260628120000) |
| 20260628121551 | bots_entitlements | ❌ (local uses 20260628120100) |
| 20260628121603 | bots_ai_tool | ❌ (local uses 20260628120200) |
| 20260628193744 | bots_foundation | ❌ duplicate re-apply |
| 20260628193759 | bots_entitlements | ❌ duplicate re-apply |
| 20260628193820 | bots_ai_tool | ❌ duplicate re-apply |
| 20260701121059 | remove_duplicate_auth_user_trigger | ✅ recovered 2026-08-02 |
| 20260715105402 | create_document_vault | ✅ recovered 2026-08-02 |
| 20260720123325 | perf_lint_fixes_rls_initplan_dup_index_search_path | ✅ recovered 2026-08-02 |
| 20260720123711 | add_missing_tenants_industry_column | ✅ recovered 2026-08-02 |
| 20260720124405 | restrict_document_vault_to_super_admin | ✅ recovered 2026-08-02 |

The three `bots_*` migrations were applied to prod **twice**, under two sets of
auto-generated timestamps, neither matching the committed filenames.

**Why CI never caught this:** `check-migration-drift.mjs` exits 0 when
`SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_ID` are absent. On PRs those secrets
are not exposed, so the green "drift" check is a **skip, not a pass**.

#### Already done (committed on `claude/offene-branches-prs-plan-j009ft`)

The 5 genuine orphans — those with no local counterpart under any name — were
recovered verbatim from `supabase_migrations.schema_migrations` and committed.
This is correct under either resolution option below.

#### Remaining decision (User/DB Admin) — the 6 `bots_*` rows

**Option A — commit the source.** Add 6 more files matching the remote
timestamps. Zero prod mutation; repo ends up with duplicate near-identical bots
migrations.

**Option B — repair the duplicates (cleaner).** `migration repair --status
reverted` only deletes the history row, it runs no down-migration, so the
already-created bots objects are untouched. The committed
`20260628120000/120100/120200` files then apply cleanly — verified idempotent
(16/16 `CREATE ... IF NOT EXISTS`; all 10 `CREATE POLICY` preceded by a matching
`DROP POLICY IF EXISTS`).

```bash
supabase link --project-ref ebljyceifhnlzhjfyxup

# Option B only:
for v in 20260628121531 20260628121551 20260628121603 \
         20260628193744 20260628193759 20260628193820; do
  supabase migration repair --status reverted "$v"
done

# Both options — ALWAYS dry-run first:
supabase db push --dry-run
```

⚠️ **119 local migrations are currently unapplied on prod.** Do not run a bare
`supabase db push` until that list has been reviewed — it is far more than the
bots delta and is its own scoping exercise.

**Effort:** 30-60 min (includes review of remote schema)
**Blocker Type:** Database state mismatch (requires Supabase CLI access)

---

### 3. Ambiguous VPS Frontend Deployment Path ⛔

**Status:** RESOLVED BY EVIDENCE 2026-08-02 — no SSH access needed. The original
write-up had the wrong path, so the prescribed SSH check would have inspected a
directory the workflow never writes to and wrongly concluded "dead".

#### ❌ Correction to the original write-up

It claimed the workflow deploys to `72.61.89.191:/var/www/realsyncdynamicsai.de/dist`
via rsync. Reading `.github/workflows/deploy-frontend-vps.yml` directly, it
actually rsyncs the **repo source** to `/var/www/realsyncdynamicsai-frontend/`
and then runs `docker compose up -d --build` from
`deploy/frontend-vps-deploy-v2/`. That directory **is** committed
(`docker-compose.yml`, `nginx.conf`, `.env.example`, `README.md`), so the
"missing Docker service definition" concern does not apply.

#### ✅ Who actually serves production

`https://realsyncdynamicsai.de` is served by **Cloudflare**, not the VPS:

| Probe | Result | Meaning |
|---|---|---|
| `HEAD /` | `server: cloudflare`, `cf-ray`, `cf-cache-status: DYNAMIC` | Cloudflare edge |
| `GET /healthz` content-type | `text/html` (SPA `index.html`) | SPA catch-all rewrite |
| `nginx.conf` `location = /healthz` | `add_header Content-Type text/plain` | VPS would return **text/plain** |
| `72.61.89.191:8090/healthz` | connection timed out | not publicly exposed |
| `72.61.89.191:80` | 308 redirect | host is up, but not serving this content |

The content-type mismatch is decisive: production `/healthz` returns the SPA
HTML shell, which is Cloudflare Pages' catch-all. Had the VPS nginx been the
origin, it would have returned `text/plain`. **The VPS is not serving the public
domain.**

#### ⚠️ The workflow's own verification is a false positive

Its final step runs `curl -fsSL https://realsyncdynamicsai.de/healthz` and gets
200 — from Cloudflare, regardless of whether the VPS deploy did anything. The
workflow can report a fully successful deploy while changing nothing users see.
That is the more serious finding here: it is not merely dead, it is
**misleadingly green**.

#### Decision (User/Ops) — not taken unilaterally

`deploy-frontend-vps.yml` triggers on every push to `main` touching `src/**`, so
it currently burns CI minutes and SSH secrets for no user-visible effect.

- **If the VPS is not intended as an origin/failover** → delete
  `.github/workflows/deploy-frontend-vps.yml`. `deploy/frontend-vps-deploy-v2/`
  can stay as documentation.
- **If it IS intended as a warm failover** → keep it, but fix the verification
  step to probe the VPS origin directly (e.g. `curl --resolve
  realsyncdynamicsai.de:443:72.61.89.191`) and assert `content-type: text/plain`
  on `/healthz`, so a broken VPS deploy actually fails the job.

Left in place pending that decision — deleting a deploy path is not reversible
from CI history alone.

**Blocker Type:** downgraded from ⛔ P0 to ⚠️ P1 — it does not block go-live,
because it does not serve production traffic.

---

## P1 Blockers (Important, Pre-Production)

### 4. HTTP 404 on Nested SPA Routes

**Status:** Known issue (documented)

**Symptom:**
- Routes like `/welcome`, `/login`, `/setup`, `/checkout/success` return HTTP 404 from GitHub Pages
- React Router still takes over → UI renders correctly
- **Problem:** Breaks HTTP status code, crawlers see 404, social previews fail, Stripe redirect validation might fail

**Example:**
```bash
curl -I https://realsyncdynamicsai.de/checkout/success
# HTTP 404 Not Found ← expected 200
```

**Root Cause:** GitHub Pages SPA fallback configuration quirk with nested routes

**Workaround (Temporary):**
- Stripe payment validation: may fail redirect with 404 status
- SEO: crawlers see 404 on deep routes

**Action (Phase 3):**
```bash
# Solution: Netlify/Cloudflare Workers SPA routing
# or: Prerender all critical routes (already done in CI)
# Current: SPA shell fallback works but returns 404 status
```

**Effort:** 2 hours (reconfigure GitHub Pages SPA routing or migrate CDN)
**Blocker Type:** Quality (impacts SEO, status codes, but UI works)

---

### 5. Monitoring Not Verified

**Status:** Configuration exists, not validated in production

**Issue:**
- Sentry integration configured via `VITE_SENTRY_DSN` (optional)
- Edge Functions error tracking exists but untested
- No production verification that errors are captured

**Action (Phase 3):**
```bash
# Step 1: Set VITE_SENTRY_DSN in GitHub Actions secrets
# Step 2: Deploy frontend
# Step 3: Trigger test error and verify in Sentry dashboard
# Step 4: Check Edge Function logs in Supabase
```

**Effort:** 30 min (add secret + verify)
**Blocker Type:** Observability (not critical for launch, but required for monitoring)

---

## Deployment Checklist (Before Go-Live)

### ✅ Code Readiness
- [x] TypeScript type check passes (`npm run lint`)
- [x] Frontend dev server running (localhost:3000)
- [x] No compilation errors
- [ ] All tests pass (`npm test`)
- [ ] Build completes (`npm run build`)
- [ ] E2E tests pass (`npm run test:e2e`)

### ⚠️ Manual Ops Tasks (User Responsibility)
- [ ] **Supabase Vault:** Secrets provisioned (resend_api_key, stripe_secret_key, stripe_webhook_secret)
- [ ] **DB Migrations:** Drift resolved (5 orphans recovered ✅; 6 bots_* rows pending Option A/B; 119 local migrations unreviewed)
- [x] **VPS Path:** Clarified — Cloudflare serves prod, VPS is not an origin (P1, not a go-live blocker)
- [ ] **GitHub Actions Secrets:** All environment variables configured

### 🚀 Pre-Production (Final Checks)
- [ ] `npm run check:production` passes
- [ ] `npm run smoke:production` passes
- [ ] Production readiness checklist signed off
- [ ] Deployment sequence validated (DB → Functions → Frontend)

---

## Timeline to Production

| Milestone | Owner | Duration | Date |
|-----------|-------|----------|------|
| **Code consolidation** (merge PRs) | Claude | 1 hour | 2026-08-01 |
| **Secrets provisioning** (Resend + Stripe) | User/Ops | 30 min | 2026-08-01 EOD |
| **DB migration repair** (Supabase CLI) | User/DB Admin | 1 hour | 2026-08-02 AM |
| **VPS path clarification** (SSH check) | User/Ops | 15 min | 2026-08-02 AM |
| **Production readiness checks** | Claude | 10 min | 2026-08-02 11:00 |
| **GitHub merge** (main → prod) | Claude | 2 min | 2026-08-02 14:00 |
| **🚀 Go-live** | User/Monitoring | — | 2026-08-02 14:30 |
| **Post-go-live monitoring** (24h) | User | Ongoing | 2026-08-02+ |

**Earliest safe go-live: 2026-08-02 @ 14:30 UTC** (assuming all blockers resolved by AM)

---

## Resources & Documentation

- **Migration Drift Guide:** `/root/.claude/plans/migration-drift.md`
- **Production Runtime Docs:** `/root/.claude/plans/production-runtime.md`
- **Supabase Vault Setup:** https://supabase.com/docs/guides/cli/managing-secrets
- **Stripe API Dashboard:** https://dashboard.stripe.com/developers/api
- **Resend API Dashboard:** https://resend.com/api-keys

---

## Questions for User

1. **Secrets:** Who retrieves Resend + Stripe keys? (Ops team / Finance / User?)
2. **Migration repair:** Who has Supabase access? (DB Admin / Ops team?)
3. **VPS path:** Shall we keep or delete the VPS frontend workflow?
4. **Monitoring:** Shall we enable Sentry on go-live or post-launch?

**These must be answered before production merge.**

