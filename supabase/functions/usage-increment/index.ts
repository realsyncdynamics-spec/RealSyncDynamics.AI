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
// Authorization model: the user must be an owner or admin of the tenant
// (memberships probed with the user's JWT; RLS enforces membership), and the
// entitlement key must be a known, non-metered key (see policy.ts).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { consumeUsage, UsageError } from '../_shared/usage.ts';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { parseDelta } from './delta.ts';
import { checkEntitlementKey, checkRole, isWellFormedKey } from './policy.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
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

  let body: { tenant_id?: string; entitlement_key?: string; delta?: unknown; metadata?: Record<string, unknown> };
  try { body = await req.json(); }
  catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  if (!body.tenant_id || !body.entitlement_key) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id and entitlement_key required');
  }
  const parsed = parseDelta(body.delta);
  if (!parsed.ok) return jsonError(parsed.status, parsed.code, parsed.message);
  const delta = parsed.delta;

  if (!isWellFormedKey(body.entitlement_key)) {
    return jsonError(400, 'BAD_REQUEST', 'unknown entitlement_key');
  }
  const entitlementKey = body.entitlement_key;

  // Membership + role check via user's JWT (RLS does the actual gate)
  const { data: member, error: memberErr } = await userClient
    .from('memberships')
    .select('id, role')
    .eq('tenant_id', body.tenant_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (memberErr) return jsonError(500, 'INTERNAL', 'membership lookup failed');
  if (!member)   return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
  const roleCheck = checkRole(member.role);
  if (!roleCheck.ok) return jsonError(roleCheck.status, roleCheck.code, roleCheck.message);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Only known, non-metered keys may be reported by clients (fail-closed).
  const { data: keyConfig, error: keyErr } = await admin
    .from('usage_limits_config')
    .select('billing_mode')
    .eq('entitlement_key', entitlementKey)
    .maybeSingle();
  if (keyErr) return jsonError(500, 'INTERNAL', 'entitlement lookup failed');
  const keyCheck = checkEntitlementKey(entitlementKey, keyConfig);
  if (!keyCheck.ok) return jsonError(keyCheck.status, keyCheck.code, keyCheck.message);

  try {
    const snap = await consumeUsage(
      admin,
      body.tenant_id,
      entitlementKey,
      delta,
      body.metadata ?? {},
    );
    return jsonResponse({
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
      return jsonError(status, e.code, e.message, undefined, e.details);
    }
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

