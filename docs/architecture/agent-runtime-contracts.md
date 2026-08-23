# Agent Runtime Contracts v0.1

> Der Voice-Agent ist kein eigenständiges Produkt.
> Er ist eine weitere kontrollierte Agent-Schnittstelle innerhalb des
> RealSyncDynamics Governance Runtime.

Normative Typen: `packages/agent-runtime-contracts`.
Keine Runtime-Abhängigkeiten. LLM / STT / TTS stehen **nicht** in `decidedBy`.

## Warum eigene Contracts

Der bestehende Gateway (`apps/agent-runtime/src/types.ts`) kennt

```ts
PolicyDecision = { ok: true; reviewRequired: boolean } | { ok: false; reason }
```

Das reicht für den internen Runner. Voice, Chat und WhatsApp brauchen eine
Schicht **darüber**: Session, Consent, PII, Evidence-Kette und ein drittes
Verdict `REQUIRE_CONFIRMATION`. Diese Contracts erweitern den Gateway.
`evaluate()` bleibt unangetastet.

## Mapping zum Gateway

| Voice-Verdict | Gateway |
|---|---|
| `ALLOW` | `{ ok: true, reviewRequired: false }` |
| `REQUIRE_CONFIRMATION` | `{ ok: true, reviewRequired: true }` |
| `DENY` | `{ ok: false, reason }` |

`PolicyDecision.decidedBy` ist immer `"policy-engine"`. Niemals `"llm"`.

## Die sechs Verträge

| Contract | Zweck |
|---|---|
| `AgentSession` | Tenant-isolierte Laufzeit, Kill Switch, Rate Limit, Evidence-Head |
| `ToolRequest` | Vorschlag des Modells. `proposedBy: "llm"`. Nie direkte Ausführung. |
| `PolicyDecision` | `ALLOW` / `DENY` / `REQUIRE_CONFIRMATION` plus Trace (Prüfpfad) |
| `Consent` | Zwecke nach Art. 6 DSGVO. Fehlende Zwecke = DENY. |
| `EvidenceEvent` | Hash-Kette (`prevHash` → `hash`). Auch DENY schreibt. |
| `AgentAction` | Was der Tool Runner nach dem Verdict tatsächlich getan hat. |

## Policy-Pfad

```
LLM → ToolRequest → Policy Engine
  → Kill Switch → Rate Limit
  → Tenant → Permission → PII → Consent → Risk → Audit
  → ALLOW | DENY | REQUIRE_CONFIRMATION
  → Tool Runner → EvidenceEvent
```

Jeder Check schreibt in `PolicyDecision.trace[]`. Das ist der sichtbare
Prüfpfad. `auditRequired` ist für Tool-Aktionen immer `true`.

## Tenant Isolation

`ToolRequest.tenantId` muss `AgentSession.tenantId` gleichen.
Cross-Tenant ist `DENY`. Persistenz (nächster Schritt, nicht diese PR):
`tenant_id` + RLS auf `agent_sessions`, `agent_tool_requests`,
`agent_policy_decisions`. Evidence landet in `ai_evidence_events`.

## Consent-Zwecke

| Zweck | Ohne ihn |
|---|---|
| `record_audio` | Kein Mikrofon |
| `process_transcript` | Kein Turn |
| `store_evidence` | `export_transcript` = DENY |
| `execute_tools` | Jedes Tool = DENY |
| `tts_playback` | Keine Sprachausgabe |

Rechtsgrundlage in v0.1: `art6_1_a` (Einwilligung). Widerruf setzt
`withdrawnAt` und beendet die Session für Tools.

## Evidence

`EvidenceEvent.hash` = SHA-256 über kanonisches JSON inkl. `prevHash`.
Genesis:

```
0000000000000000000000000000000000000000000000000000000000000000
```

Kinds: `session.start` · `session.end` · `consent.granted` ·
`consent.revoked` · `turn.user` · `turn.assistant` · `tool.request` ·
`policy.decision` · `tool.result` · `kill.engaged` · `rate.limited`.

## Kanal-Neutralität

`Channel = "voice" | "chat" | "whatsapp" | "api"`.
Dieselben Contracts, dieselbe Policy Engine, dieselbe Evidence-Kette.
Voice ist der erste Adapter, nicht ein Sonderfall.

## Was diese PR nicht tut

- `apps/agent-runtime/src/policy-engine.ts` `evaluate()` bleibt.
- Keine Migration, keine Edge Function, keine Public-Landing-Änderung
  (Design-Freeze Baseline `339b08e7`).
- Voice-UI im Hauptrepo folgt nach Merge als `/app/voice` (auth-gated).
