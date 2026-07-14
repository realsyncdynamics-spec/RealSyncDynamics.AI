# RealSyncDynamics.AI Frontend — Docker + Traefik VPS-Deployment

Container-Setup für die Vite + React SPA auf VPS mit Host-Traefik als Reverse Proxy.

## Architektur

```
[Internet] ──HTTPS──> Host-Traefik (Let's Encrypt TLS-Terminierung)
                          │
                          ├─> realsyncdynamicsai.de
                          │
                          ▼
                    docker/realsync-web/frontend:80 (nginx)
                    (Docker-internes Netz)
```

- **Host-Traefik**: läuft auf dem VPS-Host selbst (separate compose oder systemd)
- **Frontend-Container**: läuft in `docker compose` mit Traefik-Labels
- **Networking**: Container nur auf internem Bridge-Netz + Traefik-Proxy-Netz (nicht localhost-gebunden)
- **TLS**: Traefik Host-Level (Let's Encrypt), Container spricht nur HTTP (Port 80)

## Voraussetzungen

1. **VPS mit Docker + docker-compose v2**
   ```bash
   docker --version  # ≥ 20.10
   docker compose --version  # ≥ v2.0
   ```

2. **Host-Traefik mit Docker Provider**
   - Muss auf dem VPS bereits laufen (separate Compose oder systemd)
   - Muss ein Docker-Netz mit Namen z. B. `openclaw_default` bereitstellen
   - Let's Encrypt Cert-Resolver muss konfiguriert sein (typisch: `letsencrypt`)

   Prüfen:
   ```bash
   docker network ls | grep -E 'openclaw|traefik|proxy'
   # Output: openclaw_default, ...
   ```

3. **DNS A-Records**
   - `realsyncdynamicsai.de` → VPS-IP (z. B. 194.163.130.123)
   - `www.realsyncdynamicsai.de` → VPS-IP (optional, wird auch geroutet)
   - **ZUERST** DNS setzen, **DANN** Docker starten (sonst Let's Encrypt scheitert)

## Setup-Anleitung

### 1. .env vorbereiten

```bash
cd docker/realsync-web
cp .env.example .env
```

Datei öffnen und Werte eintragen:
- `TRAEFIK_NETWORK` — der tatsächliche Netz-Name von Host-Traefik (prüfen: `docker network ls`)
- `TRAEFIK_CERT_RESOLVER` — typisch `letsencrypt`
- `VITE_SUPABASE_URL` — von Supabase Dashboard
- `VITE_SUPABASE_ANON_KEY` — von Supabase Dashboard
- `VITE_SENTRY_DSN` — optional
- `VITE_GOOGLE_GENAI_API_KEY` — optional
- `VITE_STRIPE_PUBLISHABLE_KEY` — optional

Beispiel `.env`:
```env
TRAEFIK_NETWORK=openclaw_default
TRAEFIK_CERT_RESOLVER=letsencrypt
VITE_SUPABASE_URL=https://xyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SENTRY_DSN=https://example@o123.ingest.sentry.io/456
```

### 2. Build & Deploy

```bash
cd docker/realsync-web

# Build das Image (erste Mal länger, ~2-3 min)
docker compose build

# Starten (daemonized)
docker compose up -d

# Logs prüfen (sollten keine Fehler zeigen)
docker compose logs -f frontend
```

### 3. Verifikation

Sobald der Container läuft:

```bash
# Container sollte healthy sein:
docker compose ps
# → Status sollte "Up (healthy)" sein

# Traefik-Cert-Generierung prüfen (braucht 30-60s):
docker logs realsync-frontend | grep -iE 'traefik|certificate|https'

# In Traefik Dashboard prüfen (falls Traefik-UI aktiv):
# https://traefik-ui.example.de (oder Port 8080)
# → Routers & Services sollten "realsync-frontend" zeigen

# HTTPS testen (curl-Redirect folgen):
curl -I https://realsyncdynamicsai.de
# Output: 200 OK, oder 301/302 Redirect (je nach Router-Config)
```

## Debugging

### Container lädt sich dauernd neu (CrashLoop)

```bash
docker compose logs frontend
# Suche nach: "segfault", "out of memory", "cannot open"
```

**Häufige Ursachen:**
- `.env` vergessen → build bricht ab
- Falsche `VITE_*` Values → blank canvas, aber kein Crash
- Fehlende Node-Modules → Build-Stage scheitert

**Lösung:**
```bash
docker compose down
docker compose build --no-cache  # Cache-Rebuild erzwingt
docker compose up -d
```

### Traefik findet Container nicht (502 Bad Gateway)

```bash
# Traefik-Config-Logs prüfen:
docker exec <traefik-container> traefik-cli providers docker

# Container im Traefik-Netz?
docker network inspect openclaw_default | grep realsync-frontend
```

**Häufige Ursachen:**
- `TRAEFIK_NETWORK` falsch in `.env` → Container im falschen Netz
- Host-Traefik nicht auf Docker-Provider konfiguriert
- Traefik-Labels typo (`traefik.enable=true` vergessen)

**Lösung:**
```bash
# .env aktualisieren
docker compose down
docker compose up -d
```

### Let's Encrypt Cert holt nicht (Traefik schreibt ACME-Fehler)

```bash
# Traefik-Container Logs:
docker logs <traefik-container-name> | grep -iE 'acme|letsencrypt|challenge'
```

**Häufige Ursachen:**
- DNS A-Record nicht gesetzt/nicht propagiert
- Traefik kann Port 80/443 nicht erreichen (Firewall?)
- ACME-Challenge schlägt fehl

**Lösung:**
```bash
# DNS-Propagation prüfen:
dig realsyncdynamicsai.de  # sollte VPS-IP zeigen
nslookup realsyncdynamicsai.de

# Warten auf DNS-Propagation (bis zu 48h, typisch 5-30 min)
# Dann Traefik neu starten:
docker restart <traefik-container-name>
```

## Updates & Redeploy

### Code-Update (nach npm run build + git push)

```bash
cd docker/realsync-web

# Repository auf VPS pullen (oder via CI/CD)
cd ../..
git pull origin claude/turborepo-nextjs-docker-4l9cey

# Neu bauen & deployen
cd docker/realsync-web
docker compose build
docker compose up -d

# Rolling Restart: Container kurz weg, dann wieder up
# → Traefik kann in der Zwischenzeit zu anderen Services routen
```

### Konfiguration ändern (.env-Update)

```bash
cd docker/realsync-web

# .env editieren
nano .env

# Neu bauen (nur wenn VITE_* geändert) & Restart
docker compose build
docker compose up -d

# ODER nur Restart (keine Build-Args geändert):
docker compose restart frontend
```

## Sicherheit

- ✅ **No Secrets in Repo**: `.env` ist in `.gitignore`, Server-Werte nur auf dem VPS
- ✅ **TLS via Traefik**: Host-level, container spricht nur http://
- ✅ **Security Headers**: nginx-Config setzt X-Frame-Options, CSP, etc.
- ✅ **No Root**: nginx läuft als nobody (Alpine-Standard)

## Monitoring

### Logs

```bash
# Echtzeit-Logs
docker compose logs -f frontend

# Last 50 lines
docker compose logs --tail=50 frontend

# Mit Timestamps
docker compose logs -f --timestamps frontend
```

### Healthcheck

```bash
# Container-Status
docker compose ps

# Curl Healthz-Endpoint
curl http://localhost:8000/healthz  # falls Port exposed, sonst Container-intern
# → "ok" = alle gut
```

### Disk Usage

```bash
# nginx Layer Cache prüfen
docker image ls | grep realsync

# Volumes
docker volume ls | grep realsync
```

## Häufige Fragen

**F: Warum nicht Vercel?**  
A: VPS-Deployment ermöglicht EU-Datenhaltung, vollständige Kontrolle, eigene n8n/Ollama-Integration.

**F: Warum nginx, nicht Node?**  
A: SPA braucht keinen Node-Runtime — statische HTML/JS/CSS ist schneller, sicherer, einfacher zu skalieren.

**F: Was ist mit Supabase/Stripe-Keys in .env?**  
A: Secrets landen nie im Repo (`.gitignore`). Anon-Key ist public (ok), Service-Role nur im Edge-Functions-Container (strikt).

**F: Kann ich mehrere Frontends auf diesem VPS laufen?**  
A: Ja — zusätzliche `docker compose` Ordner (z. B. `docker/realsync-staging/`), unterschiedliche Domains, alles über Host-Traefik routen.

## Checkliste vor Production

- [ ] DNS A-Records gesetzt und propagiert
- [ ] Host-Traefik läuft und hat funktionierendes `letsencrypt` Setup
- [ ] `.env` vollständig mit Supabase-Keys, Domain, etc.
- [ ] `docker compose up -d` erfolgreich gestartet
- [ ] Container Status: `Up (healthy)`
- [ ] `https://realsyncdynamicsai.de` lädt im Browser
- [ ] HTTPS-Cert zeigt Let's Encrypt / nicht selbstsigniert
- [ ] Traefik-Dashboard zeigt "realsync-frontend" im Routers-Tab
- [ ] E2E-Tests gegen Live-Domain laufen (siehe `npm run e2e`)

## Weitere Ressourcen

- [Traefik Dokumentation](https://doc.traefik.io/traefik/)
- [Docker Compose Doku](https://docs.docker.com/compose/)
- [Vite Production Deployment](https://vitejs.dev/guide/static-deploy.html)
- [RealSync Deployment Validation](../../DEPLOYMENT_VALIDATION.md)
