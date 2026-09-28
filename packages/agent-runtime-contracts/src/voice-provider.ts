/**
 * Voice Provider Contract — RealSyncDynamics.AI
 *
 * Grok, OpenAI Realtime, Gemini, … sind austauschbare Adapter hinter
 * dieser Schnittstelle. Der Rest der Runtime weiß nicht, welches Modell
 * spricht; Policy und Governance wechseln nicht mit dem Provider.
 *
 *   Audio IN → Provider (versteht + spricht)
 *     → ProviderToolCall  (Vorschlag, untrusted)
 *     → normalizeProviderToolCall → ToolRequest
 *     → Policy Engine → Execution → Verification → EvidenceEvent
 *     → submitToolResult → Provider spricht das Ergebnis
 *
 * Harte Regeln:
 *  - Ein Adapter führt NIE selbst ein Tool aus. Er meldet Tool-Calls nur
 *    als Event; das Ergebnis kommt ausschließlich über submitToolResult.
 *  - Provider-Credentials leben serverseitig (Secret-Verwaltung der Voice
 *    Runtime). Sie sind kein Teil von VoiceSessionConfig.
 *  - tenantId/botId stammen aus der serverseitigen Auflösung
 *    (voice_number_bindings bzw. memberships), nie aus Provider-Payloads.
 *
 * Datenmodell: supabase/migrations/20260928130000_voice_runtime_foundation.sql
 */

import type { RiskLevel, ToolName, ToolRequest } from "./index";

export type VoiceProviderId = "grok" | "openai" | "gemini" | "claude" | "custom";

export const VOICE_PROVIDER_IDS: readonly VoiceProviderId[] = [
  "grok",
  "openai",
  "gemini",
  "claude",
  "custom",
] as const;

/** Werkzeuge, die dieser Contract kennt. Alles andere ist fail-closed. */
export const CONTRACT_TOOL_NAMES: readonly ToolName[] = [
  "lookup_kb",
  "create_ticket",
  "schedule_appointment",
  "handoff_human",
  "export_transcript",
] as const;

export type AudioEncoding = "pcm16" | "g711_ulaw" | "g711_alaw" | "opus";

export interface AudioFormat {
  encoding: AudioEncoding;
  sampleRateHz: 8000 | 16000 | 24000 | 48000;
}

/** Tool-Beschreibung, wie sie dem Modell angeboten wird. Angeboten ≠ erlaubt. */
export interface VoiceToolDefinition {
  name: ToolName;
  description: string;
  /** JSON-Schema der Argumente. */
  parameters: Record<string, unknown>;
}

export interface VoiceSessionConfig {
  /** Serverseitig aufgelöst — nie aus URL, Body oder Provider-Payload. */
  tenantId: string;
  botId: string;
  /** voice_sessions.id — von der Runtime vor createSession angelegt. */
  sessionId: string;
  correlationId: string;
  provider: VoiceProviderId;
  model: string;
  voice?: string;
  language: "de-DE" | (string & {});
  /** bots.persona + Governance-Rahmen, von der Runtime zusammengesetzt. */
  instructions: string;
  /** Pflicht-Hinweis (Art. 50 EU AI Act), wird zuerst gesprochen. */
  disclosureText: string;
  tools: VoiceToolDefinition[];
  inputAudio: AudioFormat;
  outputAudio: AudioFormat;
}

export type VoiceProviderSessionStatus = "connecting" | "open" | "closing" | "closed" | "failed";

export interface VoiceProviderSession {
  sessionId: string;
  provider: VoiceProviderId;
  model: string;
  /** Session-/Connection-ID beim Provider (voice_sessions.provider_session_ref). */
  providerSessionRef: string | null;
  status: VoiceProviderSessionStatus;
}

/** Roh-Vorschlag des Modells. Untrusted — Name und Argumente sind Modellausgabe. */
export interface ProviderToolCall {
  /** Tool-Call-ID des Providers (Idempotenz, voice_tool_requests.provider_call_id). */
  callId: string;
  name: string;
  /** Roh-Argumente; Provider liefern teils JSON-Strings. */
  arguments: unknown;
}

export type VoiceProviderEvent =
  | { type: "session.opened"; sessionId: string; providerSessionRef: string | null }
  | { type: "audio.output"; sessionId: string; audio: ArrayBuffer }
  | { type: "transcript.user"; sessionId: string; text: string; final: boolean }
  | { type: "transcript.assistant"; sessionId: string; text: string; final: boolean }
  | { type: "tool.call"; sessionId: string; call: ProviderToolCall }
  | { type: "error"; sessionId: string; code: string; retryable: boolean }
  | { type: "session.closed"; sessionId: string; reason: "caller" | "runtime" | "provider" | "error" };

/**
 * Governance-Ergebnis, das an das Modell zurückgeht. `verified` darf nur
 * true sein, wenn voice_executions.verification_status = 'confirmed' —
 * sonst darf der Agent nichts als erledigt zusagen.
 */
export interface VoiceToolResult {
  callId: string;
  outcome: "executed" | "denied" | "awaiting_confirmation" | "failed";
  verified: boolean;
  /** Für das Modell formulierbare, PII-arme Rückmeldung. */
  output: Record<string, unknown>;
}

export interface VoiceProvider {
  readonly id: VoiceProviderId;
  createSession(
    config: VoiceSessionConfig,
    onEvent: (event: VoiceProviderEvent) => void,
  ): Promise<VoiceProviderSession>;
  sendAudio(sessionId: string, audio: ArrayBuffer): Promise<void>;
  submitToolResult(sessionId: string, result: VoiceToolResult): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
}

export function isVoiceProviderId(value: unknown): value is VoiceProviderId {
  return typeof value === "string" && (VOICE_PROVIDER_IDS as readonly string[]).includes(value);
}

export function isContractToolName(value: unknown): value is ToolName {
  return typeof value === "string" && (CONTRACT_TOOL_NAMES as readonly string[]).includes(value);
}

export type ToolCallRejection =
  | "unknown_tool"
  | "tool_not_offered"
  | "invalid_arguments"
  | "missing_call_id";

export type NormalizedToolCall =
  | { ok: true; request: ToolRequest; argumentKeys: string[] }
  | { ok: false; callId: string | null; reason: ToolCallRejection };

/**
 * Übersetzt einen Provider-Tool-Call in einen ToolRequest — fail-closed.
 *
 * Tenant, Session und Agent kommen aus dem serverseitigen Kontext, nie aus
 * dem Call. Unbekannte oder nicht angebotene Tools, fehlende Call-IDs und
 * Argumente, die kein flaches JSON-Objekt sind, werden abgelehnt, bevor
 * sie die Policy Engine erreichen. Eine Ablehnung hier ersetzt die Policy
 * nicht — sie ist nur die erste, billigste Schranke.
 */
export function normalizeProviderToolCall(
  call: ProviderToolCall,
  ctx: {
    requestId: string;
    sessionId: string;
    tenantId: string;
    agentId: string;
    offeredTools: readonly string[];
    now: string;
  },
): NormalizedToolCall {
  const callId = typeof call.callId === "string" && call.callId.trim() !== "" ? call.callId : null;
  if (!callId) return { ok: false, callId: null, reason: "missing_call_id" };
  if (!isContractToolName(call.name)) return { ok: false, callId, reason: "unknown_tool" };
  if (!ctx.offeredTools.includes(call.name)) return { ok: false, callId, reason: "tool_not_offered" };

  let args: unknown = call.arguments ?? {};
  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch {
      return { ok: false, callId, reason: "invalid_arguments" };
    }
  }
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return { ok: false, callId, reason: "invalid_arguments" };
  }

  const record = args as Record<string, unknown>;
  return {
    ok: true,
    argumentKeys: Object.keys(record).sort(),
    request: {
      requestId: ctx.requestId,
      sessionId: ctx.sessionId,
      tenantId: ctx.tenantId,
      agentId: ctx.agentId,
      tool: call.name,
      args: record,
      proposedBy: "llm",
      createdAt: ctx.now,
    },
  };
}

/** Evidenz-Snapshot je Voice-Session: welcher Provider hat gesprochen. */
export interface VoiceSessionEvidenceMeta {
  provider: VoiceProviderId;
  model: string;
  policyRef: string;
  correlationId: string;
  riskCeiling: RiskLevel;
}
