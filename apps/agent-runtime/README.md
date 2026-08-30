# realsync-agent-runtime

Kontrollierter Runtime-Gateway für die Governance-Agenten von
RealSyncDynamics.AI. Dieser Service nimmt authentifizierte
Agent-Run-Anfragen entgegen, prüft sie gegen eine Policy-Engine und
schreibt für jede Entscheidung ein strukturiertes Audit-Event nach
stdout.

> **Scope dieses MVP:** Gateway + Registry + Policy + Audit. **Keine**
> tatsächliche Tool-Ausführung — kein OpenClaw-Aufruf, kein
> Ollama-Inferenz-Call, kein n8n-Trigger. Diese Schichten folgen in
> Folge-PRs hinter denselben Auth- und Policy-Gates.

## Architektur

```
Frontend / Backend / Edge Function voice-turn
   ↓  (Supabase Auth / Service Token)
agent-runtime  (this service, Port 8787)
   ↓
┌──────────────────┬─────────────────────────┐
│ /run-agent       │ /voice-tool             │
│ evaluate()       │ evaluateVoiceToolRequest│
│ ok | denied      │ ALLOW | DENY | CONFIRM  │
└──────────────────┴─────────────────────────┘
   ↓
Audit Log (stdout)
```

Voice ist ein Kanal, kein eigenes Produkt. LLM/STT/TTS dürfen nur
`ToolRequest`s vorschlagen. `PolicyDecision.decidedBy` ist immer
`policy-engine`. `evaluate()` bleibt unangetastet. Nora (`agent_voice_nora_v01`)
wird auf `/run-agent` mit `denied_by_channel_policy` abgewiesen — der
8-Check-Prüfpfad läuft nur über `/voice-tool`.

## Endpoints

| Methode | Pfad          | Auth   | Beschreibung |
|---------|---------------|--------|--------------|
| GET     | `/health`     | öffentlich | Liveness-Probe |
| GET     | `/agents`     | Bearer | Listet registrierte Agents inkl. Nora |
| POST    | `/run-agent`  | Bearer | Interne Agents → `evaluate()` |
| POST    | `/voice-tool` | Bearer | Voice-Kanal → 8-Check-Prüfpfad |

Auth-Header: `Authorization: Bearer ${AGENT_RUNTIME_API_TOKEN}`

## Environment

| Variable                  | Default                  | Pflicht in `production`? |
|---------------------------|--------------------------|--------------------------|
| `NODE_ENV`                | `development`            | nein |
| `PORT`                    | `8787`                   | nein |
| `AGENT_RUNTIME_API_TOKEN` | —                        | **ja** — sonst Fail-Fast beim Boot |
| `OLLAMA_URL`              | `http://ollama:11434`    | nein |
| `OPENCLAW_URL`            | `http://openclaw:3000`   | nein |
| `N8N_URL`                 | `http://n8n:5678`        | nein |

## Lokal entwickeln

```bash
cd apps/agent-runtime
npm install
AGENT_RUNTIME_API_TOKEN=dev-token npm run dev
npm test
npm run typecheck
```

## Build / Run

```bash
npm run build
NODE_ENV=production AGENT_RUNTIME_API_TOKEN=… npm run start
```

## Docker

```bash
docker build -t realsync-agent-runtime .
docker run --rm -p 8787:8787 \
  -e NODE_ENV=production \
  -e AGENT_RUNTIME_API_TOKEN=… \
  realsync-agent-runtime
```

Oder per Compose:

```bash
AGENT_RUNTIME_API_TOKEN=… docker compose up --build
```

## Beispiel-Aufrufe

```bash
# Health (offen)
curl http://localhost:8787/health

# Agent-Liste (Bearer)
curl -H "Authorization: Bearer $AGENT_RUNTIME_API_TOKEN" \
  http://localhost:8787/agents

# Erlaubter Run (bestehender interner Agent)
curl -X POST http://localhost:8787/run-agent \
  -H "Authorization: Bearer $AGENT_RUNTIME_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId":"tenant_123",
    "agentId":"website-drift-agent",
    "taskType":"scan",
    "requestedTool":"website_scan",
    "input":{"url":"https://example.com"},
    "requestId":"req_abc"
  }'

# Restricted Action (wird denied + audit-logged)
curl -X POST http://localhost:8787/run-agent \
  -H "Authorization: Bearer $AGENT_RUNTIME_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId":"tenant_123",
    "agentId":"developer-remediation-agent",
    "taskType":"production_change",
    "requestedTool":"github_pr_draft",
    "input":{},
    "requestId":"req_xyz"
  }'

# Voice: lookup_kb → ALLOW
curl -X POST http://localhost:8787/voice-tool \
  -H "Authorization: Bearer $AGENT_RUNTIME_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId":"tenant_mueller_sanitaer",
    "agentId":"agent_voice_nora_v01",
    "sessionId":"sess_1",
    "requestId":"req_voice_1",
    "tool":"lookup_kb",
    "args":{"query":"öffnungszeiten"},
    "session":{"killSwitch":false,"turnCount":1,"toolCount":0,"rateLimit":{"maxTurns":20,"maxTools":8}},
    "consent":{"purposes":["execute_tools","store_evidence"],"withdrawnAt":null}
  }'
```

## Mapping Voice → Gateway

| Voice-Verdict | HTTP | Gateway |
|---|---|---|
| `ALLOW` | 200 | `{ ok: true, reviewRequired: false }` |
| `REQUIRE_CONFIRMATION` | 200 | `{ ok: true, reviewRequired: true }` |
| `DENY` | 403 | `{ ok: false, reason: denied_by_channel_policy }` |

`denied_by_channel_policy` ist additiv in `DenyReason`. `evaluate()`
erzeugt ihn nicht.

## Sicherheit

- Fail-Fast beim Boot, wenn `AGENT_RUNTIME_API_TOKEN` in Produktion fehlt
- `/health` ist die einzige unauthentifizierte Route
- Body-Limit 256 kB
- Keine Tokens, Bodies oder Header in Audit-Events
- `x-powered-by` deaktiviert
- Container läuft als unprivilegierter Node-User
- Cross-Tenant in `/voice-tool` ist `DENY`
- `/run-agent` mit Nora ist `denied_by_channel_policy`

## Non-Goals (in diesem PR)

- Frontend-Anbindung (`/app/voice` folgt)
- Persistente Speicherung (Audit nur stdout; Evidence in `ai_evidence_events` folgt in der Edge Function)
- Echte Tool-Calls (OpenClaw, Ollama, n8n)
- Autonome Produktionsänderungen
- Kubernetes, Temporal, Keycloak
- Änderung der Public Landing
