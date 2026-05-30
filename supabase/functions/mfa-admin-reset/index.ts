// mfa-admin-reset — privilegierter MFA-Reset (ADR 0006).
//
// Owner/Admin des Tenants ODER Plattform-super_admin setzt die MFA eines
// Mitglieds zurück (Geräteverlust ohne Recovery-Code, Offboarding-Support).
// Entfernt TOTP-Faktoren (service-role) und invalidiert offene Recovery-Codes.
// AAL2-Pflicht laut Matrix — in P0a observe (hartes Enforce folgt P0c).
//
// POST /functions/v1/mfa-admin-reset
// Authorization: Bearer <user JWT>   (verify_jwt=true, Default)
// Body: { tenant_id: string, target_user_id: string }
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'missing_authorization' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return json({ error: 'invalid_token' }, 401);
  const user = userResp.user;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  try {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
    const tenantId = body.tenant_id as string | undefined;
    const targetUserId = body.target_user_id as string | undefined;
    if (!tenantId || !targetUserId) return json({ error: 'missing_fields' }, 400);

    // Autorisierung: Plattform-super_admin ODER owner/admin des Tenants.
    const { data: caller } = await admin.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
    const isSuperAdmin = !!caller?.is_super_admin;

    if (!isSuperAdmin) {
      const { data: m } = await admin
        .from('memberships').select('role')
        .eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
      if (!m || !['owner', 'admin'].includes(m.role as string)) return json({ error: 'forbidden' }, 403);
    }

    // Ziel muss Mitglied desselben Tenants sein (kein Cross-Tenant-Reset).
    const { data: targetMembership } = await admin
      .from('memberships').select('id')
      .eq('tenant_id', tenantId).eq('user_id', targetUserId).maybeSingle();
    if (!targetMembership) return json({ error: 'target_not_in_tenant' }, 404);

    // Offene Recovery-Codes des Ziels invalidieren.
    await admin.from('mfa_recovery_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', targetUserId).is('used_at', null);

    // TOTP-Faktoren des Ziels entfernen.
    // deno-lint-ignore no-explicit-any
    const { data: factors } = await (admin as any).auth.admin.mfa.listFactors({ userId: targetUserId });
    const list = factors?.factors ?? [];
    for (const f of list) {
      // deno-lint-ignore no-explicit-any
      await (admin as any).auth.admin.mfa.deleteFactor({ userId: targetUserId, id: f.id });
    }

    // Audit-Eintrag (best effort — Tabelle/Spalten ggf. abweichend, nie hart fehlschlagen).
    await admin.from('governance_admin_log').insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: 'mfa.admin_reset',
      target_type: 'user',
      target_id: targetUserId,
      payload: { removed_factors: list.length, by_super_admin: isSuperAdmin },
    }).then(() => {}, () => {});

    return json({ ok: true, removed_factors: list.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
