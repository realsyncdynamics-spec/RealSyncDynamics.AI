// Enterprise AI OS — list unapproved (pending) AI systems.
//
// GET /functions/v1/enterprise-ai-os-discovery-pending?tenantId=...&limit=50
// Authorization: Bearer <user JWT>   (required)
//
// Returns rows from enterprise_ai_system_registry with approved=false,
// ordered by created_at DESC.
//
// SECURITY (Stopgap, siehe docs/ops/enterprise-ai-os-exposure-findings.md):
// War zuvor verify_jwt=false + Service-Role ohne Auth -> oeffentlicher
// Cross-Tenant-Read (inkl. PII-Flags). Jetzt: Bearer-Pflicht (401) + Query
// unter Anon-Key + weitergereichter JWT, d.h. RLS greift und scoped auf den
// Aufrufer. Kein Service-Role mehr.

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

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json(401, { error: 'missing bearer token' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json(500, { error: 'Supabase env vars missing' });

  const sb = createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await sb.auth.getUser();
  if (userErr || !userResp.user) return json(401, { error: 'invalid token' });

  const parsedUrl = new URL(req.url);
  const tenantId = parsedUrl.searchParams.get('tenantId');
  const limitParam = Number.parseInt(parsedUrl.searchParams.get('limit') ?? '50', 10);
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 50, 1), 200);

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
