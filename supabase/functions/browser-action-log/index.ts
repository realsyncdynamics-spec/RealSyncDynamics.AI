/**
 * browser-action-log — Prüfpfad für Aktionen des Governance-Browsers
 * (Vorschau geladen, Scan gestartet, Evidence erzeugt, extern geöffnet).
 *
 * Schreibt eine Zeile nach `browser_actions`. Die Tabelle erlaubt per RLS
 * nur SELECT für Mandantenmitglieder; der INSERT läuft mit Service Role.
 * Service Role umgeht RLS — deshalb entscheidet ausschließlich dieser
 * Handler, unter welchem Mandanten und welchem Akteur geschrieben wird.
 *
 * Autorisierung: `requireAuthAndTenant` aus `_shared/auth.ts`, derselbe
 * Resolver wie bei evidence-anchor, website-domain-manager und
 * website-operations-agent. Kein zweiter Auth-Pfad. `tenantId` aus dem Body
 * ist nur das Argument der Mitgliedschaftsprüfung; geschrieben wird der
 * geprüfte Wert. `actor_id` kommt aus der verifizierten Sitzung, nie aus dem
 * Body — ein Aufrufer kann keinen fremden Akteur benennen.
 *
 * Vorher lief die Function ohne jede Eingangsprüfung: jeder mit der URL
 * konnte Evidence-Zeilen samt frei gewähltem `evidence_hash` in beliebige
 * Mandanten schreiben. Sie bleibt in config.toml als `verify_jwt = false`
 * deklariert (Live-Zustand, Drift-Guard); das Plattform-Gate ließe den
 * Anon-Key ohnehin durch — die Prüfung hier ist die eigentliche Sperre.
 *
 * POST /functions/v1/browser-action-log
 * Authorization: Bearer <User-JWT>
 * Body: siehe BrowserActionPayload
 * 201 { success: true, id }
 */

import { corsHeaders, handleOptions, jsonError, jsonResponse, methodNotAllowed } from '../_shared/gateway.ts';
import { requireAuthAndTenant } from '../_shared/auth.ts';

// Muss mit dem CHECK-Constraint in
// supabase/migrations/20260526000100_browser_actions_observability.sql
// übereinstimmen. Ein unbekannter Wert scheitert dort ohnehin — hier wird er
// vorher mit 400 statt 500 beantwortet.
const BROWSER_ACTIONS = [
  'preview_load',
  'preview_error',
  'reload',
  'scan_start',
  'scan_complete',
  'evidence_generate',
  'open_external',
] as const;

const STATUSES = ['started', 'completed', 'failed', 'blocked'] as const;

type BrowserAction = (typeof BROWSER_ACTIONS)[number];
type ActionStatus = (typeof STATUSES)[number];

interface BrowserActionPayload {
  tenantId: string;
  sessionId: string;
  workflowId?: string;
  runId?: string;
  toolName?: string;
  browserAction: BrowserAction;
  status: ActionStatus;
  url?: string;
  httpStatus?: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  evidenceHash?: string;
  evidenceSizeBytes?: number;
  errorMessage?: string;
  errorCode?: string;
  browserUserAgent?: string;
  metadata?: Record<string, unknown>;
}

function isBrowserAction(v: unknown): v is BrowserAction {
  return typeof v === 'string' && (BROWSER_ACTIONS as readonly string[]).includes(v);
}

function isStatus(v: unknown): v is ActionStatus {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;

  if (req.method !== 'POST') return methodNotAllowed();

  let payload: BrowserActionPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid JSON body');
  }

  // Formprüfung ohne Wirkung — darf vor der Autorisierung stehen, weil sie
  // weder liest noch schreibt und nichts über fremde Mandanten verrät.
  if (!payload.sessionId || typeof payload.sessionId !== 'string') {
    return jsonError(400, 'BAD_REQUEST', 'sessionId is required');
  }
  if (!isBrowserAction(payload.browserAction)) {
    return jsonError(400, 'BAD_REQUEST', `browserAction must be one of ${BROWSER_ACTIONS.join(', ')}`);
  }
  if (!isStatus(payload.status)) {
    return jsonError(400, 'BAD_REQUEST', `status must be one of ${STATUSES.join(', ')}`);
  }

  // Autorisierung vor der ersten Wirkung. 401 ohne Sitzung, 403 ohne
  // Mitgliedschaft — beides entsteht in _shared/auth.ts.
  const auth = await requireAuthAndTenant(req, payload.tenantId);
  if (auth instanceof Response) return auth;

  const tenantId = auth.tenantId;
  const actorId = auth.user.id;

  const now = new Date().toISOString();
  const startedAt = payload.startedAt || now;
  const completedAt = payload.completedAt;

  let durationMs = payload.durationMs;
  if (startedAt && completedAt && !durationMs) {
    durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  }

  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    '';

  const { data, error } = await auth.admin
    .from('browser_actions')
    .insert({
      tenant_id: tenantId,
      actor_id: actorId,
      session_id: payload.sessionId,
      workflow_id: payload.workflowId || null,
      run_id: payload.runId || null,
      tool_name: payload.toolName || null,
      browser_action: payload.browserAction,
      status: payload.status,
      url: payload.url || null,
      http_status: payload.httpStatus || null,
      started_at: startedAt,
      completed_at: completedAt || null,
      duration_ms: durationMs || null,
      evidence_hash: payload.evidenceHash || null,
      evidence_size_bytes: payload.evidenceSizeBytes || null,
      error_message: payload.errorMessage || null,
      error_code: payload.errorCode || null,
      browser_user_agent: payload.browserUserAgent || req.headers.get('user-agent') || null,
      client_ip: clientIp,
      metadata: payload.metadata || {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('[browser-action-log] insert failed:', error.message);
    return jsonError(500, 'INTERNAL', 'failed to log browser action', corsHeaders, error.message);
  }

  return jsonResponse({ success: true, id: data?.id }, 201);
});
