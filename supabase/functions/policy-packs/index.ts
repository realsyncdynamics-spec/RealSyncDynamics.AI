// policy-packs — Aktivierung/Deaktivierung von Policy Packs pro Tenant.
//
// POST /functions/v1/policy-packs
// Auth: Authorization: Bearer <user JWT>
// Body: { op: 'activate' | 'deactivate', tenant_id, pack_id }
//
// Gate: policy.packs (ab Agency). Katalog + Abdeckung liest das Frontend
// RLS-sicher direkt (policy_pack_catalog/_controls sind global lesbar,
// framework_controls + asset_control_mappings ebenfalls).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { audit } from '../_shared/auditLog.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const op = String(body.op ?? '');
  const tenantId = String(body.tenant_id ?? '');
  const packId = String(body.pack_id ?? '');
  if (!['activate', 'deactivate'].includes(op)) return jsonError(400, 'BAD_REQUEST', 'op must be activate|deactivate');
  if (!tenantId || !packId) return jsonError(400, 'BAD_REQUEST', 'tenant_id and pack_id required');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: member } = await admin.from('memberships').select('user_id').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  try {
    await gateFeature(admin, tenantId, 'policy.packs');
  } catch (e) {
    if (e instanceof EntitlementError) return jsonError(402, 'PAYMENT_REQUIRED', 'Policy Packs sind erst ab Agency verfügbar.');
    return jsonError(500, 'INTERNAL', 'entitlement check failed');
  }

  try {
    // Pack muss existieren.
    const { data: pack } = await admin.from('policy_pack_catalog').select('id').eq('id', packId).maybeSingle();
    if (!pack) return jsonError(404, 'NOT_FOUND', 'unbekanntes Policy Pack');

    if (op === 'activate') {
      const { error } = await admin.from('policy_pack_activations')
        .upsert({ tenant_id: tenantId, pack_id: packId, created_by: userId }, { onConflict: 'tenant_id,pack_id' });
      if (error) return jsonError(500, 'INTERNAL', 'could not activate pack');
    } else {
      await admin.from('policy_pack_activations').delete().eq('tenant_id', tenantId).eq('pack_id', packId);
    }

    await audit(admin, {
      tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail,
      action: `policy_pack.${op}`, target_type: 'policy_pack', target_id: packId, payload: {},
    });

    return jsonResponse({ ok: true, pack_id: packId, activated: op === 'activate' });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'policy_packs_failed', op, error: (e as Error)?.message ?? String(e) }));
    return jsonError(500, 'INTERNAL', 'policy-packs operation failed');
  }
});
