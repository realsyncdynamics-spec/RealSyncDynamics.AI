// Governance Incidents — authenticated, tenant-gated endpoint (deny-by-default).
//
// POST /functions/v1/governance-incidents
// Authorization: Bearer <user JWT>   (required)
// Body: { op: 'create' | 'transition' | 'list', tenant_id, ... }
//
// SECURITY FIX
// ------------
// Dieser Endpoint war zuvor `verify_jwt=false` + Service-Role OHNE jeglichen
// Auth-/Tenant-Check — also oeffentlich unauthentifiziert mit RLS-Bypass.
// Jetzt deny-by-default: Bearer-Pflicht (401), Owner/Admin-Membership-Gate (403),
// tenant_id-Scoping. Muster gespiegelt von governance-approvals.
//
// STATUS: NICHT FUNKTIONAL VERDRAHTET (bewusst als gesicherter Stub belassen).
//   - Der Frontend-Caller (src/features/governance/incidentsApi.ts) sendet
//     `{ op: 'create' | 'transition' }` und liest die real existierende
//     `public.incidents`-Tabelle DIREKT via RLS — nicht ueber diese Funktion.
//   - Der urspruengliche Stub schrieb in `public.governance_incidents`, eine
//     Tabelle ohne Migration, die auf der Live-DB nicht existiert.
//   Bis Contract + Schema geklaert sind, antwortet diese Funktion ehrlich mit
//   501 NOT_IMPLEMENTED statt Feature-Verhalten vorzutaeuschen. Details:
//   docs/ops/governance-edge-auth-gate.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const KNOWN_OPS = ['create', 'transition', 'list'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SRK) {
    return jsonError(500, 'CONFIG', 'missing Supabase environment variables');
  }

  // Verify the caller's JWT via an anon client carrying the forwarded token.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  // Tolerate both the frontend key (`op`) and the legacy stub key (`action`).
  const op = (body.op ?? body.action) as string | undefined;
  const tenant_id = body.tenant_id as string | undefined;
  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });
  if (!(await isOwnerOrAdmin(admin, userResp.user.id, tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  if (!op || !KNOWN_OPS.includes(op)) return jsonError(400, 'BAD_REQUEST', 'unknown op');

  // Auth + tenant verified. Feature persistence not yet wired (see header).
  return jsonError(
    501,
    'NOT_IMPLEMENTED',
    'governance-incidents persistence is not wired; the SPA uses the incidents table via RLS directly',
  );
});

// deno-lint-ignore no-explicit-any
async function isOwnerOrAdmin(admin: any, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships')
    .select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return data?.role === 'owner' || data?.role === 'admin';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
