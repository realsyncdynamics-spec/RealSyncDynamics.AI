// workspace-execute — prüft, ob eine Workspace-Freigabe jetzt einlösbar wäre.
//
// POST /functions/v1/workspace-execute
// Headers:
//   x-rsd-tenant-key: rsd_gov_…   (Pflicht; Quelle google_workspace)
//   x-rsd-timestamp, x-rsd-nonce, x-rsd-signature   (IMMER Pflicht)
//   content-type: application/json
//
// Body (Schema 1.0):
//   { schema_version, approval_id, payload_hash, mode?: 'dry_run' | 'execute' }
//
// STAND: NUR PRÜFMODUS. Diese Funktion führt keine externe Aktion aus und löst
// keine Freigabe ein — `consume_workspace_approval` wird hier nirgends
// aufgerufen. `mode: 'execute'` wird immer mit 403 EXECUTION_DISABLED
// abgewiesen. Ein Ausführer je Aktion (send_email …) kommt gesondert, mit
// eigener Einzel-Freigabe.
//
// Antwort 200 (dry_run):
//   { ok, status: 'ready', agent_id, action_type, target_resource, expires_at }
//
// Fail closed: Schlüssel fehlt/ungültig 401, Quelle nicht erlaubt 403,
// Signatur fehlt/falsch/nicht eingerichtet 401, Replay 409, Limit 429,
// Freigabe unbekannt oder fremd 404, nicht freigegeben/abgelaufen/anderer
// Hash 409, Aktion inzwischen verboten 403, Datenbankfehler 503.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authenticateIngestKey } from '../_shared/ingestKeyAuth.ts';
import { readCappedText } from '../_shared/readCappedBody.ts';
import { buildCorsHeaders, handleOptions, jsonError, jsonResponse } from '../_shared/gateway.ts';
import { WORKSPACE_SOURCE, keySourceAllowsWorkspace } from '../_shared/workspaceEvents.ts';
import { checkWorkspaceSignature, signatureDepsFromRpc } from '../_shared/workspaceSignature.ts';
import {
  WORKSPACE_EXECUTE_MAX_BODY_BYTES,
  evaluateApproval,
  validateExecuteRequest,
  type ApprovalRow,
} from '../_shared/workspaceExecute.ts';

const corsHeaders = buildCorsHeaders('POST, OPTIONS');
corsHeaders['Access-Control-Allow-Headers'] =
  'authorization, content-type, x-rsd-tenant-key, x-rsd-timestamp, x-rsd-nonce, x-rsd-signature';

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_METHOD', 'POST only', corsHeaders);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError(503, 'NOT_CONFIGURED', 'workspace execute not configured', corsHeaders);
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Mandant ausschließlich aus dem Ingest-Schlüssel — vor jedem Lesen des Bodys.
  let keySources: string[] = [];
  const auth = await authenticateIngestKey(req.headers, async (keyHash) => {
    const { data, error } = await admin
      .from('governance_ingest_keys')
      .select('id, tenant_id, allowed_sources, revoked_at')
      .eq('key_hash', keyHash)
      .maybeSingle();
    keySources = (data?.allowed_sources as string[] | null) ?? [];
    return { row: data ?? null, failed: Boolean(error) };
  }, WORKSPACE_SOURCE);
  if (!auth.ok) return jsonError(auth.status, auth.code, auth.message, corsHeaders);
  if (!keySourceAllowsWorkspace(keySources)) {
    return jsonError(403, 'SOURCE_NOT_ALLOWED', `ingest key must explicitly allow source ${WORKSPACE_SOURCE}`, corsHeaders);
  }

  const body = await readCappedText(req, WORKSPACE_EXECUTE_MAX_BODY_BYTES);
  if (!body.ok) return jsonError(413, 'BODY_TOO_LARGE', `max ${WORKSPACE_EXECUTE_MAX_BODY_BYTES} bytes`, corsHeaders);

  // Ohne gültige Signatur gibt diese Funktion keine Auskunft über Freigaben.
  const sig = await checkWorkspaceSignature(
    req.headers,
    body.text,
    'workspace-execute',
    true,
    signatureDepsFromRpc((fn, args) => admin.rpc(fn, args), auth.keyId),
  );
  if (!sig.ok) {
    console.error('[workspace-execute] signature rejected', { code: sig.code, tenant: auth.tenantId });
    return jsonError(sig.status, sig.code, sig.message, corsHeaders);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return jsonError(400, 'BAD_JSON', 'request body must be valid JSON', corsHeaders);
  }
  const v = validateExecuteRequest(payload);
  if (!v.ok) return jsonError(v.status, v.code, v.errors.join(' · '), corsHeaders);
  const r = v.request;

  if (r.mode === 'execute') {
    return jsonError(403, 'EXECUTION_DISABLED', 'external execution is not implemented; use mode dry_run', corsHeaders);
  }

  const { data, error } = await admin
    .from('workspace_approvals')
    .select('id, tenant_id, agent_id, action_type, target_resource, payload_hash, status, expires_at')
    .eq('id', r.approval_id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (error) {
    console.error('[workspace-execute] approval lookup failed', { tenant: auth.tenantId });
    return jsonError(503, 'APPROVAL_LOOKUP_FAILED', 'approval could not be verified', corsHeaders);
  }

  const readiness = evaluateApproval((data as ApprovalRow | null) ?? null, auth.tenantId, r.payload_hash);
  if (!readiness.ready) return jsonError(readiness.status, readiness.code, readiness.message, corsHeaders);

  return jsonResponse({
    ok: true,
    status: 'ready',
    mode: 'dry_run',
    execution_enabled: false,
    agent_id: readiness.agent_id,
    action_type: readiness.action_type,
    target_resource: readiness.target_resource,
    expires_at: readiness.expires_at,
  }, 200, corsHeaders);
});
