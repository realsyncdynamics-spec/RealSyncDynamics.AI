# VPS Frontend Deployment Guide

**Last Updated:** 2026-07-25  
**Status:** Automated via GitHub Actions  
**Environment:** Hostinger VPS + Traefik Reverse Proxy

## Overview

The frontend (React 19 + Vite SPA) is deployed to a Hostinger VPS via:
- GitHub Actions workflow: `.github/workflows/deploy-frontend-vps.yml`
- Docker Compose orchestration: `deploy/frontend-vps-deploy-v2/`
- Traefik reverse proxy (external, not managed by frontend compose)
- nginx serving static assets inside container

```
┌─────────────────────────────────────────────────┐
│ GitHub Push to main (src/ changes)              │
└──────────────┬──────────────────────────────────┘
               │
     ┌─────────▼─────────┐
     │ GitHub Actions    │
     │ - npm ci           │
     │ - npm run build    │
     │ - Docker build     │
     └─────────┬─────────┘
               │
     ┌─────────▼─────────────────────────┐
     │ SSH into VPS                       │
     │ - rsync source to /var/www/...     │
     │ - docker compose up -d --build     │
     │ - healthcheck (max 60s)            │
     └─────────┬─────────────────────────┘
               │
     ┌─────────▼─────────────────────────┐
     │ Verify deployment                  │
     │ - Test https://realsyncdynamicsai  │
     │ - If fail: rollback to previous    │
     └─────────────────────────────────────┘
```

## Prerequisites

### On the VPS
```bash
# SSH as root or with sudo
ssh root@<vps-host>

# Check installed tools
docker --version          # Docker 20.10+
docker compose version    # Compose v2
ssh -i ~/.ssh/id_rsa -v   # SSH key access

# Create directories
mkdir -p /var/www/realsyncdynamicsai-frontend
cd /var/www/realsyncdynamicsai-frontend

# Clone repo (first time only)
git clone https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI.git .
```

### On GitHub
1. Add SSH key as `VPS_SSH_KEY` secret
2. Add VPS hostname as `VPS_SSH_HOST` secret
3. Add VPS username as `VPS_SSH_USER` secret (usually `root`)
4. Add known host fingerprint as `VPS_SSH_KNOWN_HOST` secret

```bash
# Get known host fingerprint
ssh-keyscan -H <vps-host>
```

### Environment file on VPS
```bash
# On VPS, create deploy/frontend-vps-deploy-v2/.env
cd /var/www/realsyncdynamicsai-frontend
cp deploy/frontend-vps-deploy-v2/.env.example deploy/frontend-vps-deploy-v2/.env

# Edit with your values
vi deploy/frontend-vps-deploy-v2/.env
```

**Required variables:**
```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_SENTRY_DSN=https://<key>@sentry.io/<project>
FRONTEND_HOST_PORT=8090
FRONTEND_HOST_BIND=127.0.0.1  # Only local, nginx handles public access
```

## Deployment Flow

### Automatic (via GitHub Actions)
1. Push to `main` with changes in:
   - `src/**`
   - `public/**`
   - `package.json`, `vite.config.ts`, `Dockerfile.frontend`
   - `.github/workflows/deploy-frontend-vps.yml`

2. Workflow runs:
   - Lint + type check (continue-on-error, doesn't block)
   - Build frontend (`npm run build`)
   - rsync to VPS
   - SSH into VPS and docker compose up -d --build
   - Healthcheck (30 attempts, 2s intervals)
   - Verify public URL responds

3. On success: ✅ frontend deployed
   On failure: ⏮️ automatically rolls back to previous version

### Manual Deployment
```bash
# Option 1: Use the GitHub Actions UI
# Go to Actions > Deploy Frontend to Hostinger VPS > Run workflow

# Option 2: SSH and deploy manually
ssh root@<vps-host>
cd /var/www/realsyncdynamicsai-frontend/deploy/frontend-vps-deploy-v2

# Build and start
docker compose --env-file .env up -d --build

# Check status
docker compose ps
docker compose logs -f frontend
```

## Rollback

### Automatic Rollback
If the deployment fails (healthcheck fails or public URL doesn't respond), the workflow automatically:
1. Tags the previous image as `latest`
2. Restarts docker compose
3. Verifies the rollback was successful

### Manual Rollback
```bash
ssh root@<vps-host>
cd /var/www/realsyncdynamicsai-frontend/deploy/frontend-vps-deploy-v2

# Restore previous version
docker image tag realsync-frontend:previous realsync-frontend:latest
docker compose down
docker compose up -d

# Verify
docker compose logs -f frontend
curl http://127.0.0.1:8090/healthz
```

## Troubleshooting

### "Container failed health check"
```bash
ssh root@<vps-host>
cd /var/www/realsyncdynamicsai-frontend/deploy/frontend-vps-deploy-v2

# Check container logs
docker compose logs frontend

# Check nginx config
docker exec realsync-frontend cat /etc/nginx/conf.d/frontend.conf

# Test healthz manually
docker exec realsync-frontend wget -qO- http://127.0.0.1/healthz

# If still failing, rollback
docker image tag realsync-frontend:previous realsync-frontend:latest
docker compose down && docker compose up -d
```

### "Frontend not responding at https://realsyncdynamicsai.de"
1. Check if Traefik is running (external, not part of this compose)
2. Verify DNS resolves to the VPS IP
3. Check VPS firewall allows 443/80 to Traefik container
4. Test locally: `curl http://127.0.0.1:8090/healthz`

**Traefik configuration** (in `deploy/ollama-traefik/docker-compose.yml` or on host):
- Traefik listens on 80/443
- Routes `realsyncdynamicsai.de` → `realsync-frontend:8090` (via Docker bridge network)
- TLS certificates via Let's Encrypt

### "SSH key not working"
```bash
# On local machine, test SSH
ssh -i <vps-ssh-key-file> <vps-user>@<vps-host> echo "✓ SSH works"

# If using GitHub Secrets, ensure:
# - Private key is base64-encoded if multiline
# - Known host fingerprint includes port if non-standard
ssh-keyscan -p 22 -H <vps-host> | base64
```

### "Out of disk space"
```bash
ssh root@<vps-host>
df -h

# Docker cleanup
docker system prune -af --volumes  # Removes unused images/containers
docker image prune -a              # Removes untagged images

# See deploy/README.md for disk management
```

## Performance Optimization

### Bundle Size
Frontend builds to ~938 KB (gzipped). Monitor via:
```bash
npm run build
ls -lh dist/
# or use a tool like: npm install -g source-map-explorer
source-map-explorer 'dist/**/*.js'
```

### Caching
nginx is configured to cache static assets. Current settings:
- HTML: `Cache-Control: no-cache` (always validate)
- JS/CSS: `Cache-Control: public, max-age=31536000` (1 year, content-hashed)
- Images: `Cache-Control: public, max-age=86400` (1 day)

See `deploy/frontend-vps-deploy-v2/nginx.conf` for detailed config.

### SPA Fallback
The nginx config includes a fallback rule:
```nginx
try_files $uri $uri/ /index.html;
```
This ensures all routes go to `index.html` for react-router to handle client-side routing.

## Monitoring

### GitHub Actions Logs
1. Go to Actions > Deploy Frontend to Hostinger VPS
2. Click on the most recent run
3. View job logs for build, deploy, and rollback steps

### VPS Logs
```bash
ssh root@<vps-host>
cd /var/www/realsyncdynamicsai-frontend/deploy/frontend-vps-deploy-v2

# Docker compose logs
docker compose logs -f frontend

# nginx error logs
docker exec realsync-frontend tail -f /var/log/nginx/error.log

# Check container health
docker inspect realsync-frontend | jq '.State.Health'
```

### Sentry Error Tracking
Frontend errors are sent to Sentry (if `VITE_SENTRY_DSN` is set):
1. Go to https://sentry.io/projects/realsyncdynamics/
2. View errors by release
3. Each deployment creates a new Sentry release (to be configured)

## Deployment Configuration

### .env.example
```bash
# Copy to .env on VPS
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...  # From Supabase API settings
VITE_SENTRY_DSN=https://key@sentry.io/project  # From Sentry project settings
FRONTEND_HOST_PORT=8090
FRONTEND_HOST_BIND=127.0.0.1
```

### Build Args
Passed via GitHub Actions during `docker build`:
```bash
--build-arg VITE_SUPABASE_URL=...
--build-arg VITE_SUPABASE_ANON_KEY=...
--build-arg VITE_SENTRY_DSN=...
```

These are baked into the JavaScript bundle during build time (no runtime configuration).

## CI/CD Pipeline

**Trigger:** Push to `main` with changes to frontend files  
**Workflow:** `.github/workflows/deploy-frontend-vps.yml`

**Steps:**
1. Checkout code
2. Setup Node.js 20
3. Install dependencies (`npm ci`)
4. Lint (continue-on-error)
5. Type check (continue-on-error)
6. Build frontend (`npm run build`)
7. Configure SSH credentials
8. rsync source to VPS
9. SSH deploy: docker compose up -d --build
10. Wait for healthcheck (max 60s)
11. Verify public URL (max 10 attempts)
12. If fail: automatic rollback

**Expected Duration:** 3-5 minutes

## Phase 3 Improvements

- [ ] Traefik configuration integrated into frontend compose
- [ ] Feature flags for staged rollouts
- [ ] Canary deployments (10% traffic first)
- [ ] Load testing before promotion to production
- [ ] Automated performance regression detection
- [ ] Multi-region deployment (CDN edge caching)

---

**Maintained by:** RealSyncDynamics Engineering Team  
**Related docs:**
- `deploy/README.md` — Overall infrastructure
- `deploy/ollama-traefik/README.md` — Traefik configuration
- `deploy/frontend-vps-deploy-v2/nginx.conf` — nginx routing
- `.github/workflows/deploy-frontend-vps.yml` — GitHub Actions workflow
