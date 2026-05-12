# OpenClaw Voice/Chat-Agent — Architektur-Spec + Härtungs-Plan

Status: **Spec dokumentiert, nicht implementiert.** Implementierung folgt sobald
ein erster Design-Partner einen konkreten Use-Case nennt — vorher ist es
Optimierung am offenen Markt (siehe Strategie-Notiz unten).

---

## Original-Spec (User-Liefer)

Minimaler Node.js + Express + WebSocket + OpenAI Server für Hostinger VPS:

### `package.json`
```json
{
  "name": "openclaw-voice-agent",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.19.2",
    "openai": "^4.77.0",
    "ws": "^8.18.0"
  }
}
```

### `.env`
```
PORT=3001
OPENAI_API_KEY=sk-xxxxx
OPENCLAW_SYSTEM_PROMPT="Du bist OpenClaw, ein deutscher Compliance- und AI-Act-Agent für RealSyncDynamics AI. Antworte präzise, geschäftlich und rechtlich vorsichtig. Du ersetzt keine Rechtsberatung."
```

### `server.js` — siehe Original-Chat (Express + WebSocket + OpenAI Chat-Completions, kein Tool-Calling, kein STT/TTS)

### Deploy
```bash
mkdir openclaw-agent && cd openclaw-agent
npm install
nano server.js  # paste original
nano .env       # paste env
node server.js  # test
# Dann PM2 + nginx + certbot wie im Original
```

---

## Was VOR Production gehärtet werden muss

### 🔴 Critical (Blocker)

| # | Lücke | Mitigation |
|---|---|---|
| 1 | Keine Auth auf `/api/chat` und WebSocket | Bearer-Token via `OPENCLAW_SECRET` env-var, gleiches Pattern wie `services/playwright-scanner/index.ts` |
| 2 | Kein Rate-Limit | `express-rate-limit` mit 10 req/min/IP, plus daily-Total-Cap |
| 3 | CORS offen (`cors()`) | `cors({ origin: ['https://realsyncdynamicsai.de', 'https://www.realsyncdynamicsai.de'] })` |
| 4 | Kein Cost-Cap | Per-Request: `max_tokens: 512`. Daily-Cap via Redis-Counter oder einfacher in-memory-Counter mit cron-reset |
| 5 | API-Key in `.env` auf VPS | Move zu HashiCorp Vault oder mind. systemd-environment-files mit chmod 600 |

### 🟠 Important (vor Beta-Launch)

| # | Lücke | Mitigation |
|---|---|---|
| 6 | Kein Sentry / Logging | `import * as Sentry from '@sentry/node'` + `Sentry.captureException()` im error-handler |
| 7 | Kein graceful-shutdown | `process.on('SIGTERM', () => server.close(...))` mit 5s timeout für aktive WebSockets |
| 8 | Keine Tool-Calling-Implementation (im Original nur erwähnt) | Wenn Tool-Calling: OpenAI `tools`-Param + Function-Definitions für `lookup_dsgvo_paragraph`, `classify_ai_system`, `query_evidence_vault` |
| 9 | "Voice-Agent" misleading — keine STT/TTS | Rename zu `openclaw-chat-agent` bis LiveKit/Whisper/TTS dazu kommt |

### 🟡 Nice-to-have

- Health-endpoint mit deeper checks (OpenAI-API-reachable, env vars present)
- Structured logging (Pino) statt `console.log`
- Multi-Tenant via `x-rsd-tenant-key` Header (bereits Pattern im playwright-scanner + telemetry-ai-event)
- WebSocket-Reconnect mit Exponential Backoff Client-Side

---

## Empfohlenes Implementations-Template

Wenn du es baust: **NICHT die Original-Spec 1:1 nehmen.** Stattdessen das
playwright-scanner-Pattern adaptieren:

```
services/openclaw-agent/
├── Dockerfile                  (multi-stage Node-Alpine + Tini)
├── openclaw-agent.service      (systemd-unit)
├── package.json                (Hono + OpenAI + ws statt Express)
├── tsconfig.json               (strict TS)
├── README.md                   (Deploy-Anleitung)
└── src/
    ├── index.ts                (Hono-app + auth + rate-limit + CORS)
    ├── agent.ts                (OpenAI-Call + tool-routing)
    ├── tools.ts                (DSGVO-/AI-Act-Lookup-Tools)
    ├── ws.ts                   (WebSocket-Handler mit auth-handshake)
    └── types.ts                (Request/Response-Schemata)
```

Stack-Choice:
- **Hono statt Express** — kleinerer Footprint, edge-deploybar, bessere TS-Integration
- **TypeScript statt plain JS** — match repo-style
- **Tini in Docker** — graceful-shutdown ohne PID-1-Probleme
- **systemd statt PM2** — konsistent mit playwright-scanner-Setup

---

## Wann implementieren?

**Trigger:** Erster Design-Partner sagt explizit „wir brauchen einen Compliance-Chat-Bot in unserem Workflow".

**Vorher:** Skip. Mehr Code ohne Validation ist Verzettelung. Die 4 echten GTM-Blocker zuerst:
1. OAuth-Provider-Konfig (`docs/oauth-setup.md`)
2. Stripe-Test-Mode-Setup + Pricing-Seed (`docs/stripe-pricing-seed.template.sql`)
3. Sentry-DSN setzen + Re-Deploy
4. LinkedIn-Outreach starten (5 Posts ready, 4 Targets refined)

---

## Wenn Voice-Layer dazu kommt

`openclaw-voice-agent` (echter Name dann gerechtfertigt):
- **STT:** OpenAI Whisper-API (`audio/transcriptions`) ODER selbst-gehosted Whisper auf VPS-GPU
- **TTS:** ElevenLabs (gut, teuer) ODER OpenAI TTS (`audio/speech`) (günstiger, OK-Quality)
- **Realtime-Layer:** LiveKit für duplex-WebRTC
- **Voice-Activity-Detection:** silero-vad oder webrtc-vad
- **Latenz-Budget:** <800ms Roundtrip — nur mit streaming + LiveKit erreichbar
