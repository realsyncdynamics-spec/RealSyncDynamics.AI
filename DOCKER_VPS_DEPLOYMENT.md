# Docker + Traefik VPS-Deployment für RealSyncDynamics.AI

Vollständige Anleitung zum Deployment der Vite+React SPA auf einen VPS mit Host-Traefik als Reverse Proxy.

## Überblick

- **Zielinfrastruktur**: VPS mit Docker + docker-compose + Host-Traefik
- **Frontend**: Vite + React (statische HTML/JS/CSS)
- **Build-Zeit**: ~2-3 Minuten (npm install + vite build)
- **Laufzeit**: nginx:alpine auf Port 80 (hinter Traefik-TLS)
- **Skalierung**: Horizontal möglich (mehrere Container, Load-Balanced via Traefik)

## Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│ Internet / DNS                                              │
│   realsyncdynamicsai.de → VPS-IP                            │
└──────────────────────┬──────────────────────────────────────┘
                       │ :443 (HTTPS)
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ VPS Host                                                    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Host-Traefik (Reverse Proxy)                       │   │
│  │  - TLS-Terminierung (Let's Encrypt)                │   │
│  │  - Docker Provider (Auto-Discovery)                │   │
│  │  - Routing-Rules via Labels                        │   │
│  │  - Port 80/443 auf Host                            │   │
│  └────────────────────────────────────────────────────┘   │
│         │                                                   │
│         │ :80 (HTTP-intern)                                │
│         ▼                                                   │
│  ┌────────────────────────────────────────────────────┐   │
│  │ docker-compose (docker/realsync-web)               │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐  │   │
│  │  │ realsync-frontend (nginx:alpine)            │  │   │
│  │  │  - Statische SPA-Assets                     │  │   │
│  │  │  - Port 80 (nur intern im Netz)             │  │   │
│  │  │  - Healthcheck (/healthz)                   │  │   │
│  │  │  - Security Headers                         │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─── Weitere Services (optional) ──────────────────┐     │
│  │  - Ollama (ai-api.realsyncdynamicsai.de)         │     │
│  │  - Open WebUI (chat.realsyncdynamicsai.de)       │     │
│  │  - n8n (n8n.realsyncdynamicsai.de)               │     │
│  └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: VPS-Setup (einmalig)

### Schritt 1: Host-Traefik installieren (falls nicht vorhanden)

Falls Traefik noch nicht auf diesem VPS läuft:

```bash
# SSH auf den VPS
ssh user@your-vps-ip

# Verzeichnis für Traefik vorbereiten
mkdir -p /home/deploy/traefik-host
cd /home/deploy/traefik-host

# Traefik Static Config (traefik.yml) erstellen
cat > traefik.yml << 'EOF'
global:
  checkNewVersion: false
  sendAnonymousUsage: false

api:
  insecure: false
  address: :8080

entryPoints:
  web:
    address: :80
  websecure:
    address: :443

providers:
  docker:
    endpoint: unix:///var/run/docker.sock
    exposedByDefault: false
    watch: true
  file:
    filename: /etc/traefik/dynamic.yml
    watch: true

certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com
      storage: /etc/traefik/acme.json
      httpChallenge:
        entryPoint: web
      tlsChallenge: {}

log:
  level: INFO
  format: json
EOF

# docker-compose.yml für Traefik
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  traefik:
    image: traefik:v3.0
    container_name: traefik-host
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/traefik.yml:ro
      - ./acme.json:/etc/traefik/acme.json
    networks:
      - traefik_proxy

networks:
  traefik_proxy:
    driver: bridge
EOF

# ACME-Storage vorbereiten
touch acme.json
chmod 600 acme.json

# Starten
docker compose up -d

# Prüfen
docker compose ps
docker logs traefik-host | head -20
```

### Schritt 2: Network Namen herausfinden

```bash
docker network ls | grep -E 'traefik|proxy|default'
# Output: NAME              DRIVER    SCOPE
#         traefik_proxy     bridge    local

# Merken: traefik_proxy (oder whatever der Name ist)
# Diese ID in docker/realsync-web/.env unter TRAEFIK_NETWORK eintragen
```

### Schritt 3: Repository auf VPS clonen

```bash
# Deploy-Directory
mkdir -p /home/deploy/realsync
cd /home/deploy/realsync

# Repository clonen
git clone https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI.git .
git checkout claude/turborepo-nextjs-docker-4l9cey

# Erfolgreich geclont?
ls -la docker/realsync-web/
# → Dockerfile, docker-compose.yml, .env.example, nginx.conf sollten da sein
```

## Phase 2: Frontend-Deployment

### Schritt 1: Environment konfigurieren

```bash
cd /home/deploy/realsync/docker/realsync-web

# .env aus Beispiel erstellen
cp .env.example .env

# Mit Editor öffnen und Werte eintragen
nano .env
# (oder vim, je nach Vorliebe)
```

Folgende Werte MÜSSEN gesetzt sein:

```env
# Traefik (prüfen mit: docker network ls)
TRAEFIK_NETWORK=traefik_proxy
TRAEFIK_CERT_RESOLVER=letsencrypt

# Supabase (von https://app.supabase.com → Project Settings → API)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional (leer lassen wenn nicht verfügbar)
VITE_SENTRY_DSN=
VITE_GOOGLE_GENAI_API_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
```

### Schritt 2: DNS A-Records setzen

Bevor wir den Container starten, **MUSS** DNS konfiguriert sein, sonst schlägt Let's Encrypt fehl.

Beispiel (bei Hetzner DNS, DigitalOcean, Cloudflare, etc.):

```
Type    Name                           Value              TTL
─────────────────────────────────────────────────────────────
A       realsyncdynamicsai.de          194.163.130.123    3600
A       www.realsyncdynamicsai.de      194.163.130.123    3600
```

Propagation prüfen (kann 5-30 Minuten dauern):

```bash
dig realsyncdynamicsai.de
# Sollte VPS-IP zeigen
```

**Erst weitermachen wenn DNS zeigt** — sonst ACME-Challenge schlägt fehl!

### Schritt 3: Build & Start

```bash
cd /home/deploy/realsync/docker/realsync-web

# Build (abhängig von Node-Version und Bandbreite: 2-3 min)
docker compose build --progress=plain

# Logs während dem Build beobachten
# Sollte am Ende "npm run build" erfolgreich abschließen

# Starten
docker compose up -d

# Logs prüfen
docker compose logs -f frontend

# Sollte etwa so aussehen:
# frontend | [notice] nginx/1.27-alpine: signal process started
# → Keine Fehler = gut!
```

### Schritt 4: Verifikation

```bash
# 1. Container-Status
docker compose ps
# Status sollte: "Up (healthy)"

# 2. Healthcheck vom Container
curl http://127.0.0.1:8080/healthz
# Output: "ok"
# (Hinweis: nur Host-intern erreichbar, nicht von außen)

# 3. Traefik-Logs (Let's Encrypt Cert-Generierung)
docker logs traefik-host | grep -iE 'realsync|certificate|letsencrypt'
# Sollte zeigen: "Successfully received certificate"
# (Dauert 30-60 Sekunden nach startup)

# 4. HTTPS testen
curl -I https://realsyncdynamicsai.de
# Output: 200 OK, HTTPS mit Let's Encrypt Cert

# 5. Im Browser
# Öffne: https://realsyncdynamicsai.de
# → Sollte die RealSync-Startseite laden
# → HTTPS-Schloss (grün) = Let's Encrypt aktiv
```

## Phase 3: Continuous Deployment (GitHub Actions)

Optionaler Schritt: Automatisches Deployment bei Push.

### Schritt 1: GitHub Secrets konfigurieren

Im Repository → Settings → Secrets and variables → Actions:

```
VPS_HOST          = deine-vps.de (oder IP)
VPS_USER          = deploy (oder dein SSH-User)
VPS_SSH_KEY       = Private SSH-Key (PEM-Format)
VPS_DEPLOY_PATH   = /home/deploy/realsync
```

SSH-Key generieren (auf lokaler Maschine):

```bash
ssh-keygen -t ed25519 -f deploy_key -N ""
# Ergebnis: deploy_key (private, → GitHub Secret)
#          deploy_key.pub (public, → auf VPS in ~/.ssh/authorized_keys)

cat deploy_key | base64 -w0  # → GitHub Secret VPS_SSH_KEY
```

### Schritt 2: Workflow aktivieren

Die GitHub Actions Workflow ist bereits vorhanden: `.github/workflows/deploy-frontend-vps.yml`

Sie triggert automatisch bei Push auf `claude/turborepo-nextjs-docker-4l9cey` und ändert in:
- `src/**`
- `docker/realsync-web/**`
- `package.json`
- `vite.config.ts`

Prüfen:

```bash
git push origin claude/turborepo-nextjs-docker-4l9cey

# Im Repository → Actions Tab sollte der Workflow laufen
# Nach ~10-15 Minuten: "✅ Frontend deployed to VPS"
```

## Phase 4: Wartung & Monitoring

### Regelmäßige Checks

```bash
cd /home/deploy/realsync/docker/realsync-web

# Container-Status
docker compose ps

# Logs der letzten 100 Zeilen
docker compose logs --tail=100 frontend

# Speichernutzung
docker stats realsync-frontend

# Traefik-Status (von host-Traefik)
docker logs traefik-host | tail -20
```

### Updates einspielen

```bash
cd /home/deploy/realsync

# Neuen Code pullen
git pull origin claude/turborepo-nextjs-docker-4l9cey

# Neu bauen + deployen
cd docker/realsync-web
docker compose build
docker compose up -d

# Verifikation
docker compose ps  # Should be "Up (healthy)"
curl -I https://realsyncdynamicsai.de  # Should be 200 OK
```

### Backups

WICHTIG: Die `.env`-Datei mit Secrets sollte regelmäßig gesichert werden:

```bash
# Backup
cp docker/realsync-web/.env /backup/realsync-web-env.backup

# Mit Encryption
gpg --symmetric docker/realsync-web/.env
# Ergebnis: .env.gpg (mit Passwort)
```

## Troubleshooting

### Container lädt sich dauernd neu (CrashLoop)

```bash
docker compose logs frontend
# Suche nach Fehlermeldungen
```

**Häufige Ursachen & Lösungen:**

| Problem | Symptom | Lösung |
|---------|---------|---------|
| Fehlende .env | "Error: Required env var not set" | `cp .env.example .env` + Werte eintragen |
| Build scheitert | "npm ERR!" in Logs | `docker compose build --no-cache` |
| Falsche VITE_* Werte | Blank white page im Browser | .env überprüfen, Werte korrekt? |
| Kein Traefik-Netz | "network not found" | `docker network ls` prüfen, TRAEFIK_NETWORK korrigieren |

### Traefik findet Container nicht (502 Bad Gateway)

```bash
# 1. Ist Container im Traefik-Netz?
docker network inspect traefik_proxy | grep realsync

# 2. Traefik-Config OK?
docker logs traefik-host | grep -iE 'provider|docker'

# 3. Labels korrekt?
docker inspect realsync-frontend | grep traefik.
```

**Häufig hilfreich:**

```bash
docker compose down
docker compose up -d
# (Traefik-Discovery triggern)

sleep 10

docker logs traefik-host | tail -5
```

### HTTPS-Cert holt nicht (Traefik Error)

```bash
# Traefik-Logs
docker logs traefik-host | grep -iE 'acme|letsencrypt|challenge|error'
```

**Häufige Ursachen:**

1. **DNS nicht konfiguriert**: `dig realsyncdynamicsai.de` sollte VPS-IP zeigen
2. **Firewall blockiert Port 80**: Let's Encrypt braucht HTTP für Challenge
3. **ACME-Storage nicht persistent**: `acme.json` muss als Volume gemountet sein

**Lösung:**

```bash
# DNS prüfen
dig realsyncdynamicsai.de +short

# Firewall prüfen (Port 80 muss offen sein)
nmap -p 80,443 your-vps-ip

# Traefik neustarten (erzwingt neuen ACME-Attempt)
docker restart traefik-host

# 60 Sekunden warten
sleep 60

# Cert generiert?
docker exec traefik-host cat /etc/traefik/acme.json | grep -o 'realsyncdynamicsai'
# Sollte Treffern zeigen
```

## Sicherheitschecklist

- [ ] `.env` ist in `.gitignore` (Secrets nicht im Repo)
- [ ] SSH-Keys nicht in `.env` (nur Supabase/Stripe Public Keys)
- [ ] Host-Firewall nur :80/:443 öffentlich (SSH privat via VPN)
- [ ] Let's Encrypt Cert (nicht self-signed)
- [ ] Security Headers in nginx Config (CSP, X-Frame-Options, etc.)
- [ ] Traefik-Dashboard mit Auth gesichert (falls expose=true)
- [ ] Logs regelmäßig prüfen auf Anomalien

## Performance-Tuning

### Caching

nginx in `docker/realsync-web/nginx.conf` cachert bereits:
- Immutable Assets (Vite hash): 1 Jahr
- HTML-Dateien: no-cache (immer vom Server holen)

Zusätzliches Caching via Traefik (optional):

```yaml
labels:
  - "traefik.http.middlewares.realsync-cache.headers.customresponseheaders.Cache-Control=public, max-age=3600"
```

### Kompression

nginx comprimiert bereits Textinhalte (gzip). Traefik kann zusätzlich komprimieren:

```yaml
labels:
  - "traefik.http.middlewares.realsync-compress.compress=true"
```

### Load Balancing (mehrere Replicas)

Falls der Traffic wächst, mehrere Frontend-Container:

```yaml
# docker-compose.yml
services:
  frontend:
    deploy:
      replicas: 3
```

Traefik verteilt automatisch auf alle replicas.

## Weitere Schritte

1. **E2E-Tests gegen Live-Domain**: `npm run e2e -- --baseURL https://realsyncdynamicsai.de`
2. **Monitoring/Alerts**: Sentry/Datadog für Runtime-Errors
3. **CDN (optional)**: Cloudflare für Geo-Caching
4. **Weitere Services**: n8n, Ollama in separaten `docker-compose` Ordnern
5. **Disaster Recovery**: Automatische Backups der `.env` + `acme.json`

## Support

Bei Fragen oder Problemen:

1. **Logs prüfen**: `docker compose logs -f`
2. **Traefik-Logs**: `docker logs traefik-host`
3. **Healthcheck**: `docker compose ps` → Status sollte "Up (healthy)"
4. **DNS**: `dig realsyncdynamicsai.de`
5. **HTTPS-Cert**: `curl -I https://realsyncdynamicsai.de` sollte 200 OK sein

---

**Letzte Aktualisierung**: 2026-07-05  
**Status**: Production-ready ✅
