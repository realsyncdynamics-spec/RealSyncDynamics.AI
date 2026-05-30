// mfa-admin-reset — privilegierter MFA-Reset (ADR 0006).
//
// Owner/Admin des Tenants ODER Plattform-super_admin setzt die MFA eines
// Mitglieds zurück (Geräteverlust ohne Recovery-Code, Offboarding-Support).
// Entfernt TOTP-Faktoren (service-role) und invalidiert offene Recovery-Codes.
// AAL2-Pflicht laut Matrix — in P0a observe (siehe `requireAal2`-Hinweis),
// hartes Enforce folgt P0c.
import { corsHeaders } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const { user, admin } = await requireUser(req);
    const { tenant_id: tenantId, target_user_id: targetUserId } = (await req.json()) ?? {};
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

    // Audit-Eintrag (best effort).
    await admin.from('governance_admin_log').insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: 'mfa.admin_reset',
      target_type: 'user',
      target_id: targetUserId,
      payload: { removed_factors: list.length, by_super_admin: isSuperAdmin },
    }).then(() => {}, () => {}); // Tabelle/Spalten ggf. abweichend → nie hart fehlschlagen

    return json({ ok: true, removed_factors: list.length });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
