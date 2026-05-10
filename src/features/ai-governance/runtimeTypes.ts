/**
 * Demo-Type fuer das Runtime-Dashboard. Bewusst lockerer als das
 * SDK-Schema (src/sdk/telemetry.ts) — fuer die UI-Anzeige reicht ein
 * konsolidiertes "summary"-Feld statt voller Metadata-Bag.
 *
 * Folge-PR ersetzt durch echte Reihen aus ai_runtime_events (live).
 */

export interface AiRuntimeEventDemo {
  id: string;
  occurredAt: string;
  vendor: string;
  model: string;
  user: string;
  team: string;
  eventType:
    | 'prompt_sent'
    | 'response_received'
    | 'agent_action'
    | 'file_upload'
    | 'tool_call'
    | 'session_start'
    | 'session_end';
  promptCategory: string;
  dataClass:
    | 'public'
    | 'internal'
    | 'confidential'
    | 'personal_data'
    | 'special_category'
    | 'unknown';
  riskLevel: 'info' | 'low' | 'medium' | 'high' | 'critical';
  policyStatus: 'allowed' | 'warned' | 'blocked' | 'requires_approval' | 'logged';
  promptTokens?: number;
  summary: string;
}
