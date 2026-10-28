// Übernahme eines anonymen DSGVO-Audits in einen Mandanten — HTTP-Zugang
// zum einen Schreiber, der RPC `claim_gdpr_audit`.
//
// POST /functions/v1/audit-claim   (verify_jwt = true — Default, kein
//                                   config.toml-Eintrag noetig)
// Body: { audit_id: uuid, tenant_id?: uuid }
//
// Bis 2026-10-13 schrieb diese Function `gdpr_audits` selbst, mit der
// Service-Role, und autorisierte allein über die Kenntnis der `audit_id`.
// Die steht im teilbaren Ergebnis-Link — jedes frisch registrierte Konto
// konnte damit ein fremdes Audit dauerhaft in den eigenen Mandanten ziehen.
//
// Jetzt: Die RPC läuft mit dem Token des Nutzers. Sie prüft E-Mail-Bindung,
// Mitgliedschaft und Erstübernahme im selben Statement
// (`_shared/audit-claim.ts`). Die Service-Role schreibt hier nur noch den
// Prüfpfad, nie das Audit.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';
import {
  claimErrorInfo,
  claimRpcArgs,
  classifyClaimError,
  isUuid,
  parseClaimRpcResult,
} from '../_shared/audit-claim.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHENTICATED', claimErrorInfo('UNAUTHENTICATED').message);
  }

  let body: { audit_id?: unknown; tenant_id?: unknown };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const auditId = body.audit_id;
  if (!isUuid(auditId)) return jsonError(400, 'BAD_REQUEST', 'audit_id must be a uuid');
  const requestedTenant = body.tenant_id === undefined || body.tenant_id === null
    ? null
    : (isUuid(body.tenant_id) ? body.tenant_id : undefined);
  if (requestedTenant === undefined) return jsonError(400, 'BAD_REQUEST', 'tenant_id must be a uuid');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Identität und Berechtigung über den Nutzer-Token: `auth.uid()` in der
  // RPC ist dieser Nutzer, nicht die Service-Role.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) {
    return jsonError(401, 'UNAUTHENTICATED', claimErrorInfo('UNAUTHENTICATED').message);
  }

  const { data, error } = await userClient.rpc('claim_gdpr_audit', claimRpcArgs(auditId, requestedTenant));
  if (error) {
    const info = claimErrorInfo(classifyClaimError(error));
    if (info.code === 'INTERNAL') {
      console.error(JSON.stringify({ level: 'error', scope: 'audit_claim_failed', error: error.message }));
    }
    return jsonError(info.httpStatus, info.code, info.message, corsHeaders, { retryable: info.retryable });
  }

  const result = parseClaimRpcResult(data);
  if (!result) {
    console.error(JSON.stringify({ level: 'error', scope: 'audit_claim_unexpected_result' }));
    const info = claimErrorInfo('INTERNAL');
    return jsonError(info.httpStatus, info.code, info.message, corsHeaders, { retryable: info.retryable });
  }

  if (!result.already_claimed) {
    // Prüfpfad nach der Übernahme. Schlägt er fehl, bleibt die Übernahme
    // bestehen — `audit()` meldet das selbst und wirft nicht.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    await audit(admin, {
      tenant_id: result.tenant_id, actor_user_id: userResp.user.id,
      actor_email: userResp.user.email ?? null,
      action: 'audit.claim', target_type: 'gdpr_audit', target_id: result.audit_id,
      payload: { domain: result.domain, tenant_selected_explicitly: requestedTenant !== null },
    });
  }

  return jsonResponse(result);
});
