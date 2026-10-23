// GDPR Art. 17 — Recht auf Löschung.
//
// POST /functions/v1/gdpr-delete
// Authorization: Bearer <user JWT>
// Body: { confirm: "DELETE-MY-ACCOUNT" }   <- exact match required
//
// Reihenfolge:
//   1. JWT verify
//   2. Confirm-Phrase prüfen — Schutz gegen versehentliche Aufrufe
//   3. Pre-flight (Probelauf der RPC delete_sole_member_tenants): Workspaces,
//      deren einziger Owner der User ist, werden mitgelöscht — außer sie haben
//      weitere Mitglieder (409 SOLE_OWNER, erst übertragen), Stripe-Abrechnung
//      (409 BILLING_RETENTION) oder aufbewahrungspflichtige Nachweise
//      (409 WORKSPACE_RETAINED). FAIL CLOSED, nichts geändert (tenant-cleanup.ts).
//   4. Lead- und Scan-Daten der Adresse löschen bzw. anonymisieren
//      (RPC erase_lead_data: sales_leads, Scan-E-Mail, Mail-Serien,
//      Newsletter/Warteliste). FAIL CLOSED: Jeder Fehler — auch eine noch
//      nicht ausgerollte RPC — bricht ab, BEVOR am Konto etwas geändert ist
//      (lead-erasure.ts). Sonst bliebe die Adresse ohne Zuordnung zurück.
//   5. Audit-Logs anonymisieren (triggered_by/user_id → NULL):
//      preserves Compliance/Buchhaltung, entfernt PII-Verknüpfung.
//   5a. Ein-Personen-Workspaces löschen (dieselbe RPC, echter Lauf; prüft
//      unter Sperre erneut — eine Einladung seit Schritt 3 blockiert).
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
import { anonymizationFailures, checkLeadErasure } from './lead-erasure.ts';
import { checkTenantCleanup } from './tenant-cleanup.ts';

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

  // ── Pre-flight: eigene Ein-Personen-Workspaces (Probelauf, ändert nichts) ──
  const { data: tenantPlanData, error: tenantPlanErr } = await admin.rpc('delete_sole_member_tenants', {
    p_user_id: userId,
    p_dry_run: true,
  });
  const tenantPlan = checkTenantCleanup(tenantPlanData, tenantPlanErr);
  if (!tenantPlan.ok) {
    console.error('gdpr-delete: workspace pre-flight blocked', { code: tenantPlan.logCode });
    return jsonError(tenantPlan.status, tenantPlan.code, tenantPlan.message, undefined, tenantPlan.details);
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

  // ── Anonymisieren statt löschen (Audit-Retention) — fail closed ──────────
  // Ein Datenbankfehler kommt als `{ error }` zurück, nicht als abgelehntes
  // Promise; anonymizationFailures wertet beides aus. Scheitert eine
  // Anonymisierung, bleibt das Konto bestehen — sonst hingen Läufe an einer
  // gelöschten Person, die niemand mehr zuordnen oder bereinigen kann.
  const ANON_TABLES = ['workflow_runs', 'ai_tool_runs'] as const;
  const anonymizations = await Promise.allSettled([
    admin.from('workflow_runs').update({ triggered_by: null }).eq('triggered_by', userId),
    admin.from('ai_tool_runs').update({ user_id: null }).eq('user_id', userId),
  ]);
  const anonymizationErrors = anonymizationFailures(anonymizations, ANON_TABLES);
  if (anonymizationErrors.length > 0) {
    console.error('gdpr-delete: anonymization failed', { failures: anonymizationErrors });
    return jsonError(500, 'ANONYMIZATION_FAILED',
      'Die Löschung konnte nicht abgeschlossen werden. Ihr Konto besteht weiter; bitte versuchen Sie es später erneut.');
  }

  // ── Ein-Personen-Workspaces löschen — fail closed ────────────────────────
  // Die RPC prüft unter Sperre erneut. Scheitert sie jetzt, sind Lead-Daten
  // und Läufe schon bereinigt, das Konto besteht aber weiter.
  const { data: tenantDelData, error: tenantDelErr } = await admin.rpc('delete_sole_member_tenants', {
    p_user_id: userId,
    p_dry_run: false,
  });
  const tenantCleanup = checkTenantCleanup(tenantDelData, tenantDelErr);
  if (!tenantCleanup.ok) {
    console.error('gdpr-delete: workspace deletion failed', { code: tenantCleanup.logCode });
    return jsonError(tenantCleanup.status, tenantCleanup.code,
      'Die Löschung konnte nicht abgeschlossen werden. Dein Konto besteht weiter; bitte versuche es später erneut.',
      undefined, tenantCleanup.details);
  }

  // ── Memberships löschen ───────────────────────────────────────────────────
  const { error: memErr } = await admin.from('memberships').delete().eq('user_id', userId);
  if (memErr) {
    console.error('gdpr-delete: memberships delete failed', { code: memErr.code });
    return jsonError(500, 'INTERNAL', 'Die Löschung konnte nicht abgeschlossen werden.');
  }

  // ── auth.users löschen — cascade-Delete via FK ────────────────────────────
  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) {
    console.error('gdpr-delete: auth.deleteUser failed', { status: (authErr as { status?: number }).status ?? null });
    return jsonError(500, 'INTERNAL', 'Die Löschung konnte nicht abgeschlossen werden.');
  }

  return jsonResponse({
    ok: true,
    // Keine E-Mail-Adresse in der Antwort: Der Aufrufer kennt sie, und die
    // Antwort kann in Logs, Proxys oder Fehlerberichten landen.
    deleted_user: { id: userId },
    anonymized_tables: ['workflow_runs', 'ai_tool_runs'],
    cascade_deleted: ['profiles', 'memberships', 'workflows', 'c2pa_assets'],
    retained_for_legitimate_interest: ['workflow_runs (anonymized)', 'ai_tool_runs (anonymized)', 'subscriptions (HGB/AO 10 Jahre)'],
    lead_data: leadErasure.counts,
    // Anzahl gelöschter Ein-Personen-Workspaces (samt Mitgliedschaft und Free-Platzhalter).
    deleted_workspaces: tenantCleanup.tenants,
    // Zufällige Vorgangsnummer aus lead_erasure_log — Beleg ohne Personenbezug.
    erasure_receipt_id: leadErasure.receiptId,
  });
});
