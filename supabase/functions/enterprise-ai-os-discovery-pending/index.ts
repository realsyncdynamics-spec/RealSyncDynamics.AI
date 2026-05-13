// Enterprise AI OS — list unapproved (pending) AI systems.
//
// GET /functions/v1/enterprise-ai-os-discovery-pending?tenantId=...&limit=50
//
// Returns rows from enterprise_ai_system_registry with approved=false,
// ordered by risk_level severity (prohibited → high → limited → minimal
// → unknown), then created_at DESC.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'GET') return json(405, { error: 'GET only' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(500, { error: 'Supabase env vars missing' });

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
  if (error) return json(500, { error: error.message });

  return json(200, { pending: data ?? [] });
});
