// WP9 (M3): Evidence-Nachweis pro angemeldetem KI-Aufruf in `ai_evidence_events`.
//
// Ziel-Tabelle: `ai_evidence_events` (Migration 20260510_ai_governance_core.sql,
// append-only seit 20260901090000_evidence_append_only_anchors.sql, Hash-Kette
// per Trigger `tg_evidence_event_chain`). Keine Migration nötig.
//
// Datenminimierung (DSGVO Art. 5 Abs. 1 lit. c):
//   Weder Prompt- (`input`, `system_prompt`, `messages`) noch Antwortinhalte
//   (`output`, `raw_text`) werden im Evidence-JSON oder in `event_summary`
//   gespeichert — ausschließlich Länge (`input_length`) und SHA-256-Prüfsumme
//   (`input_sha256`) über `_shared/hash.ts`.
//
// Reine Hilfsfunktionen ohne `jsr:`-/Deno-Spezifika, damit Vitest das Modul
// direkt importieren und testen kann.

import { sha256Hex } from '../hash.ts';
import type { AiGatewayUsage } from './types.ts';
import type { InternalCaller } from './access.ts';

export type AiCallEvidenceEventType = 'ai:call' | 'ai:call_blocked';

export type AiCallEvidenceRiskLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type AiCallResidency = 'eu_local' | 'cloud';

export type AiCallVerdict = 'allow' | 'warn' | 'log_only' | 'block' | 'require_approval';

export interface AiCallEvidenceTokens {
  input: number;
  output: number;
  total: number;
}

export interface AiCallEvidencePayload {
  tenant_id: string;
  path: 'user' | 'service';
  user_id: string | null;
  internal_caller: InternalCaller | string | null;
  feature: string;
  route: string;
  op: string;
  provider: string | null;
  model: string | null;
  model_profile: string | null;
  provider_region: string;
  residency: AiCallResidency;
  tokens: AiCallEvidenceTokens;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  verdict: AiCallVerdict;
  pdp_decision: AiCallVerdict;
  reasons: string[];
  policy_id: string | null;
  request_id: string | null;
  latency_ms: number | null;
  input_length: number;
  input_sha256: string | null;
}

export interface AiEvidenceEventInsert {
  tenant_id: string;
  ai_system_id: string | null;
  policy_id: string | null;
  event_type: AiCallEvidenceEventType;
  event_summary: string;
  risk_level: AiCallEvidenceRiskLevel;
  evidence: AiCallEvidencePayload;
}

export interface BuildAiCallEvidenceArgs {
  tenantId: string;
  path: 'user' | 'service';
  userId?: string | null;
  internalCaller?: InternalCaller | string | null;
  feature: string;
  route: string;
  op?: string;
  provider?: string | null;
  model?: string | null;
  modelProfile?: string | null;
  providerRegion?: string;
  residency?: AiCallResidency;
  usage?: AiGatewayUsage | null;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  verdict?: string | null;
  blocked?: boolean;
  reasons?: string[];
  policyId?: string | null;
  aiSystemId?: string | null;
  requestId?: string | null;
  latencyMs?: number | null;
  /** Roh-Eingabe wird ausschließlich gehasht und vermessen, NIE im Ergebnis abgelegt. */
  input?: string | null;
  inputLength?: number;
  inputSha256?: string | null;
}

/** Minimale Supabase-Client-Schnittstelle (portabel zwischen Deno und Vitest). */
export interface EvidenceAdminLike {
  from(table: string): {
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
  };
}

function nonNegativeInt(value: number | undefined | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

/** Normalisiert ein PDP-Verdikt auf das kanonische Vokabular. */
export function normalizeVerdict(verdict: string | null | undefined, blocked = false): AiCallVerdict {
  if (blocked) {
    return verdict === 'require_approval' ? 'require_approval' : 'block';
  }
  switch (verdict) {
    case 'allow':
      return 'allow';
    case 'warn':
      return 'warn';
    case 'log_only':
    case 'log':
      return 'log_only';
    case 'require_approval':
      return 'require_approval';
    case 'block':
      return 'block';
    default:
      return 'allow';
  }
}

/**
 * Leitet `risk_level` für `ai_evidence_events` aus dem PDP-Verdikt ab:
 *   allow             → info
 *   warn / log_only   → low
 *   block / approval  → high
 */
export function riskLevelForVerdict(verdict: AiCallVerdict): AiCallEvidenceRiskLevel {
  switch (verdict) {
    case 'allow':
      return 'info';
    case 'warn':
    case 'log_only':
      return 'low';
    case 'block':
    case 'require_approval':
      return 'high';
  }
}

/** Bestimmt Residency und Provider-Region aus Provider-Kennung bzw. Vorgabe. */
export function resolveResidencyAndRegion(
  provider: string | null | undefined,
  residency?: AiCallResidency,
  providerRegion?: string,
): { residency: AiCallResidency; providerRegion: string } {
  const p = (provider ?? '').toLowerCase();
  const isCloudProvider = p === 'openai' || p === 'anthropic' || p === 'google';
  const resolvedResidency: AiCallResidency = residency ?? (isCloudProvider ? 'cloud' : 'eu_local');
  const resolvedRegion = providerRegion ?? (resolvedResidency === 'eu_local' ? 'EU' : 'cloud');
  return { residency: resolvedResidency, providerRegion: resolvedRegion };
}

/**
 * Baut den `ai_evidence_events`-Insert-Datensatz für einen angemeldeten KI-Call.
 * Enthält garantiert keinen Prompt- oder Antwort-Klartext.
 */
export async function buildAiCallEvidenceRow(
  args: BuildAiCallEvidenceArgs,
): Promise<AiEvidenceEventInsert> {
  const isBlocked = Boolean(
    args.blocked || args.verdict === 'block' || args.verdict === 'require_approval',
  );
  const verdict = normalizeVerdict(args.verdict, isBlocked);
  const eventType: AiCallEvidenceEventType = isBlocked ? 'ai:call_blocked' : 'ai:call';
  const riskLevel = riskLevelForVerdict(verdict);

  const inputTokens = nonNegativeInt(args.usage?.input_tokens ?? args.inputTokens);
  const outputTokens = nonNegativeInt(args.usage?.output_tokens ?? args.outputTokens);
  const rawTotal = args.usage?.total_tokens ?? args.totalTokens;
  const totalTokens = nonNegativeInt(rawTotal) > 0
    ? nonNegativeInt(rawTotal)
    : inputTokens + outputTokens;

  const { residency, providerRegion } = resolveResidencyAndRegion(
    args.provider,
    args.residency,
    args.providerRegion,
  );

  let inputLength = nonNegativeInt(args.inputLength);
  let inputSha256: string | null = args.inputSha256 ?? null;
  if (typeof args.input === 'string') {
    inputLength = args.input.length;
    inputSha256 = await sha256Hex(args.input);
  }

  const provider = args.provider ?? null;
  const model = args.model ?? args.modelProfile ?? null;
  const modelProfile = args.modelProfile ?? null;
  const subject = provider ? `${provider}/${model ?? 'unknown'}` : (model ?? 'unknown');

  const eventSummary = isBlocked
    ? `KI-Aufruf blockiert (${args.feature}): ${subject} [${verdict}]`
    : `KI-Aufruf (${args.feature}): ${subject} [${verdict}]`;

  return {
    tenant_id: args.tenantId,
    ai_system_id: args.aiSystemId ?? null,
    policy_id: args.policyId ?? null,
    event_type: eventType,
    event_summary: eventSummary,
    risk_level: riskLevel,
    evidence: {
      tenant_id: args.tenantId,
      path: args.path,
      user_id: args.userId ?? null,
      internal_caller: args.internalCaller ?? null,
      feature: args.feature,
      route: args.route,
      op: args.op ?? 'generate',
      provider,
      model,
      model_profile: modelProfile,
      provider_region: providerRegion,
      residency,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
      },
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      verdict,
      pdp_decision: verdict,
      reasons: Array.isArray(args.reasons) ? [...args.reasons] : [],
      policy_id: args.policyId ?? null,
      request_id: args.requestId ?? null,
      latency_ms: typeof args.latencyMs === 'number' && Number.isFinite(args.latencyMs)
        ? Math.max(0, Math.round(args.latencyMs))
        : null,
      input_length: inputLength,
      input_sha256: inputSha256,
    },
  };
}

/**
 * Schreibt einen vorbereiteten Evidence-Datensatz in `ai_evidence_events`.
 * Wirft bei DB-Fehlern, damit der Aufrufer das Fehlerverhalten (fail-open +
 * strukturiertes Alarm-Log) kontrolliert.
 */
export async function recordAiCallEvidence(
  admin: EvidenceAdminLike,
  row: AiEvidenceEventInsert,
): Promise<void> {
  const { error } = await admin
    .from('ai_evidence_events')
    .insert(row as unknown as Record<string, unknown>);
  if (error) {
    throw new Error(`ai_evidence_events insert failed: ${error.message}`);
  }
}
