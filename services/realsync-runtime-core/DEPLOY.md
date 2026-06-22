# Deployment — realsync-runtime-core

**Kein Vercel.** Dieser Service ist ein langlaufendes Fastify-Backend
(Tenant-, Policy- und Event-Orchestrierung) mit Postgres-, Redis- und
NATS-Abhängigkeiten. Vercel ist für das statische SPA-Frontend gedacht
(gehostet auf Cloudflare Pages / GitHub Pages) und kann diesen Dienst nicht
betreiben — entsprechend sind Vercel-Git-Deployments für dieses Verzeichnis
deaktiviert (`vercel.json` → `git.deploymentEnabled: false`).

## Alternative: Docker via Coolify / Traefik (VPS)

Der Service deployt über denselben Docker/Traefik-Stack wie die übrigen
Backend-Dienste (`deploy/ollama-traefik/`, `worker/`).

### Coolify (empfohlen)
1. Neue Resource → „Docker Compose" → dieses Verzeichnis als Build-Kontext.
2. `.env` aus `.env.example` befüllen (Secrets, DB-/Redis-/NATS-URLs).
3. Domain `runtime-core.realsyncdynamicsai.de` → DNS-A-Record auf den VPS.
4. Deploy. Coolify baut das `Dockerfile` und startet `docker-compose.yml`;
   Traefik übernimmt TLS und Routing über die Container-Labels.

### Manuell (docker compose)
```bash
cp .env.example .env   # Werte setzen
docker compose up -d --build
docker compose logs -f runtime-core
```

### Health-Check
`GET https://runtime-core.realsyncdynamicsai.de/health` → `200`
(intern: `http://localhost:4000/health`, vom Container-Healthcheck genutzt).

## Voraussetzungen
- Externes Traefik-Netz (`TRAEFIK_NETWORK`) mit Let's-Encrypt-Resolver
  (`TRAEFIK_CERT_RESOLVER`) — identisch zum bestehenden Stack.
- Erreichbare Postgres-, Redis- und NATS-Instanzen (siehe `.env.example`).
