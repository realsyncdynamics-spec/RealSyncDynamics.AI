# Voice Agent v0.1 — kontrollierte Agent-Schnittstelle

> Der Voice-Agent ist kein eigenständiges Produkt.
> Er ist eine weitere kontrollierte Agent-Schnittstelle innerhalb des
> RealSyncDynamics Governance Runtime.

Dieses Dokument ist die Zielarchitektur für `voice.realsyncdynamicsai.de`.
Es ändert **nicht** das eingefrorene Landing-Design auf
`realsyncdynamicsai.de`. Ergänzung ist frei; die Startseite bleibt unangetastet.

## Entscheidungsregel

LLM, STT und TTS dürfen **keine** Governance-Entscheidungen treffen.
Sie dürfen nur *vorschlagen* (z. B. `create_ticket` mit `priority: high`).
Die Ausführung läuft immer:

```
LLM → ToolRequest → Policy Engine
  → Tenant Check → Permission → PII → Consent → Risk → Audit Requirement
  → ALLOW / DENY / REQUIRE_CONFIRMATION
  → Tool Runner → EvidenceEvent
```

`PolicyDecision.decidedBy` ist immer `"policy-engine"`. Niemals `"llm"`.

## Zielarchitektur

```
voice.realsyncdynamicsai.de
        ↓
   Cloudflare → Traefik
        ↓
   Voice Gateway (WebRTC / WS / API)
        ↓
   Agent Orchestrator (Session + State)
        ↓
   ┌───────────────┬───────────────┬──────────────┐
   Policy Engine   Tool Runner     KB Retrieval
        ↓               ↓
   Internal Gateway → CRM / Ticketing / Calendar / APIs
        ↓
   Audit Writer → Evidence Events → Supabase
```

Anbindung an den bestehenden Node-Gateway `apps/agent-runtime` (Port 8787):
Voice erzeugt `ToolRequest`, der Gateway bleibt die Policy-Kante, Evidence
landet in `ai_evidence_events` (nicht nur stdout).

## MVP-Scope (bewusst klein)

Enthalten:

- WebRTC / WebSocket Voice **oder** Browser-STT + Streaming-LLM + TTS
- Session Management + Tenant Isolation
- 5 Tools: `lookup_kb`, `create_ticket`, `schedule_appointment`,
  `handoff_human`, `export_transcript`
- Policy Engine + Consent Handling (Art. 6 DSGVO)
- Evidence-Event je kritischer Aktion, Hash-Kette
- Kill Switch + Rate Limiting

Nicht enthalten:

- Telefonanlage / SIP
- Agent Studio
- 50 Tools
- Autonome Produktionsänderungen

## Tools und Default-Verdicts

| Tool | Risiko | Default |
|---|---|---|
| `lookup_kb` | low | ALLOW |
| `create_ticket` | medium, high wenn priority=high | ALLOW / REQUIRE_CONFIRMATION |
| `schedule_appointment` | medium | REQUIRE_CONFIRMATION |
| `handoff_human` | low | ALLOW |
| `export_transcript` | high | DENY ohne `store_evidence`, sonst REQUIRE_CONFIRMATION |

## Contracts

Siehe `packages/agent-runtime-contracts` und
`docs/architecture/agent-runtime-contracts.md`.

- `AgentSession`
- `ToolRequest`
- `PolicyDecision`
- `Consent`
- `EvidenceEvent`
- `AgentAction`

## Positionierung

Nicht „Voice AI“ verkaufen.

> **Governed AI Agents**
> Agents, bei denen jede relevante Aktion kontrolliert, tenant-isoliert,
> policy-geprüft und beweisfähig protokolliert wird.

Das liegt auf der Produktlinie EU AI Act + DSGVO Governance OS.

## Design-Freeze

Landing (`/`) bleibt eingefroren (Baseline `339b08e7`). Voice bekommt eine
eigene Route / Subdomain. App/Dashboard: Obsidian · Titanium · Security-Blue,
Hard-Edge. Keine Änderung an bestehenden Texten oder CTAs der Startseite
ohne Rückfrage.

## Nächster Implementierungsschritt im Hauptrepo

1. Contracts-Package mergen (diese PR).
2. Voice-Policy als reines Modul neben `apps/agent-runtime/src/policy-engine.ts`
   (bestehende `evaluate()` nicht brechen).
3. Additive Migration `agent_sessions` / `agent_tool_requests` /
   `agent_policy_decisions` mit `tenant_id` + RLS — erst nach Review.
4. Edge Function `voice-turn` (kein Service-Role im Client).
5. Route `/app/voice` (auth-gated, lazy) — **nicht** die Public Landing.
