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
//   scan_runs   ← startScanRun(detector='gdpr-audit')
//   findings    ← recordScanFinding pro Issue (category-Guess via id)
//   gdpr_audits ← unverändert (durch internen gdpr-audit-Aufruf)
//   runtime_events ← TODO (PR P0-impl-3 wired später automatisch)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { observeAal2 } from '../_shared/requireAal2.ts';
import {
  startScanRun,
  recordScanFinding,
  completeScanRun,
  failScanRun,
} from '../_shared/scan-pipeline.ts';
import {
  categoryFor,
  confidenceFor,
  evidenceLevelFor,
} from '../_shared/audit-mapping.ts';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface GdprAuditIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
  paragraph_ref?: string;
}

interface GdprAuditResponse {
  ok: boolean;
  audit_id: string;
  score: number;
  severity: string;
  domain: string;
  issues: GdprAuditIssue[];
  fetched_status: number | null;
  fetched: boolean;
  fetch_error: string | null;
}

// Issue → Finding-Mapping ist in _shared/audit-mapping.ts ausgelagert,
// damit Vitest die pure Heuristik testen kann (kein Deno-Runtime).

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

  // 1. Pipeline starten — bevor der eigentliche Scan läuft, damit wir
  //    den scan_run_id auch bei Detektor-Fehler reportable haben.
  const started = await startScanRun(admin, {
    tenant_id:  tenantId,
    website_id: websiteId,
    detector:   'gdpr-audit',
    raw_payload: { url, triggered_by: userId },
  });
  if ('error' in started) return jsonError(500, 'PIPELINE_START_FAILED', started.error);
  const { scan_run_id, correlation_id } = started;

  // 2. Internen gdpr-audit-Aufruf — Single-Source-of-Truth für die Regeln.
  let auditResp: GdprAuditResponse;
  try {
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
    if (!r.ok) {
      const text = await r.text();
      await failScanRun(admin, scan_run_id, 'GDPR_AUDIT_HTTP', `${r.status}: ${text.slice(0, 300)}`);
      return jsonError(502, 'DETECTOR_FAILED', `gdpr-audit returned ${r.status}`);
    }
    auditResp = await r.json() as GdprAuditResponse;
  } catch (e) {
    await failScanRun(admin, scan_run_id, 'GDPR_AUDIT_FETCH', String(e));
    return jsonError(502, 'DETECTOR_FAILED', `gdpr-audit fetch failed: ${(e as Error).message}`);
  }

  // 3. Issues → findings pumpen. Wir verschlucken einzelne Insert-Fehler
  //    NICHT — wenn ein Insert scheitert, gehen wir auf failScanRun und
  //    melden 500. Garantie: keine Halbdatenströme im Pipeline-Log.
  for (const issue of auditResp.issues) {
    const r = await recordScanFinding(admin, scan_run_id, correlation_id ?? '', {
      tenant_id:   tenantId,
      website_id:  websiteId,
      category:    categoryFor(issue.id),
      severity:    issue.severity,
      detector:    'gdpr-audit',
      summary:     issue.title.slice(0, 1000),
      raw_payload: {
        detail:        issue.detail,
        paragraph_ref: issue.paragraph_ref ?? null,
        original_id:   issue.id,
        source_audit_id: auditResp.audit_id,
      },
      confidence_score:    confidenceFor(issue.id),
      evidence_level:      evidenceLevelFor(issue.id),
      verification_status: 'unverified',
    });
    if (!r.ok) {
      await failScanRun(admin, scan_run_id, 'FINDING_INSERT', r.error ?? 'unknown');
      return jsonError(500, 'PIPELINE_INSERT_FAILED', r.error ?? 'unknown');
    }
  }

  // 4. Pipeline abschließen — count + severity_max werden DB-seitig
  //    aus den eben eingefügten findings aggregiert.
  const completed = await completeScanRun(admin, scan_run_id);
  if (!completed.ok) {
    return jsonError(500, 'PIPELINE_COMPLETE_FAILED', completed.error ?? 'unknown');
  }

  return jsonResponse({
    ok:             true,
    scan_run_id,
    correlation_id,
    finding_count:  completed.finding_count ?? auditResp.issues.length,
    severity_max:   completed.severity_max ?? null,
    gdpr_audit_id:  auditResp.audit_id,
    score:          auditResp.score,
    severity:       auditResp.severity,
  });
});

// ─── helpers ─────────────────────────────────────────────────────────
