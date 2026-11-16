// workspace-events — Eingang für Google-Workspace-Studio-Flows (RSD-01 … RSD-06).
//
// POST /functions/v1/workspace-events
// Headers:
//   x-rsd-tenant-key: rsd_gov_…   (Pflicht; alternativ Authorization: Bearer rsd_gov_…)
//   content-type:    application/json
//
// Body (Schema 1.0):
//   { schema_version, event_id, agent_id, event_type, resource_id,
//     requested_action, requires_approval?, metadata? }
//   `tenant_id` im Body wird abgewiesen — der Mandant kommt nur aus dem Schlüssel.
//   `requires_approval` ist ein Hinweis des Flows; entscheidend ist die
//   serverseitige Einstufung (decideWorkspaceAction).
//
// Antwort 202:
//   { ok, event_id, duplicate, decision: 'allow'|'require_approval',
//     approval_id?, approval_status? }
//
// Diese Funktion führt KEINE externe Aktion aus. `require_approval` legt nur
// eine Freigabeanfrage an; die Einlösung (consume_workspace_approval) ist für
// einen künftigen, gesondert freizugebenden Ausführer vorgesehen.
//
// Fail closed: fehlender/ungültiger Schlüssel 401, Schlüssel ohne Quelle
// `google_workspace` 403, verbotene oder unbekannte Aktion 403, zu großer Body
// 413, Datenbankfehler 503. Inhalte (Mailtexte, Dokumente) gehören nicht in
// `metadata` — die Grenze liegt bei 4 KB.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authenticateIngestKey } from '../_shared/ingestKeyAuth.ts';
import { readCappedText } from '../_shared/readCappedBody.ts';
import { buildCorsHeaders, handleOptions, jsonError, jsonResponse } from '../_shared/gateway.ts';
import {
  WORKSPACE_MAX_BODY_BYTES,
  WORKSPACE_SOURCE,
  decideWorkspaceAction,
  keySourceAllowsWorkspace,
  mapIngestRpcError,
  validateWorkspaceEvent,
  workspacePayloadHash,
} from '../_shared/workspaceEvents.ts';

const corsHeaders = buildCorsHeaders('POST, OPTIONS');
corsHeaders['Access-Control-Allow-Headers'] = 'authorization, content-type, x-rsd-tenant-key';

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_METHOD', 'POST only', corsHeaders);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError(503, 'NOT_CONFIGURED', 'workspace ingest not configured', corsHeaders);
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
  // Strenger als der allgemeine Ingest: ein Schlüssel ohne Quellenbindung
  // (z. B. ein SDK-Schlüssel) darf hier nichts einliefern.
  if (!keySourceAllowsWorkspace(keySources)) {
    return jsonError(403, 'SOURCE_NOT_ALLOWED', `ingest key must explicitly allow source ${WORKSPACE_SOURCE}`, corsHeaders);
  }

  const body = await readCappedText(req, WORKSPACE_MAX_BODY_BYTES);
  if (!body.ok) return jsonError(413, 'BODY_TOO_LARGE', `max ${WORKSPACE_MAX_BODY_BYTES} bytes`, corsHeaders);
  let payload: unknown;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return jsonError(400, 'BAD_JSON', 'request body must be valid JSON', corsHeaders);
  }

  const v = validateWorkspaceEvent(payload);
  if (!v.ok) return jsonError(v.status, v.code, v.errors.join(' · '), corsHeaders);
  const e = v.event;

  const decision = decideWorkspaceAction(e.agent_id, e.requested_action);
  if (decision === 'forbidden') {
    return jsonError(403, 'ACTION_FORBIDDEN', `${e.requested_action} is not allowed for ${e.agent_id}`, corsHeaders);
  }

  const payloadHash = await workspacePayloadHash(auth.tenantId, e);
  const { data, error } = await admin.rpc('ingest_workspace_event', {
    p_tenant_id: auth.tenantId,
    p_ingest_key_id: auth.keyId,
    p_event_id: e.event_id,
    p_agent_id: e.agent_id,
    p_event_type: e.event_type,
    p_resource_id: e.resource_id,
    p_requested_action: e.requested_action,
    p_decision: decision,
    p_payload_hash: payloadHash,
    p_metadata: e.metadata,
  });
  if (error) {
    const m = mapIngestRpcError(error.message);
    console.error('[workspace-events] ingest failed', { code: m.code, tenant: auth.tenantId, agent: e.agent_id });
    return jsonError(m.status, m.code, 'event could not be stored', corsHeaders);
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { event_row_id: string; duplicate: boolean; approval_id: string | null; approval_status: string | null }
    | undefined;
  if (!row) return jsonError(503, 'INGEST_FAILED', 'event could not be stored', corsHeaders);

  return jsonResponse({
    ok: true,
    event_id: e.event_id,
    duplicate: row.duplicate,
    decision,
    approval_id: row.approval_id ?? undefined,
    approval_status: row.approval_status ?? undefined,
    payload_hash: payloadHash,
  }, 202, corsHeaders);
});
