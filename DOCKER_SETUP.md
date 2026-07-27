# Docker Setup — RealSyncDynamics.AI Production Deployment

Ein produktionsreifes Docker-Setup für RealSyncDynamics.AI mit Traefik, Ollama, Hermes, AnythingLLM und automatisierten Backups.

## Architecture

```
Internet (HTTPS via Let's Encrypt)
    ↓
Traefik (Reverse Proxy, Port 80/443)
    ├─ realsyncdynamicsai.de (Frontend)
    ├─ traefik.realsyncdynamicsai.de (Dashboard)
    ├─ ollama.realsyncdynamicsai.de (Local LLM)
    ├─ hermes.realsyncdynamicsai.de (Workflow Automation)
    ├─ rag.realsyncdynamicsai.de (RAG System)
    └─ status.realsyncdynamicsai.de (Monitoring)
```

## Services

| Service | Port | Description | Status Page |
|---------|------|-------------|-------------|
| **Traefik** | 80, 443, 8080 | Reverse Proxy, TLS | `http://localhost:8080` |
| **Frontend** | 80 | React/Vite SPA (nginx) | `https://realsyncdynamicsai.de` |
| **Ollama** | 11434 | Local LLM (Gemma2, Mistral) | `https://ollama.realsyncdynamicsai.de` |
| **Hermes** | 5678 | n8n Workflow Automation | `https://hermes.realsyncdynamicsai.de` |
| **AnythingLLM** | 3001 | RAG System | `https://rag.realsyncdynamicsai.de` |
| **Uptime Kuma** | 3001 | Health Monitoring | `https://status.realsyncdynamicsai.de` |
| **Watchtower** | — | Auto-Update Images | — |

## File Structure

```
/opt/realsyncdynamics/
├── docker-compose.yml          # Main orchestration
├── .env                         # Environment variables (DO NOT COMMIT)
├── Dockerfile.frontend          # Frontend build (Vite → nginx)
├── traefik/
│   ├── traefik.yml             # Traefik static config
│   ├── config.yml              # Traefik dynamic config
│   └── acme.json               # Let's Encrypt certificates (auto-generated)
├── scripts/
│   ├── deploy.sh               # Deploy to VPS
│   ├── backup.sh               # Create backups
│   ├── restore.sh              # Restore from backup
│   └── healthcheck.sh          # Health monitoring
├── data/
│   ├── ollama/                 # Ollama models & cache
│   ├── hermes/                 # n8n workflows & config
│   ├── anythingllm/            # RAG documents & embeddings
│   ├── uptime-kuma/            # Monitoring data
│   └── traefik/                # Traefik config
├── logs/
│   ├── traefik/                # Traefik access & error logs
│   └── deploy-*.log            # Deployment logs
└── backups/
    └── backup-*.tar.gz         # Automated backups

```

## Quick Start

### 1. Local Development

```bash
# Copy environment template
cp .env.docker.example .env

# Edit .env with your values
nano .env

# Start all services
docker-compose up -d

# Watch logs
docker-compose logs -f frontend

# Access services
# Frontend: http://localhost:8090
# Traefik Dashboard: http://localhost:8080
# Ollama: http://localhost:11434
```

### 2. VPS Deployment

#### Prerequisites

- Docker + docker-compose v2 installed
- SSH access to VPS
- Domain configured with DNS pointing to VPS IP
- GitHub Actions secrets configured

#### One-time Setup on VPS

```bash
# SSH into VPS
ssh deploy@72.61.89.191

# Create deployment directory
sudo mkdir -p /opt/realsyncdynamics
sudo chown deploy:deploy /opt/realsyncdynamics
cd /opt/realsyncdynamics

# Clone repository
git clone https://github.com/realsyncdynamics-spec/realsyncdynamics.ai.git .

# Copy environment template
cp .env.docker.example .env

# Edit with real values
nano .env

# Create required directories
mkdir -p data/{ollama,hermes,anythingllm,uptime-kuma} logs backups
chmod 700 traefik

# Generate Traefik basicauth password
htpasswd -c traefik/.htpasswd admin
# Enter password twice

# Update traefik/traefik.yml with htpasswd output

# Start services
docker-compose up -d

# Verify deployment
docker-compose logs -f
curl https://realsyncdynamicsai.de
```

#### Automatic Deployment via GitHub Actions

1. **Set GitHub Secrets** (Settings → Secrets and variables → Actions):

```
VPS_HOST                   = 72.61.89.191
VPS_USER                   = deploy
VPS_SSH_KEY                = <contents of ~/.ssh/id_ed25519>
DEPLOY_PATH                = /opt/realsyncdynamics

VITE_SUPABASE_URL          = https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY     = <anon-key>
VITE_SENTRY_DSN            = https://...
VITE_GOOGLE_GENAI_API_KEY  = <key>
VITE_STRIPE_PUBLISHABLE_KEY = pk_live_...

ACME_EMAIL                 = admin@realsyncdynamicsai.de
N8N_ENCRYPTION_KEY         = <random-32-chars>
JWT_SECRET                 = <random-32-chars>

SLACK_WEBHOOK_URL          = https://hooks.slack.com/...
```

2. **Push to main branch triggers deployment**:

```bash
git add .
git commit -m "Deploy: Add docker setup"
git push origin main
```

3. **Monitor in GitHub Actions** → Workflows → "Docker Deploy to VPS"

## Management

### Start/Stop Services

```bash
# Start all services
docker-compose up -d

# Stop all services (keeps data)
docker-compose down

# Restart a specific service
docker-compose restart frontend

# View logs
docker-compose logs -f [service]

# Logs with timestamp
docker-compose logs --timestamps -f frontend
```

### Health Checks

```bash
# Local check
./scripts/healthcheck.sh

# Remote check (via SSH)
ssh deploy@72.61.89.191 "cd /opt/realsyncdynamics && ./scripts/healthcheck.sh"

# Send alert if unhealthy
./scripts/healthcheck.sh --send-alert
```

### Backups

```bash
# Create backup
./scripts/backup.sh

# Automatic daily backups (configured in watchtower)
# Retention: 30 days (configurable via BACKUP_RETENTION_DAYS)

# List backups
ls -lh backups/

# Upload to S3 (if S3_BUCKET configured)
# Backups are automatically uploaded after creation
```

### Restore

```bash
# List available backups
ls backups/

# Restore from backup
./scripts/restore.sh backups/backup-20260726_120000.tar.gz

# Als root bzw. mit sudo ausführen — die Archive tragen die numerischen UIDs
# der Container-Prozesse.

# The script will:
# 1. Stop containers
# 2. Restore data directories (./data/*)
# 3. Restore configuration (.env, docker-compose.yml, traefik/acme.json)
# 4. Start containers
# 5. Verify restore
```

Der vorherige Stand wird nicht gelöscht, sondern beiseitegelegt:
`data/<dienst>.pre-restore-<timestamp>` und `config-backup-<timestamp>`.

> **Hinweis zu den Datenpfaden.** Der Stack nutzt Bind-Mounts unter `./data`,
> keine named volumes. `scripts/backup.sh` und `scripts/restore.sh` führen die
> Pfade in `DATA_DIRS`. Wer in `docker-compose.yml` auf named volumes umstellt,
> muss beide Skripte mitziehen — sonst sichert das Backup ins Leere und meldet
> trotzdem Erfolg.

### Update Models

#### Ollama Models

```bash
# SSH into VPS
ssh deploy@72.61.89.191

# Pull new model
docker exec realsync-ollama ollama pull mistral

# List models
docker exec realsync-ollama ollama list

# Set as default (in .env)
OLLAMA_MODEL_PREF=mistral
docker-compose restart anythingllm
```

#### Auto-Updates

Services are configured to auto-update images (Watchtower):
- Schedule: Every Sunday at 2 AM UTC
- Notifications: Email sent after update

Disable auto-updates:
```bash
docker-compose down watchtower
```

## Monitoring

### Traefik Dashboard

- URL: `https://traefik.realsyncdynamicsai.de` (auth required)
- Default credentials: From TRAEFIK_BASICAUTH_USERS in .env
- Shows: Routes, services, middlewares, certificates

### Uptime Kuma

- URL: `https://status.realsyncdynamicsai.de`
- Configure monitors for all services
- Public status page available

### Container Logs

```bash
# View all logs with timestamps
docker-compose logs --timestamps -f

# View specific service
docker-compose logs -f frontend --tail 100

# Export logs
docker-compose logs > all-logs.txt

# Clear logs
docker-compose exec traefik rm /var/log/traefik/access.log
```

### Metrics

Traefik exposes Prometheus metrics on `:8080/metrics`. Configure Prometheus scraper:

```yaml
scrape_configs:
  - job_name: 'traefik'
    static_configs:
      - targets: ['localhost:8080']
```

## Troubleshooting

### Containers Won't Start

```bash
# Check logs
docker-compose logs frontend

# Common issues:
# - Missing .env file
# - Port already in use (80/443)
# - Permissions issues in data/ directories

# Fix permissions
chmod -R 755 data/
chmod 600 traefik/acme.json
```

### Certificate Issues

```bash
# Check certificate status
docker-compose logs traefik | grep -i "certificate\|acme"

# Manual cert renewal
docker-compose down traefik
rm -f traefik/acme.json
docker-compose up -d traefik

# Wait 60 seconds for cert generation
sleep 60
curl https://realsyncdynamicsai.de
```

### Database Connectivity

```bash
# Check if Supabase is reachable
curl -I $VITE_SUPABASE_URL

# Check frontend connection to Supabase
docker-compose logs frontend | grep -i "supabase\|error"

# Update VITE_SUPABASE_URL in .env
docker-compose down frontend
docker-compose up -d frontend
```

### Disk Space

```bash
# Check disk usage
df -h

# Find large data directories (der Stack nutzt Bind-Mounts, keine Volumes)
du -sh data/*

# Clean up dangling volumes (aus früheren Setups)
docker volume prune

# Clear old backups
find backups/ -name "*.tar.gz" -mtime +30 -delete
```

### Performance Issues

```bash
# Monitor resource usage
docker stats

# Limit container resources (edit docker-compose.yml)
services:
  frontend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

# Restart services
docker-compose up -d
```

## Security

### Network Isolation

- Traefik network: `172.20.0.0/16`
- Internal network: `172.21.0.0/16`
- Services communicate only via internal network
- Only Traefik exposed to internet

### TLS Certificates

- Automatic renewal via Let's Encrypt
- Stored in `traefik/acme.json`
- Renewed 30 days before expiry
- Check expiry: `curl -vI https://realsyncdynamicsai.de 2>&1 | grep expire`

### Secrets Management

```bash
# DO NOT commit .env file!
# .gitignore protects it:
echo ".env" >> .gitignore
git add .gitignore && git commit -m "Ignore .env"

# For CI/CD, use GitHub Secrets or environment variables
# Never log secrets:
docker-compose config | grep -v SECRET
```

### Firewall Rules

Recommended ufw rules (if enabled):

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

### SSH Key Access

```bash
# Generate SSH keypair (on your machine)
ssh-keygen -t ed25519 -C "deploy" -f ~/.ssh/realsync_deploy

# Add public key to VPS
ssh-copy-id -i ~/.ssh/realsync_deploy.pub deploy@72.61.89.191

# Disable password auth (on VPS)
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl reload sshd
```

## Maintenance

### Weekly Maintenance

```bash
# Check health
./scripts/healthcheck.sh

# Review logs for errors
docker-compose logs --timestamps | tail -100

# Check disk usage
df -h
```

### Monthly Maintenance

```bash
# Update all images
docker-compose pull
docker-compose up -d

# Review certificate expiry
openssl s_client -connect realsyncdynamicsai.de:443 -dates

# Clean up old data
docker volume prune
find backups/ -name "*.tar.gz" -mtime +30 -delete

# Review backup sizes
du -sh backups/
```

### Quarterly Maintenance

```bash
# Test restore process
./scripts/restore.sh backups/backup-latest.tar.gz

# Update base images
docker pull alpine:latest
docker pull node:20-alpine
docker pull nginx:1.27-alpine

# Security updates
sudo apt update && sudo apt upgrade -y
docker system prune -a
```

## Scaling

### Horizontal Scaling

To run multiple frontend instances behind Traefik:

```yaml
services:
  frontend-1:
    # ...same as frontend...
    container_name: realsync-frontend-1
  
  frontend-2:
    # ...same as frontend...
    container_name: realsync-frontend-2
    
  # Traefik auto-discovers both via labels
```

### Resource Limits

```yaml
services:
  frontend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Advanced Configuration

### Cloudflare DNS Challenge

For wildcard certificates, use DNS challenge instead of HTTP challenge:

Edit `traefik/traefik.yml`:

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@realsyncdynamicsai.de
      storage: acme.json
      dnsChallenge:
        provider: cloudflare
        resolvers:
          - "1.1.1.1:53"
```

And set environment variable:
```bash
CLOUDFLARE_API_TOKEN=your_token
```

### Custom Error Pages

Create `traefik/custom-error.html` and add to `traefik/config.yml`:

```yaml
http:
  middlewares:
    custom-error:
      errors:
        service: error-service
```

### Rate Limiting

Already configured in `traefik/config.yml`:
- Average: 100 requests/minute
- Burst: 200 requests/minute

Adjust in `rateLimitMiddleware` section.

### CORS Headers

Configured in `traefik/config.yml` for `realsyncdynamicsai.de`.

Modify `accessControlAllowOriginList` for additional domains.

## Cost Estimation

Monthly VPS costs (Hostinger):
- 2-core CPU: ~$5
- 4GB RAM: Included
- 100GB SSD: Included
- Bandwidth: Included

Docker services (free):
- Traefik: Free (open-source)
- Ollama: Free (open-source)
- n8n: Free (open-source community)
- AnythingLLM: Free (open-source)
- Uptime Kuma: Free (open-source)
- Watchtower: Free (open-source)

Total: ~$5/month for VPS only

## References

- Traefik: https://doc.traefik.io/traefik/
- Docker Compose: https://docs.docker.com/compose/
- Let's Encrypt: https://letsencrypt.org/
- Ollama: https://ollama.com/
- n8n: https://n8n.io/
- AnythingLLM: https://anythingllm.com/
- Uptime Kuma: https://uptime.kuma.pet/

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Run health check: `./scripts/healthcheck.sh`
3. Review this document
4. Check GitHub Issues: https://github.com/realsyncdynamics-spec/realsyncdynamics.ai/issues

---

**Last Updated**: 2026-07-26  
**Version**: 1.0  
**Status**: Production-Ready
