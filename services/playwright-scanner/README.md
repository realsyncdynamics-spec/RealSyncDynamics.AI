# Playwright-Scanner-Microservice

Headless-Chromium-basierter Compliance-Scanner für die DSGVO/TTDSG-Audit-Pipeline.
Komplementiert die `cookie-scan` Edge Function (statisches HTML-Parsing) um echte
JavaScript-Ausführung — sieht damit auch dynamisch nachgeladene Tracker, lese
`localStorage`/`sessionStorage`, und die echte Network-Request-Liste statt nur HTML-Sources.

**Stack:** Node 20 · Hono · Playwright · TypeScript strict.
**Deployment:** Docker (Compose) ODER Native via systemd.

---

## API

### `GET /health`

No-auth. Liveness + Browser-Status für Container-Healthcheck.

```json
{
  "status": "ok",
  "active_scans": 0,
  "max_concurrent": 10,
  "browser_connected": true,
  "uptime_seconds": 1234,
  "version": "1.0.0"
}
```

### `POST /scan`

Bearer-Auth via `SCANNER_SECRET`. Max `MAX_CONCURRENT` parallel — sonst 429.

**Request:**
```json
{
  "url": "https://example.com",
  "options": {
    "timeout": 30000,
    "waitFor": "#cookie-banner",
    "user_agent": "Custom-Bot/1.0"
  }
}
```

**Response (200):** `ScanResult` — siehe `src/types.ts`.

**Felder (Auswahl):**
- `meta.duration_ms`, `meta.redirect_chain`, `meta.fetched_status`
- `cookies[]` — Name, Domain, Category (essential/tracking/unknown), third_party
- `trackers[]` — id, name, category, pattern_matched, loaded_before_consent
- `forms` — total + per-form (action, method, has_email_field, …)
- `local_storage` / `session_storage` — key→preview-value
- `network_requests_count`, `third_party_hosts[]`
- `unknown_third_party_scripts[]` — für Auto-Discovery-Pipeline
- `score` (0-100), `severity`, `summary`

**Error-Schema (4xx/5xx):**
```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Max 10 concurrent scans...",
    "details": { "active_scans": 10 }
  }
}
```

Codes: `UNAUTHORIZED`, `RATE_LIMITED`, `BAD_REQUEST`, `INVALID_URL`, `SCAN_FAILED`, `INTERNAL`.

---

## Quick Start (Local-Dev)

```bash
cd services/playwright-scanner
cp .env.example .env
# SCANNER_SECRET in .env setzen (oder: echo "SCANNER_SECRET=$(openssl rand -hex 32)" >> .env)

npm install
npx playwright install chromium

npm run dev
# → http://localhost:3000

curl -X POST http://localhost:3000/scan \
  -H "Authorization: Bearer $(grep SCANNER_SECRET .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' | jq
```

---

## Deployment Option A: Docker auf VPS

```bash
# Auf dem VPS
ssh user@vps.realsyncdynamicsai.de
git clone https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI.git
cd RealSyncDynamics.AI/services/playwright-scanner

cp .env.example .env
echo "SCANNER_SECRET=$(openssl rand -hex 32)" >> .env

./deploy.sh
```

`deploy.sh` baut + restarted + wartet auf `/health`. Idempotent.

**Mit Traefik (TLS + BasicAuth):** `docker-compose.yml` enthält Traefik-Labels für `scanner.realsyncdynamicsai.de`. Setze `TRAEFIK_BASIC_AUTH` in `.env` mit `htpasswd -nb user pass | sed -e s/\\$/\\$\\$/g`.

**Resource-Limits (compose):** 2 GB RAM, 1.5 vCPU. Reservierung 512 MB RAM. Logs rotiert auf 10 MB × 3 Files.

---

## Deployment Option B: Native via systemd

Wenn der VPS keinen Docker hat oder du den Container-Layer überspringen willst:

```bash
ssh user@vps.realsyncdynamicsai.de

# 1. Code installieren
sudo mkdir -p /opt/realsync-playwright-scanner
sudo cp -r services/playwright-scanner/* /opt/realsync-playwright-scanner/
cd /opt/realsync-playwright-scanner
sudo npm ci --omit=dev
sudo npm run build
sudo npx playwright install chromium --with-deps

# 2. User + Env
sudo useradd -m -s /bin/bash scanner
sudo chown -R scanner:scanner /opt/realsync-playwright-scanner
sudo -u scanner npx playwright install chromium

echo "SCANNER_SECRET=$(openssl rand -hex 32)" | sudo tee /etc/realsync-playwright-scanner.env
sudo chmod 600 /etc/realsync-playwright-scanner.env
sudo chown scanner:scanner /etc/realsync-playwright-scanner.env

# 3. Service installieren
sudo cp playwright-scanner.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now playwright-scanner

# 4. Status
sudo systemctl status playwright-scanner
journalctl -u playwright-scanner -f
```

Die unit hat Security-Hardening: `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`, restricted Syscalls. Memory-Limit 2 GB, CPU-Quota 150%.

---

## Integration mit cookie-scan Edge Function

Im Repo gibt es zwei Cookie-Scanner:

| Tool | Tech | Scope |
|---|---|---|
| `cookie-scan` (Edge Function) | Deno · server-side `fetch` | HTML-statisch, ~500ms, kostenlos |
| `playwright-scanner` (this) | Node · Headless Chromium | Vollständig + JS-Ausführung, ~5-15s, ressourcenintensiv |

Strategie:
- **Free-Tier-Scan** auf `/cookie-scanner`-Page → `cookie-scan` Edge Function (schnell, billig)
- **Paid-Audit** (`/audit-pro`, `gdpr-audit`) → ruft `playwright-scanner` für tiefe Analyse

In Edge Function `gdpr-audit` o.ä.:

```ts
const r = await fetch(`${PLAYWRIGHT_SCANNER_URL}/scan`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${PLAYWRIGHT_SCANNER_SECRET}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ url, options: { timeout: 30000 } }),
});
const result = await r.json();
```

`PLAYWRIGHT_SCANNER_URL` und `PLAYWRIGHT_SCANNER_SECRET` müssen im Supabase Vault liegen.

---

## Limits / Bekanntes

- **Rate-Limit ist process-local** (kein Redis) — bei mehreren Replicas brauchst du eine Queue (`docker-compose --profile queue` startet Redis, Queue-Implementierung ist nicht in V1).
- **Consent-Klick wird nicht simuliert** — alle Tracker werden als `loaded_before_consent: true` markiert (headless ohne Banner-Interaktion). Echte Pre/Post-Consent-Trennung käme in V2 (`/scan/consent-timing`).
- **Single-Page-Apps mit Lazy-Loading** brauchen evtl. längeren `timeout` oder spezifischen `waitFor` Selector.

---

## Versions-Sync

Tracker-Patterns + Cookie-Klassifikation sind dupliziert in:
- `src/scanner.ts` (hier)
- `supabase/functions/cookie-scan/index.ts` (Edge Function)
- `supabase/functions/_shared/rules/tracker-registry.json` (canonical source)

Bei Änderungen siehe `src/rules/CHANGELOG.md` im Hauptrepo. Bump `SCANNER_VERSION` in `scanner.ts` mit.
