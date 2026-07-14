# Quickstart: Frontend auf VPS deployen

TL;DR für die schnelle Deployment.

## 5-Minuten-Setup (vorausgesetzt: Traefik läuft, DNS ist gesetzt)

```bash
# 1. SSH auf VPS
ssh user@your-vps-ip
cd /path/to/realsync-repo/docker/realsync-web

# 2. .env erstellen
cp .env.example .env
# Dann in einem Editor:
# - TRAEFIK_NETWORK = (docker network ls eingeben)
# - VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY = aus Supabase
# - (Rest optional)

# 3. Build & Deploy
docker compose build
docker compose up -d

# 4. Verifikation
docker compose ps        # Sollte "Up (healthy)" zeigen
curl https://realsyncdynamicsai.de  # Sollte 200 OK sein
```

Das wars! 🚀

## Was wurde gebaut?

```
docker/realsync-web/
├── Dockerfile           → Multi-Stage Build (node:20 → nginx:alpine)
├── docker-compose.yml   → Traefik Integration
├── nginx.conf           → SPA-Routing + Security Headers
├── .env.example         → Konfigurations-Template
├── README.md            → Ausführliche Doku
├── QUICKSTART.md        → Diese Datei
└── .gitignore           → Secrets nicht committen
```

## Was passiert beim Start?

1. **Build-Phase**: npm install + vite build (2-3 min)
2. **Image-Layer**: nginx:alpine + dist/ (~15 MB)
3. **Container-Start**: nginx-Server auf :80
4. **Traefik-Discovery**: Labels → Routing-Rules
5. **Let's Encrypt**: TLS-Cert generiert (30-60 sec)
6. **Healthcheck**: nginx antwortet auf /healthz

## Environment-Variablen (wichtig!)

| Variable | Woher? | Erforderlich? |
|----------|--------|---------------|
| TRAEFIK_NETWORK | `docker network ls` | ✅ JA |
| TRAEFIK_CERT_RESOLVER | `traefik.yml` (typisch: letsencrypt) | ✅ JA |
| VITE_SUPABASE_URL | Supabase Dashboard → API Url | ✅ JA |
| VITE_SUPABASE_ANON_KEY | Supabase Dashboard → API → anon key | ✅ JA |
| VITE_SENTRY_DSN | sentry.io → Project → DSN | ❌ Optional |
| VITE_GOOGLE_GENAI_API_KEY | ai.google.dev | ❌ Optional |
| VITE_STRIPE_PUBLISHABLE_KEY | stripe.com Dashboard | ❌ Optional |

Wenn optional-Variablen leer sind = Features deaktiviert, aber kein Error.

## Häufige Fehler

### ❌ "network not found"
**Lösung**: `TRAEFIK_NETWORK` in `.env` ist falsch
```bash
docker network ls  # Richtige Netz-Name kopieren
```

### ❌ "502 Bad Gateway"
**Lösung**: Container nicht healthy
```bash
docker compose logs frontend  # Error-Message anschauen
docker compose ps            # Status prüfen (sollte healthy sein)
```

### ❌ "Certificate generation failed"
**Lösung**: DNS nicht gesetzt
```bash
dig realsyncdynamicsai.de  # Sollte VPS-IP zeigen, nicht SERVFAIL
```

### ❌ Blank White Page im Browser
**Lösung**: Falsche Supabase-Keys
- Prüfen: `.env` hat korrekte `VITE_SUPABASE_*` Werte?
- Browser Console (F12) auf Fehler prüfen

## Status prüfen

```bash
# Alles gut?
docker compose ps

# Container-Logs live folgen
docker compose logs -f frontend

# Traefik-Status
docker logs traefik-host | grep realsync

# HTTPS-Test
curl -I https://realsyncdynamicsai.de
```

## Update einspielen

```bash
# Neuen Code
git pull origin claude/turborepo-nextjs-docker-4l9cey

# Neu bauen
docker compose build

# Neu starten (kurze Downtime)
docker compose up -d
```

## Hilfreiche Commands

```bash
# Logs (letzte 50 Zeilen, formatiert)
docker compose logs --tail=50 -f frontend

# In Container reingehen (Debug)
docker exec -it realsync-frontend sh

# Container stoppen (für Wartung)
docker compose stop frontend

# Container neustarten
docker compose restart frontend

# Alles löschen (Image, Container, Volumes)
docker compose down -v
```

---

**Weitere Info**: Siehe `README.md` in diesem Ordner für ausführliche Dokumentation.
