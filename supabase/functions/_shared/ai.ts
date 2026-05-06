// Programmatic invocation of an AI tool — same pipeline as the ai-invoke
// HTTP function, but callable directly from another edge function.
//
// Pipeline:
//   gateFeature(ai.tool.<key> | tool.required_entitlement_key)
//   pre-check call/token quota
//   callProvider
//   ai_tool_runs INSERT (success or error)
//   recordUsage  ai_calls / ai_tokens / ai_cost_cents (non-throwing)

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { gateFeature, EntitlementError } from './entitlements.ts';
import { recordUsage, getCurrentTotal, UsageError } from './usage.ts';
import { callProvider, ProviderError } from './providers.ts';

export interface RunAiToolOptions {
  /** Forwarded to ai_tool_runs.metadata. */
  metadata?: Record<string, unknown>;
  /** Override the tool's input character cap (default 200000). */
  maxInputChars?: number;
}

export interface RunAiToolResult {
  ok: true;
  runId: string | null;
  output: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
  durationMs: number;
}

export class AiInvokeError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(message: string, code = 'INTERNAL', status = 500, details?: unknown) {
    super(message); this.code = code; this.status = status; this.details = details;
  }
}

interface ToolRow {
  id: string;
  key: string;
  model_provider: 'anthropic' | 'google' | 'openai' | 'ollama';
  model_id: string;
  ollama_model_id: string | null;
  system_prompt: string | null;
  max_tokens: number;
  temperature: number;
  cost_input_per_million_usd: number;
  cost_output_per_million_usd: number;
  required_entitlement_key: string | null;
  enabled: boolean;
}

type Residency = 'cloud' | 'eu_local';

async function resolveResidency(
  admin: SupabaseClient,
  tenantId: string,
  userId: string | null,
): Promise<Residency> {
  const { data, error } = await admin.rpc('resolve_ai_residency', {
    p_tenant_id: tenantId,
    p_user_id: userId,
  });
  if (error) {
    console.error('resolve_ai_residency failed, defaulting to cloud:', error.message);
    return 'cloud';
  }
  return data === 'eu_local' ? 'eu_local' : 'cloud';
}

export async function runAiTool(
  admin: SupabaseClient,
  tenantId: string,
  userId: string | null,
  toolKey: string,
  input: string,
  opts: RunAiToolOptions = {},
): Promise<RunAiToolResult> {
  const maxInputChars = opts.maxInputChars ?? 200_000;
  if (typeof input !== 'string') throw new AiInvokeError('input must be a string', 'BAD_REQUEST', 400);
  if (input.length > maxInputChars) {
    throw new AiInvokeError(`input too large (>${maxInputChars} chars)`, 'BAD_REQUEST', 400);
  }

  const { data: tool, error: toolErr } = await admin
    .from('ai_tools').select('*')
    .eq('key', toolKey).maybeSingle<ToolRow>();
  if (toolErr) throw new AiInvokeError(toolErr.message, 'INTERNAL', 500);
  if (!tool || !tool.enabled) {
    throw new AiInvokeError(`tool ${toolKey} not available`, 'NOT_FOUND', 404);
  }

  // Boolean entitlement
  const requiredKey = tool.required_entitlement_key ?? `ai.tool.${tool.key}`;
  try {
    await gateFeature(admin, tenantId, requiredKey);
  } catch (e) {
    if (e instanceof EntitlementError) {
      throw new AiInvokeError(e.message, e.code, 403);
    }
    throw e;
  }

  // Pre-check token + call quotas
  const inputCharEstimate = (tool.system_prompt?.length ?? 0) + input.length;
  const estimatedInputTokens = Math.ceil(inputCharEstimate / 4);
  const projectedTokens = estimatedInputTokens + tool.max_tokens;

  const [{ data: entRows }, currentTokens, currentCalls] = await Promise.all([
    admin.rpc('tenant_entitlements', { p_tenant_id: tenantId }),
    getCurrentTotal(admin, tenantId, 'limit.ai_tokens_monthly'),
    getCurrentTotal(admin, tenantId, 'limit.ai_calls_monthly'),
  ]);

  // deno-lint-ignore no-explicit-any
  const limits = Object.fromEntries(((entRows ?? []) as any[]).map((r) => [r.key, r.value as number]));
  const tokenLimit = limits['limit.ai_tokens_monthly'];
  const callLimit  = limits['limit.ai_calls_monthly'];

  if (typeof callLimit === 'number' && callLimit !== -1 && currentCalls + 1 > callLimit) {
    throw new AiInvokeError('monthly AI call quota reached', 'QUOTA_EXCEEDED', 402, {
      current: currentCalls, limit: callLimit, source: 'plan',
    });
  }
  if (typeof tokenLimit === 'number' && tokenLimit !== -1 && currentTokens + projectedTokens > tokenLimit) {
    throw new AiInvokeError('monthly AI token quota would be exceeded', 'QUOTA_EXCEEDED', 402, {
      current: currentTokens, projected: projectedTokens, limit: tokenLimit, source: 'plan',
    });
  }

  // Resolve effective data residency (tenant policy > user pref > default 'cloud')
  // and override the tool's provider when the caller opted into eu_local routing.
  const residency = await resolveResidency(admin, tenantId, userId);
  let effectiveProvider = tool.model_provider;
  let effectiveModelId  = tool.model_id;
  if (residency === 'eu_local') {
    if (!tool.ollama_model_id) {
      throw new AiInvokeError(
        `tool ${tool.key} is not available in EU-local mode`,
        'LOCAL_UNAVAILABLE',
        503,
        { tool_key: tool.key },
      );
    }
    effectiveProvider = 'ollama';
    effectiveModelId  = tool.ollama_model_id;
  }

  // Call provider
  const start = performance.now();
  try {
    const result = await callProvider({
      provider: effectiveProvider,
      modelId: effectiveModelId,
      systemPrompt: tool.system_prompt,
      userPrompt: input,
      maxTokens: tool.max_tokens,
      temperature: tool.temperature,
    });
    const durationMs = Math.round(performance.now() - start);

    // Local inference is free at the per-call level (paid for via VPS),
    // so zero-out cost when the residency override kicked in.
    const costUsd = effectiveProvider === 'ollama'
      ? 0
      : (result.inputTokens / 1_000_000) * Number(tool.cost_input_per_million_usd) +
        (result.outputTokens / 1_000_000) * Number(tool.cost_output_per_million_usd);

    const { data: run } = await admin.from('ai_tool_runs').insert({
      tenant_id: tenantId,
      tool_id: tool.id,
      tool_key: tool.key,
      user_id: userId,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cached_tokens: result.cachedTokens,
      cost_usd: costUsd,
      duration_ms: durationMs,
      status: 'success',
      metadata: { ...(opts.metadata ?? {}), residency, provider: effectiveProvider },
    }).select('id').single();

    const totalTokens = result.inputTokens + result.outputTokens;
    const meta = { tool_key: tool.key, run_id: run?.id };
    try {
      await Promise.all([
        recordUsage(admin, tenantId, 'limit.ai_calls_monthly', 1, meta),
        recordUsage(admin, tenantId, 'limit.ai_tokens_monthly', totalTokens, meta),
        recordUsage(admin, tenantId, 'limit.ai_cost_monthly_cents', Math.round(costUsd * 100), meta),
      ]);
    } catch (e) {
      console.error('usage recordUsage failed', (e as Error).message);
    }

    return {
      ok: true,
      runId: run?.id ?? null,
      output: result.text,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cachedTokens: result.cachedTokens,
      costUsd: Number(costUsd.toFixed(6)),
      durationMs,
    };
  } catch (e) {
    const durationMs = Math.round(performance.now() - start);
    const code = e instanceof ProviderError ? e.code
                : e instanceof UsageError ? e.code
                : e instanceof AiInvokeError ? e.code
                : 'INTERNAL';
    const message = (e as Error).message ?? String(e);

    await admin.from('ai_tool_runs').insert({
      tenant_id: tenantId,
      tool_id: tool.id,
      tool_key: tool.key,
      user_id: userId,
      duration_ms: durationMs,
      status: 'error',
      error_code: code,
      error_message: message,
      metadata: { ...(opts.metadata ?? {}), residency, provider: effectiveProvider },
    });

    const status = code === 'PROVIDER_NOT_CONFIGURED' ? 503
                 : code === 'PROVIDER_NOT_IMPLEMENTED' ? 501
                 : code === 'PROVIDER_ERROR' ? 502
                 : code === 'QUOTA_EXCEEDED' ? 402
                 : code === 'LOCAL_UNAVAILABLE' ? 503
                 : 500;
    throw new AiInvokeError(message, code, status);
  }
}
