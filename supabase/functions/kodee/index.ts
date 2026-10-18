// Kodee VPS server actions — entry point.
//
// Endpoint: POST /functions/v1/kodee
// Auth:     Authorization: Bearer <user JWT>
// Body:     { v?: 1, tenant_id?: uuid, connection_id: uuid, action: ActionName, args?: ... }
// Response: KodeeResponse<T> — see ./types.ts
//
// Flow:
//   1. Validate request shape
//   2. Verify caller via Supabase Auth (user JWT)
//   3. Load vps_connections row the caller owns or shares via tenant
//      (defense-in-depth — RLS would also enforce this if we used the user client)
//   3b. The connection's tenant (or, for a personal connection, the
//       caller's tenant_id) holds `ai.tool.vps_status` (Agency+). The Kodee
//       chat stays open on Free; SSH actions do not. tenant_id is optional
//       so clients from before this gate keep working on tenant connections.
//   4. Decrypt SSH private key from vps_ssh_keys (service-role only)
//   5. Dispatch to action implementation
//   6. Audit-log the result and return JSON

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { dispatch } from './actions.ts';
import { decryptPrivateKey } from './secrets.ts';
import { loadConnectionForUser } from '../_shared/connections.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import {
  API_VERSION,
  type ActionName,
  type KodeeRequest,
  type KodeeResponse,
} from './types.ts';
import { corsHeaders, handleOptions } from '../_shared/gateway.ts';

const ALLOWED_ACTIONS: ActionName[] = [
  'vps.status', 'vps.logs.tail', 'vps.disk', 'vps.dns_check', 'vps.tls_check',
  'vps.service.restart', 'vps.compose.up', 'vps.compose.restart',
];

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return jsonError(405, 'BAD_REQUEST', 'POST only');
  }

  const start = performance.now();
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'missing bearer token', undefined, start);
  }

  // 1. Parse + validate body
  let body: KodeeRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json', undefined, start);
  }
  if (
    !body || typeof body.connection_id !== 'string' || !ALLOWED_ACTIONS.includes(body.action) ||
    (body.tenant_id !== undefined && typeof body.tenant_id !== 'string')
  ) {
    return jsonError(400, 'BAD_REQUEST', 'connection_id and supported action required', undefined, start);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 2. Verify caller
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid token', undefined, start, body.action);
  }
  const userId = userResp.user.id;

  // 3. Load connection (service-role bypass RLS to also fetch keys, but enforce owner_id explicitly)
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const conn = await loadConnectionForUser(adminClient, userId, body.connection_id);
  if (!conn) return jsonError(404, 'NOT_FOUND', 'connection not found', undefined, start, body.action);

  // 3b. Entitlement of the tenant that owns the server, not of a tenant the
  //     client names — otherwise an Agency membership elsewhere would unlock
  //     a Free tenant's connection. Personal connections fall back to the
  //     caller's tenant_id, which needs a membership (RLS via user JWT).
  let gateTenantId = conn.tenant_id;
  if (!gateTenantId) {
    if (!body.tenant_id) {
      return jsonError(403, 'FORBIDDEN', 'tenant_id required for personal connections', undefined, start, body.action);
    }
    const { data: member, error: memberErr } = await userClient
      .from('memberships').select('id')
      .eq('tenant_id', body.tenant_id).eq('user_id', userId).maybeSingle();
    if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message, undefined, start, body.action);
    if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant', undefined, start, body.action);
    gateTenantId = body.tenant_id;
  }

  try {
    await gateFeature(adminClient, gateTenantId, 'ai.tool.vps_status');
  } catch (e) {
    if (e instanceof EntitlementError) {
      const status = e.code === 'INTERNAL' ? 500 : 403;
      return jsonError(status, e.code === 'INTERNAL' ? 'INTERNAL' : 'FORBIDDEN', e.message, undefined, start, body.action);
    }
    throw e;
  }

  // 4. Decrypt private key (only required for SSH-backed actions)
  let privateKey = '';
  const needsSsh = body.action !== 'vps.dns_check' && body.action !== 'vps.tls_check';
  if (needsSsh) {
    const { data: keyRow, error: keyErr } = await adminClient
      .from('vps_ssh_keys')
      .select('encrypted_private_key')
      .eq('connection_id', conn.id)
      .maybeSingle<{ encrypted_private_key: string }>();
    if (keyErr || !keyRow) {
      return jsonError(404, 'NOT_FOUND', 'ssh key missing for this connection', undefined, start, body.action);
    }
    try {
      privateKey = await decryptPrivateKey(keyRow.encrypted_private_key);
    } catch (e) {
      return jsonError(500, 'INTERNAL', 'failed to decrypt key', String(e), start, body.action);
    }
  }

  // 5. Dispatch
  try {
    const data = await dispatch(body.action, body.args, { conn, privateKey });
    const duration_ms = Math.round(performance.now() - start);

    // Best-effort touch + audit log; don't fail the request if these error.
    void adminClient.from('vps_connections')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', conn.id);
    void adminClient.from('vps_action_log').insert({
      owner_id: userId,
      connection_id: conn.id,
      action: body.action,
      args: body.args ?? {},
      success: true,
      duration_ms,
    });

    const ok: KodeeResponse = { ok: true, v: API_VERSION, action: body.action, data, duration_ms };
    return new Response(JSON.stringify(ok), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (err) {
    const duration_ms = Math.round(performance.now() - start);
    const code = (err as { code?: string }).code ?? 'EXEC_ERROR';
    const message = (err as Error).message ?? String(err);

    void adminClient.from('vps_action_log').insert({
      owner_id: userId,
      connection_id: conn.id,
      action: body.action,
      args: body.args ?? {},
      success: false,
      duration_ms,
      error_code: code,
      error_message: message,
    });

    const httpStatus = code === 'AUTH_FAILED' || code === 'HOST_KEY_MISMATCH' ? 403
      : code === 'CONNECTION_FAILED' ? 502
      : code === 'EXEC_TIMEOUT' ? 504
      : 500;
    return jsonError(httpStatus, code as never, message, undefined, start, body.action);
  }
});

function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  start = performance.now(),
  action?: ActionName,
): Response {
  const body: KodeeResponse = {
    ok: false,
    v: API_VERSION,
    action,
    // deno-lint-ignore no-explicit-any
    error: { code: code as any, message, details },
    duration_ms: Math.round(performance.now() - start),
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
