// Governance Connectors — authenticated, tenant-gated endpoint (deny-by-default).
//
// POST /functions/v1/governance-connectors
// Authorization: Bearer <user JWT>   (required)
// Body: { op: 'create' | 'update' | 'delete' | 'list', tenant_id, ... }
//
// SECURITY FIX
// ------------
// Dieser Endpoint war zuvor `verify_jwt=false` + Service-Role OHNE jeglichen
// Auth-/Tenant-Check — also oeffentlich unauthentifiziert mit RLS-Bypass.
// Jetzt deny-by-default: Bearer-Pflicht (401) + Owner/Admin-Membership-Gate (403).
// Muster gespiegelt von governance-approvals.
//
// STATUS: NICHT FUNKTIONAL VERDRAHTET (bewusst als gesicherter Stub belassen).
//   - Der Frontend-Caller (src/features/governance/connectorsApi.ts) sendet
//     `{ op: 'create' | 'update' | 'delete' }` und liest die real existierenden
//     `integration_connectors` / `remediation_actions`-Tabellen DIREKT via RLS.
//   - Der urspruengliche Stub war ein reiner Echo ohne Persistenz; eine
//     `governance_connectors`-Tabelle existiert nicht.
//   Bis Contract + Schema geklaert sind, antwortet diese Funktion ehrlich mit
//   501 NOT_IMPLEMENTED. Details: docs/ops/governance-edge-auth-gate.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const KNOWN_OPS = ['create', 'update', 'delete', 'list'];

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

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const op = (body.op ?? body.action) as string | undefined;
  const tenant_id = body.tenant_id as string | undefined;
  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });
  if (!(await isOwnerOrAdmin(admin, userResp.user.id, tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  if (!op || !KNOWN_OPS.includes(op)) return jsonError(400, 'BAD_REQUEST', 'unknown op');

  return jsonError(
    501,
    'NOT_IMPLEMENTED',
    'governance-connectors persistence is not wired; the SPA uses integration_connectors via RLS directly',
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
