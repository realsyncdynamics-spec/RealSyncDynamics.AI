# Phase 2: CI/CD Hardening Configuration

**Status:** Ready to implement  
**Date:** 2026-07-23  
**Branch Protection:** `main`

---

## Overview

Phase 2 removes Vercel from merge requirements and establishes Cloudflare Pages as the sole deployment gate. This ensures a clean, fast CI/CD pipeline without infrastructure blockers.

---

## Step 1: Remove Vercel from Required Checks

**Location:** GitHub → Settings → Branches → Branch Protection Rules → main

**Current failing checks to REMOVE:**
- ❌ `Vercel – real-sync-dynamics-ai` (account suspended)
- ❌ `Vercel – real-sync-dynamics-ai-9ue5` 
- ❌ `Vercel Deployments – realsynchost`

**Action:** Edit branch protection rule, uncheck these checks.

---

## Step 2: Define Required Checks

**Location:** GitHub → Settings → Branches → Branch Protection Rules → main → Edit

**Set as REQUIRED (must pass before merge):**
```
✅ build                    (GitHub Actions)
✅ Playwright E2E           (GitHub Actions)
✅ Build & Test             (GitHub Actions)
✅ Migration validation     (GitHub Actions)
✅ Cloudflare Pages         (Cloudflare)
```

**Allow to pass but NOT required:**
```
⏳ Cloudflare Pages (already passing)
⏳ Vercel Preview Comments (informational only)
```

---

## Step 3: Enforce Strict Status Checks

**In branch protection rule, enable:**
- ✅ **"Require status checks to pass before merging"**
- ✅ **"Require branches to be up to date before merging"** (strict mode)
- ✅ **"Require code reviews"** (0 approvals min, optional for cleanup)
- ✅ **"Dismiss stale pull request approvals when new commits are pushed"**

---

## Step 4: Configure Merge Settings

**Location:** GitHub → Settings → Branches → Branch Protection Rules → main

Enable:
- ✅ Require pull request reviews (1 review recommended)
- ✅ Dismiss stale reviews
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ❌ Allow force pushes (keep disabled)
- ❌ Allow deletion (keep disabled)

---

## Step 5: Cloudflare Pages Configuration

Verify Cloudflare Pages deployment is active:

**Check:**
```bash
# Verify Cloudflare project exists
curl -s "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects" \
  -H "Authorization: Bearer $CLOUDFLARE_TOKEN"
```

**Ensure:**
- ✅ Production deployment: branch = `main`
- ✅ Auto-deploy on push to `main`
- ✅ Preview deployments on PRs enabled

---

## Vercel Removal Checklist

### In Vercel Dashboard:
1. Go to **Vercel.com → Settings → Git Integrations**
2. Find **realsyncdynamics-spec/RealSyncDynamics.AI**
3. Click **"Disconnect"** (or just disable GitHub integration)
4. Confirm disconnection

### In GitHub:
1. Go to **Repo Settings → Integrations & services**
2. Remove **Vercel** if listed
3. Verify no Vercel checks appear in new PRs

---

## Testing Phase 2 Configuration

Create a test PR to verify:

```bash
git checkout -b test/phase-2-ci-hardening
echo "Test commit for Phase 2 CI/CD verification" >> PHASE_2_CI_CD_HARDENING.md
git add PHASE_2_CI_CD_HARDENING.md
git commit -m "test: Phase 2 CI/CD hardening configuration"
git push origin test/phase-2-ci-hardening

# Open PR on GitHub and verify:
# ✅ Build passes
# ✅ Playwright E2E passes
# ✅ Cloudflare Pages deploys
# ✅ NO Vercel checks appear
# ✅ NO "Account is blocked" errors
```

---

## Completion Checklist

- [ ] Vercel disconnected from GitHub
- [ ] Vercel checks removed from branch protection
- [ ] Required checks set: build, E2E, Migration, Cloudflare
- [ ] Strict mode enabled (branches must be up-to-date)
- [ ] Test PR created and verified
- [ ] No Vercel checks blocking merges
- [ ] Cloudflare Pages deploying successfully

---

## What's Next

Once Phase 2 is complete:
1. ✅ Repository is clean (branches)
2. ✅ CI/CD is hardened (no infrastructure blockers)
3. → **Phase 3: Cloudflare Optimization** (cache policies, KV, R2)

**Phase 2 is manual configuration. Once complete, update `CLEANUP_STATUS.md` with completion date.**
