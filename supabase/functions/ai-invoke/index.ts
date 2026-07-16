// AI tool invocation — thin HTTP wrapper around _shared/ai.ts.
//
// POST /functions/v1/ai-invoke
// Authorization: Bearer <user JWT>
// Body: { tenant_id: uuid, tool_key: string, input: string, metadata?: object }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { runAiTool, AiInvokeError } from '../_shared/ai.ts';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { recordUsage } from '../_shared/usage.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
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

  // Membership check via RLS
  const { data: member, error: memberErr } = await userClient
    .from('memberships').select('id')
    .eq('tenant_id', body.tenant_id).eq('user_id', userId).maybeSingle();
  if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message);
  if (!member)   return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const r = await runAiTool(admin, body.tenant_id, userId, body.tool_key, body.input, {
      metadata: body.metadata ?? {},
    });

    // Record token usage for metering
    // Total tokens = input + output (cached tokens don't count toward billing)
    const totalTokens = r.inputTokens + r.outputTokens;
    if (totalTokens > 0) {
      try {
        await recordUsage(admin, body.tenant_id, 'limit.ai_tokens_monthly', totalTokens, {
          run_id: r.runId,
          tool_key: body.tool_key,
          input_tokens: r.inputTokens,
          output_tokens: r.outputTokens,
          cached_tokens: r.cachedTokens,
          cost_usd: r.costUsd,
        });
      } catch (usageErr) {
        // Log but don't fail the request — token tracking is best-effort
        console.warn('Failed to record token usage:', usageErr);
      }
    }

    return jsonResponse({
      ok: true,
      run_id: r.runId,
      output: r.output,
      tokens: { input: r.inputTokens, output: r.outputTokens, cached: r.cachedTokens },
      cost_usd: r.costUsd,
      duration_ms: r.durationMs,
    });
  } catch (e) {
    if (e instanceof AiInvokeError) return jsonError(e.status, e.code, e.message, undefined, e.details);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
