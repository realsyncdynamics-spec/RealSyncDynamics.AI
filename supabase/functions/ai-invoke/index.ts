// AI tool invocation.
//
// POST /functions/v1/ai-invoke
// Authorization: Bearer <user JWT>
// Body: { tenant_id: uuid, tool_key: string, input: string, metadata?: object }
//
// Pipeline:
//   1. Verify caller, membership.
//   2. Load tool by key (must be enabled).
//   3. Gate boolean entitlement (ai.tool.<key> or tool.required_entitlement_key).
//   4. Pre-check projected token usage against limit.ai_tokens_monthly.
//      Reject early with 402 QUOTA_EXCEEDED if over.
//   5. Pre-check call quota against limit.ai_calls_monthly.
//   6. Call provider (Anthropic / Google).
//   7. Compute USD cost from token counts × tool's price columns.
//   8. Insert ai_tool_runs row (success or error).
//   9. Record usage_events for calls / tokens / cost (recordUsage — does NOT
//      throw on quota; the call already happened, accuracy beats blocking).
//  10. Return { run_id, output, tokens, cost_usd, duration_ms, warning? }.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { recordUsage, getCurrentTotal, UsageError } from '../_shared/usage.ts';
import { callProvider, ProviderError } from '../_shared/providers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ToolRow {
  id: string;
  key: string;
  name: string;
  model_provider: 'anthropic' | 'google' | 'openai';
  model_id: string;
  system_prompt: string | null;
  max_tokens: number;
  temperature: number;
  cost_input_per_million_usd: number;
  cost_output_per_million_usd: number;
  required_entitlement_key: string | null;
  enabled: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;

  let body: { tenant_id?: string; tool_key?: string; input?: string; metadata?: Record<string, unknown> };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }
  if (!body.tenant_id || !body.tool_key || typeof body.input !== 'string') {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id, tool_key, input required');
  }
  if (body.input.length > 200_000) {
    return jsonError(400, 'BAD_REQUEST', 'input too large (>200000 chars)');
  }

  // Membership check via RLS
  const { data: member, error: memberErr } = await userClient
    .from('memberships').select('id')
    .eq('tenant_id', body.tenant_id).eq('user_id', userId).maybeSingle();
  if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message);
  if (!member)   return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Load tool
  const { data: tool, error: toolErr } = await admin
    .from('ai_tools').select('*')
    .eq('key', body.tool_key).maybeSingle<ToolRow>();
  if (toolErr) return jsonError(500, 'INTERNAL', toolErr.message);
  if (!tool || !tool.enabled) return jsonError(404, 'NOT_FOUND', `tool ${body.tool_key} not available`);

  // Boolean entitlement
  const requiredKey = tool.required_entitlement_key ?? `ai.tool.${tool.key}`;
  try {
    await gateFeature(admin, body.tenant_id, requiredKey);
  } catch (e) {
    if (e instanceof EntitlementError) {
      return jsonError(403, e.code, e.message);
    }
    throw e;
  }

  // Pre-check token + call quotas
  const inputCharEstimate = (tool.system_prompt?.length ?? 0) + body.input.length;
  const estimatedInputTokens = Math.ceil(inputCharEstimate / 4);
  const projectedTokens = estimatedInputTokens + tool.max_tokens;

  const [{ data: entRows }, currentTokens, currentCalls] = await Promise.all([
    admin.rpc('tenant_entitlements', { p_tenant_id: body.tenant_id }),
    getCurrentTotal(admin, body.tenant_id, 'limit.ai_tokens_monthly'),
    getCurrentTotal(admin, body.tenant_id, 'limit.ai_calls_monthly'),
  ]);

  // deno-lint-ignore no-explicit-any
  const limits = Object.fromEntries(((entRows ?? []) as any[]).map((r) => [r.key, r.value as number]));
  const tokenLimit = limits['limit.ai_tokens_monthly'];
  const callLimit  = limits['limit.ai_calls_monthly'];

  if (typeof callLimit === 'number' && callLimit !== -1 && currentCalls + 1 > callLimit) {
    return jsonError(402, 'QUOTA_EXCEEDED', 'monthly AI call quota reached', {
      current: currentCalls, limit: callLimit, source: 'plan',
    });
  }
  if (typeof tokenLimit === 'number' && tokenLimit !== -1 && currentTokens + projectedTokens > tokenLimit) {
    return jsonError(402, 'QUOTA_EXCEEDED', 'monthly AI token quota would be exceeded', {
      current: currentTokens, projected: projectedTokens, limit: tokenLimit, source: 'plan',
    });
  }

  // Call the provider
  const start = performance.now();
  try {
    const result = await callProvider({
      provider: tool.model_provider,
      modelId: tool.model_id,
      systemPrompt: tool.system_prompt,
      userPrompt: body.input,
      maxTokens: tool.max_tokens,
      temperature: tool.temperature,
    });
    const durationMs = Math.round(performance.now() - start);

    const billableInput = result.inputTokens; // cached portion is included
    const costUsd =
      (billableInput / 1_000_000) * Number(tool.cost_input_per_million_usd) +
      (result.outputTokens / 1_000_000) * Number(tool.cost_output_per_million_usd);

    // Audit row
    const { data: run, error: runErr } = await admin.from('ai_tool_runs').insert({
      tenant_id: body.tenant_id,
      tool_id: tool.id,
      tool_key: tool.key,
      user_id: userId,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cached_tokens: result.cachedTokens,
      cost_usd: costUsd,
      duration_ms: durationMs,
      status: 'success',
      metadata: body.metadata ?? {},
    }).select('id').single();
    if (runErr) console.error('ai_tool_runs insert failed', runErr);

    // Usage counters — never throw, the call already happened
    const totalTokens = result.inputTokens + result.outputTokens;
    const meta = { tool_key: tool.key, run_id: run?.id };
    try {
      await Promise.all([
        recordUsage(admin, body.tenant_id, 'limit.ai_calls_monthly', 1, meta),
        recordUsage(admin, body.tenant_id, 'limit.ai_tokens_monthly', totalTokens, meta),
        recordUsage(admin, body.tenant_id, 'limit.ai_cost_monthly_cents', Math.round(costUsd * 100), meta),
      ]);
    } catch (e) {
      // Surface but do not fail the response.
      console.error('usage recordUsage failed', (e as Error).message);
    }

    // Soft-warning if we just crossed a configured soft_limit
    const newCallTotal = currentCalls + 1;
    const newTokenTotal = currentTokens + totalTokens;
    const warning =
      (typeof callLimit === 'number' && callLimit > 0 && newCallTotal >= callLimit * 0.9) ||
      (typeof tokenLimit === 'number' && tokenLimit > 0 && newTokenTotal >= tokenLimit * 0.9);

    return json({
      ok: true,
      run_id: run?.id,
      output: result.text,
      tokens: { input: result.inputTokens, output: result.outputTokens, cached: result.cachedTokens },
      cost_usd: Number(costUsd.toFixed(6)),
      duration_ms: durationMs,
      warning,
    });
  } catch (e) {
    const durationMs = Math.round(performance.now() - start);
    const code = e instanceof ProviderError ? e.code
                : e instanceof UsageError ? e.code
                : 'INTERNAL';
    const message = (e as Error).message ?? String(e);

    await admin.from('ai_tool_runs').insert({
      tenant_id: body.tenant_id,
      tool_id: tool.id,
      tool_key: tool.key,
      user_id: userId,
      duration_ms: durationMs,
      status: 'error',
      error_code: code,
      error_message: message,
      metadata: body.metadata ?? {},
    });

    const status = code === 'PROVIDER_NOT_CONFIGURED' ? 503
                 : code === 'PROVIDER_NOT_IMPLEMENTED' ? 501
                 : code === 'PROVIDER_ERROR' ? 502
                 : 500;
    return jsonError(status, code, message);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string, details?: unknown): Response {
  return json({ ok: false, error: { code, message, details } }, status);
}
