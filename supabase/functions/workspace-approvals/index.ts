// workspace-approvals — Workspace-Freigaben ansehen und entscheiden.
//
// POST /functions/v1/workspace-approvals
// Authorization: Bearer <User-JWT>
// Body:
//   { op: 'list',    status?: 'PENDING'|…, tenant_id?: uuid }
//   { op: 'approve', approval_id }
//   { op: 'reject',  approval_id }
//
// Diese Funktion arbeitet ausschließlich mit dem JWT des Aufrufers — kein
// Service-Role-Key. Was jemand sieht, bestimmt RLS (Mitglieder des Mandanten,
// Migration 20261116020000). Entscheiden dürfen nur Owner/Admin: das prüft
// `decide_workspace_approval` in der Datenbank über auth.uid(), mit
// Zeilensperre. Unbekannte und fremde Freigaben sind nicht unterscheidbar.
// `tenant_id` bei `list` ist nur ein Filter, keine Berechtigung.
//
// Eine Entscheidung führt nichts aus. Sie macht die Freigabe nur einlösbar.
//
// Fail closed: kein/ungültiges JWT 401, unbekannt oder fremd 404,
// nicht mehr offen 409, abgelaufen 409, Datenbankfehler 503.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonError, jsonResponse } from '../_shared/gateway.ts';
import { readCappedText } from '../_shared/readCappedBody.ts';
import { mapDecideRpcError, validateApprovalsRequest } from '../_shared/workspaceExecute.ts';

const MAX_BODY_BYTES = 2_048;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_METHOD', 'POST only');

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonError(503, 'NOT_CONFIGURED', 'workspace approvals not configured');
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp?.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');

  const body = await readCappedText(req, MAX_BODY_BYTES);
  if (!body.ok) return jsonError(413, 'BODY_TOO_LARGE', `max ${MAX_BODY_BYTES} bytes`);
  let payload: unknown;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return jsonError(400, 'BAD_JSON', 'request body must be valid JSON');
  }
  const v = validateApprovalsRequest(payload);
  if (!v.ok) return jsonError(400, 'VALIDATION', v.errors.join(' · '));
  const r = v.request;

  if (r.op === 'list') {
    let query = userClient
      .from('workspace_approvals')
      .select('id, tenant_id, agent_id, action_type, target_resource, payload_hash, status, requested_at, expires_at, decided_by, decided_at, execution_id, executed_at');
    if (r.tenant_id) query = query.eq('tenant_id', r.tenant_id);
    // Abgelaufen gilt ab expires_at, auch wenn der Status noch nicht nachgezogen ist.
    const nowIso = new Date().toISOString();
    if (r.status === 'PENDING' || r.status === 'APPROVED') {
      query = query.eq('status', r.status).gt('expires_at', nowIso);
    } else if (r.status === 'EXPIRED') {
      query = query.or(`status.eq.EXPIRED,and(status.in.(PENDING,APPROVED),expires_at.lte."${nowIso}")`);
    } else {
      query = query.eq('status', r.status);
    }
    const { data, error } = await query.order('requested_at', { ascending: false }).limit(200);
    if (error) {
      console.error('[workspace-approvals] list failed', { user: userResp.user.id });
      return jsonError(503, 'LIST_FAILED', 'approvals could not be loaded');
    }
    return jsonResponse({ ok: true, approvals: data ?? [] });
  }

  const { data, error } = await userClient.rpc('decide_workspace_approval', {
    p_approval_id: r.approval_id,
    p_approve: r.op === 'approve',
  });
  if (error) {
    const m = mapDecideRpcError(error.message);
    if (m.status === 503) console.error('[workspace-approvals] decide failed', { user: userResp.user.id });
    return jsonError(m.status, m.code, 'approval could not be decided');
  }
  if (data === 'EXPIRED') return jsonError(409, 'APPROVAL_EXPIRED', 'approval has expired');
  if (data !== 'APPROVED' && data !== 'REJECTED') {
    return jsonError(503, 'DECISION_FAILED', 'approval could not be decided');
  }
  return jsonResponse({ ok: true, approval_id: r.approval_id, status: data });
});
