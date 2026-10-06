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
| POST    | `/voice-sessions` | Bearer | Session-Start → Store-Snapshot + Provider |

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
| `XAI_API_KEY`             | —                        | nur für den Grok-Voice-Adapter (Default-Getter); nie loggen |
| `AGENT_RUNTIME_VOICE_TOOL_BASE_URL` | `http://127.0.0.1:$PORT` | Base-URL für POST `/voice-tool` (Session-Runtime) |
| `AGENT_RUNTIME_VOICE_TOOL_TIMEOUT_MS` | `5000`               | Timeout der Session-Runtime gegen `/voice-tool` |
| `SUPABASE_URL` | — | Base-URL für `SupabaseVoiceStore` (Tool-Gateway Persistenz) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Service-Role nur serverseitig; nie loggen / nie im Browser |

### Agent-PEP (Governance-Prüfung vor dem Lauf)

Ab P1-5 fragt der Gateway vor jedem freigegebenen Lauf den Policy Decision
Point (`governance-decide`) — auf **beiden** Werkzeugrouten, `/run-agent`
und `/voice-tool`. Die lokale Prüfung bleibt die erste Schranke: bei
`/run-agent` die Agent-Registry (erlaubte Werkzeuge), bei `/voice-tool` die
Kanal-Policy (Einwilligung, Kill-Switch, Rate-Limit). Der PDP kommt darüber
und kennt die Regeln des Mandanten. **Ein lokales Nein bleibt ein
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

### Voice-Provider: Grok Realtime (PR 2)

`src/providers/grok-provider.ts` implementiert den `VoiceProvider`-Vertrag
(`packages/agent-runtime-contracts/src/voice-provider.ts`, lokal gespiegelt in
`src/voice-provider-types.ts`, weil das Docker-Build nur `apps/agent-runtime`
kopiert) gegen die xAI Realtime Voice API (`wss://api.x.ai/v1/realtime`).

- Der Adapter führt **nie** ein Tool aus. Tool-Calls des Modells werden nur
  als `tool.call`-Event gemeldet; das Ergebnis geht ausschließlich über
  `submitToolResult` an xAI zurück (`function_call_output` + `response.create`).
- `tenantId`/`botId` kommen nur aus der `VoiceSessionConfig`; gleichnamige
  Felder in Provider-Payloads werden ignoriert.
- Unbekannte/nicht angebotene Tools, fehlende Call-IDs und kaputte Argumente
  werden fail-closed als `error`-Event (`tool_call_rejected.<grund>`) gemeldet.
- Audio: `pcm16` → `audio/pcm` (8/16/24/48 kHz), `g711_ulaw` → `audio/pcmu`,
  `g711_alaw` → `audio/pcma` (je 8 kHz); `opus` und andere Raten werden abgelehnt.
- Die WebSocket-Implementierung wird über `socketFactory` injiziert, der
  API-Key über `getApiKey` (Default: `XAI_API_KEY`).

### Session-Runtime (PR 3)

`src/voice/session-runtime.ts` verdrahtet den Grok-Adapter mit `ws`
(`createWsSocketFactory`) und leitet jeden `tool.call` an `POST /voice-tool`
weiter (Bearer `AGENT_RUNTIME_API_TOKEN`, Base-URL
`AGENT_RUNTIME_VOICE_TOOL_BASE_URL`).

- **Keine Tool-Ausführung** in Adapter oder Runtime — die kommt in **PR 4**.
  Bei Policy-`ALLOW` geht `outcome: failed` / `execution: deferred_to_pr4`
  an das Modell (`verified: false`).
- `tenantId`/`botId` ausschließlich aus dem Session-Kontext
  (`voice_number_bindings` → `bots`; Tenant via `memberships` /
  `is_tenant_member`). Gleichnamige Felder in Modell-Args werden verworfen.
- Disclosure (`voice_bot_configs.disclosure_text`) ist Pflicht und wird
  verbatim zuerst gesprochen. Fehlt sie → keine Session.
- Optional `greetingText` nur als konfigurierte Begrüßung **nach** der
  Disclosure (kein Default im Code, kein Marketing-Story-Hardcode als
  Disclosure).
- Unbekannte Tools, kaputte Args, Timeout/Fehler von `/voice-tool` →
  fail-closed `denied` an das Modell.
- Kein `voice_channels` / `bot_agents`.

### Tool-Gateway (PR 4)

`src/voice/tool-gateway.ts` übernimmt nach der Policy-Entscheidung
Ausführung, Verifikation und Evidenz-Hash-Kette (`voice_evidence` /
`GENESIS_HASH`).

- `PolicyDecision.decidedBy` bleibt immer `policy-engine`.
- Ohne vollständigen Decision-Payload von `/voice-tool` →
  `denied` / `missing_policy_decision` (keine synthetisierte Entscheidung).
- `evaluate()` in `policy-engine.ts` unberührt.
- Ausführung nur bei `ALLOW` oder bestätigtem `REQUIRE_CONFIRMATION`.
- `verified: true` nur nach Re-Read des Datensatzes (`id` + `tenant_id`,
  `external_ref` = diese ID); sonst `mismatch` / `failed`.
- Echter Executor: `schedule_appointment` → `bot_appointments` (via Store).
  Fehlt `customer_name` → `invalid_arguments`, keine Ausführung.
- Bewusst `not_configured`: `lookup_kb`, `create_ticket`, `handoff_human`,
  `export_transcript` (kein Backend im Repo).
- Keine neuen Tool-Namen `read_availability` / `book_appointment` (kein
  Backend; bestehende fünf Nora-Tools bleiben).
- Persistenz: `SupabaseVoiceStore`
  (`src/voice/supabase-voice-store.ts`) aus `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` — nie loggen. Ohne Store → jedes Tool
  fail-closed `failed`/`not_configured`. Memory-Store nur explizit in Tests.
- **`voice_sessions`:** Ist ein Store konfiguriert, legt die Session-Runtime
  VOR dem Provider-Start eine Zeile in `public.voice_sessions` an (Snapshot
  aus `voice_bot_configs` / `voice_number_bindings`, status=`active`). Deren
  `id` ist die kanonische `sessionId` für Tool-Requests und Evidenz.
  Caller-`tenantId`/`policy`/`disclosure` überschreiben den DB-Snapshot nie.
  Fehlt aktiver Config/Binding → `config_not_found` (kein Provider-Start).
  `insertSession`-Fehler → `store_error` (kein Provider-Start). Ohne Store
  bleibt der Legacy-Pfad (Tools `not_configured`) — kein vorgetäuschter Erfolg.

## Betrieb / Deploy

**Status: nicht deployt.** Im Repo gibt es für `apps/agent-runtime` kein
Hoster-Deploy-Muster (kein `fly.toml` / `render.yaml` / Railway / dedizierter
Deploy-Workflow). Vorhanden sind:

- `apps/agent-runtime/Dockerfile` (Node 20, Port `8787`)
- `apps/agent-runtime/docker-compose.yml` (internes Netz, Healthcheck auf `/health`)
- CI: `.github/workflows/backend-services-ci.yml` → `npm run typecheck && npm test`

### Docker-Build / Run

```bash
cd apps/agent-runtime
docker build -t realsync-agent-runtime .
docker run --rm -p 8787:8787 \
  -e NODE_ENV=production \
  -e PORT=8787 \
  -e AGENT_RUNTIME_API_TOKEN=… \
  -e XAI_API_KEY=… \
  -e SUPABASE_URL=… \
  -e SUPABASE_SERVICE_ROLE_KEY=… \
  realsync-agent-runtime
```

Health: `GET /health` (ohne Auth).

### Env-Namen (keine Werte)

| Name | Pflicht | Zweck |
|------|---------|--------|
| `AGENT_RUNTIME_API_TOKEN` | ja | Bearer für `/agents`, `/run-agent`, `/voice-tool` |
| `PORT` | nein (8787) | Listen-Port |
| `XAI_API_KEY` | für Voice | Grok Realtime — nie loggen |
| `SUPABASE_URL` | für Persistenz | PostgREST-Base |
| `SUPABASE_SERVICE_ROLE_KEY` | für Persistenz | Service-Role — nie loggen, nie im Browser |
| `AGENT_RUNTIME_VOICE_TOOL_BASE_URL` | nein | Base-URL für POST `/voice-tool` |
| `AGENT_RUNTIME_VOICE_TOOL_TIMEOUT_MS` | nein (5000) | Timeout Session-Runtime → `/voice-tool` |

Kein Wrangler, kein KV, keine Secrets im Code außer Env-Lesen.

### HTTP-Einstieg Voice-Session

`POST /voice-sessions` (Bearer `AGENT_RUNTIME_API_TOKEN`) startet eine
governed Voice-Session über `VoiceSessionRuntime.startSession`.

**Body** (JSON, `.strict` — unbekannte/autoritative Felder → `400 invalid_request`):

| Feld | Pflicht | Bemerkung |
|------|---------|-----------|
| `bot_id` **oder** `number_binding_id` | genau eines | UUID |
| `correlation_id` | nein | UUID |
| `input_audio` / `output_audio` | nein | Allowlist: `pcm16`/`g711_ulaw`/`g711_alaw` + 8/16/24/48 kHz |
| `consent` | nein | `{ purposes[], withdrawn_at }` |

**Verboten im Body** (führen zu `400`, erreichen `startSession` nie):
`tenantId`/`tenant_id`, `policy`/`policy_ref`, `disclosure`/`disclosure_text`,
`provider`, `model`, `offered_tools`, `instructions`. Tenant nie aus URL.
Snapshot kommt ausschließlich aus `voice_bot_configs` /
`voice_number_bindings`. Instructions = serverseitiger Default.

**Antworten**

| Status | `reason` | Bedeutung |
|--------|----------|-----------|
| 201 | — | `{ ok: true, session_id }` (= `voice_sessions.id`) |
| 400 | `invalid_request` | Body/Strict/exactly-one |
| 401 | `missing_token` | Auth fehlt/falsch |
| 404 | `config_not_found` | kein aktiver Config/Binding |
| 502 | `provider_error` | Provider-Start fehlgeschlagen |
| 503 | `store_error` / `not_configured` / `missing_token` | Store/Insert/Env |

Ohne konfigurierten Store: `503 not_configured` — **kein** Legacy-Start über HTTP.

```bash
curl -X POST http://localhost:8787/voice-sessions \
  -H "Authorization: Bearer $AGENT_RUNTIME_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bot_id":"22222222-2222-2222-2222-222222222222"}'
```

Weitere Routen: `GET /health`, `GET /agents`, `POST /run-agent`, `POST /voice-tool`.

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
