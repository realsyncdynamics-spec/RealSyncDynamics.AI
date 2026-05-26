# VPS Bootstrap Status — RealSyncDynamics.AI

**Erstellt:** 2026-05-26
**Modus:** Read-only Inventur aus dem Repo. Was hier steht, ist **die Soll-Konfiguration laut Repository**. Den Ist-Zustand des laufenden Systems (Disk, RAM, listening ports, Restart-Loops) muss ein Operator per SSH live verifizieren — siehe SSH-Checkliste am Ende.

VPS-Ziel: `srv1622293` auf `187.77.89.1` (Hostinger).

---

## 1. Soll-Komponenten auf dem VPS

### 1.1 systemd-Units

| Unit | Bin/Container | Port | Env-File | Install | Restart |
|---|---|---|---|---|---|
| `openclaw-agent.service` | Docker-Container `realsync/openclaw-agent:latest` | `127.0.0.1:3001` | `/etc/openclaw-agent/env` (chmod 600) | `scripts/install-openclaw-vps.sh` (PR #402) | `always`, 10s Delay, 512MB / 1.0 CPU |
| `playwright-scanner.service` | Node `dist/index.js` aus `/opt/realsync-playwright-scanner` | `:3000` | `/etc/realsync-playwright-scanner.env` | Manuell (Service-File existiert, kein Install-Skript) | `on-failure`, 5s Delay, 3 Bursts/60s. Hardening: ProtectSystem, ProtectHome, PrivateTmp, NoNewPrivileges |
| `ollama.service` | offiziell via `ollama install.sh` | `127.0.0.1:11434` | systemd-Drop-In `/etc/systemd/system/ollama.service.d/override.conf` | `scripts/install-ollama-vps.sh` | systemd-Default |
| `nginx.service` | distro-paket | `:80`, `:443` | `/etc/nginx/sites-enabled/*` | manuell (Distro) | systemd-Default |

### 1.2 Docker-Compose-Stacks

| Stack | Container | Interner Port | Externe Route |
|---|---|---|---|
| `deploy/ollama-traefik/docker-compose.yml` | `kodee-ollama` (`ollama/ollama:latest`) | `11434` | Traefik → `ollama.realsyncdynamicsai.de` (BasicAuth) + nginx-Snippet `/_kodee/ollama` |
| | `kodee-open-webui` (`ghcr.io/open-webui/open-webui:main`) | `8080` | Traefik → `chat.realsyncdynamicsai.de` |
| | `kodee-n8n` (`docker.n8n.io/n8nio/n8n:latest`) | `5678` | Traefik → `n8n.realsyncdynamicsai.de` |
| `deploy/playwright-scanner/docker-compose.yml` | `realsync/playwright-scanner:latest` | `127.0.0.1:3001:3000` | Traefik → `scanner.realsyncdynamicsai.de`. Limits: 2GB RAM, 2.0 CPU, 1GB shm |
| `apps/agent-runtime/docker-compose.yml` | `agent-runtime:0.1.0` | `8787` | Traefik-Labels **auskommentiert** — derzeit nicht extern erreichbar |
| `worker/docker-compose.yml` | `realsync/audit-worker:latest` | kein Port | Worker-Prozess, polling. README markiert als „Scaffold" |

### 1.3 nginx-Vhosts und Snippets

| Datei (Repo) | Auf VPS | Zweck |
|---|---|---|
| `deploy/nginx/realsyncdynamicsai.de.conf` | `/etc/nginx/sites-available/realsyncdynamicsai.de.conf` | Apex + www-Redirect, SPA aus `/var/www/realsyncdynamicsai.de/dist`. Status unklar (siehe `dns-domain-status.md` §5.1) |
| `deploy/nginx/api.realsyncdynamicsai.de.conf` (PR #402) | `/etc/nginx/sites-available/api.realsyncdynamicsai.de.conf` | OpenClaw-Subdomain mit WS-Upgrade |
| `deploy/nginx/snippets/kodee-ollama.conf` | `/etc/nginx/snippets/kodee-ollama.conf` (chmod 600) | Bearer-gated Ollama-Proxy unter `/_kodee/ollama` |
| `deploy/nginx/snippets/openclaw-apex.conf` (PR #402) | `/etc/nginx/snippets/openclaw-apex.conf` | Apex-Pfad-Fallback fuer OpenClaw |

---

## 2. TCP-Ports — Soll

| Port | Service | Bind | Quelle |
|---|---|---|---|
| `22` | SSH | `0.0.0.0` | Implizit (deploy-Workflows nutzen SSH) — nicht im Repo deklariert |
| `80` | nginx | `0.0.0.0` | `deploy/nginx/realsyncdynamicsai.de.conf`. ACME + HTTP→HTTPS-Redirect |
| `443` | nginx | `0.0.0.0` | dito. TLS-Terminierung |
| `3001` | OpenClaw-Container | `127.0.0.1` | `services/openclaw-agent/openclaw-agent.service` |
| `3000`/`3001` | Playwright-Scanner | `127.0.0.1` | systemd-Variante: `:3000` · Docker-Variante: `127.0.0.1:3001:3000`. **Inkonsistenz** — siehe §6 |
| `11434` | Ollama | `127.0.0.1` | systemd-Drop-In |
| `8080` | Open WebUI | docker-internal | docker-compose, Traefik proxiert |
| `5678` | n8n | docker-internal | docker-compose, Traefik proxiert |
| `8787` | Agent-Runtime | docker-internal | aktuell nicht extern exposed |

---

## 3. Secrets-Pfade auf dem VPS

| Datei | Permissions | Wer schreibt? | Was steht drin? |
|---|---|---|---|
| `/etc/openclaw-agent/env` | `0600 root:root` | `scripts/install-openclaw-vps.sh` | `OPENAI_API_KEY`, `OPENCLAW_SECRET`, `OPENCLAW_CORS_ORIGINS`, `OPENCLAW_RATE_LIMIT_PER_MIN`, `OPENCLAW_DAILY_TOKEN_CAP`, `SENTRY_DSN`, `PORT` |
| `/etc/realsync-playwright-scanner.env` | `0600 root:root` | Manuell | `SCANNER_SECRET` |
| `/etc/nginx/snippets/kodee-ollama.conf` | `0600 root:root` | `scripts/install-ollama-vps.sh` | Bearer-Token (in nginx-Snippet einkompiliert) |
| docker-compose `.env` neben jedem Stack | Datei-System-Default | Manuell | `WEBUI_SECRET_KEY`, `N8N_ENCRYPTION_KEY` (kritisch — Verlust = irreversibler Datenverlust), `AGENT_RUNTIME_API_TOKEN`, `OLLAMA_BASIC_AUTH` |
| `/etc/letsencrypt/live/<domain>/privkey.pem` | `0600 root:root` | certbot | TLS-Private-Keys, **nicht** im Repo, **nicht** im Backup |

---

## 4. Logs — Soll-Pfade

| Quelle | Befehl |
|---|---|
| `openclaw-agent` | `journalctl -u openclaw-agent -n 200 --no-pager` (systemd zieht Docker-stdout) |
| `playwright-scanner` (systemd) | `journalctl -u playwright-scanner -n 200 --no-pager` |
| nginx Access/Error | `/var/log/nginx/access.log`, `/var/log/nginx/error.log` (logrotate) |
| Docker-Container | `docker logs --tail 200 kodee-ollama`, `docker logs --tail 200 kodee-n8n`, etc. |
| n8n-App-Logs | `docker exec kodee-n8n ls -lh /home/node/.n8n/` |

Aus dem Repo gibt es keine zentrale Log-Aggregation (kein Loki, kein Vector, kein Promtail in den Compose-Files). Logs muessen pro Service einzeln gezogen werden.

---

## 5. Backup — Soll-Stand

`scripts/vps-backup.sh`, getriggert von `.github/workflows/vps-backup.yml` (Cron 03:17 UTC).

| Was wird gesichert | Pfad |
|---|---|
| Frontend-Dist | `/var/www/realsyncdynamicsai.de` |
| nginx-Configs + ACME-Public-Certs | `/etc/nginx`, `/etc/letsencrypt/live` (ohne `privkey.pem`) |
| Deploy-Skripte | `/opt/realsync/deploy` falls vorhanden |

Ausgabe: `/var/backups/realsyncdynamicsai/rsd-YYYYMMDD-HHMM.tar.gz`, 7-Tage-Rotation.

**Was wird NICHT gesichert (siehe §6):**

- Docker-Volumes: `ollama_models` (~4.7GB qwen3:4b), `kodee_open_webui_data`, `kodee_n8n_data`, `playwright-cache`
- Insbesondere `N8N_ENCRYPTION_KEY` und das verschluesselte n8n-Workflow-State sind nur als Docker-Volume vorhanden. Bei Volume-Verlust ohne separate Sicherung sind verschluesselte Credentials nicht mehr lesbar.
- Off-Site: keine. Backup liegt auf derselben Box, die es sichert.

---

## 6. Bekannte Inkonsistenzen / offene Punkte

### 6.1 Playwright-Scanner: systemd vs Docker

`services/playwright-scanner/playwright-scanner.service` deklariert einen systemd-Node-Prozess auf `:3000`. `services/playwright-scanner/docker-compose.yml` und `deploy/playwright-scanner/docker-compose.yml` deklarieren denselben Service als Container auf `127.0.0.1:3001:3000`. → Beide koennen nicht gleichzeitig laufen. Operator muss eines waehlen und das andere im Repo loeschen.

### 6.2 Apex-Frontend-Pfad

`deploy-frontend.yml` rsynct nach `/var/www/realsyncdynamicsai.de/dist`. Es existiert kein `kodee-frontend`-Container, aber Traefik hat ein 301-Redirect zu GitHub Pages. Wer servt heute tatsaechlich `realsyncdynamicsai.de:443`? Siehe `dns-domain-status.md` §5.1.

### 6.3 Docker-Volume-Backup fehlt

`scripts/vps-backup.sh` ignoriert Docker-Volumes. `N8N_ENCRYPTION_KEY` ist als einziger Wert auf der ganzen Box, der bei Verlust irreversiblen Datenverlust verursacht. Kein redundanter Speicher.

### 6.4 Off-Site-Backup fehlt

Bei VPS-Verlust sind Backup und Quelldaten in einem Schritt weg. Empfohlene Mitigation (separater PR): `rclone` Push nach S3/B2 nach jedem `vps-backup.sh`-Lauf.

### 6.5 Firewall

Im Repo gibt es keine ufw-/fail2ban-/iptables-Konfiguration. Welche Regeln aktuell auf der Box gelten, ist nicht reproduzierbar dokumentiert.

### 6.6 Traefik-Konfiguration nicht im Repo

`deploy/ollama-traefik/docker-compose.yml` nutzt ein externes Docker-Network (`traefik_proxy`). Die Traefik-Instanz selbst (Image-Version, certresolver-Config, dynamic config, BasicAuth-Hashes) ist nicht im Repo. → Operator-Wissen bei Neusetup nicht reproduzierbar.

### 6.7 Veraltete IPs / DNS-Beispiele

`deploy/README.md` und `deploy/ollama-traefik/README.md` enthalten alte IPs (`72.61.89.191`, `194.163.130.123`). Siehe `dns-domain-status.md` §5.2, §5.3.

### 6.8 Agent-Runtime nicht produktiv

`apps/agent-runtime/docker-compose.yml` hat Traefik-Labels auskommentiert und keine externe Route. Status ist „Scaffold". Sollte ggf. aus dem Deploy-Bild explizit ausgenommen oder fertiggestellt werden.

---

## 7. SSH-Verifikations-Checkliste (Operator)

Diese Befehle muss jemand einmal auf dem VPS ausfuehren und die Ausgaben in dieses Dokument unterhalb dieser Sektion anhaengen.

```bash
# 7.1 OS / Kernel / Distro
cat /etc/os-release
uname -a
uptime

# 7.2 Disk / RAM / CPU / Load
df -h / /var /home
free -h
nproc
top -bn1 | head -5

# 7.3 Listening Ports — entspricht das §2?
sudo ss -tlnp

# 7.4 systemd Status — laeuft / restart loop?
sudo systemctl --failed
sudo systemctl status openclaw-agent --no-pager
sudo systemctl status playwright-scanner --no-pager
sudo systemctl status ollama --no-pager
sudo systemctl status nginx --no-pager

# 7.5 Restart-Loops in den letzten 24h?
sudo journalctl --since='24 hours ago' -p err -u openclaw-agent -u playwright-scanner -u nginx -u ollama --no-pager | tail -50

# 7.6 Docker — welche Container, welche Volumes, welche Logs-Groesse?
sudo docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
sudo docker volume ls
sudo docker system df

# 7.7 nginx -t syntaktisch sauber?
sudo nginx -t

# 7.8 Cert-Renewal-Mechanismus aktiv?
sudo certbot certificates
sudo systemctl list-timers | grep -i certbot

# 7.9 Firewall — was ist offen?
sudo ufw status verbose          # ufw falls vorhanden
sudo iptables -L -n -v            # andernfalls iptables
sudo fail2ban-client status       # falls vorhanden

# 7.10 Backup — letzter Lauf, Groesse, Datei-Inventar
ls -lh /var/backups/realsyncdynamicsai/
sudo tar -tzf /var/backups/realsyncdynamicsai/$(ls -t /var/backups/realsyncdynamicsai/ | head -1) | head -50

# 7.11 Secrets — existieren und chmod 600?
sudo ls -l /etc/openclaw-agent/env /etc/realsync-playwright-scanner.env /etc/nginx/snippets/kodee-ollama.conf 2>/dev/null
```

Wenn diese 11 Punkte ein Mal lueckenlos abgelaufen sind und die Outputs hier angehaengt sind, ist die Repo-Soll-Konfiguration und der Ist-Zustand abgeglichen.

---

## 8. Keine Aenderungen aus dieser Analyse

Dieses Dokument ist Read-Only-Inventur. Keine Service-Restarts, keine Compose-Edits, keine Backup-Skript-Aenderungen.
