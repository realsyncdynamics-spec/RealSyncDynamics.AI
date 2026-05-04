# Kodee Ollama-Stack (Traefik-Variante, Subdomain-Routing)

EU-lokale, **DSGVO-konforme** AI-Inferenz für RealSyncDynamics.AI, hinter dem
bestehenden Host-Traefik auf dem Kodee-VPS (187.77.89.1, Hostinger srv1622293).

## DSGVO-Posture (Stand 2026-05-03)

- **Modell:** `qwen3:4b` (Apache 2.0, Alibaba) — läuft komplett auf dem
  Hostinger-EU-VPS; keine Daten an Anthropic, Google, OpenAI oder andere
  Drittländer.
- **Telemetrie aus:** Ollama hat keine Telemetrie; Open WebUI mit
  `ENABLE_SIGNUP=false`; n8n mit `N8N_DIAGNOSTICS_ENABLED=false` und
  `N8N_VERSION_NOTIFICATIONS_ENABLED=false`.
- **Verschlüsselung:** TLS für alle externen Verbindungen (Let's Encrypt
  via Traefik), n8n-Workflow-Credentials AES-256 via `N8N_ENCRYPTION_KEY`.
- **Zugriffskontrolle:** Ollama-API über BasicAuth-Middleware (Traefik),
  Open WebUI über eigene Login + `DEFAULT_USER_ROLE=pending` (kein
  Auto-Approve).
- **Datenfluss-Transparenz:** Edge-Function `ai-invoke` schreibt jeden
  Aufruf in `ai_tool_runs` (Audit-Log) mit `metadata.provider` und
  `metadata.residency` — User kann jederzeit sehen wo seine Anfrage lief.
- **Nutzer-Wahl:** `/settings/ai-residency` — Per-User-Toggle und
  Per-Tenant-Policy für `eu_local` vs `cloud`.
- **Kein Cross-Border-Routing:** Edge-Functions weigern sich strikt
  Cloud-Provider zu callen wenn `residency=eu_local` gesetzt ist (auch
  wenn der Cloud-Provider technisch verfügbar wäre).

## Architektur

```
[internet] ─TLS─→ Host-Traefik
                     │
                     ├── ollama.realsyncdynamicsai.de
                     │      ↓ BasicAuth-Middleware (Traefik native)
                     │   ollama:11434  (interne Compose-Net, keine Public-Ports)
                     │      ↑
                     │      │ http (internal)
                     │      │
                     └── chat.realsyncdynamicsai.de
                            ↓ Open WebUI bringt eigene Login + API-Keys
                         open-webui:8080
```

- **Routing rein über Traefik-Labels** — kein Caddy, kein PathPrefix.
- **BasicAuth auf der API** über Traefik-Middleware (Bearer kann Traefik nicht
  ohne Plugin validieren).
- **Open WebUI** als Standard-Frontend für Ollama, mit Auto-Admin-Flow für
  den ersten User + Multi-User danach.
- Beide Container hängen am externen Traefik-Netz (`TRAEFIK_NETWORK`) und
  einem privaten Compose-Netz (`internal`).

## Voraussetzungen

- Docker + docker-compose v2 (`docker compose version`)
- Bestehender Host-Traefik mit Docker-Provider + Let's-Encrypt-Resolver
- `apache2-utils` (für `htpasswd`) — `apt install -y apache2-utils`
- DNS A-Records:
  - `ollama.realsyncdynamicsai.de` → 187.77.89.1 (VPS public IP)
  - `chat.realsyncdynamicsai.de`   → 187.77.89.1
- Mind. 4 GB RAM für `qwen3:4b` (Default-Modell, ~2.5 GB). 7B/8B-Modelle brauchen
  ≥ 16 GB — wenn die VPS knapp ist, beim 3B bleiben + 2 GB Swap einrichten:
  `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab`

## Setup

### 1. DNS anlegen

Im Hostinger-DNS-Panel **zwei neue A-Records**:

```
A  ollama  194.163.130.123  3600
A  chat    194.163.130.123  3600
```

Warten bis beide auflösen (Cloudflare DoH:
`curl 'https://cloudflare-dns.com/dns-query?name=ollama.realsyncdynamicsai.de&type=A' -H 'Accept: application/dns-json'`).

### 2. Auf dem VPS

```bash
ssh root@194.163.130.123
cd /root/RealSyncDynamics.AI
git pull origin claude/kodee-vps-assistant-QAj43
cd deploy/ollama-traefik
```

### 3. .env anlegen

```bash
cp .env.example .env

# BasicAuth-Credentials erzeugen
apt install -y apache2-utils
PASS=$(openssl rand -base64 24)
HASH=$(htpasswd -nbB kodee "$PASS" | sed 's/\$/\$\$/g')
echo "PLAIN PASSWORD (für Supabase-Secret OLLAMA_AUTH_TOKEN als 'kodee:$PASS'): $PASS"

# WebUI-Secret
WEBUI_KEY=$(openssl rand -hex 32)

# Traefik-Netz vom Host finden
NET=$(docker ps --format '{{.Names}}\t{{.Networks}}' | grep -i traefik | head -1 | awk '{print $NF}')
[ -z "$NET" ] && NET="openclaw_default"

# In .env eintragen
sed -i "s|^OLLAMA_BASIC_AUTH=.*|OLLAMA_BASIC_AUTH=$HASH|" .env
sed -i "s|^WEBUI_SECRET_KEY=.*|WEBUI_SECRET_KEY=$WEBUI_KEY|" .env
sed -i "s|^TRAEFIK_NETWORK=.*|TRAEFIK_NETWORK=$NET|" .env

cat .env
```

### 4. Stack starten

```bash
docker compose up -d
sleep 5
docker compose ps
```

Beide Container sollten `Up` (Ollama eventuell `health: starting` bis 60s).

### 5. Modell pullen (~5-15 Min, einmalig)

```bash
docker exec -it kodee-ollama ollama pull qwen3:4b
```

### 6. Tests

```bash
# 401 ohne Auth
curl -s -o /dev/null -w 'no-auth: %{http_code}\n' \
  https://ollama.realsyncdynamicsai.de/

# 200 mit BasicAuth
curl -sf -u "kodee:$PASS" https://ollama.realsyncdynamicsai.de/

# Echte Inferenz (30-60s auf 16GB CPU)
curl -sf --max-time 180 -u "kodee:$PASS" \
  -X POST https://ollama.realsyncdynamicsai.de/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3:4b","messages":[{"role":"user","content":"Antworte mit genau einem Wort: ok"}],"stream":false}'

# WebUI im Browser:  https://chat.realsyncdynamicsai.de
```

Erwartung:
- `no-auth: 401`
- BasicAuth → `Ollama is running` (Default-Antwort an `/`)
- Inferenz → `{"model":"...","message":{"content":"ok"},...}`

## Supabase Edge-Function Secrets

[Settings → Edge Functions → Secrets](https://supabase.com/dashboard/project/ebljyceifhnlzhjfyxup/settings/functions):

```
OLLAMA_URL        = https://ollama.realsyncdynamicsai.de
OLLAMA_AUTH_TOKEN = kodee:<das Klartext-Passwort aus Schritt 3>
```

`OLLAMA_AUTH_TOKEN` ist hier **`user:password`**, nicht ein hex-Token. Die
Edge-Function rechnet das in `Authorization: Basic base64(user:password)` um.

## WebUI-Hardening nach erstem Login

1. https://chat.realsyncdynamicsai.de aufrufen, Konto anlegen → Du bist Admin.
2. In `.env`: `ENABLE_SIGNUP=false`, dann:
   ```bash
   docker compose up -d open-webui
   ```
3. (Optional) Im Admin-Panel weitere User einladen + Permissions setzen.

## Troubleshooting

**`network openclaw_default not found`** beim `compose up` —
Falscher `TRAEFIK_NETWORK`. Auf VPS: `docker network ls`. Den richtigen
Namen in `.env` eintragen.

**`no-auth` liefert 200 oder 404 statt 401** —
Traefik sieht den Router nicht oder die Middleware greift nicht. Check:
- `docker compose ps` — beide `Up`?
- Traefik-Logs: `docker logs $(docker ps --format '{{.Names}}' | grep -i traefik | head -1) 2>&1 | grep -iE 'kodee|ollama|chat'`

**`mit-auth` liefert 502** —
Container im selben Netz wie Traefik? `docker network inspect $NET | grep -E 'kodee'` sollte beide listen.

**Cert-Fehler** —
`TRAEFIK_CERT_RESOLVER`-Name passt nicht. Im Traefik-static-config (typisch
`traefik.yml`) unter `certificatesResolvers:` nachsehen.

## Stack stoppen / aufräumen

```bash
docker compose down              # Container weg, Modelle + WebUI-Daten bleiben
docker compose down -v           # auch alle Volumes löschen (4.7 GB Modell + WebUI-DB)
```
