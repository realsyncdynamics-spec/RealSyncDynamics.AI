// Enterprise AI OS — list recent agent runs.
//
// GET /functions/v1/enterprise-ai-os-agent-runs-list?tenantId=...&limit=20
// Authorization: Bearer <user JWT>   (required)
//
// Returns recent agent runs ordered by created_at DESC. Optional
// tenant filter via ?tenantId. limit clamped to [1, 100].
//
// SECURITY (Stopgap, siehe docs/ops/enterprise-ai-os-exposure-findings.md):
// War zuvor verify_jwt=false + Service-Role ohne Auth -> oeffentlicher
// Cross-Tenant-Read. Jetzt: Bearer-Pflicht (401) + Query laeuft unter
// Anon-Key + weitergereichter JWT, d.h. RLS greift und scoped auf das, was der
// Aufrufer sehen darf. Kein Service-Role mehr.

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

  // Anon key + forwarded JWT → RLS applies, tenant-scoped to the caller.
  const sb = createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await sb.auth.getUser();
  if (userErr || !userResp.user) return json(401, { error: 'invalid token' });

  const parsedUrl = new URL(req.url);
  const tenantId = parsedUrl.searchParams.get('tenantId');
  const limitParam = Number.parseInt(parsedUrl.searchParams.get('limit') ?? '20', 10);
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 20, 1), 100);

  let query = sb
    .from('enterprise_agent_runs')
    .select('id, tenant_id, agent_id, actor, status, summary, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { data, error } = await query;
  if (error) return json(500, { error: error.message });

  return json(200, { runs: data ?? [] });
});
