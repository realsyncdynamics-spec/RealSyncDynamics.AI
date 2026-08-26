/**
 * Agent Runtime Contracts — RealSyncDynamics.AI
 *
 * Gemeinsame Typen für Voice, Chat und WhatsApp.
 * LLM / STT / TTS dürfen keine Governance-Entscheidungen treffen.
 *
 *   LLM → ToolRequest → Policy Engine
 *     → Tenant → Permission → PII → Consent → Risk → Audit
 *     → ALLOW | DENY | REQUIRE_CONFIRMATION
 *     → Tool Runner → EvidenceEvent
 *
 * Bestehende Gateway-Typen in apps/agent-runtime/src/types.ts bleiben
 * unangetastet. Diese Contracts leben eine Schicht darüber.
 *
 * Mapping zum Gateway-evaluate():
 *   ALLOW                → { ok: true,  reviewRequired: false }
 *   REQUIRE_CONFIRMATION → { ok: true,  reviewRequired: true  }
 *   DENY                 → { ok: false, reason }
 *
 * PolicyDecision.decidedBy ist immer "policy-engine". Niemals "llm".
 */

export type Channel = "voice" | "chat" | "whatsapp" | "api";

export type SessionStatus =
  | "idle"
  | "consent_required"
  | "listening"
  | "transcribing"
  | "reasoning"
  | "policy_check"
  | "awaiting_confirmation"
  | "speaking"
  | "killed"
  | "rate_limited";

export type PolicyVerdict = "ALLOW" | "DENY" | "REQUIRE_CONFIRMATION";

export type PolicyCheck =
  | "kill_switch"
  | "rate_limit"
  | "tenant"
  | "permission"
  | "pii"
  | "consent"
  | "risk"
  | "audit";

export type CheckResult = "pass" | "fail" | "flag";

export type RiskLevel = "low" | "medium" | "high";

export type ConsentPurpose =
  | "record_audio"
  | "process_transcript"
  | "store_evidence"
  | "execute_tools"
  | "tts_playback";

export type ToolName =
  | "lookup_kb"
  | "create_ticket"
  | "schedule_appointment"
  | "handoff_human"
  | "export_transcript";

export type EvidenceKind =
  | "session.start"
  | "session.end"
  | "consent.granted"
  | "consent.revoked"
  | "turn.user"
  | "turn.assistant"
  | "tool.request"
  | "policy.decision"
  | "tool.result"
  | "kill.engaged"
  | "rate.limited";

export interface TenantContext {
  tenantId: string;
  name: string;
  locale: "de-DE";
  industry: string;
}

export interface AgentIdentity {
  agentId: string;
  name: string;
  version: "v0.1";
  channel: Channel;
  tools: ToolName[];
  riskCeiling: RiskLevel;
}

export interface Consent {
  id: string;
  tenantId: string;
  sessionId: string;
  purposes: ConsentPurpose[];
  grantedAt: string;
  withdrawnAt: string | null;
  lawfulBasis: "art6_1_a" | "art6_1_b" | "art6_1_f";
}

export interface AgentSession {
  sessionId: string;
  tenantId: string;
  agentId: string;
  channel: Channel;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  turnCount: number;
  toolCount: number;
  killSwitch: boolean;
  rateLimit: { maxTurns: number; maxTools: number };
  consentId: string | null;
  lastEvidenceHash: string;
}

export interface ToolRequest {
  requestId: string;
  sessionId: string;
  tenantId: string;
  agentId: string;
  tool: ToolName;
  args: Record<string, unknown>;
  proposedBy: "llm";
  createdAt: string;
}

export interface PolicyTraceStep {
  check: PolicyCheck;
  result: CheckResult;
  detail: string;
}

export interface PolicyDecision {
  decisionId: string;
  requestId: string;
  sessionId: string;
  tenantId: string;
  verdict: PolicyVerdict;
  reason: string;
  risk: RiskLevel;
  piiDetected: boolean;
  auditRequired: boolean;
  trace: PolicyTraceStep[];
  decidedAt: string;
  decidedBy: "policy-engine";
}

export interface AgentAction {
  actionId: string;
  requestId: string;
  sessionId: string;
  tenantId: string;
  tool: ToolName;
  verdict: PolicyVerdict;
  executed: boolean;
  result: Record<string, unknown> | null;
  blockedReason: string | null;
  executedAt: string | null;
}

export interface EvidenceEvent {
  eventId: string;
  kind: EvidenceKind;
  sessionId: string;
  tenantId: string;
  agentId: string;
  at: string;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";
