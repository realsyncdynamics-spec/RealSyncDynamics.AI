// tenant-audit — authentifizierter Bridge zwischen `gdpr-audit` (anon
// Lead-Magnet, schreibt in `gdpr_audits`) und der neuen Pipeline aus
// PRs #426–#430 (`scan_runs` + `findings`).
//
// Warum eine eigene Edge Function statt `gdpr-audit` zu erweitern:
//   - `gdpr-audit` ist `verify_jwt=false` (Lead-Magnet, public). Wir
//     dürfen seinen Vertrag nicht aufweichen.
//   - Diese Function ist `verify_jwt=true` (auth-gated). Anrufer ist
//     ein eingeloggter Tenant-User, der für seinen Workspace einen
//     Scan triggert.
//   - Audit-Regeln bleiben Single-Source-of-Truth in `gdpr-audit`.
//     `tenant-audit` ruft `gdpr-audit` intern via HTTP und übersetzt
//     das Ergebnis in die Pipeline.
//
// Body:
//   { url: string, website_id?: string }
// Header:
//   Authorization: Bearer <supabase-jwt>
//   X-Tenant-Id: <tenant uuid> (Member-Check vor Pipeline-Start)
//
// Response:
//   { ok: true, scan_run_id, correlation_id, finding_count, severity_max,
//     gdpr_audit_id, score, severity }
//
// Storage:
//   scan_runs   ← startScanRun(detector='gdpr-audit')  (./pipeline.ts)
//   findings    ← recordScanFinding pro Issue (category-Guess via id)
//   gdpr_audits ← unverändert (durch internen gdpr-audit-Aufruf)
//   runtime_events ← emitRuntimeEvent() an den Scan-Lifecycle-Übergängen
//     (audit.scan_started / audit.scan_completed / audit.scan_failed)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { observeAal2 } from '../_shared/requireAal2.ts';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { runTenantAuditPipeline, type GdprAuditResponse } from './pipeline.ts';

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Issue → Finding-Mapping ist in _shared/audit-mapping.ts ausgelagert,
// damit Vitest die pure Heuristik testen kann (kein Deno-Runtime).
// Die Pipeline selbst (scan_run → findings → complete/fail) liegt in
// ./pipeline.ts — dort ist auch der Fix für den scan_run_id-Destructuring-Bug
// dokumentiert (test/edge/tenant-audit-pipeline.test.ts).

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST')    return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Auth: Bearer JWT muss vorhanden sein (Edge runtime hat verify_jwt=true,
  // setzt aber den User nicht automatisch ins admin-Client. Wir extrahieren
  // das Bearer-Token manuell, um die user_id zu bekommen.).
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'Bearer token required');
  }
  const jwt = authHeader.slice(7);
  if (!jwt) return jsonError(401, 'UNAUTHORIZED', 'empty Bearer token');

  // Tenant-Header
  const tenantId = req.headers.get('x-tenant-id') ?? '';
  if (!tenantId || !UUID_RE.test(tenantId)) {
    return jsonError(400, 'INVALID_TENANT', 'X-Tenant-Id header must be a valid UUID');
  }

  // Body
  let body: { url?: string; website_id?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const url = (body.url ?? '').trim();
  if (!url || !URL_RE.test(url)) return jsonError(400, 'INVALID_URL', 'valid http(s) URL required');
  if (url.length > 1000)         return jsonError(400, 'INVALID_URL', 'url too long');

  const websiteId = body.website_id ? body.website_id.trim() : null;
  if (websiteId && !UUID_RE.test(websiteId)) {
    return jsonError(400, 'INVALID_WEBSITE_ID', 'website_id must be a valid UUID');
  }

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // Membership-Check: user MUSS Mitglied des Tenants sein.
  // Wir verifizieren über das User-Token + memberships-Tabelle.
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  });
  const { data: userResult, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResult?.user) {
    return jsonError(401, 'UNAUTHORIZED', `invalid jwt: ${userErr?.message ?? 'no user'}`);
  }
  const userId = userResult.user.id;
  // P0d Phase 1 — OBSERVE ONLY: AAL2-Status protokollieren, NICHT blocken.
  observeAal2(authHeader, 'tenant-audit');

  const { data: membership, error: memErr } = await admin
    .from('memberships').select('role')
    .eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (memErr) return jsonError(500, 'INTERNAL', memErr.message);
  if (!membership) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  const result = await runTenantAuditPipeline({
    // deno-lint-ignore no-explicit-any
    admin: admin as any,
    callGdprAudit: async () => {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/gdpr-audit`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          // gdpr-audit ist verify_jwt=false, braucht aber email — wir nutzen
          // den user-email als technisches Identifikator (taucht im sales_lead
          // auf, der ohnehin Lead-Tracking ist; OK für authenticated path).
        },
        body: JSON.stringify({
          url,
          email:  userResult.user.email ?? 'no-email@tenant-audit',
          source: 'tenant-audit',
        }),
      });
      if (!r.ok) return { httpStatus: r.status, text: await r.text() };
      return await r.json() as GdprAuditResponse;
    },
    emit: (args) => emitRuntimeEvent(admin, { tenant_id: tenantId, ...args }),
  }, { tenantId, websiteId, url, userId });

  if (!result.ok) {
    const code = result.code === 'GDPR_AUDIT_HTTP' || result.code === 'GDPR_AUDIT_FETCH'
      ? 'DETECTOR_FAILED'
      : result.code === 'FINDING_INSERT' ? 'PIPELINE_INSERT_FAILED' : result.code;
    return jsonError(result.status, code, result.message);
  }

  return jsonResponse({
    ok:             true,
    scan_run_id:    result.scan_run_id,
    correlation_id: result.correlation_id,
    finding_count:  result.finding_count,
    severity_max:   result.severity_max,
    gdpr_audit_id:  result.gdpr_audit_id,
    score:          result.score,
    severity:       result.severity,
  });
});

// ─── helpers ─────────────────────────────────────────────────────────

// SupabaseAdminClient hier bewusst als struktureller Typ (nicht importiert)
// gehalten — spiegelt das Muster aus governance-vendors/governance-dsr, wo
// jede Function ihren eigenen minimalen runtime_events-Emitter trägt statt
// eine geteilte Abstraktion zu erzwingen (noch kein zweiter Nutzer, der die
// Form diktieren würde).
interface RuntimeEventAdminClient {
  from(table: string): {
    insert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  };
}

/**
 * Emittiert ein runtime_events-Event für den Audit-Scan-Lifecycle. Fehler
 * beim Emit werden geloggt, aber NICHT propagiert — ein Telemetrie-Ausfall
 * darf die eigentliche Scan-Pipeline nicht blockieren oder scheitern lassen.
 */
async function emitRuntimeEvent(admin: RuntimeEventAdminClient, args: {
  tenant_id: string;
  type: 'audit.scan_started' | 'audit.scan_completed' | 'audit.scan_failed';
  severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';
  correlation_id: string | null;
  payload: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await admin.from('runtime_events').insert({
      tenant_id: args.tenant_id,
      type: args.type,
      severity: args.severity ?? 'info',
      source: 'tenant-audit',
      // spec_version CHECK ist auf ('0.1','0.2') verschärft; der Spalten-
      // Default lag lange bei '1.0' (Fix in 20260626000000) — explizit
      // setzen, damit der Insert unabhängig von der Deploy-Reihenfolge gilt.
      spec_version: '0.2',
      correlation_id: args.correlation_id,
      payload: args.payload,
    });
    if (error) throw error;
  } catch (e) {
    console.error(JSON.stringify({
      level: 'error', scope: 'audit_runtime_event_emit_failed',
      event_type: args.type, tenant_id: args.tenant_id,
      error: (e as Error)?.message ?? String(e),
    }));
  }
}
