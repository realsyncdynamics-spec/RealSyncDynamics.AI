// Governed AI Routing Layer (R2) — Observability mapping.
//
// Pure mapping from a gateway call (request + outcome) to an `ai_tool_runs`
// insert row. This is the deterministic, unit-tested core of R2; the actual
// database write lives in the Deno-only sink (`evidenceSink.ts`) so this
// module stays free of I/O, fetch and Deno APIs.
//
// The row shape mirrors the canonical writer in
// `supabase/functions/_shared/ai.ts` so gateway calls land in the same
// audit/cost trail as every other AI-tool invocation.
//
// Frontend mirror: src/core/ai-gateway/observability.ts — keep in sync.

import type {
  AiGatewayRequest,
  AiGatewayUsage,
  ModelProfile,
  ProviderId,
} from './types.ts';

/** ai_tool_runs.status CHECK constraint domain. */
export type ToolRunStatus = 'success' | 'error' | 'timeout' | 'quota_exceeded';

/** Outcome of a single gateway op, whether it succeeded or failed. */
export interface GatewayCallOutcome {
  status: ToolRunStatus;
  provider?: ProviderId;
  model?: string;
  profile?: ModelProfile;
  usage?: AiGatewayUsage;
  durationMs: number;
  traceId?: string;
  errorCode?: string;
  errorMessage?: string;
}

/** Insert row for public.ai_tool_runs. `tool_id` stays null — gateway calls
 * have no backing `ai_tools` row; `tool_key` carries the feature name. */
export interface ToolRunRow {
  tenant_id: string;
  tool_id: null;
  tool_key: string;
  user_id: string | null;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  cost_usd: number;
  duration_ms: number;
  status: ToolRunStatus;
  error_code?: string;
  error_message?: string;
  metadata: Record<string, unknown>;
}

// error_message is denormalised free text; cap it so a provider that returns
// a huge error body can't bloat the audit row.
const MAX_ERROR_MESSAGE = 2000;

/**
 * Build the ai_tool_runs row for a gateway call, or return null when the call
 * cannot be logged. A row is skipped (null) when `tenant_id` is absent, because
 * ai_tool_runs.tenant_id is NOT NULL and tenant-scoped by RLS — an untenanted
 * gateway call has no audit home and must not be forced under a placeholder.
 *
 * cost_usd is intentionally 0: per-token pricing lives on `ai_tools` rows and
 * is not known at the gateway layer. Token counts are still captured so a
 * downstream job can price them; recording a guessed cost here would be worse
 * than recording none.
 */
export function toToolRunRow(
  request: AiGatewayRequest,
  outcome: GatewayCallOutcome,
): ToolRunRow | null {
  const tenantId = request.tenant_id;
  if (!tenantId) return null;

  const metadata: Record<string, unknown> = {
    ...(request.metadata ?? {}),
    source: 'ai-gateway',
    task_type: request.task_type,
    model_profile: request.model_profile,
  };
  if (outcome.provider) metadata.provider = outcome.provider;
  if (outcome.model) metadata.model = outcome.model;
  if (outcome.traceId) metadata.trace_id = outcome.traceId;

  const row: ToolRunRow = {
    tenant_id: tenantId,
    tool_id: null,
    tool_key: request.feature,
    user_id: request.user_id ?? null,
    input_tokens: outcome.usage?.input_tokens ?? 0,
    output_tokens: outcome.usage?.output_tokens ?? 0,
    cached_tokens: 0,
    cost_usd: 0,
    duration_ms: Math.max(0, Math.round(outcome.durationMs)),
    status: outcome.status,
    metadata,
  };

  if (outcome.status !== 'success') {
    if (outcome.errorCode) row.error_code = outcome.errorCode;
    if (outcome.errorMessage) {
      row.error_message = outcome.errorMessage.slice(0, MAX_ERROR_MESSAGE);
    }
  }

  return row;
}

/**
 * Classify a thrown gateway error into a (status, code) pair for the audit row.
 * Mirrors the transport/rate-limit vocabulary the router already uses so the
 * logged status lines up with how the gateway actually treated the failure.
 */
export function classifyError(err: unknown): { status: ToolRunStatus; code: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (/timeout|aborted/i.test(message)) return { status: 'timeout', code: 'TIMEOUT' };
  if (/rate.?limit|HTTP 429/i.test(message)) return { status: 'quota_exceeded', code: 'RATE_LIMITED' };
  return { status: 'error', code: 'PROVIDER_ERROR' };
}
