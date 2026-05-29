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
Frontend / Backend
   ↓  (Supabase Auth / Service Token)
agent-runtime  (this service, Port 8787)
   ↓
Policy Engine  →  Agent Registry  →  Audit Log (stdout)
   ↓
Tools (out of scope in this PR)
```

## Endpoints

| Methode | Pfad         | Auth       | Beschreibung |
|---------|--------------|------------|--------------|
| GET     | `/health`    | öffentlich | Liveness-Probe |
| GET     | `/agents`    | Bearer     | Listet registrierte Agents |
| POST    | `/run-agent` | Bearer     | Reicht einen Agent-Run zur Policy-Prüfung ein |

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

# Erlaubter Run
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
```

## Sicherheit

- Fail-Fast beim Boot, wenn `AGENT_RUNTIME_API_TOKEN` in Produktion fehlt
- `/health` ist die einzige unauthentifizierte Route
- Body-Limit 256 kB
- Keine Tokens, Bodies oder Header in Audit-Events
- `x-powered-by` deaktiviert
- Container läuft als unprivilegierter Node-User

## Non-Goals (in diesem PR)

- Frontend-Anbindung
- Persistente Speicherung (Audit nur stdout)
- Echte Tool-Calls (OpenClaw, Ollama, n8n)
- Autonome Produktionsänderungen
- Kubernetes, Temporal, Keycloak
