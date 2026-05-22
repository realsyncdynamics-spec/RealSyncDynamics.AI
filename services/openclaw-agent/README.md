# OpenClaw Compliance-Agent

Hardened build der OpenClaw-Spec aus `docs/openclaw-agent-spec.md`.

**Stack:** Hono + TypeScript + OpenAI + ws · Docker + Tini · systemd
**Auth:** Bearer-Token via `OPENCLAW_SECRET` env-var
**Cost-Cap:** Per-Request `max_tokens=800` + Daily-Token-Counter (default 2M)
**Rate-Limit:** Per-IP, sliding-window, 10 req/min default
**CORS:** Whitelist via `OPENCLAW_CORS_ORIGINS`

## Endpoints

```
GET  /healthz       — liveness + daily-usage
POST /api/chat      — Bearer-Auth required
GET  /ws            — WebSocket-Upgrade, auth-frame nach connect
```

### `POST /api/chat`

```bash
curl -X POST https://api.realsyncdynamicsai.de/api/chat \
  -H "Authorization: Bearer $OPENCLAW_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Darf ich Google Analytics ohne Consent laden?",
    "context": { "industry": "ecommerce" }
  }'
```

Response:
```json
{
  "ok": true,
  "answer": "Nein. Google Analytics setzt Cookies und ...",
  "tool_calls_made": 1,
  "usage": { "prompt_tokens": 320, "completion_tokens": 180, "total_tokens": 500 }
}
```

### WebSocket-Flow

```js
const ws = new WebSocket('wss://api.realsyncdynamicsai.de/ws');
ws.onopen = () => {
  // 1. Auth-Frame
  ws.send(JSON.stringify({ type: 'auth', token: OPENCLAW_SECRET }));
};
ws.onmessage = (evt) => {
  const frame = JSON.parse(evt.data);
  if (frame.type === 'auth_ok') {
    // 2. Erst nach auth_ok: user_message
    ws.send(JSON.stringify({
      type: 'user_message',
      message: 'Was ist Annex III des EU AI Act?',
    }));
  }
  if (frame.type === 'agent_message') console.log(frame.message);
};
```

## Tools (Tool-Calling)

Drei initiale Tools, ausgefuehrt lokal im Service:

| Tool | Was es macht |
|---|---|
| `lookup_dsgvo_paragraph` | Volltext + Erklaerung zu DSGVO-Artikel / TTDSG-Paragraph |
| `classify_ai_system_risk` | EU-AI-Act-Risikoklasse fuer beschriebenes System |
| `check_pre_consent_tracker` | Ist Tracker-Loading vor Consent erlaubt? |

In dieser Iteration: Heuristik-basierte Antworten. Folge-PR ersetzt durch echte
Lookups gegen `ai_systems` / pre-loaded Norm-JSON.

## Deploy

### Lokaler Test

```bash
cd services/openclaw-agent
npm install
cp .env.example .env  # nicht eingecheckt
# .env mit OPENAI_API_KEY + OPENCLAW_SECRET fuellen
npm run dev
```

Test:
```bash
curl http://localhost:3001/healthz
curl -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer test-secret" \
  -d '{"message":"Test"}'
```

### Production (Hostinger VPS, 187.77.89.1)

Komplettes Setup per One-Shot-Skript — installiert Docker-Image, env-File,
systemd-Unit, beide nginx-Configs (Subdomain `api.realsyncdynamicsai.de` +
Apex-Pfad `/_openclaw/...`), zieht das TLS-Cert via certbot und faehrt
Health/Auth-Smoke-Tests gegen beide Endpoints.

```bash
# 1. Image bauen + pushen (von der Dev-Maschine)
docker build -t realsync/openclaw-agent:latest .
docker push realsync/openclaw-agent:latest

# 2. Repo auf VPS klonen (oder pullen), dann im Repo-Root:
sudo OPENAI_API_KEY="sk-..." \
     CERTBOT_EMAIL="ops@realsyncdynamicsai.de" \
     bash scripts/install-openclaw-vps.sh
```

Optionale env-Vars: `OPENCLAW_SECRET` (default: `openssl rand -hex 32`),
`OPENCLAW_CORS_ORIGINS`, `OPENCLAW_RATE_LIMIT_PER_MIN`,
`OPENCLAW_DAILY_TOKEN_CAP`, `SENTRY_DSN`, `SKIP_CERTBOT=1` (Subdomain ohne TLS).

Voraussetzung: A-Record `api.realsyncdynamicsai.de → 187.77.89.1` ist live
(sonst `SKIP_CERTBOT=1` setzen — Apex-Pfad funktioniert trotzdem).

Das Skript ist idempotent — bei einem zweiten Lauf wird das `OPENCLAW_SECRET`
aus der existierenden env-Datei uebernommen, sodass aktive Clients ihre Token
nicht erneuern muessen.

### Endpoints nach dem Setup

| URL                                                | Zweck                                |
|----------------------------------------------------|--------------------------------------|
| `https://api.realsyncdynamicsai.de/healthz`        | Liveness (Subdomain)                 |
| `https://api.realsyncdynamicsai.de/api/chat`       | Chat (Subdomain, Bearer-Auth)        |
| `https://api.realsyncdynamicsai.de/ws`             | WebSocket (Subdomain)                |
| `https://realsyncdynamicsai.de/_openclaw/healthz`  | Liveness (Apex-Pfad, kein extra DNS) |
| `https://realsyncdynamicsai.de/_openclaw/api/chat` | Chat (Apex-Pfad, same-origin)        |
| `https://realsyncdynamicsai.de/_openclaw/ws`       | WebSocket (Apex-Pfad)                |

Apex-Pfad ist nuetzlich, weil same-origin → kein CORS-Preflight. Subdomain
ist die kanonische API-URL fuer externe Integrationen.

### Manuelle Schritte (falls das Skript nicht passt)

Die installierten Artefakte:

- `deploy/nginx/api.realsyncdynamicsai.de.conf` — Subdomain-vhost
- `deploy/nginx/snippets/openclaw-apex.conf` — Apex-Pfad-Snippet
- `services/openclaw-agent/openclaw-agent.service` — systemd-Unit
- `/etc/openclaw-agent/env` — env-Datei (chmod 600, vom Skript geschrieben)

Reload-Befehle:

```bash
sudo systemctl daemon-reload
sudo systemctl restart openclaw-agent
sudo nginx -t && sudo systemctl reload nginx
```

## Out-of-Scope (Folge-PRs)

- STT/TTS (Whisper-API + OpenAI-TTS oder ElevenLabs)
- LiveKit fuer Realtime-Voice-Duplex
- Multi-Tenant-Isolation (`x-rsd-tenant-key` Header → Tenant-Quota statt Global-Cap)
- Echte Tool-Implementations (Norm-Volltext-DB, Annex-III-Lookup, Tracker-Registry)
- Streaming-Responses (`stream: true` + WS-Chunk-Frames)
- Conversation-Memory (Redis-backed Multi-Turn-State)
- HMAC-Signing der Tool-Responses fuer Tamper-Evidence
- Per-Tenant-Cost-Caps + Stripe-Metered-Billing-Integration
