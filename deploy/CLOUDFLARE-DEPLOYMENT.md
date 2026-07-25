# Cloudflare Pages Deployment Guide

**Last Updated:** 2026-07-25  
**Status:** Dual deployment strategy (Git-integrated + GitHub Actions)  
**Domain:** `realsyncdynamicsai.de` (apex) + `staging.realsyncdynamicsai.de`

## Overview

The frontend is deployed to **Cloudflare Pages** (the primary production deployment target). The strategy uses:

1. **Primary Path**: Cloudflare's native Git integration (no secrets needed)
   - Automatically deploys on push to `main`
   - Faster feedback loop, zero configuration
   
2. **Secondary Path**: GitHub Actions with wrangler CLI (optional)
   - Used if transitioning away from Cloudflare Git integration
   - Allows more control over build/deploy timing
   - Requires `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets

```
GitHub Push to main
    │
    ├─→ Cloudflare Git Integration (Active)
    │   └─→ Auto-deploy to realsyncdynamicsai.de ✅
    │
    └─→ GitHub Actions (Validation only)
        └─→ Lint + Build verification
        └─→ Smoke test live routes (if secrets configured)
```

## Architecture: Multiple Deployment Targets

### Production Deployments
| Target | Technology | Status | Primary? | Domain |
|--------|-----------|--------|----------|--------|
| **Cloudflare Pages** | Edge-deployed SPA | ✅ Active | **YES** | realsyncdynamicsai.de |
| **VPS (Hostinger)** | Docker + Traefik | ✅ Active | Secondary | Via Traefik routing |
| **GitHub Pages** | Legacy | ⚠️ Inactive | No | realsyncdynamics-spec.github.io |

**Current Primary**: Cloudflare Pages  
**Fallback**: VPS with Traefik reverse proxy  
**DNS Routing**: Cloudflare Points apex (`realsyncdynamicsai.de`) to Pages; Traefik handles subdomains (ollama.*, n8n.*, chat.*)

## Prerequisites

### Cloudflare Account Setup

1. **Create Cloudflare Project** (if not already done):
   ```bash
   # Via Cloudflare dashboard:
   # Cloudflare → Pages & Workers → Create application → Connect to Git
   ```

2. **GitHub Integration** (automatic):
   - Authorize Cloudflare App for your GitHub repo
   - Cloudflare auto-triggers build on `main` push
   - No secrets exposed to Cloudflare (build uses GitHub Secrets)

3. **Domain Setup**:
   ```bash
   # Add domain to Cloudflare
   # Cloudflare → Websites → Add site → realsyncdynamicsai.de
   # Update nameservers at registrar to point to Cloudflare
   ```

4. **Environment Variables** (in Cloudflare Pages Project Settings):
   ```
   VITE_SUPABASE_URL: <your-supabase-url>
   VITE_SUPABASE_ANON_KEY: <anon-key>
   VITE_SENTRY_DSN: <optional>
   VITE_STRIPE_PRICE_*: <pricing-tier-ids>
   ```

### GitHub Secrets (Optional for Actions-based Deploy)

If transitioning to GitHub Actions deployment:

```bash
# In GitHub: Repo → Settings → Secrets and variables → Actions
CLOUDFLARE_API_TOKEN=<global-api-token>  # From Cloudflare dashboard
CLOUDFLARE_ACCOUNT_ID=<account-id>       # From Cloudflare dashboard
```

### DNS Configuration

**Apex domain** (realsyncdynamicsai.de):
```
Type: CNAME (via Cloudflare Pages)
Points to: realsyncdynamics-ai.pages.dev
```

**Subdomains** (Traefik-routed):
```
Type: A
Points to: <vps-ip>
Subdomains: ollama.*, n8n.*, chat.realsyncdynamicsai.de
```

**DNS Records in Cloudflare**:
```
realsyncdynamicsai.de     CNAME   realsyncdynamics-ai.pages.dev   (Proxied)
www.realsyncdynamicsai.de CNAME   realsyncdynamics-ai.pages.dev   (Proxied)
n8n.realsyncdynamicsai.de A       <vps-ip>                        (DNS only)
ollama.realsyncdynamicsai.de A    <vps-ip>                        (DNS only)
chat.realsyncdynamicsai.de A      <vps-ip>                        (DNS only)
```

## Deployment Flow

### Automatic (Cloudflare Git Integration — Primary)

```bash
# 1. Push to main
git push origin main

# 2. Cloudflare detects push (webhook)
# 3. Cloudflare runs wrangler build (using wrangler.toml)
# 4. Build environment uses GitHub Actions Secrets (accessed via Git context)
# 5. Deploy to realsyncdynamics-ai.pages.dev
# 6. DNS aliases realsyncdynamicsai.de → pages.dev
# 7. ✅ Live within 30-60 seconds
```

**Build Process** (Cloudflare):
1. Clone repo
2. Install dependencies
3. Build (`npm run build`)
4. Generate legal pages (`npm run generate:legal-pages`)
5. Prerender critical routes (`npm run prerender`)
6. Generate SPA fallback (404.html copy + index.html per-route)
7. Deploy dist/ to Cloudflare

### Manual / GitHub Actions (Secondary)

```bash
# 1. Ensure secrets are set
# CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID

# 2. Push to main (or manually trigger workflow)
git push origin main

# 3. GitHub Actions runs:
# - npm ci, npm run lint, npm run build
# - Uploads dist/ artifact
# - Downloads artifact + deploys via wrangler
wrangler pages deploy dist --project-name=realsyncdynamics-ai --branch=main

# 4. ✅ Live within 2-3 minutes
```

## Build & Prerendering Strategy

### Static Routes (Prerendered)
Routes that must be fast-loading (SEO, initial paint):
- `/` (home)
- `/pricing` (conversion funnel)
- `/audit` (feature landing)
- `/governance-runtime` (public feature)
- All branch-specific landing pages

**Process**:
```bash
npm run prerender  # Playwright spins up dev server, renders each route, saves as static HTML
```

### Dynamic Routes (SPA Fallback)
Routes that require authentication or client-side state:
- `/app/*` (dashboard)
- `/governance/*` (authenticated flows)
- `/settings/*` (user account)

**Process**:
```bash
# Generate fallback 404.html (copy of index.html)
cp dist/index.html dist/404.html

# Cloudflare Pages routing rule (built-in):
# - Static assets: serve from dist/
# - 404 (dynamic route): serve dist/404.html (react-router takes over)
```

### Routes File (`_redirects`)
Cloudflare respects Netlify-style `_redirects` file for custom routing:

```
# Redirect /healthz to health check endpoint
/healthz  /__healthz  200

# SPA fallback (all 404 → index.html)
/*  /index.html  200
```

## Rollback

### Automatic Rollback (Cloudflare)
1. Go to Cloudflare Pages → Project → Deployments
2. Click on previous deployment
3. Click "Rollback to this deployment"
4. ✅ Live within 30 seconds

### Manual Rollback (GitHub Actions)
```bash
# If using GitHub Actions deploy, revert git commit
git revert <broken-commit>
git push origin main

# GitHub Actions re-runs, redeploys previous version
```

## Troubleshooting

### "Build failed" in Cloudflare
1. Check Cloudflare dashboard → Pages → Build logs
2. Common causes:
   - Missing environment variables
   - TypeScript errors (`npm run lint` failed)
   - Missing dependencies

**Fix**:
```bash
# Test locally
npm ci
npm run lint
npm run build

# If it fails locally, fix and commit
git add -A
git commit -m "fix: resolve build error"
git push origin main
```

### "Site returns 404 for all routes"
**Cause**: SPA fallback not working  
**Fix**: Cloudflare Pages routing rule for 404 → index.html

Check in Cloudflare Pages build configuration:
```
Build command: npm run build
Build output directory: dist
```

### "Domain not resolving"
1. Check DNS records in Cloudflare
2. Verify CNAME points to `realsyncdynamics-ai.pages.dev`
3. Check registrar nameservers point to Cloudflare
4. Allow 24-48 hours for propagation

### "Performance degradation"
Cloudflare Pages automatically caches based on file extensions:
- HTML: `Cache-Control: no-cache` (always revalidate)
- JS/CSS: `Cache-Control: public, max-age=31536000` (1 year, content-hash)
- Images: `Cache-Control: public, max-age=86400` (1 day)

To clear cache:
```bash
# In Cloudflare dashboard:
# Pages → Settings → Clear cache → Clear everything
```

## Environment Configuration

### Build-Time Variables (in Cloudflare Pages Settings)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_SENTRY_DSN=https://key@sentry.io/project
VITE_STRIPE_PRICE_STARTER=price_1H5...
VITE_STRIPE_PRICE_GROWTH=price_1H6...
VITE_STRIPE_PRICE_AGENCY=price_1H7...
VITE_STRIPE_PRICE_SCALE=price_1H8...
VITE_STRIPE_PRICE_STARTER_YEARLY=price_1I0...
VITE_STRIPE_PRICE_GROWTH_YEARLY=price_1I1...
VITE_STRIPE_PRICE_AGENCY_YEARLY=price_1I2...
VITE_STRIPE_PRICE_SCALE_YEARLY=price_1I3...
```

These are **baked into the JavaScript bundle** during build (no runtime configuration).

## Dual-Deployment Strategy: Cloudflare vs. VPS

### Why Two Targets?

| Aspect | Cloudflare Pages | VPS (Traefik) |
|--------|------------------|---------------|
| **Primary Use** | Public SPA (all users) | Backend services (ollama, n8n) |
| **Performance** | Global CDN, instant cache | Single region, slower |
| **Cost** | Included in CF plan | Fixed VPS cost |
| **Control** | Limited (managed service) | Full control |
| **Regions** | Edge (100+ cities) | Single VPS location |

### Routing Strategy
- **Apex** (realsyncdynamicsai.de): Cloudflare Pages (SPA)
- **Subdomains** (ollama.*, n8n.*): VPS → Traefik

**DNS Configuration** ensures clean separation:
```
realsyncdynamicsai.de       → Cloudflare Pages
ollama.realsyncdynamicsai   → VPS IP (Traefik)
n8n.realsyncdynamicsai      → VPS IP (Traefik)
chat.realsyncdynamicsai     → VPS IP (Traefik)
```

## Monitoring & Analytics

### Cloudflare Analytics
1. Go to Cloudflare dashboard → Pages → Analytics
2. View:
   - Requests per day
   - Bandwidth usage
   - Cache hit ratio
   - Errors & performance

### Sentry Error Tracking
If `VITE_SENTRY_DSN` is configured, all client-side errors are tracked:
```
Sentry Dashboard → Projects → realsyncdynamics →
  Issues → Filter by release (if release tracking configured)
```

## CI/CD Pipeline

**File**: `.github/workflows/deploy-cloudflare-pages.yml`

**Trigger**: Push to `main` with changes in:
- `src/`, `public/`
- `package.json`, `vite.config.ts`, `wrangler.toml`

**Steps**:
1. Checkout
2. Setup Node.js 20
3. Install dependencies
4. Lint TypeScript
5. Build Vite
6. Generate legal pages
7. Prerender critical routes
8. Generate SPA fallback
9. Upload dist/ artifact
10. Deploy to Cloudflare (if secrets configured)
11. Smoke test critical routes

**Expected Duration**: 5-8 minutes

## Phase 3 Improvements

- [ ] Staged rollouts (canary 10% → 50% → 100%)
- [ ] Feature flags for zero-downtime migrations
- [ ] Automated performance regression detection
- [ ] Multi-region replication (EU data residency)
- [ ] Automatic rollback on error-spike detection (Sentry integration)
- [ ] Staging environment on `staging.realsyncdynamicsai.de`

## Related Documentation

- `DEPLOYMENT.md` — Overall deployment strategy
- `VPS-DEPLOYMENT.md` — VPS + Traefik setup
- `deploy/README.md` — Infrastructure overview
- `.github/workflows/deploy-cloudflare-pages.yml` — GitHub Actions workflow
- `wrangler.toml` — Cloudflare Pages configuration

---

**Maintained by:** RealSyncDynamics Engineering Team  
**Repository**: https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI  
**Cloudflare Project**: https://dash.cloudflare.com/pages (realsyncdynamics-ai)
