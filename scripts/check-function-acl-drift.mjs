#!/usr/bin/env node
// Function-ACL-Drift-Guard.
//
// Verhindert die Wiederholung des Vorfalls vom 2026-08-23 (CLAUDE.md §5,
// Migration 20260826000001): Ein ausserhalb des Repos ausgefuehrter
// Bulk-REVOKE hatte ~160 public-Funktionen auf {postgres, service_role}
// reduziert und damit alle RLS-Policies fuer eingeloggte Nutzer gebrochen
// ("permission denied for function is_tenant_member" auf /welcome).
// Migrations- und Function-Existenz-Drift waren damals gedeckt — die ACLs
// prueft erst dieser Guard.
//
// Drei Pruefrichtungen:
//   1. PFLICHT: Client-Funktionen (RLS-Helper, SPA-RPCs, oeffentliche
//      Endpunkte) muessen fuer ihre Rollen EXECUTE haben. Fehlt eine →
//      exakt der 2026-08-23-Vorfall → FAIL. Fehlt die Funktion ganz
//      (damals: update_onboarding_progress gedroppt) → ebenfalls FAIL.
//   2. VERBOT: Sensible interne Funktionen (Secrets, Signing-Keys,
//      Queue-Worker-Claims) duerfen NIE fuer anon/authenticated aufrufbar
//      sein. Broadening → FAIL.
//   3. INFO: Alle uebrigen client-aufrufbaren Funktionen werden gezaehlt
//      und gelistet, aber nicht bemaengelt — Supabase-Default-Privileges
//      geben neuen Funktionen automatisch anon/authenticated, das ist
//      kein Drift, nur Sichtbarkeit.
//
// Quelle der Soll-Listen: supabase/migrations/20260826000001_restore_client_function_grants.sql.
// Wer per Migration Client-Grants aendert, zieht die Listen hier nach —
// der schedule-Lauf failt sonst am naechsten Morgen und sagt genau das.
//
// NICHT in den Pflichtlisten, obwohl das SPA sie per rpc() aufruft (Befund
// 2026-08-23, gegen Prod UND Repo geprueft): adjust_worker_pool,
// create_oauth2_app, create_workflow, get_rate_limit_status,
// get_worker_pool_metrics, log_seo_dashboard_operation,
// retry_failed_batch_items, revoke_oauth2_token, rotate_oauth2_secret,
// sync_workflow_status, update_workflow — diese Funktionen existieren weder
// in Prod noch in irgendeiner Migration. Die aufrufenden Frontend-Features
// schlagen mit PGRST202 fehl; das ist ein eigener Backend-fehlt-Befund
// (§14 „Funktionen funktionsfaehig machen"), kein ACL-Drift. Wer eine davon
// per Migration anlegt, traegt sie hier in die Pflichtliste ein.
//
// Zugriff: Supabase Management API (POST /v1/projects/{ref}/database/query)
// mit SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID — dieselben Secrets wie
// der Migrations-Drift-Guard, kein DB-Passwort und keine neue Dependency.
// Ohne Secrets (Fork-PRs) wird sauber uebersprungen (Exit 0).
// API-/Netz-Fehler failen NICHT hart (≠ Drift) — aber wie beim
// Migrations-Guard gibt es dann auch keinen gruenen Haken.

// ── Soll-Zustand (Spiegel von 20260826000001) ────────────────────────────────

// anon + authenticated: RLS-Helper und bewusst oeffentliche Endpunkte.
const REQUIRED_ANON = [
  'is_tenant_member',
  'is_tenant_owner_or_admin',
  'is_tenant_admin',
  'has_tenant_membership',
  'audit_share_get',
  'report_unknown_tracker',
  'affiliate_validate',
  'platform_stats',
  'health_ping',
];

// Nur authenticated: alles, was das SPA hinter Login per rpc() aufruft.
const REQUIRED_AUTHENTICATED = [
  'admin_customers_list',
  'admin_system_health',
  'analytics_funnel',
  'analytics_pageviews_daily',
  'analytics_sources',
  'analytics_top_pages',
  'bulk_scan_batch_progress',
  'compute_racpo',
  'compute_tenant_quadrant',
  // P2-1: Ohne diese beiden zeigt /app/governance/connectors keine Klasse mehr
  // an — und eine Seite, die Durchsetzbarkeit ausweisen soll, aber nichts
  // ausweist, ist schlimmer als keine. Genau dieser Ausfalltyp war der
  // ACL-Vorfall vom 2026-08-23 (Migration 20260904100000).
  'connector_enforcement_class',
  'connector_enforcement_summary',
  'create_api_key',
  'evidence_vault_timeline',
  'get_compliance_timeline',
  'governance_24h_summary',
  'governance_alerts_list',
  'governance_kpi_latest_snapshot',
  'governance_kpi_range',
  'governance_kpi_timeseries_data',
  'incident_correlation_export',
  'runtime_events_verify_chain',
  'siteos_site_overview',
  'tenant_entitlements',
  'update_onboarding_progress',
];

// Duerfen NIE von anon/authenticated aufrufbar sein. Quellen: die expliziten
// Lockdown-Migrationen (20260505230000, 20260506220000, 20260620000000,
// 20260603000000) — Secrets, Signing-Keys, Cron-/Worker-Interna.
const FORBIDDEN_CLIENT = [
  'get_app_secret',
  'set_app_secret',
  'creatorseal_insert_user_key',
  'creatorseal_load_user_key',
  'resolve_ai_residency',
  'prune_business_metric_snapshots',
  'rotate_subject_ref_key',
  'subject_ref_compute',
  'api_key_validate',
  'partner_validate_key',
  'legal_retrieve_chunks',
  'legal_retrieve_chunks_hybrid',
  'audit_jobs_claim_next',
  'audit_jobs_complete',
  'bulk_scan_claim_next',
  'distribution_queue_claim_next',
];

// ── Ausfuehrung ──────────────────────────────────────────────────────────────

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectId = process.env.SUPABASE_PROJECT_ID;

if (!token || !projectId) {
  console.log('ℹ️  Function-ACL-Drift-Check uebersprungen (keine Supabase-Secrets).');
  process.exit(0);
}

const ADVISORY = (process.env.FUNCTION_ACL_DRIFT_MODE ?? 'fail') === 'advisory';

const SQL = `
SELECT p.proname AS name,
       pg_get_function_identity_arguments(p.oid) AS args,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;`;

let rows;
try {
  const resp = await fetch(
    `https://api.supabase.com/v1/projects/${projectId}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: SQL }),
    },
  );
  if (!resp.ok) {
    throw new Error(`Management API antwortete ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }
  rows = await resp.json();
} catch (e) {
  console.error('⚠️  ACL-Abfrage nicht ausfuehrbar (Infra, kein Drift):', e.message);
  process.exit(0);
}

// Format-Wachhund wie beim Migrations-Guard: liefert die API keine einzige
// Funktionszeile, wurde NICHTS geprueft — dann keine Entwarnung ausgeben.
if (!Array.isArray(rows) || rows.length === 0) {
  console.error(
    '\n❌ Keine Funktionszeilen von der Management API erhalten — vermutlich hat\n' +
    'sich das Antwortformat geaendert. Es wurde KEINE Richtung geprueft;\n' +
    'Parser in scripts/check-function-acl-drift.mjs pruefen.',
  );
  process.exit(ADVISORY ? 0 : 1);
}

// Mehrere Overloads pro Name sind moeglich: PFLICHT gilt als erfuellt, wenn
// ALLE Overloads die Rolle haben (ein einzelner gesperrter Overload bricht
// PostgREST-RPC-Aufloesung genauso); VERBOT schlaegt an, sobald EIN Overload
// client-aufrufbar ist.
const byName = new Map();
for (const r of rows) {
  if (!byName.has(r.name)) byName.set(r.name, []);
  byName.get(r.name).push(r);
}

const missing = [];       // Richtung 1
const broadened = [];     // Richtung 2
const extraClient = [];   // Richtung 3 (nur Info)

const requiredAll = new Set([...REQUIRED_ANON, ...REQUIRED_AUTHENTICATED]);

for (const name of requiredAll) {
  const overloads = byName.get(name);
  if (!overloads) {
    missing.push(`${name} — Funktion existiert in Prod NICHT (gedroppt?)`);
    continue;
  }
  for (const o of overloads) {
    if (!o.auth_exec) missing.push(`${name}(${o.args}) — authenticated fehlt`);
    if (REQUIRED_ANON.includes(name) && !o.anon_exec) missing.push(`${name}(${o.args}) — anon fehlt`);
  }
}

for (const name of FORBIDDEN_CLIENT) {
  for (const o of byName.get(name) ?? []) {
    if (o.anon_exec || o.auth_exec) {
      const roles = [o.anon_exec && 'anon', o.auth_exec && 'authenticated'].filter(Boolean).join(', ');
      broadened.push(`${name}(${o.args}) — aufrufbar fuer: ${roles}`);
    }
  }
}

for (const [name, overloads] of byName) {
  if (requiredAll.has(name) || FORBIDDEN_CLIENT.includes(name)) continue;
  if (overloads.some((o) => o.anon_exec || o.auth_exec)) extraClient.push(name);
}

let failed = false;

if (missing.length > 0) {
  failed = true;
  console.error('\n❌ ACL-Drift (Richtung 1): Client-Funktionen ohne noetiges EXECUTE:');
  for (const m of missing) console.error(`   - ${m}`);
  console.error(
    '\nDas ist der 2026-08-23-Vorfall: RLS-Policies und SPA-RPCs brechen fuer\n' +
    'Nutzer mit "permission denied for function ..." (42501).\n' +
    'Fix: 20260826000001_restore_client_function_grants.sql erneut anwenden\n' +
    '(idempotent) — und klaeren, WER den Revoke ausserhalb des Repos ausfuehrt.',
  );
}

if (broadened.length > 0) {
  failed = true;
  console.error('\n❌ ACL-Drift (Richtung 2): gesperrte Funktionen sind client-aufrufbar:');
  for (const b of broadened) console.error(`   - ${b}`);
  console.error(
    '\nDiese Funktionen geben Secrets/Signing-Keys preis oder gehoeren Workern.\n' +
    'Fix: REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated per Migration\n' +
    '(Muster: 20260620000000_lockdown_internal_functions.sql).',
  );
}

if (failed) {
  if (ADVISORY) {
    console.error(
      '\n::warning::Function-ACL-Drift erkannt. Dieser Lauf ist advisory (pull_request) — ' +
      'der Drift betrifft den Zustand der Produktions-DB, nicht diesen PR. ' +
      'Der taegliche schedule-Lauf failt hart.',
    );
    process.exit(0);
  }
  process.exit(1);
}

console.log(
  `✅ Function-ACLs konsistent: ${requiredAll.size} Pflicht-Funktionen erreichbar, ` +
  `${FORBIDDEN_CLIENT.length} gesperrte Funktionen dicht.`,
);
if (extraClient.length > 0) {
  console.log(
    `ℹ️  ${extraClient.length} weitere client-aufrufbare Funktionen ausserhalb der ` +
    'Soll-Listen (Default-Privileges neuer Migrationen — kein Fehler, nur Sichtbarkeit):',
  );
  console.log(`   ${extraClient.join(', ')}`);
}
