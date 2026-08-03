# Perplexity MCP — Docker Deployment für Hostinger VPS

Deployment als Docker Container hinter Traefik in der bestehenden RealSyncDynamicsAI-Infrastruktur.

## Architektur

```
Traefik (Port 80/443)
    ↓
mcp.realsyncdynamicsai.de (oder interne Route)
    ↓
perplexity-mcp:3000 (Container)
    ↓
Perplexity API
```

## Voraussetzungen

- Hostinger VPS mit Docker & Docker Compose
- Bestehende `docker-compose.yml` mit Traefik
- Perplexity API Key (`PERPLEXITY_API_KEY`)
- Repository geklont

## Phase 1: Lokales Testen

### Build the Image

```bash
cd services/perplexity-mcp
docker build -t perplexity-mcp:latest .
```

### Test Container

```bash
docker run \
  -e PERPLEXITY_API_KEY=$PERPLEXITY_API_KEY \
  -e LOG_LEVEL=debug \
  --name perplexity-mcp-test \
  perplexity-mcp:latest
```

Expected output:
```
pino@...: Perplexity MCP Server started and connected
```

Verify logs:
```bash
docker logs perplexity-mcp-test
```

Stop container:
```bash
docker stop perplexity-mcp-test
docker rm perplexity-mcp-test
```

## Phase 2: Integration in Docker Compose

### Option A: Separate Compose File (Recommended for VPS)

Create `docker-compose.perplexity.yml`:

```yaml
version: '3.9'

services:
  perplexity-mcp:
    build:
      context: ./services/perplexity-mcp
    container_name: perplexity-mcp
    restart: unless-stopped
    environment:
      PERPLEXITY_API_KEY: ${PERPLEXITY_API_KEY}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    labels:
      - traefik.enable=true
      - traefik.http.routers.perplexity.rule=Host(`mcp.realsyncdynamicsai.de`)
      - traefik.http.routers.perplexity.entrypoints=web,websecure
      - traefik.http.routers.perplexity.tls=true
      - traefik.http.services.perplexity.loadbalancer.server.port=3000
    networks:
      - proxy

networks:
  proxy:
    external: true
    name: proxy  # Must match your existing Traefik network
```

### Option B: Add to Existing docker-compose.yml

Add to your main `docker-compose.yml`:

```yaml
services:
  perplexity-mcp:
    build:
      context: ./services/perplexity-mcp
    container_name: perplexity-mcp
    restart: unless-stopped
    environment:
      PERPLEXITY_API_KEY: ${PERPLEXITY_API_KEY}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    labels:
      - traefik.enable=true
      - traefik.http.routers.perplexity.rule=Host(`mcp.realsyncdynamicsai.de`)
      - traefik.http.routers.perplexity.entrypoints=web,websecure
      - traefik.http.routers.perplexity.tls=true
      - traefik.http.services.perplexity.loadbalancer.server.port=3000
    networks:
      - rsd_net  # Use your existing network name
```

## Phase 3: Environment Configuration

### Create or Update .env

```bash
# .env (do NOT commit)
PERPLEXITY_API_KEY=pplx_your_api_key_here
LOG_LEVEL=info
```

Add to `.gitignore`:
```
.env
.env.production
.env.*.local
```

## Deployment on VPS

### Step 1: SSH to VPS

```bash
ssh root@your-vps-ip
cd /opt/RealSyncDynamics.AI
```

### Step 2: Pull Latest Code

```bash
git pull origin main
```

### Step 3: Create/Update .env

```bash
cat > .env <<EOF
PERPLEXITY_API_KEY=$PERPLEXITY_API_KEY
LOG_LEVEL=info
EOF

chmod 600 .env
```

### Step 4: Start Service

**Option A: Separate Compose File**
```bash
docker compose -f docker-compose.perplexity.yml up -d
```

**Option B: Integrated Compose**
```bash
docker compose up -d perplexity-mcp
```

### Step 5: Verify Deployment

```bash
# Check container is running
docker ps | grep perplexity

# View logs
docker logs -f perplexity-mcp

# Test Traefik routing
curl -H "Host: mcp.realsyncdynamicsai.de" https://your-vps-ip
```

## Monitoring & Operations

### View Logs

```bash
# Real-time logs
docker logs -f perplexity-mcp

# Last 50 lines
docker logs --tail 50 perplexity-mcp

# Specific time range
docker logs --since 2h perplexity-mcp
```

### Check Container Status

```bash
docker ps -a | grep perplexity
docker inspect perplexity-mcp
```

### Memory/CPU Usage

```bash
docker stats perplexity-mcp --no-stream
```

### Restart Container

```bash
docker restart perplexity-mcp
```

### Stop Container

```bash
docker stop perplexity-mcp
```

### Remove Container (Cleanup)

```bash
docker stop perplexity-mcp
docker rm perplexity-mcp
```

## Updates & Rollback

### Update Service

```bash
# Pull latest code
git pull origin main

# Rebuild image
docker compose build --no-cache perplexity-mcp

# Restart container
docker compose up -d perplexity-mcp

# Verify
docker logs -f perplexity-mcp
```

### Rollback to Previous Version

```bash
# Revert code
git checkout HEAD~1

# Rebuild
docker compose build --no-cache perplexity-mcp

# Restart
docker compose up -d perplexity-mcp
```

Then investigate the issue and deploy a fixed version.

## Network Configuration

### Traefik Integration

The container is automatically discovered by Traefik via Docker labels:
- `traefik.enable=true` — Enable auto-discovery
- `traefik.http.routers.*.rule=Host(...)` — Route rule
- `traefik.http.services.*.loadbalancer.server.port=3000` — Backend port

### Domain Options

**Public Route (if MCP is public API):**
```yaml
traefik.http.routers.perplexity.rule=Host(`mcp.realsyncdynamicsai.de`)
```

**Private Route (internal only):**
```yaml
traefik.http.routers.perplexity.rule=Host(`perplexity-mcp`)
```

**Custom Port:**
Change `mcp.realsyncdynamicsai.de:8080` by updating the rule.

## Security Best Practices

✅ **Implemented:**
- `restart: unless-stopped` — Auto-recovery
- Environment variables for secrets (not hardcoded)
- Container isolation via bridge network
- Read-only volumes where possible

✅ **Recommended:**
- Use `.env` for secrets (never commit)
- Rotate `PERPLEXITY_API_KEY` quarterly
- Monitor container logs for errors
- Keep Docker & images updated
- Use private networks for internal routes

## Scaling & High Availability

### Multiple Replicas (for load balancing)

```yaml
perplexity-mcp:
  deploy:
    replicas: 2
    restart_policy:
      condition: on-failure
      delay: 5s
      max_attempts: 3
```

Traefik automatically load-balances across replicas.

### Resource Limits

```yaml
resources:
  limits:
    cpus: '1'
    memory: 512M
  reservations:
    cpus: '0.5'
    memory: 256M
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs perplexity-mcp

# Check if port is already in use
docker ps | grep 3000

# Check image exists
docker images | grep perplexity
```

### Traefik Routing Not Working

```bash
# Verify labels
docker inspect perplexity-mcp | grep -A 20 Labels

# Check Traefik logs
docker logs traefik

# Test direct connection
docker exec perplexity-mcp curl http://localhost:3000/health
```

### High Memory Usage

```bash
# Check memory
docker stats perplexity-mcp

# Set memory limit in compose
memory: 512M

# Restart
docker restart perplexity-mcp
```

### API Key Invalid

```bash
# Verify API key is set
docker exec perplexity-mcp env | grep PERPLEXITY

# Check .env file
cat .env | grep PERPLEXITY_API_KEY

# Restart with correct key
docker restart perplexity-mcp
```

## Integration with Hermes/OpenClaw

Once running, the MCP server can be used by agents:

**In Hermes/OpenClaw configuration:**

```typescript
const mcpClient = new MCPClient({
  host: 'perplexity-mcp',  // Docker network DNS
  port: 3000,
  tools: ['search_web', 'search_academic', 'summarize_research']
});

// Use in agent
const research = await mcpClient.call('search_web', {
  query: 'latest security vulnerabilities in AI'
});
```

## Performance Tuning

### Node.js Memory Limit

Add to environment:
```yaml
environment:
  NODE_OPTIONS: '--max-old-space-size=512'
```

### CPU Affinity

```yaml
deploy:
  resources:
    cpus: '2'
    memory: 512M
```

### Logging Optimization

Reduce verbosity in production:
```yaml
environment:
  LOG_LEVEL: warn
```

## Docker Compose Commands Reference

```bash
# Build image
docker compose build perplexity-mcp

# Start container
docker compose up -d perplexity-mcp

# Stop container
docker compose down perplexity-mcp

# View logs
docker compose logs -f perplexity-mcp

# Rebuild and restart
docker compose up -d --build perplexity-mcp

# Remove container and volume
docker compose down -v perplexity-mcp
```

## Documentation

- **README.md** — Service documentation & API reference
- **DEPLOY_DOCKER.md** — This file
- **docs/integrations/perplexity-mcp.md** — Full integration guide

## Support

- **Issues:** GitHub Issues with `perplexity-mcp` label
- **Logs:** `docker logs perplexity-mcp`
- **Status:** `docker ps | grep perplexity`
- **API Docs:** https://docs.perplexity.ai/
