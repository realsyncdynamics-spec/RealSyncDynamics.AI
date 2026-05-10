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

```bash
# 1. Image bauen + pushen
docker build -t realsync/openclaw-agent:latest .
docker push realsync/openclaw-agent:latest

# 2. Auf VPS:
sudo mkdir -p /etc/openclaw-agent
sudo tee /etc/openclaw-agent/env >/dev/null <<'EOF'
OPENAI_API_KEY=sk-...
OPENCLAW_SECRET=<openssl rand -hex 32 ergebnis>
OPENCLAW_CORS_ORIGINS=https://realsyncdynamicsai.de,https://www.realsyncdynamicsai.de
OPENCLAW_RATE_LIMIT_PER_MIN=10
OPENCLAW_DAILY_TOKEN_CAP=2000000
SENTRY_DSN=https://...
PORT=3001
EOF
sudo chmod 600 /etc/openclaw-agent/env

sudo cp openclaw-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable openclaw-agent
sudo systemctl start openclaw-agent
sudo systemctl status openclaw-agent
```

### Nginx Reverse-Proxy (auf 187.77.89.1)

```nginx
server {
    server_name api.realsyncdynamicsai.de;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 90s;
    }
}
```

```bash
sudo certbot --nginx -d api.realsyncdynamicsai.de
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
