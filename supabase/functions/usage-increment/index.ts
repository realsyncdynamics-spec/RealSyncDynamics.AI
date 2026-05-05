// Usage increment endpoint.
//
// POST /functions/v1/usage-increment
// Authorization: Bearer <user JWT>
// Body: { tenant_id: uuid, entitlement_key: string, delta?: number, metadata?: object }
//
// Returns { ok, total, hard_limit, soft_limit, billing_mode, warning } on
// success, or { ok: false, error: { code, message, details } } on quota /
// validation errors.
//
// Authorization model: the user must be a member of the tenant. We verify by
// reading the JWT, then probing memberships with the same JWT (RLS enforces
// the membership constraint).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { consumeUsage, UsageError } from '../_shared/usage.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

  let body: { tenant_id?: string; entitlement_key?: string; delta?: number; metadata?: Record<string, unknown> };
  try { body = await req.json(); }
  catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  if (!body.tenant_id || !body.entitlement_key) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id and entitlement_key required');
  }
  const delta = Math.trunc(body.delta ?? 1);
  if (!Number.isFinite(delta) || delta === 0) {
    return jsonError(400, 'BAD_REQUEST', 'delta must be a non-zero integer');
  }
  if (Math.abs(delta) > 1_000_000) {
    return jsonError(400, 'BAD_REQUEST', 'delta out of range');
  }

  // Membership check via user's JWT (RLS does the actual gate)
  const { data: member, error: memberErr } = await userClient
    .from('memberships')
    .select('id')
    .eq('tenant_id', body.tenant_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message);
  if (!member)   return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const snap = await consumeUsage(
      admin,
      body.tenant_id,
      body.entitlement_key,
      delta,
      body.metadata ?? {},
    );
    return json({
      ok: true,
      total: snap.total,
      hard_limit: snap.hardLimit,
      soft_limit: snap.softLimit,
      billing_mode: snap.billingMode,
      warning: snap.warning,
    });
  } catch (e) {
    if (e instanceof UsageError) {
      const status = e.code === 'QUOTA_EXCEEDED' ? 402 : 500;
      return jsonError(status, e.code, e.message, e.details);
    }
    return jsonError(500, 'INTERNAL', (e as Error).message);
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
