// Enterprise AI OS — list unapproved (pending) AI systems.
//
// GET /functions/v1/enterprise-ai-os-discovery-pending?tenantId=...&limit=50
//
// Returns rows from enterprise_ai_system_registry with approved=false,
// ordered by risk_level severity (prohibited → high → limited → minimal
// → unknown), then created_at DESC.

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
  const limitParam = Number.parseInt(parsedUrl.searchParams.get('limit') ?? '50', 10);
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 50, 1), 200);

  const sb = createClient(url, serviceKey);
  let query = sb
    .from('enterprise_ai_system_registry')
    .select('id, tenant_id, name, provider, model, usage_context, department, risk_level, contains_personal_data, contains_sensitive_data, external_usage, intake_source, created_at')
    .eq('approved', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 500, corsHeaders);

  return jsonResponse({ pending: data ?? [] }, 200, corsHeaders);
});
