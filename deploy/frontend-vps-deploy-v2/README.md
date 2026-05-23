# frontend-vps-deploy-v2

Vite-SPA als eigenständiger Docker-Container auf dem Hostinger-VPS.

**Verhältnis zu v1** (`deploy/README.md` + `deploy/nginx/realsyncdynamicsai.de.conf`):
v1 deployt das statische `dist/` direkt unter `/var/www/realsyncdynamicsai.de/dist`
und wird von der Host-nginx ausgeliefert. v2 paketiert Build + Auslieferung in einen
Container, lauscht intern auf Port 80 und wird vom Host-Reverse-Proxy
durchgereicht. Beide Pfade können parallel existieren — v2 ist additiv.

---

## Voraussetzungen auf dem VPS

- Docker Engine ≥ 24 und `docker compose` (V2-Plugin)
- Freier Host-Port — Default `8090`. Bekannt belegt:
  - `80/443`  → Host-nginx (siehe `deploy/nginx/`)
  - `8787`   → `realsync-agent-runtime` (siehe `apps/agent-runtime/`)
  - `?`      → `openclaw-app-1` (vor Deploy mit `docker port openclaw-app-1` prüfen)
- Lese-Zugriff auf das Repo (z.B. via `git pull` als Deploy-User)

---

## Erstdeployment

```bash
# Auf dem VPS, als Deploy-User:
cd /pfad/zum/repo/deploy/frontend-vps-deploy-v2

cp .env.example .env
$EDITOR .env                       # VITE_*-Werte und ggf. FRONTEND_HOST_PORT setzen

# Vor dem Build prüfen, dass der gewählte Port frei ist:
ss -ltnp | grep ":${FRONTEND_HOST_PORT:-8090}\b" && echo "PORT BELEGT — abbrechen" || echo "ok"

docker compose --env-file .env up -d --build

# Smoke:
curl -fsS "http://127.0.0.1:${FRONTEND_HOST_PORT:-8090}/healthz"   # → ok
docker compose ps                  # State sollte "healthy" werden (~10–30s)
```

---

## Host-Reverse-Proxy anbinden

Die Container-nginx terminiert **kein** TLS. Den extern erreichbaren Pfad
übernimmt entweder die bestehende Host-nginx oder Traefik.

### Variante A — Host-nginx (bestehend)

In `deploy/nginx/realsyncdynamicsai.de.conf` den statischen `root /var/www/.../dist`-Block
durch einen `proxy_pass` auf den Container ersetzen:

```nginx
location / {
    proxy_pass         http://127.0.0.1:8090;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
}
```

Security-Headers nicht doppelt setzen — entweder im Container oder im Host,
nicht beides (sonst überschreibt nginx den jeweils letzten Wert).

### Variante B — Traefik

Im `docker-compose.yml` die auskommentierten Labels-Vorlagen aus
`apps/agent-runtime/docker-compose.yml` als Muster nehmen und auf
Host `realsyncdynamicsai.de` + Port `80` (Container-intern) anpassen.

---

## Update / Re-Deploy

```bash
cd /pfad/zum/repo
git pull

cd deploy/frontend-vps-deploy-v2
docker compose --env-file .env up -d --build
docker image prune -f                   # alte Layer aufräumen
```

Während des Re-Build läuft der alte Container weiter; erst nach
erfolgreichem `up -d` wird er ersetzt. Down-Time: ~Sekunden.

---

## Rollback

```bash
# Vor jedem Deploy:
docker image tag realsync-frontend:latest realsync-frontend:previous

# Im Fehlerfall:
docker compose down
docker image tag realsync-frontend:previous realsync-frontend:latest
docker compose --env-file .env up -d
```

---

## Healthcheck

- **Container-intern:** `HEALTHCHECK` im Dockerfile pollt `http://127.0.0.1/healthz` alle 30 s.
- **Extern:** `curl -fsS https://realsyncdynamicsai.de/healthz` (sobald Reverse-Proxy steht).
- **Compose-State:** `docker compose ps` → Spalte `STATUS` zeigt `healthy` / `unhealthy`.

---

## Logs

```bash
docker compose logs -f frontend         # live
docker compose logs --tail=200 frontend # letzte 200 Zeilen
```

JSON-File-Driver mit 10 MB × 3 Rotation — kein zusätzliches Aufräumen nötig.

---

## Bekannte Stolperfallen

- **Port-Kollision mit `openclaw-app-1`** → vor dem ersten `up` mit
  `docker port openclaw-app-1` prüfen und ggf. `FRONTEND_HOST_PORT` ändern.
- **VITE_*-Werte fehlen** → Build bricht ab (`?` im Compose erzwingt sie für
  die nötigen Vars). Nur `VITE_SENTRY_DSN` ist optional.
- **Build-Kontext zu groß** → `.dockerignore` im Repo-Root schließt
  `node_modules`, `dist`, `supabase/migrations`, `services/`, `apps/` etc. aus.
  Beim Hinzufügen neuer Top-Level-Ordner ggf. erweitern.
- **CSP doppelt gesetzt** → wenn Host-nginx Headers setzt UND Container,
  gewinnt der letzte. Eine der beiden Stellen entfernen.
