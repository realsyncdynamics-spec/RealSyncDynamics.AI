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
//   4. Lead- und Scan-Daten der Adresse löschen bzw. anonymisieren
//      (RPC erase_lead_data: sales_leads, Scan-E-Mail, Mail-Serien,
//      Newsletter/Warteliste). FAIL CLOSED: Jeder Fehler — auch eine noch
//      nicht ausgerollte RPC — bricht ab, BEVOR am Konto etwas geändert ist
//      (lead-erasure.ts). Sonst bliebe die Adresse ohne Zuordnung zurück.
//   5. Audit-Logs anonymisieren (triggered_by/user_id → NULL):
//      preserves Compliance/Buchhaltung, entfernt PII-Verknüpfung.
//   5b. Memberships hart löschen (eigene Rolle in Tenants).
//   6. auth.users löschen via admin API → CASCADE löscht profiles,
//      workflows (owner_id), c2pa_assets (owner_id) etc.
//
// Was bleibt nach Löschung (legitimes Interesse):
//   - workflow_runs / ai_tool_runs — Cost-Tracking, mit user_id=NULL
//   - audit_events — RLS-anonymisiert, aggregierte Abrechnung
//   - subscriptions — Buchhaltung 10 Jahre Pflicht (HGB/AO)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { observeAal2 } from '../_shared/requireAal2.ts';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { checkLeadErasure } from './lead-erasure.ts';

const CONFIRM_PHRASE = 'DELETE-MY-ACCOUNT';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
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
  // P0d Phase 1 — OBSERVE ONLY: AAL2-Status protokollieren, NICHT blocken.
  observeAal2(auth, 'gdpr-delete');

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
      undefined, { sole_owner_of: soleOwnerTenants });
  }

  // ── Lead-/Scan-Daten (Art. 17) — zuerst, fail closed ──────────────────────
  const { data: leadErasureData, error: eraseErr } = await admin.rpc('erase_lead_data', {
    p_email: userEmail ?? '',
    p_user_id: userId,
    p_origin: 'account_deletion',
  });
  const leadErasure = checkLeadErasure(leadErasureData, eraseErr);
  if (!leadErasure.ok) {
    console.error('gdpr-delete: erase_lead_data failed', { code: leadErasure.logCode });
    return jsonError(leadErasure.status, leadErasure.code, leadErasure.message);
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

  return jsonResponse({
    ok: true,
    // Keine E-Mail-Adresse in der Antwort: Der Aufrufer kennt sie, und die
    // Antwort kann in Logs, Proxys oder Fehlerberichten landen.
    deleted_user: { id: userId },
    anonymized_tables: ['workflow_runs', 'ai_tool_runs'],
    cascade_deleted: ['profiles', 'memberships', 'workflows', 'c2pa_assets'],
    retained_for_legitimate_interest: ['workflow_runs (anonymized)', 'ai_tool_runs (anonymized)', 'subscriptions (HGB/AO 10 Jahre)'],
    anonymization_warnings: anonymizationErrors,
    lead_data: leadErasure.counts,
  });
});
