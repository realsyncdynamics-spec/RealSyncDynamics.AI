# Perplexity MCP — VPS Deployment Guide

Deploy the Perplexity MCP server on Hostinger VPS as a systemd service.

## Prerequisites

- Hostinger VPS access (SSH)
- Node.js 18+ installed
- Perplexity API key (`PERPLEXITY_API_KEY`)
- Domain/DNS configured (optional, for reverse proxy)

## Deployment Steps

### 1. SSH into VPS

```bash
ssh root@your-vps-ip
```

### 2. Clone Repository

```bash
cd /opt
git clone https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI.git
cd RealSyncDynamics.AI/services/perplexity-mcp
```

Or if already cloned:
```bash
cd /opt/RealSyncDynamics.AI
git pull origin main
```

### 3. Install Dependencies

```bash
npm install --production
```

### 4. Create Service User (Recommended)

```bash
useradd -r -s /bin/false perplexity-mcp
chown -R perplexity-mcp:perplexity-mcp /opt/RealSyncDynamics.AI/services/perplexity-mcp
```

### 5. Set Environment Variables

Create `.env` file:

```bash
sudo nano /opt/RealSyncDynamics.AI/services/perplexity-mcp/.env
```

Add:
```
PERPLEXITY_API_KEY=pplx_your_api_key_here
LOG_LEVEL=info
```

**Secure it:**
```bash
chmod 600 /opt/RealSyncDynamics.AI/services/perplexity-mcp/.env
chown perplexity-mcp:perplexity-mcp /opt/RealSyncDynamics.AI/services/perplexity-mcp/.env
```

### 6. Create Systemd Service File

Create `/etc/systemd/system/perplexity-mcp.service`:

```bash
sudo tee /etc/systemd/system/perplexity-mcp.service > /dev/null <<'EOF'
[Unit]
Description=Perplexity MCP Server
Documentation=https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/tree/main/services/perplexity-mcp
After=network.target

[Service]
Type=simple
User=perplexity-mcp
WorkingDirectory=/opt/RealSyncDynamics.AI/services/perplexity-mcp
EnvironmentFile=/opt/RealSyncDynamics.AI/services/perplexity-mcp/.env
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=perplexity-mcp

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/RealSyncDynamics.AI/services/perplexity-mcp

[Install]
WantedBy=multi-user.target
EOF
```

### 7. Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable perplexity-mcp
sudo systemctl start perplexity-mcp
```

### 8. Verify Service Status

```bash
sudo systemctl status perplexity-mcp
```

Expected output:
```
● perplexity-mcp.service - Perplexity MCP Server
     Loaded: loaded (/etc/systemd/system/perplexity-mcp.service; enabled; vendor preset: enabled)
     Active: active (running) since 2026-08-03 23:00:00 UTC
```

### 9. View Logs

```bash
# Real-time logs
sudo journalctl -u perplexity-mcp -f

# Last 50 lines
sudo journalctl -u perplexity-mcp -n 50

# Specific time range
sudo journalctl -u perplexity-mcp --since "2 hours ago"
```

## Integration with Traefik (Reverse Proxy)

If using Traefik for load balancing, configure:

**Docker Compose (optional):**
```yaml
services:
  perplexity-mcp:
    image: perplexity-mcp:latest
    build: ./services/perplexity-mcp
    environment:
      PERPLEXITY_API_KEY: ${PERPLEXITY_API_KEY}
      LOG_LEVEL: info
    restart: unless-stopped
    networks:
      - internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.services.perplexity-mcp.loadbalancer.server.port=3000"
      # Middleware for MCP protocol (stdio-based, no HTTP routing needed)
```

## Monitoring & Maintenance

### Health Checks

The service runs on stdio (MCP protocol), not HTTP. Monitor via:

```bash
# Check process is running
pgrep -f "perplexity-mcp" && echo "Running" || echo "Stopped"

# Check memory usage
ps aux | grep perplexity-mcp

# Check systemd restart count
systemctl show -p NRestarts perplexity-mcp.service
```

### Log Rotation

Systemd journal manages logs automatically. To configure retention:

```bash
sudo nano /etc/systemd/journald.conf
```

Set:
```
MaxRetentionSec=30d
MaxDiskUsage=1G
```

Restart journald:
```bash
sudo systemctl restart systemd-journald
```

### Updates

To update the service:

```bash
cd /opt/RealSyncDynamics.AI
git pull origin main
cd services/perplexity-mcp
npm install --production

# Restart service
sudo systemctl restart perplexity-mcp

# Verify
sudo systemctl status perplexity-mcp
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
sudo journalctl -u perplexity-mcp -n 100

# Check for syntax errors
node /opt/RealSyncDynamics.AI/services/perplexity-mcp/src/index.js

# Check permissions
ls -la /opt/RealSyncDynamics.AI/services/perplexity-mcp/.env
```

### Permission Denied

```bash
sudo chown -R perplexity-mcp:perplexity-mcp /opt/RealSyncDynamics.AI/services/perplexity-mcp
sudo chmod 755 /opt/RealSyncDynamics.AI/services/perplexity-mcp
sudo chmod 600 /opt/RealSyncDynamics.AI/services/perplexity-mcp/.env
```

### High CPU/Memory Usage

```bash
# Monitor in real-time
watch -n 1 'ps aux | grep perplexity-mcp'

# Check if API calls are timing out
sudo journalctl -u perplexity-mcp -f | grep -i "error\|timeout"

# Adjust LOG_LEVEL for debugging
sudo nano /opt/RealSyncDynamics.AI/services/perplexity-mcp/.env
# Set: LOG_LEVEL=debug
sudo systemctl restart perplexity-mcp
```

### Connection Issues

```bash
# Test API key
curl -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
  https://api.perplexity.ai/chat/completions

# Check network connectivity
ping api.perplexity.ai
```

## Security Considerations

✅ **Implemented:**
- Service runs as unprivileged user (`perplexity-mcp`)
- `.env` file is mode 600 (owner-only readable)
- Systemd sandboxing enabled (`ProtectSystem=strict`)
- No access to `/home` or system directories
- Logs captured by journald (no file access needed)

✅ **Recommendations:**
- Rotate `PERPLEXITY_API_KEY` quarterly
- Monitor `journalctl` for errors
- Update Node.js regularly: `apt update && apt upgrade nodejs`
- Use firewall to restrict outbound HTTPS to Perplexity API only

## Performance Tuning

### Node.js Memory Limit

Edit systemd service:
```bash
sudo systemctl edit perplexity-mcp
```

Add under `[Service]`:
```
Environment="NODE_OPTIONS=--max-old-space-size=512"
```

### CPU Affinity (Optional)

Pin to specific cores:
```
CPUAffinity=0-3
```

### Rate Limiting

Set in `.env`:
```
MAX_REQUESTS_PER_MINUTE=30
MAX_REQUESTS_PER_DAY=1000
```

(Future feature — currently unlimited)

## Backup & Recovery

### Backup Configuration

```bash
sudo tar czf /backup/perplexity-mcp-config-$(date +%Y%m%d).tar.gz \
  /opt/RealSyncDynamics.AI/services/perplexity-mcp/.env \
  /etc/systemd/system/perplexity-mcp.service
```

### Restore from Backup

```bash
sudo tar xzf /backup/perplexity-mcp-config-20260803.tar.gz -C /
sudo systemctl daemon-reload
sudo systemctl restart perplexity-mcp
```

## Metrics & Monitoring (Future)

Plan integration with:
- **Prometheus:** Scrape metrics endpoint
- **Grafana:** Visualize API calls, latency, token usage
- **AlertManager:** Alert on failures or high latency

Example Prometheus config (future):
```yaml
scrape_configs:
  - job_name: 'perplexity-mcp'
    static_configs:
      - targets: ['localhost:9090']  # Metrics port
```

## Support & Documentation

- **Service Logs:** `sudo journalctl -u perplexity-mcp -f`
- **GitHub:** https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/tree/main/services/perplexity-mcp
- **Issues:** Report in GitHub Issues with logs
- **API Docs:** https://docs.perplexity.ai/

## Rollback

If issues occur after deployment:

```bash
# Stop the service
sudo systemctl stop perplexity-mcp

# Revert code
cd /opt/RealSyncDynamics.AI
git checkout main~1

# Reinstall dependencies
cd services/perplexity-mcp
npm install --production

# Restart
sudo systemctl start perplexity-mcp

# Verify
sudo systemctl status perplexity-mcp
```

Then investigate the issue and re-deploy with fixes.
