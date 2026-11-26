// siteos/code-preview — Laufzeit-Vorschau per Sandbox (SPIKE 22.11.2026).
//
// POST /functions/v1/siteos/code-preview
// Auth: Authorization: Bearer <user JWT>
// Body: { op: 'start'|'heartbeat'|'stop', tenant_id, project_id?, session_id?, reason? }
//
// Fail-closed in drei Stufen:
//   1. Ohne APP_BUILDER_SANDBOX_PREVIEW=true → 404 FEATURE_DISABLED (Standard).
//   2. Session + Membership (requireAuthAndTenant) + gateFeature('siteos.builder').
//   3. Ohne angebundenen Anbieter UND dauerhaften Limit-Store → 503.
//      Beides existiert in diesem Spike NICHT (kein Konto, keine Migration).
//      Der In-Memory-Store gilt nur je Isolate und taugt deshalb nicht als
//      Kostenlimit im Betrieb — er wird hier bewusst nicht verwendet.
//
// Projektdateien kommen aus app_builder_projects (verifizierter Mandant),
// nicht aus dem Request. tenant_id im Body ist nur ein Claim.
// Nicht deployt. Bericht: docs/builder/SPIKE_SANDBOX_PREVIEW_2026-11-22.md

import { handleOptions, jsonError, jsonResponse, methodNotAllowed } from '../../_shared/gateway.ts';
import { requireAuthAndTenant } from '../../_shared/auth.ts';
import { EntitlementError, gateFeature } from '../../_shared/entitlements.ts';
import type { PreviewSessionManager } from '../../_shared/preview-sandbox/manager.ts';
import type { PreviewAuthz, PreviewError } from '../../_shared/preview-sandbox/types.ts';

const OPS = new Set(['start', 'heartbeat', 'stop']);

/**
 * Liefert erst dann einen Manager, wenn ein echter Anbieter-Adapter und ein
 * dauerhafter, atomarer PreviewStore (Postgres-RPC mit Advisory-Lock)
 * existieren. Beides ist offene Entscheidung bzw. Folgearbeit.
 */
function createManager(): PreviewSessionManager | null {
  return null;
}

function errorResponse(e: PreviewError): Response {
  return jsonError(e.status, e.code, e.message);
}

export async function handle(req: Request): Promise<Response> {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (Deno.env.get('APP_BUILDER_SANDBOX_PREVIEW') !== 'true') {
    return jsonError(404, 'FEATURE_DISABLED', 'sandbox preview is disabled');
  }
  if (req.method !== 'POST') return methodNotAllowed();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }
  const op = String(body.op ?? '').trim();
  if (!OPS.has(op)) return jsonError(400, 'BAD_REQUEST', 'op must be start|heartbeat|stop');

  const auth = await requireAuthAndTenant(req, typeof body.tenant_id === 'string' ? body.tenant_id : null);
  if (auth instanceof Response) return auth;
  const { tenantId, user, admin } = auth;

  try {
    await gateFeature(admin, tenantId, 'siteos.builder');
  } catch (e) {
    if (e instanceof EntitlementError) {
      return jsonError(e.code === 'INTERNAL' ? 500 : 403, e.code === 'FORBIDDEN' ? 'ENTITLEMENT' : e.code, e.message);
    }
    throw e;
  }

  const manager = createManager();
  if (!manager) {
    return jsonError(503, 'PREVIEW_RUNTIME_UNAVAILABLE', 'no sandbox provider and no durable limit store configured');
  }

  const authz: PreviewAuthz = { authenticated: true, tenantId, actorId: user.id, entitlementBuilder: true };

  if (op === 'start') {
    const projectId = String(body.project_id ?? '').trim();
    if (!projectId) return jsonError(400, 'BAD_REQUEST', 'project_id required');
    const { data, error } = await admin
      .from('app_builder_projects')
      .select('id, files')
      .eq('tenant_id', tenantId)
      .eq('id', projectId)
      .neq('status', 'archived')
      .maybeSingle();
    if (error) return jsonError(500, 'INTERNAL', error.message);
    if (!data) return jsonError(404, 'NOT_FOUND', 'project not found');
    const res = await manager.start(authz, { projectId, files: (data.files ?? {}) as Record<string, unknown> });
    return res.ok ? jsonResponse({ ok: true, session: res.session }) : errorResponse(res);
  }
  if (op === 'heartbeat') {
    const res = await manager.heartbeat(authz, body.session_id);
    return res.ok ? jsonResponse({ ok: true, session: res.session }) : errorResponse(res);
  }
  const reason = body.reason === 'closed' ? 'closed' : 'user';
  const res = await manager.stop(authz, body.session_id, reason);
  return res.ok ? jsonResponse({ ok: true, session: res.session }) : errorResponse(res);
}
