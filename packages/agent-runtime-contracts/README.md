# @realsync/agent-runtime-contracts

Typen für Session, ToolRequest, PolicyDecision, Consent, EvidenceEvent
und AgentAction. Keine Runtime-Abhängigkeiten.

```ts
import type {
  AgentSession,
  ToolRequest,
  PolicyDecision,
  Consent,
  EvidenceEvent,
  AgentAction,
} from "@realsync/agent-runtime-contracts";
```

Normativ: `docs/architecture/agent-runtime-contracts.md`
Voice-Zielarchitektur: `docs/architecture/voice-agent-v0.1.md`

Voice-Provider (Grok, OpenAI Realtime, …) als austauschbare Adapter:
`src/voice-provider.ts` (`VoiceProvider`, `normalizeProviderToolCall`).
Datenmodell: `supabase/migrations/20260928130000_voice_runtime_foundation.sql`.
