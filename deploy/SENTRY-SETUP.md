# Sentry Release Tracking Setup

**Last Updated:** 2026-07-25  
**Status:** Configured for frontend + backend deployments  
**Documentation**: https://docs.sentry.io/platforms/

## Overview

Sentry tracks errors and provides release-based tracking to link errors to specific deployments. This guide covers:

1. **Setup**: Creating Sentry project and obtaining credentials
2. **Configuration**: Adding Sentry tokens to GitHub Secrets
3. **Integration**: How release tracking works with CI/CD
4. **Monitoring**: Viewing releases and errors in Sentry

## Prerequisites

- Sentry account (https://sentry.io)
- GitHub repository with workflow secrets access
- `@sentry/cli` installed (`npm install -g @sentry/cli`)

## Step 1: Create Sentry Project

### For Frontend Errors
1. Go to https://sentry.io
2. Create organization: "RealSyncDynamics"
3. Create project:
   - **Platform**: JavaScript
   - **Project name**: realsyncdynamics
   - **Environment**: Production (https://realsyncdynamicsai.de)

### For Backend Errors (Edge Functions)
1. Create separate project:
   - **Platform**: Node.js
   - **Project name**: realsyncdynamics-backend
   - **Environment**: Edge Functions (Supabase)

(Optional: can use same project for both if preferred)

## Step 2: Get Credentials

### Auth Token
```bash
# 1. Go to Sentry → Settings → Auth Tokens
# 2. Create token with scopes:
#    - org:read
#    - org:write
#    - project:releases
#    - project:write
#    - team:read

# 3. Copy token value
TOKEN=sntrys_...
```

### Organization & Project IDs
```bash
# In Sentry dashboard:
# Settings → Organization Settings → Organization Slug
ORG_ID=realsyncdynamics

# Settings → Projects → Project Settings → Project Slug
PROJECT_ID=realsyncdynamics
```

### Account ID
```bash
# Dashboard URL: https://sentry.io/organizations/<ORG_ID>/
# Settings → Organization Settings → Account Details
ACCOUNT_ID=12345  # numeric
```

## Step 3: Configure GitHub Secrets

Add to GitHub: Repo → Settings → Secrets and variables → Actions

```bash
# Frontend & Backend error tracking
SENTRY_AUTH_TOKEN=sntrys_...

# Optional (for release management)
SENTRY_ORG=realsyncdynamics
SENTRY_PROJECT=realsyncdynamics
```

## Step 4: Frontend Integration

### Add Sentry to React App

```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: 'production',
  tracesSampleRate: 0.1,  // 10% of transactions
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,  // 100% on errors
});

const App = Sentry.withProfiler(() => {
  return <YourApp />;
});
```

### Environment Variable
In GitHub Actions (build-time):
```bash
VITE_SENTRY_DSN=https://<key>@<host>/project
```

Obtain DSN from Sentry:
1. Settings → Client Keys (DSN)
2. Copy public DSN

## Step 5: Configure Release Tracking

### Automatic Release Creation (in CI/CD)

**Frontend** (`.github/workflows/deploy-cloudflare-pages.yml`):
```bash
# Creates release on successful Cloudflare Pages deploy
# Links commits via `git` integration
# Version: v<latest-tag>.<short-sha>
```

**Backend** (`.github/workflows/deploy.yml`):
```bash
# Creates release on successful functions deploy
# Version: backend-v<latest-tag>.<short-sha>
```

### Manual Release Creation

```bash
# Install Sentry CLI
npm install -g @sentry/cli

# Create release
SENTRY_AUTH_TOKEN=sntrys_... \
node scripts/sentry-release.mjs create v2.X.Y

# List releases
SENTRY_AUTH_TOKEN=sntrys_... \
node scripts/sentry-release.mjs list

# Finalize deployment
SENTRY_AUTH_TOKEN=sntrys_... \
node scripts/sentry-release.mjs finalize v2.X.Y
```

## How It Works

### Release Workflow

```
1. Git tag v2.X.Y pushed to main
   │
2. GitHub Actions workflow triggered
   │
3. CI/CD runs:
   - Build frontend/backend
   - Tests pass
   - Deploy to Cloudflare Pages / Supabase Functions
   │
4. Post-deploy: Create Sentry release
   - sentry-cli releases create v2.X.Y
   - Auto-link commits: git log ... → sentry
   - Record deployment: environment=production, timestamp
   │
5. Frontend JS errors go to Sentry
   - Automatically tagged with release: v2.X.Y
   - Includes commit hash, commits since last release
   - Stack trace linked to source code
   │
6. Developers can view error by release
   - Sentry → Issues → Filter: release:v2.X.Y
   - See which commits introduced the bug
```

### Source Maps (for Stack Trace Accuracy)

**Frontend Source Maps** (Vite builds):
```bash
# Vite automatically generates dist/.js.map files
# Upload to Sentry for readable stack traces

# In CI (post-build, pre-deploy):
sentry-cli releases files upload-sourcemaps \
  --org realsyncdynamics \
  --project realsyncdynamics \
  --release v2.X.Y \
  dist/

# Only in production — omit in staging to reduce complexity
```

(Optional for now, can be added in Phase 3)

## Monitoring Releases

### View Releases in Sentry

1. **Sentry Dashboard** → Organization → Project
2. **Releases** tab → See list of deployments
3. Click on release → View:
   - Associated commits
   - Errors introduced in this release
   - Deployment timing and environment
   - Rollout progress (if staged rollout configured)

### View Errors by Release

1. **Issues** tab
2. Filter: `release:v2.X.Y`
3. View stack trace + source code link
4. Click commit hash to see what changed

### Alerts

**Error Spike Detection**:
1. Settings → Alerts → Create alert
2. When: New issue or 10+ events in 5 minutes
3. For project: realsyncdynamics
4. Notify: #sentry-alerts Slack channel

## Troubleshooting

### "Release not showing in Sentry"

```bash
# Check if release was created
sentry-cli releases list \
  --org realsyncdynamics \
  --project realsyncdynamics \
  --auth-token $SENTRY_AUTH_TOKEN
```

**Common causes**:
- `SENTRY_AUTH_TOKEN` not set
- Wrong `org` or `project` name
- Token lacks `project:releases` scope

### "Errors not tagged with release"

**For Frontend**:
1. Check `VITE_SENTRY_DSN` is set at build time
2. Verify `Sentry.init()` called in `main.tsx`
3. Check browser console for Sentry errors
4. Verify release was created in Sentry dashboard

**For Backend (Edge Functions)**:
1. Add Sentry to function entry points
2. Set `SENTRY_DSN` as Supabase secret
3. Test locally: `supabase functions serve`

### "Source maps not showing"

1. Upload source maps after build:
   ```bash
   sentry-cli releases files upload-sourcemaps \
     --org realsyncdynamics \
     --project realsyncdynamics \
     --release v2.X.Y \
     dist/
   ```

2. Verify in Sentry dashboard:
   - Release page → Artifacts
   - Should see `.js` + `.js.map` pairs

## Environment Configuration

### GitHub Secrets

```bash
# Required
SENTRY_AUTH_TOKEN=sntrys_eyJpc...

# Optional (defaults in script)
SENTRY_ORG=realsyncdynamics
SENTRY_PROJECT=realsyncdynamics
```

### Build-Time Variables

```bash
# Added to .env for build
VITE_SENTRY_DSN=https://abc123@o12345.ingest.sentry.io/67890

# Baked into JavaScript bundle
# No runtime configuration
```

## Sentry Features Used

### Release Tracking
- ✅ Create releases on deploy
- ✅ Link commits to releases
- ✅ Record deployment timestamps/environments

### Error Aggregation
- ✅ Group errors by type
- ✅ Tag errors with release
- ✅ Stack trace capture

### Source Maps
- ⚠️ Optional, can be added later
- Would map minified stack traces to source code

### Session Replay
- ✅ Configured (10% sample rate)
- ✅ 100% capture on errors
- Provides video of user session before error

## Phase 3 Improvements

- [ ] Automated source map uploads
- [ ] Performance monitoring (Core Web Vitals)
- [ ] Release health tracking (crash-free rate %)
- [ ] User feedback integration
- [ ] Integration with Slack (#sentry-alerts)
- [ ] Automated alerts for error spikes
- [ ] Staged rollout monitoring (canary deployments)

## References

- **Sentry Docs**: https://docs.sentry.io/
- **Release Tracking**: https://docs.sentry.io/product/releases/
- **Source Maps**: https://docs.sentry.io/product/source-maps/
- **CLI Commands**: https://docs.sentry.io/cli/

## Release Script

**File**: `scripts/sentry-release.mjs`

```bash
# Create release
node scripts/sentry-release.mjs create v2.X.Y

# Finalize deployment
node scripts/sentry-release.mjs finalize v2.X.Y

# List releases
node scripts/sentry-release.mjs list
```

**Automatically called by**:
- `.github/workflows/deploy-cloudflare-pages.yml` (frontend)
- `.github/workflows/deploy.yml` (backend)

---

**Maintained by:** RealSyncDynamics Engineering Team  
**Related docs**:
- `DEPLOYMENT.md` — Overall deployment strategy
- `.github/workflows/deploy-cloudflare-pages.yml` — Frontend CI/CD
- `.github/workflows/deploy.yml` — Backend CI/CD
