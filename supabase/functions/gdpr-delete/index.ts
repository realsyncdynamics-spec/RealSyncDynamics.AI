// GDPR Art. 17 — Recht auf Löschung.
//
// POST /functions/v1/gdpr-delete
// Authorization: Bearer <user JWT>
// Body: { confirm: "DELETE-MY-ACCOUNT" }   <- exact match required
//
// Reihenfolge:
//   1. JWT verify
//   2. Confirm-Phrase prüfen — Schutz gegen versehentliche Aufrufe
//   3. Pre-flight: User darf nicht alleiniger Owner eines Tenants sein
//      (sonst würden andere Members ihren Zugriff verlieren). 409 mit Liste
//      betroffener Tenants — User muss erst übertragen.
//   4. Audit-Logs anonymisieren (triggered_by/user_id → NULL):
//      preserves Compliance/Buchhaltung, entfernt PII-Verknüpfung.
//   5. Memberships hart löschen (eigene Rolle in Tenants).
//   6. auth.users löschen via admin API → CASCADE löscht profiles,
//      workflows (owner_id), c2pa_assets (owner_id) etc.
//
// Was bleibt nach Löschung (legitimes Interesse):
//   - workflow_runs / ai_tool_runs — Cost-Tracking, mit user_id=NULL
//   - audit_events — RLS-anonymisiert, aggregierte Abrechnung
//   - subscriptions — Buchhaltung 10 Jahre Pflicht (HGB/AO)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CONFIRM_PHRASE = 'DELETE-MY-ACCOUNT';

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
  const userEmail = userResp.user.email;

  let body: { confirm?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }
  if (body.confirm !== CONFIRM_PHRASE) {
    return jsonError(400, 'CONFIRM_REQUIRED',
      `Body muss { "confirm": "${CONFIRM_PHRASE}" } enthalten — Schutz vor versehentlicher Löschung.`);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ── Pre-flight: Tenants in denen User alleiniger Owner ist ────────────────
  const { data: ownerships, error: ownErr } = await admin
    .from('memberships')
    .select('tenant_id, tenant:tenants(name)')
    .eq('user_id', userId)
    .eq('role', 'owner');
  if (ownErr) return jsonError(500, 'INTERNAL', ownErr.message);

  const soleOwnerTenants: { tenant_id: string; name: string }[] = [];
  for (const ownership of ownerships ?? []) {
    const { count } = await admin
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', ownership.tenant_id)
      .eq('role', 'owner');
    if ((count ?? 0) === 1) {
      // deno-lint-ignore no-explicit-any
      soleOwnerTenants.push({ tenant_id: ownership.tenant_id, name: (ownership as any).tenant?.name ?? '?' });
    }
  }

  if (soleOwnerTenants.length > 0) {
    return jsonError(409, 'SOLE_OWNER',
      'Du bist alleiniger Owner mindestens eines Workspaces. Übertrage erst Ownership oder lösche den Workspace.',
      { sole_owner_of: soleOwnerTenants });
  }

  // ── Anonymisieren statt löschen (Audit-Retention) ─────────────────────────
  const anonymizations = await Promise.allSettled([
    admin.from('workflow_runs').update({ triggered_by: null }).eq('triggered_by', userId),
    admin.from('ai_tool_runs').update({ user_id: null }).eq('user_id', userId),
  ]);

  const anonymizationErrors = anonymizations
    .map((r, i) => r.status === 'rejected'
      ? { table: ['workflow_runs', 'ai_tool_runs'][i], error: String(r.reason) }
      : null)
    .filter(Boolean);

  // ── Memberships löschen ───────────────────────────────────────────────────
  const { error: memErr } = await admin.from('memberships').delete().eq('user_id', userId);
  if (memErr) return jsonError(500, 'INTERNAL', `memberships delete failed: ${memErr.message}`);

  // ── auth.users löschen — cascade-Delete via FK ────────────────────────────
  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) return jsonError(500, 'INTERNAL', `auth.deleteUser failed: ${authErr.message}`);

  return json({
    ok: true,
    deleted_user: { id: userId, email: userEmail },
    anonymized_tables: ['workflow_runs', 'ai_tool_runs'],
    cascade_deleted: ['profiles', 'memberships', 'workflows', 'c2pa_assets'],
    retained_for_legitimate_interest: ['workflow_runs (anonymized)', 'ai_tool_runs (anonymized)', 'subscriptions (HGB/AO 10 Jahre)'],
    anonymization_warnings: anonymizationErrors,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string, details?: unknown): Response {
  return json({ ok: false, error: { code, message, details } }, status);
}
