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
| `AGENT_PDP_ENFORCEMENT`   | `shadow`                 | nein — `off` \| `shadow` \| `enforce` |
| `AGENT_PDP_URL`           | —                        | für `enforce` erforderlich |
| `AGENT_PDP_KEY`           | —                        | für `enforce` erforderlich (`rsd_gov_…`) |
| `AGENT_PDP_FAILURE_MODE`  | `block`                  | nein — `allow` \| `block` |
| `AGENT_PDP_TIMEOUT_MS`    | `3000`                   | nein |

### Agent-PEP (Governance-Prüfung vor dem Lauf)

Ab P1-5 fragt der Gateway vor jedem freigegebenen Lauf den Policy Decision
Point (`governance-decide`). Die lokale Registry-Prüfung bleibt die erste
Schranke — sie kennt die erlaubten Werkzeuge des Agenten; der PDP kommt
darüber und kennt die Regeln des Mandanten. **Ein lokales Nein bleibt ein
Nein: der PDP kann zusätzlich anhalten, nie zusätzlich erlauben.**

Drei Modi:

- `off` — der Gateway verhält sich exakt wie vor P1-5.
- `shadow` (Default) — es wird gefragt und protokolliert, aber nichts
  durchgesetzt. Ein Deploy ändert damit kein Verhalten.
- `enforce` — `block` und `require_approval` führen zu HTTP 403 mit
  deutschsprachiger Begründung im Feld `message`.

**Ausfallverhalten ist hier bewusst `block` (fail closed)** — anders als
beim benutzerseitigen `ai-gateway`. Begründung: Ein Agent handelt autonom,
ohne dass jemand zusieht. Eine angehaltene Agentenaktion kostet einen Lauf;
eine ungeprüfte kostet die Zusage des Produkts. Wer das anders braucht,
setzt `AGENT_PDP_FAILURE_MODE=allow` — bewusst und sichtbar.

**Was den Prozess verlässt:** ausschließlich strukturierte Fakten des
Aufrufs — Werkzeugname, Aufgabenart, Zielsystem, Anbieter, Modell,
deklarierte Datenklasse und die **Namen** der Aufrufargumente. Niemals
Argumentwerte, freier Text oder Modellausgabe. Das ist kein Detail,
sondern der Schutz gegen Prompt Injection: Wer die Entscheidungsgrundlage
nicht beeinflussen kann, kann die Entscheidung nicht drehen. Siehe
`src/pdp-client.ts` (`sanitizeToolCall`) und
`supabase/functions/_shared/pdp/toolcall.ts`.

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
