# VPS Frontend Deployment Runbook

**Last Updated:** 2026-07-26  
**Target VPS:** realsyncdynamicsai.de (187.77.89.1)  
**Stack:** React 19 + Vite 6.2 → Docker → nginx alpine → Traefik/Host-nginx

---

## 🚀 Quick Start

### Automatic Deployment (Recommended)
Push to `main` branch → GitHub Actions auto-deploys within ~3 minutes.

```bash
git push origin main
# Watch: https://github.com/realsyncdynamics-spec/realsyncdynamics.ai/actions
```

### Manual Production Deployment
For controlled, versioned deployments with manual approval:

1. Go to **GitHub Repo → Actions → "Deploy Frontend to Production"**
2. Click **"Run workflow"**
3. Select environment: `production` or `staging`
4. Confirm and monitor logs

---

## 🔐 Prerequisites (One-Time Setup)

### A. GitHub Secrets (Required)

Set these in **Settings → Secrets and variables → Actions**:

| Secret | Purpose | Example |
|--------|---------|---------|
| `VPS_SSH_HOST` | VPS IP/hostname | `187.77.89.1` |
| `VPS_SSH_USER` | Deploy user | `deploy` |
| `VPS_SSH_KEY` | Private SSH key | `-----BEGIN OPENSSH...` |
| `VPS_SSH_KNOWN_HOST` | Host fingerprint | `187.77.89.1 ssh-ed25519 AAA...` |
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | `eyJhbGc...` |
| `VITE_SENTRY_DSN` | Sentry DSN (optional) | `https://xxx@ingest.sentry.io/123` |
| `SLACK_WEBHOOK_DEPLOY` | Slack notifications (optional) | `https://hooks.slack.com/...` |

### B. VPS Setup (One-Time)

```bash
# SSH into VPS
ssh deploy@187.77.89.1

# Create deployment directory
sudo mkdir -p /var/www/realsyncdynamicsai-frontend
sudo chown deploy:deploy /var/www/realsyncdynamicsai-frontend
cd /var/www/realsyncdynamicsai-frontend

# Clone repository
git clone https://github.com/realsyncdynamics-spec/realsyncdynamics.ai.git .

# Create .env file
cat > deploy/frontend-vps-deploy-v2/.env << 'EOF'
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key-here"
VITE_SENTRY_DSN=""
FRONTEND_HOST_BIND=127.0.0.1
FRONTEND_HOST_PORT=8090
FRONTEND_IMAGE_TAG=latest
EOF

chmod 600 deploy/frontend-vps-deploy-v2/.env

# Verify Docker is installed and running
docker --version          # Should be ≥ 24
docker compose version    # Should show V2
docker ps                 # Should work

# Test manual deploy
cd deploy/frontend-vps-deploy-v2
docker compose --env-file .env up -d --build
docker compose ps         # Should show "healthy" after ~10s
docker compose logs -f    # View logs
```

---

## 📊 Deployment Workflow

### Automatic (on `main` push)

```
git push → GitHub Actions triggered
  ↓
Lint + Type Check + Build
  ↓
SSH sync to /var/www/realsyncdynamicsai-frontend
  ↓
docker compose up -d --build
  ↓
Wait for health check (30s timeout)
  ↓
Smoke test /healthz
  ↓
✅ Success OR ❌ Auto-rollback to previous version
  ↓
Slack notification + GitHub status
```

**Duration:** ~2-3 minutes  
**Downtime:** ~30 seconds (during health check)

### Manual Production Deployment

```
Workflow dispatch (manual trigger)
  ↓
Build with timestamp tag
  ↓
SSH deploy with backup of previous image
  ↓
Verify health + public URL reachable
  ↓
✅ Success with automatic rollback available
```

---

## 🔍 Monitoring & Troubleshooting

### Check Deployment Status

```bash
# On VPS
docker compose -f deploy/frontend-vps-deploy-v2/docker-compose.yml ps
docker compose -f deploy/frontend-vps-deploy-v2/docker-compose.yml logs -f frontend

# Test locally
curl http://127.0.0.1:8090/healthz
```

### Check GitHub Actions

```bash
# Latest workflow run
gh run list --workflow deploy-frontend-vps.yml --limit 1

# View specific run logs
gh run view <run-id> --log
```

### Common Issues

#### Port 8090 already in use
```bash
# On VPS, find what's using it
lsof -i :8090
# Or change FRONTEND_HOST_PORT in .env to a free port (e.g., 8091)
```

#### Docker image build fails
```bash
# Check Docker disk space
docker system df

# Clean up old images
docker image prune -a --force

# Check build logs
docker compose --env-file .env build --no-cache 2>&1 | tail -50
```

#### Health check fails
```bash
# SSH into container and test nginx
docker exec -it realsync-frontend sh
wget -qO- http://127.0.0.1/healthz

# Check nginx config
docker exec realsync-frontend nginx -t
```

#### Needs rollback

**Automatic:** If deploy fails → previous image automatically restored  
**Manual:** 
```bash
# On VPS
cd deploy/frontend-vps-deploy-v2
docker image tag realsync-frontend:previous realsync-frontend:latest
docker compose --env-file .env up -d
```

---

## 🛡️ Security Checklist

- [ ] SSH key has no passphrase (for automated deploy)
- [ ] SSH key is ed25519 (modern, secure)
- [ ] `.env` file on VPS has `chmod 600` (owner read-only)
- [ ] VPS firewall only allows SSH from GitHub Actions IPs
- [ ] No secrets in `.env` examples or documentation
- [ ] Supabase anon key is read-only (check RLS policies)
- [ ] Sentry DSN is optional (for error tracking)

---

## 📈 Performance Notes

### Build Time
- **Local:** ~45s (npm ci + vite build)
- **GitHub Actions:** ~60s (includes setup)
- **VPS Docker:** ~40s (cached layers)
- **Total deployment:** 2-3 minutes

### Container Resources
- **CPU:** ~1 core during build, idle after
- **Memory:** ~200MB average, ~500MB peak during build
- **Disk:** ~500MB (node_modules cache) + ~15MB (final nginx image)

### Health Check
- **Initial delay:** 10 seconds
- **Interval:** 30 seconds
- **Timeout:** 3 seconds
- **Retries:** 3 failures before unhealthy

---

## 🔄 Rollback Procedures

### Automatic Rollback
Triggered automatically if:
- Docker build fails
- Health check fails after 30s
- Container crashes

Rollback restores the previous working image tagged as `realsync-frontend:previous`.

### Manual Rollback
```bash
# On VPS
ssh deploy@187.77.89.1
cd /var/www/realsyncdynamicsai-frontend/deploy/frontend-vps-deploy-v2

# List available images
docker image ls | grep realsync-frontend

# Restore previous version
docker image tag realsync-frontend:previous realsync-frontend:latest
docker compose --env-file .env up -d

# Verify
docker compose ps
curl http://127.0.0.1:8090/healthz
```

---

## 📝 Logs & Debugging

### GitHub Actions Logs
```bash
gh run view <run-id> --log  # Full logs
gh run view <run-id> --log-failed  # Only failed steps
```

### VPS Container Logs
```bash
# Current logs
docker compose -f deploy/frontend-vps-deploy-v2/docker-compose.yml logs

# Follow in real-time
docker compose -f deploy/frontend-vps-deploy-v2/docker-compose.yml logs -f

# Last 100 lines
docker compose -f deploy/frontend-vps-deploy-v2/docker-compose.yml logs --tail=100

# With timestamps
docker compose -f deploy/frontend-vps-deploy-v2/docker-compose.yml logs --timestamps
```

### Docker System Logs
```bash
# Check systemd journal
sudo journalctl -u docker -f

# Docker daemon logs
sudo systemctl status docker

# Check disk usage
docker system df
```

---

## 🎯 Best Practices

1. **Test locally first**
   ```bash
   npm run build
   docker build -f Dockerfile.frontend -t realsync-frontend:test .
   docker run -p 8090:80 realsync-frontend:test
   ```

2. **Use commit messages** that reference issues
   ```bash
   git commit -m "feat: add new feature (#123)"
   # Triggers auto-deploy with linked context
   ```

3. **Monitor Sentry** after deployment
   - Check for new errors in the first 5 minutes
   - Compare error rates before/after deploy

4. **Keep .env secure**
   - Never commit `.env` to git
   - Use `chmod 600` on VPS
   - Rotate secrets periodically

5. **Stage changes** before production
   - Test in development branch first
   - Use manual workflow for critical changes
   - Always have a rollback plan

---

## 📞 Support

**Deployment issues?**
- Check GitHub Actions logs: `.github/workflows/deploy-frontend-vps.yml`
- Check VPS logs: `docker compose logs -f`
- Check Sentry: https://sentry.io/organizations/realsyncdynamics/

**Need to revert?**
- Manual rollback available (see above)
- Or push a fix commit and re-deploy

**Slack notifications broken?**
- Add `SLACK_WEBHOOK_DEPLOY` secret in GitHub
- Webhook format: `https://hooks.slack.com/services/T.../B.../X...`
