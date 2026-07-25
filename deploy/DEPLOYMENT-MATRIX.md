# Deployment Architecture & CI/CD Matrix

**Last Updated:** 2026-07-25  
**Phase:** 2 (Production Ready with Deployment Automation)  
**Status:** ✅ All workflows automated and documented

## Executive Summary

RealSyncDynamics.AI uses a **multi-target deployment strategy** with separate CI/CD pipelines for frontend, backend, and supporting services. Each path is optimized for its target infrastructure:

| Component | Target | Trigger | Primary Path | Duration | Status |
|-----------|--------|---------|--------------|----------|--------|
| **Frontend (React SPA)** | Cloudflare Pages + VPS | Push to `main` | Git hook | 3-8 min | ✅ |
| **Backend (Edge Fn)** | Supabase Functions | Push to `main` (migrations/) | CLI | 2-5 min | ⚠️ Blocked |
| **AI Runtime** | Ollama + n8n | Terraform / Docker | Manual | — | ✅ |
| **Error Tracking** | Sentry | Auto on deploy | Release tag | 1-2 min | ✅ |
| **Validation** | Pre-deploy linting | PR to `main` | GitHub Actions | 2-3 min | ✅ |

---

## Deployment Topology

### Overview Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Git Push to main                             │
└────────┬─────────────────────────────────────────────────────────────┘
         │
    ┌────┴───────────────────────────────────────────┐
    │                                                │
    ▼                                                ▼
[FRONTEND]                                    [BACKEND/MIGRATIONS]
GitHub Actions (build)                        GitHub Actions (validate)
    │                                                │
    ├──→ Lint + Build (npm run build)               ├──→ Pre-deploy lint
    ├──→ Cloudflare Pages deploy                    ├──→ Supabase db push
    │   (via Git integration)                       ├──→ Supabase fn deploy
    │   realsyncdynamicsai.de                       │
    │                                                ├──→ Post-deploy validation
    ├──→ VPS deploy (Docker)                        │
    │   deploy/frontend-vps-deploy-v2               └──→ ⚠️ BLOCKED by drift
    │   127.0.0.1:8090 (local VPS)                     (see below)
    │
    ├──→ Smoke test live routes                [MONITORING]
    │   / /pricing /app /governance            GitHub Actions
    │                                           └──→ Sentry release create
    ├──→ ✅ Successful                              (auto on frontend deploy)
    │
    └──→ 🔄 On failure: Auto-rollback
         Previous Docker image or Cloudflare rollback
```

### Parallel Execution

**db-push** and **functions-deploy** run in **parallel** (no dependency):
- If migrations fail → db-push job fails, functions-deploy continues
- If functions fail → functions-deploy job fails, db-push status independent
- Post-deploy validation only runs if both succeed

### Known Blocker: Migration Drift

```
Push to main (supabase/migrations/*)
    │
    ▼
┌──────────────────────────────────────────┐
│ db-push Job                              │
│ - supabase db push --include-all         │
│ - Checks for 20260510 orphan             │
│ ❌ FAILS: Orphan blocks all pushes       │
└──────────────────────────────────────────┘
    │
    └──→ 🔄 Error output:
         "Remote migration versions not found in local migrations directory"
         "Run: supabase migration repair --status reverted 20260510"
    │
    ├──→ ⏮️ BLOCKER: No migrations deployed since 2026-05-10
    │
    └──→ 📖 See: DEPLOYMENT.md (Current Status section) for one-time fix
```

**Resolution**: One-time production fix required (documented in DEPLOYMENT.md)

---

## Workflows & Triggers

### 1. Pre-Deploy Lint (on PRs)

**File**: `.github/workflows/pre-deploy-check.yml`  
**Trigger**: PR to `main` (changes in `supabase/migrations/`, `supabase/functions/`, config)

**Validations**:
- ✅ Migration filename format (YYYYMMDDHHMMSS_*.sql)
- ✅ No duplicate versions
- ✅ Functions on disk have config.toml entries
- ✅ Agent contract filenames match spec
- ✅ No noisy `verify_jwt=true` re-statements

**Output**: GitHub step summary + artifact (lint result JSON)

---

### 2. Deploy: Frontend

**File**: `.github/workflows/deploy-cloudflare-pages.yml`  
**Trigger**: Push to `main` (src/, public/, vite.config.ts, Dockerfile.frontend)

**Steps**:
1. Setup Node.js 20
2. Install deps (`npm ci`)
3. Lint (`npm run lint`) — continue-on-error
4. Build (`npm run build`)
   - Env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SENTRY_DSN
5. Generate legal pages (`npm run generate:legal-pages`)
6. Prerender routes (`npm run prerender`)
7. Generate SPA fallback (404.html)
8. Upload build artifact
9. Deploy to Cloudflare Pages (if secrets configured)
10. Smoke test live routes (/, /pricing, /audit, /governance-runtime, /app)
11. Create Sentry release (optional, if SENTRY_AUTH_TOKEN set)

**Duration**: 5-8 minutes  
**Targets**:
- Cloudflare Pages: `realsyncdynamicsai.de` (primary)
- VPS (optional): `deploy/frontend-vps-deploy-v2` (Docker deploy)

---

### 3. Deploy: Backend + Migrations

**File**: `.github/workflows/deploy.yml`  
**Trigger**: Push to `main` (supabase/migrations/**, supabase/functions/**, config.toml)

**Jobs** (parallel):

#### db-push
1. Link Supabase project
2. Run: `supabase db push --include-all`
   - Hard exit on error (exit code != 0)
   - Outputs migration status to step summary
3. ❌ **Currently blocked** by 20260510 orphan (documented in DEPLOYMENT.md)

#### functions-deploy
1. Deploy edge functions: `supabase functions deploy`
   - Independent job, not affected by db-push failure
   - Continues even if db-push fails

#### post-deploy-validation
1. Download Supabase schema metadata
2. Validate tables, migrations, RLS policies
3. Verify function endpoints
4. ✅ If validation passes, log deployment summary

#### create-backend-sentry-release
1. Generate version: `backend-v<tag>.<sha>`
2. Create Sentry release (optional, if SENTRY_AUTH_TOKEN set)
3. Link commits via git integration

**Duration**: 2-5 minutes (db-push currently fails)

---

### 4. Deploy: Frontend to VPS

**File**: `.github/workflows/deploy-frontend-vps.yml`  
**Trigger**: Push to `main` (src/, Dockerfile.frontend, deploy/frontend-vps-deploy-v2/)

**Steps**:
1. Checkout code
2. Setup Node.js + npm cache
3. Install deps
4. Lint TypeScript
5. Type check (`npm run lint`)
6. Build frontend (`npm run build`)
7. Configure SSH key
8. Sync source to VPS via rsync
9. SSH into VPS + run docker compose up -d --build
10. Healthcheck (max 60s)
11. Verify public URL (max 10 attempts × 2s)
12. On failure: Auto-rollback to previous Docker image

**Targets**:
- VPS hostname (from secrets: `VPS_SSH_HOST`)
- Path: `/var/www/realsyncdynamicsai-frontend/deploy/frontend-vps-deploy-v2/`
- Container port: 8090 (local VPS)
- Public via Traefik reverse proxy

**Duration**: 3-5 minutes

---

## Secrets & Credentials Matrix

### Required for Frontend Deploy

```
GitHub Actions Secrets:
├─ VITE_SUPABASE_URL           (build env)
├─ VITE_SUPABASE_ANON_KEY      (build env)
├─ VITE_SENTRY_DSN             (optional, build env)
├─ VITE_STRIPE_PRICE_*         (8 tier IDs, build env)
├─ VPS_SSH_KEY                 (private key for VPS)
├─ VPS_SSH_HOST                (VPS hostname/IP)
├─ VPS_SSH_USER                (SSH user, usually 'root')
├─ VPS_SSH_KNOWN_HOST          (VPS host key fingerprint)
├─ CLOUDFLARE_API_TOKEN        (optional, wrangler deploy)
└─ CLOUDFLARE_ACCOUNT_ID       (optional, wrangler deploy)
```

### Required for Backend Deploy

```
GitHub Actions Secrets:
├─ SUPABASE_ACCESS_TOKEN       (CI deploy token)
├─ SUPABASE_DB_PASSWORD        (for db linking)
├─ SUPABASE_PROJECT_ID         (project ref)
└─ SENTRY_AUTH_TOKEN           (optional, release tracking)
```

### Never in Secrets

```
❌ SUPABASE_SERVICE_ROLE_KEY     (use env vars in Edge Functions)
❌ STRIPE_SECRET_KEY              (use Supabase secrets / Edge Functions)
❌ ANTHROPIC_API_KEY              (use Supabase secrets / Edge Functions)
```

---

## Error Handling & Recovery

### Frontend Deployment Failure

**Scenario**: Smoke test fails after deploy

**Auto-Recovery**:
1. GitHub Actions detects HTTP error
2. Triggers rollback job
3. Pulls previous Docker image or Cloudflare previous deployment
4. Restarts container
5. Verifies new health status
6. Posts failure summary to GitHub

**Manual Recovery**:
```bash
# VPS rollback
ssh root@<vps-host>
cd deploy/frontend-vps-deploy-v2
docker image tag realsync-frontend:previous realsync-frontend:latest
docker compose down && docker compose up -d

# Cloudflare rollback (via dashboard)
# Pages → Deployments → Previous → Rollback
```

### Backend Deployment Failure

**Scenario**: Migration fails or validation fails

**Current State**:
- db-push job fails (migration drift blocker)
- functions-deploy continues (independent)
- Post-deploy validation skips if db-push failed

**Resolution**:
1. Fix issue locally
2. Test: `supabase db reset && npm run test:db`
3. Commit + push
4. GitHub Actions re-runs on next main push

---

## Monitoring & Observability

### GitHub Actions Workflow Status
- **URL**: https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/actions
- **View**: All runs, filtered by workflow
- **Step logs**: Expandable, includes build output + deployment status

### Sentry Release Tracking
- **URL**: https://sentry.io/organizations/realsyncdynamics/
- **View**: Releases tab → See all deployed versions
- **Errors**: Issues tab → Filter by release → Linked commits

### Supabase Function Logs
- **URL**: Supabase dashboard → Functions → Logs
- **View**: Real-time function execution logs
- **Errors**: Captured with full stack trace

### VPS Deployment Logs
```bash
ssh root@<vps-host>
cd deploy/frontend-vps-deploy-v2

# Docker logs
docker compose logs -f frontend

# Health status
docker inspect realsync-frontend | jq '.State.Health'

# nginx error logs
docker exec realsync-frontend tail -f /var/log/nginx/error.log
```

---

## Deployment Checklist (Release)

Before pushing to `main`:

- [ ] Branch: Create feature branch (`feature/xyz`)
- [ ] Code: Implement feature + tests
- [ ] Tests: `npm test` passes
- [ ] Type check: `npm run lint` passes
- [ ] E2E: `npm run e2e` passes (if UI changes)
- [ ] Build: `npm run build` succeeds locally
- [ ] Pre-deploy lint: `node scripts/pre-deploy-lint.mjs` passes
- [ ] PR: Create PR → request review
- [ ] Review: Address feedback, re-request if changed
- [ ] Merge: Merge to `main` when approved
- [ ] Auto-deploy: GitHub Actions runs automatically
- [ ] Monitor: Check Sentry for new errors
- [ ] Smoke test: Verify critical paths work

---

## Phase 3 Roadmap

### Immediate (Next Sprint)
- [ ] Resolve 20260510 migration drift (prod fix)
- [ ] Complete VPS Traefik integration
- [ ] Configure staging environment (`staging.realsyncdynamicsai.de`)
- [ ] Add source map uploads to Sentry

### Medium-term (Q3 2026)
- [ ] Canary deployments (10% → 50% → 100% rollout)
- [ ] Performance regression detection (CI/CD gate)
- [ ] Feature flags for zero-downtime migrations
- [ ] Multi-region replication (EU data residency)

### Long-term (Phase 3+)
- [ ] Blue-green deployments
- [ ] Automated rollback on error-spike detection
- [ ] AI-powered deployment recommendations
- [ ] TypeScript strict mode migration

---

## Support & Troubleshooting

**Common Issues**:

| Issue | Cause | Resolution |
|-------|-------|-----------|
| db-push fails | 20260510 orphan | See DEPLOYMENT.md (Current Status) |
| Frontend not accessible | DNS propagation | Wait 24h or check Cloudflare DNS settings |
| Sentry release not created | Token not set | Add SENTRY_AUTH_TOKEN to secrets |
| VPS deploy hangs | Container stuck | SSH in, check docker logs, restart |
| Pre-deploy lint fails | Migration filename | Rename to YYYYMMDDHHMMSS_*.sql |
| Smoke test fails | Server error | Check Cloudflare Pages build logs |

**Escalation**:
1. Check GitHub Actions logs
2. Read step summary (markdown)
3. Check service-specific logs (Sentry, Supabase, VPS)
4. Review DEPLOYMENT.md + related docs
5. If prod-critical: SSH into VPS and debug directly

---

## Related Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| `DEPLOYMENT.md` | Overall strategy + known issues | Everyone |
| `VPS-DEPLOYMENT.md` | VPS + Docker + Traefik setup | DevOps/Ops |
| `CLOUDFLARE-DEPLOYMENT.md` | Cloudflare Pages strategy | Frontend leads |
| `SENTRY-SETUP.md` | Error tracking configuration | Monitoring |
| `.github/workflows/*` | CI/CD workflows | DevOps/Release eng |
| `scripts/pre-deploy-lint.mjs` | Pre-deploy validation | Automation |
| `scripts/sentry-release.mjs` | Release management | Release eng |
| `scripts/validate-supabase-*.mjs` | Post-deploy validation | DevOps |

---

**Maintained by:** RealSyncDynamics Engineering Team  
**Last Review:** 2026-07-25  
**Next Review:** 2026-08-25 (post-launch)
