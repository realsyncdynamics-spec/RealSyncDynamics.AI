# Cloudflare Pages Deployment Setup

**Status:** Ready to activate  
**Date:** 2026-06-22  
**Branch:** `claude/dreamy-gates-ns3qhm` (TypeScript fixes + Cloudflare workflow)

---

## Overview

Migration from GitHub Pages to Cloudflare Pages for the frontend deployment of `realsyncdynamicsai.de`.

**Why:**
- Better performance (Cloudflare global CDN)
- More flexibility (Workers, KV, etc. for future features)
- Integrated with existing Cloudflare domain setup
- Automatic HTTPS, DDoS protection

**What's ready:**
- ✅ Cloudflare Pages configuration (`wrangler.toml`)
- ✅ SPA fallback routes (`_redirects`)
- ✅ Security headers (`_headers`)
- ✅ GitHub Actions workflow (`.github/workflows/deploy-cloudflare-pages.yml`)
- ✅ TypeScript compilation (0 errors)
- ✅ Build process (npm run build: 16.48s)

**What's NOT ready:**
- ❌ Cloudflare API Token (user must create)
- ❌ Cloudflare Account ID (user must get)
- ❌ GitHub Actions secrets (user must add)
- ❌ Cloudflare Pages project (user must create)

---

## Step-by-Step Setup

### 1. Get Cloudflare Credentials

#### 1a. Create API Token

1. Go to **Cloudflare Dashboard** → **My Profile** → **API Tokens** → **Create Token**
2. Use template: **"Edit Cloudflare Workers"** or **"Custom Token"**
3. **Permissions:**
   - Account > Cloudflare Pages > Edit
   - Account > Workers Scripts > Edit
4. **Account Resources:** Your account
5. Copy the **API Token** (you'll paste it in GitHub)

#### 1b. Get Account ID

1. Go to **Cloudflare Dashboard** → any domain
2. Right sidebar: find **Account ID** (looks like: `abc123def456xyz`)
3. Copy it

### 2. Create Cloudflare Pages Project

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **Pages** → **Create application**
2. Select: **Connect to Git**
3. **Repository:** `realsyncdynamics-spec/RealSyncDynamics.AI`
4. **Branch:** `main`
5. **Build settings:**
   - **Framework preset:** `None` (manual)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** *(leave empty)*
   - **Node.js version:** `20`
6. **Environment Variables (Production):**

| Variable | Value | Source |
|----------|-------|--------|
| `VITE_SUPABASE_URL` | `https://ebljyceifhnlzhjfyxup.supabase.co` | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (long string) | Supabase → Settings → API → `sb_anon_public` key |
| `VITE_STRIPE_PRICE_STARTER` | `price_1...` | Stripe Dashboard → Products → Starter → Price ID |
| `VITE_STRIPE_PRICE_GROWTH` | `price_2...` | Stripe → Products → Growth → Price ID |
| `VITE_STRIPE_PRICE_AGENCY` | `price_3...` | Stripe → Products → Agency → Price ID |
| `VITE_SENTRY_DSN` | `https://abc@def.ingest.sentry.io/123` | Sentry Project Settings → DSN (optional) |

7. Click **Save and Deploy**

### 3. Add GitHub Actions Secrets

1. Go to **GitHub** → `realsyncdynamics-spec/RealSyncDynamics.AI`
2. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
3. Add both secrets:

| Name | Value |
|------|-------|
| `CLOUDFLARE_API_TOKEN` | *(paste from Cloudflare step 1a)* |
| `CLOUDFLARE_ACCOUNT_ID` | *(paste from Cloudflare step 1b)* |

4. Also ensure these **environment variables** are configured:
   - In Cloudflare Pages project settings (see step 2)
   - OR as GitHub Actions secrets (if Cloudflare project doesn't have them)

### 4. Configure Custom Domain in Cloudflare Pages

1. **Cloudflare Dashboard** → **Workers & Pages** → **Pages** → **realsyncdynamics-ai** project
2. **Settings** → **Domains & DNS** → **Add domain**
3. Enter: `realsyncdynamicsai.de`
4. Cloudflare automatically creates the DNS record (CNAME or A)
5. Wait for SSL certificate to be issued (~5 minutes)

### 5. Update DNS (if needed)

**Current state:** Domain DNS likely points to GitHub Pages (185.199.108.153)

**Target:** Points to Cloudflare Pages

**How:**
- If Cloudflare is authoritative DNS: Cloudflare Pages setup handles it automatically
- If not: Update your domain registrar's nameservers to Cloudflare
  ```
  NS1.CLOUDFLARE.COM
  NS2.CLOUDFLARE.COM
  NS3.CLOUDFLARE.COM
  NS4.CLOUDFLARE.COM
  ```

### 6. Disable GitHub Pages (Optional)

Once Cloudflare is live and working:

1. Go to **GitHub** → **Settings** → **Pages**
2. **Source:** Set to "None" (disable)
3. Delete `public/CNAME` from repo (or keep it for reference)

---

## Verification

Once setup is complete:

```bash
# 1. Check DNS
dig realsyncdynamicsai.de A
# Expected: Cloudflare IP (104.16.x.x range)

# 2. Check HTTPS
curl -I https://realsyncdynamicsai.de/
# Expected: HTTP 200, server: cloudflare

# 3. Check SPA fallback
curl -I https://realsyncdynamicsai.de/app
# Expected: HTTP 200 (not 404)

# 4. Check security headers
curl -I https://realsyncdynamicsai.de/ | grep -i "x-content-type-options"
# Expected: X-Content-Type-Options: nosniff
```

---

## Deployment Flow

Once secrets are added, any `git push` to `main` will:

```
1. Trigger GitHub Actions workflow
   ↓
2. Install dependencies (npm ci)
   ↓
3. TypeScript lint (npm run lint)
   ↓
4. Vite build (npm run build) → dist/
   ↓
5. Playwright prerender critical routes
   ↓
6. Generate SPA fallback (dist/404.html, dist/<route>/index.html)
   ↓
7. Deploy to Cloudflare Pages (via API Token)
   ↓
8. Smoke test 15 seconds later (check / /pricing /audit /app)
   ↓
9. If all 200 → ✅ Deploy successful
   If any 403/404 → ❌ Workflow fails, GitHub notifies
```

---

## Troubleshooting

### "403 Forbidden" on Cloudflare Pages

**Cause:** Custom domain not configured in Cloudflare Pages settings.

**Fix:**
1. Go to Cloudflare Pages project settings
2. Add custom domain `realsyncdynamicsai.de`
3. Wait for TLS certificate (5 min)
4. Redeploy workflow

### "API Token invalid" in GitHub Actions

**Cause:** Token expired or has wrong permissions.

**Fix:**
1. Go to Cloudflare Dashboard
2. Create new API Token with correct permissions
3. Update GitHub secret `CLOUDFLARE_API_TOKEN`

### Build fails: "Cannot find module"

**Cause:** Missing environment variables.

**Fix:**
1. Check `.github/workflows/deploy-cloudflare-pages.yml`
2. Ensure all `VITE_*` secrets/variables are in GitHub Actions
3. Ensure they match Cloudflare Pages environment variables
4. Redeploy

### SPA fallback not working

**Cause:** `_redirects` file not deployed.

**Fix:**
1. Check `public/_redirects` exists: `/* /index.html 200`
2. Check workflow includes `_redirects` in prerender step
3. Verify `dist/404.html` exists after build

---

## Configuration Files

All files are checked into git:

| File | Purpose |
|------|---------|
| `wrangler.toml` | Cloudflare project name & output dir |
| `public/_redirects` | SPA fallback routing |
| `public/_headers` | Security headers (HSTS, CSP, etc.) |
| `.github/workflows/deploy-cloudflare-pages.yml` | GitHub Actions deployment pipeline |
| `deploy/cloudflare-pages/README.md` | Manual setup instructions (legacy) |

---

## Next Steps (after setup)

1. ✅ Activate workflow by adding secrets
2. ✅ Push to `main` branch
3. ✅ GitHub Actions triggers
4. ✅ Check Actions logs for deploy status
5. ✅ Visit https://realsyncdynamicsai.de (should return 200)
6. ✅ Disable GitHub Pages in repo settings (optional)

---

## Migration Checklist

- [ ] Cloudflare API Token created
- [ ] Cloudflare Account ID obtained
- [ ] GitHub secrets added (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)
- [ ] Cloudflare Pages project created
- [ ] Environment variables in Cloudflare Pages set
- [ ] Custom domain added to Cloudflare Pages
- [ ] DNS updated (if needed)
- [ ] First deploy triggered (push to main or `workflow_dispatch`)
- [ ] Smoke tests pass (see Actions logs)
- [ ] Domain resolves to Cloudflare IP
- [ ] HTTPS working
- [ ] GitHub Pages disabled (optional)

---

## Reference

- Cloudflare Pages Docs: https://developers.cloudflare.com/pages/
- GitHub Actions Workflow: `.github/workflows/deploy-cloudflare-pages.yml`
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/install-and-update/
