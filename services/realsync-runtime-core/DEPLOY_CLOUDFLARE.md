# realsync-runtime-core — Deployment auf Cloudflare Containers

Dieser Backend-Service (Fastify + Postgres/Redis/NATS) wird als **Cloudflare
Container** betrieben und ersetzt damit den früheren, defekten Vercel-Deploy
(Projekt `real-sync-dynamics-ai-remu`).

## Warum Containers (und nicht Workers/Pages)

Der Dienst hält **dauerhafte TCP-Verbindungen** zu Postgres (`postgres`),
Redis (`ioredis`) und NATS (`nats`) und läuft als langlebiger Fastify-Server.
Das V8-Edge-Runtime von Cloudflare **Workers/Pages** unterstützt solche
Verbindungen und einen dauerhaften Server nicht. Cloudflare **Containers**
führen dagegen das `Dockerfile` als echten Linux-Container **mit
Netzwerk-Egress** aus — der bestehende Code läuft dort unverändert.

Architektur:

```
Internet ──HTTP──▶ Worker (src/worker.js) ──▶ Container (Dockerfile → Fastify :4000)
                    │  Router + Keep-warm-Cron        │
                    └── Durable-Object-Binding         └── TCP ▶ Postgres / Redis / NATS
```

## Voraussetzungen

1. Cloudflare-Konto mit **Containers** aktiviert (Workers Paid Plan).
2. `wrangler` (lokal `npm ci` im Service-Verzeichnis installiert es als devDep).
3. Docker lokal (für `wrangler dev`/`deploy`, das das Image baut). In CI liefert
   `ubuntu-latest` Docker mit.
4. **Postgres, Redis und NATS müssen von Cloudflares Egress erreichbar sein**
   (öffentliche, TLS-gesicherte Endpunkte — oder via Cloudflare Tunnel /
   Hyperdrive für Postgres). Interne VPS-Only-Hostnamen wie
   `realsync-evidence-runtime:5000` funktionieren aus der Cloud NICHT und müssen
   auf erreichbare Adressen umgestellt werden.

## Laufzeit-Secrets setzen

Die App erwartet die folgenden Variablen (siehe `src/config.js`). Sie werden als
**Worker-Secrets** gesetzt und in `src/worker.js` → `envVars` in den Container
gespiegelt. Einmalig ausführen (im Verzeichnis `services/realsync-runtime-core`):

```bash
wrangler secret put GATEWAY_INTERNAL_API_KEY
wrangler secret put JWT_SECRET
wrangler secret put RUNTIME_CORE_DATABASE_URL   # postgres://…  (SSL!)
wrangler secret put REDIS_URL                   # rediss://…
wrangler secret put NATS_URL                    # tls://…
wrangler secret put NATS_PASSWORD               # optional
# optional, sonst Defaults aus config.js / worker.js:
wrangler secret put NATS_USER
wrangler secret put EVIDENCE_RUNTIME_URL
```

Nicht-geheime Defaults (`LOG_LEVEL`) stehen als `vars` in `wrangler.jsonc`.

## Deploy

**Manuell:**

```bash
cd services/realsync-runtime-core
npm ci
npx wrangler deploy
```

**CI:** `.github/workflows/deploy-backend-cloudflare.yml` deployt automatisch bei
Push auf `main`, sobald sich etwas unter `services/realsync-runtime-core/**`
ändert. Dafür im Repo hinterlegen:

- `CLOUDFLARE_API_TOKEN` — Token mit Workers-/Containers-Deploy-Rechten
- `CLOUDFLARE_ACCOUNT_ID`

Ohne diese Secrets überspringt der Workflow den Deploy (Guard-Step), statt rot zu
werden.

## Hintergrund-Consumer & Scale-to-zero (wichtig)

Cloudflare Containers **skalieren bei Inaktivität auf null**. Dieser Service hält
aber einen dauerhaften **NATS-Event-Consumer** offen
(`src/consumers/event.consumer.js`). Damit der Consumer nicht abgewürgt wird:

- `sleepAfter = '1h'` in `src/worker.js` (späte Schlafenszeit), und
- ein **Cron-Trigger** alle 5 min (`triggers.crons` in `wrangler.jsonc`), der
  über `scheduled()` `/health` trifft und die Instanz warm hält.

Für harte 24/7-Garantien des Consumers ohne Lücken sollte langfristig geprüft
werden, ob eine „always-on"-Instanz nötig ist; das Keep-warm-Muster ist der
pragmatische Startpunkt.

## Single-Instance

`max_instances: 1` + eine feste Instanz-ID (`runtime-core-singleton`) stellen
sicher, dass Migrations (`src/db/migrate.js`) und der NATS-Consumer **genau
einmal** laufen — kein Fan-out.

## Vercel abschalten

Nach erfolgreichem Cloudflare-Deploy das Vercel-Projekt
`real-sync-dynamics-ai-remu` trennen: Vercel → Project → **Settings → Git →
Disconnect** (Details in `docs/infra/hosting-consolidation-cloudflare-pages.md`).

## Nicht aus dieser Session testbar

Der tatsächliche Deploy braucht ein Cloudflare-Konto mit Containers, ein
API-Token und aus der Cloud erreichbare PG/Redis/NATS-Endpunkte. Das Setup hier
ist konventionskonform vorbereitet, aber **nicht end-to-end verifiziert** —
bitte ersten Deploy manuell mit `npx wrangler deploy` fahren und `/health` prüfen.
