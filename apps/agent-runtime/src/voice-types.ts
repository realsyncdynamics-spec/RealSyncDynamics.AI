/**
 * Voice-Kanal-Typen. Normativ:
 * packages/agent-runtime-contracts.
 *
 * Dieser Service darf das Package nicht importieren — das Docker-Build
 * kopiert nur apps/agent-runtime. Die Formen müssen byte-genau zur
 * Contract-PR passen. evaluate() in policy-engine.ts bleibt unberührt.
 */

export type VoiceToolName =
  | 'lookup_kb'
  | 'create_ticket'
  | 'schedule_appointment'
  | 'handoff_human'
  | 'export_transcript';

export type VoiceVerdict = 'ALLOW' | 'DENY' | 'REQUIRE_CONFIRMATION';

export type VoicePolicyCheck =
  | 'kill_switch'
  | 'rate_limit'
  | 'tenant'
  | 'permission'
  | 'pii'
  | 'consent'
  | 'risk'
  | 'audit';

export type VoiceCheckResult = 'pass' | 'fail' | 'flag';

export type VoiceRiskLevel = 'low' | 'medium' | 'high';

export type VoiceConsentPurpose =
  | 'record_audio'
  | 'process_transcript'
  | 'store_evidence'
  | 'execute_tools'
  | 'tts_playback';

export interface VoiceConsent {
  purposes: VoiceConsentPurpose[];
  withdrawnAt: string | null;
}

export interface VoiceSessionState {
  sessionId: string;
  tenantId: string;
  killSwitch: boolean;
  turnCount: number;
  toolCount: number;
  rateLimit: { maxTurns: number; maxTools: number };
}

export interface VoiceToolRequest {
  requestId: string;
  sessionId: string;
  tenantId: string;
  agentId: string;
  tool: VoiceToolName;
  args: Record<string, unknown>;
  proposedBy: 'llm';
  createdAt: string;
}

export interface VoicePolicyTraceStep {
  check: VoicePolicyCheck;
  result: VoiceCheckResult;
  detail: string;
}

export interface VoicePolicyDecision {
  decisionId: string;
  requestId: string;
  sessionId: string;
  tenantId: string;
  verdict: VoiceVerdict;
  reason: string;
  risk: VoiceRiskLevel;
  piiDetected: boolean;
  auditRequired: boolean;
  trace: VoicePolicyTraceStep[];
  decidedAt: string;
  decidedBy: 'policy-engine';
}

export const VOICE_AGENT_ID = 'agent_voice_nora_v01';
export const VOICE_AGENT_NAME = 'Nora';
export const VOICE_AGENT_TOOLS: readonly VoiceToolName[] = [
  'lookup_kb',
  'create_ticket',
  'schedule_appointment',
  'handoff_human',
  'export_transcript',
] as const;
