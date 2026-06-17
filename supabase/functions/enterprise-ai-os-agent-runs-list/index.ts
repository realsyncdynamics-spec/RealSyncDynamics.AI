// Enterprise AI OS — list recent agent runs.
//
// GET /functions/v1/enterprise-ai-os-agent-runs-list?tenantId=...&limit=20
//
// Returns recent agent runs ordered by created_at DESC. Optional
// tenant filter via ?tenantId. limit clamped to [1, 100].

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';

const corsHeaders = buildCorsHeaders('GET, OPTIONS');

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'GET') return jsonResponse({ error: 'GET only' }, 405, corsHeaders);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return jsonResponse({ error: 'Supabase env vars missing' }, 500, corsHeaders);

  const parsedUrl = new URL(req.url);
  const tenantId = parsedUrl.searchParams.get('tenantId');
  const limitParam = Number.parseInt(parsedUrl.searchParams.get('limit') ?? '20', 10);
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 20, 1), 100);

  const sb = createClient(url, serviceKey);
  let query = sb
    .from('enterprise_agent_runs')
    .select('id, tenant_id, agent_id, actor, status, summary, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 500, corsHeaders);

  return jsonResponse({ runs: data ?? [] }, 200, corsHeaders);
});
