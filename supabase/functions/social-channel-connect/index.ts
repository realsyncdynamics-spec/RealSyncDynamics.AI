// social-channel-connect — Metadaten einer Social-Verbindung.
//
// POST /functions/v1/social-channel-connect   (verify_jwt = true, Default)
//   { op: 'configure', tenant_id, channel, account_external_id, ... }
//   { op: 'rotate',    tenant_id, connection_id, scopes? }
//   { op: 'remove',    tenant_id, connection_id }
//
// Der Client schickt keine fertigen Zugangsdaten. access_token,
// refresh_token und credentials werden mit 400 abgelehnt. Das Siegel
// schreibt später ein serverseitiger OAuth-Tausch über
// sealSocialCredentials in _shared/socialChannelCredentials.ts.
// Scopes vom Client nur openid und profile.
//
// Verbindung, Registratur und Audit schreibt die RPC
// social_channel_connection_apply in einer Transaktion. Ein Fehler
// lässt keine verwaiste Registry-Zeile stehen.
//
// owner/admin only. tenant_id wird gegen die Mitgliedschaft geprüft.

import { requireAuthAndTenant } from '../_shared/auth.ts';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import {
  clientSuppliedCredentials,
  isSocialProvider,
  isSocialProviderInDevelopment,
  parseAccountExternalId,
  parseClientScopes,
  parseOptionalLabel,
} from '../_shared/socialChannelCredentials.ts';

const corsHeaders = buildCorsHeaders('POST, OPTIONS');

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// deno-lint-ignore no-explicit-any
type Admin = any;

function credentialsRejected(): Response {
  return jsonError(
    400,
    'CREDENTIALS_NOT_ACCEPTED',
    'Zugangsdaten nimmt diese Funktion nicht an',
    corsHeaders,
  );
}

function applyFailure(error: { message?: string; code?: string } | null): Response {
  const message = typeof error?.message === 'string' ? error.message : '';
  const known = ['social_channel_not_found', 'social_channel_scopes', 'social_channel_invalid'];
  const code = known.find((item) => message.includes(item)) ?? 'unexpected';
  console.error(JSON.stringify({
    level: 'error',
    scope: 'social_channel_apply',
    code,
    pg_code: typeof error?.code === 'string' ? error.code : 'unknown',
  }));
  if (code === 'social_channel_not_found') {
    return jsonError(404, 'NOT_FOUND', 'connection not found', corsHeaders);
  }
  if (code === 'social_channel_scopes') {
    return jsonError(400, 'BAD_REQUEST', 'scopes are limited to openid and profile', corsHeaders);
  }
  if (code === 'social_channel_invalid') {
    return jsonError(400, 'BAD_REQUEST', 'channel is invalid', corsHeaders);
  }
  return jsonError(500, 'INTERNAL', 'Verbindung konnte nicht gespeichert werden', corsHeaders);
}

async function apply(
  admin: Admin,
  args: Record<string, unknown>,
): Promise<{ ok: true; connection: Record<string, unknown> } | { ok: false; response: Response }> {
  const { data, error } = await admin.rpc('social_channel_connection_apply', args);
  if (error || !data || typeof data !== 'object') {
    return { ok: false, response: applyFailure(error) };
  }
  return { ok: true, connection: data as Record<string, unknown> };
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only', corsHeaders);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json', corsHeaders);
  }

  const op = String(body.op ?? '');
  if (op !== 'configure' && op !== 'rotate' && op !== 'remove') {
    return jsonError(400, 'BAD_REQUEST', `unknown op: ${op}`, corsHeaders);
  }

  const auth = await requireAuthAndTenant(req, body.tenant_id as string, ['owner', 'admin']);
  if (auth instanceof Response) return auth;
  const { admin, user, tenantId } = auth;

  if (op === 'configure') return configure(admin, user, tenantId, body);
  if (op === 'rotate') return rotate(admin, user, tenantId, body);
  return remove(admin, user, tenantId, body);
});

async function configure(
  admin: Admin,
  user: { id: string; email?: string },
  tenantId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  if (clientSuppliedCredentials(body)) return credentialsRejected();

  const channel = typeof body.channel === 'string' ? body.channel.trim() : '';
  if (!isSocialProvider(channel)) {
    return jsonError(400, 'BAD_REQUEST', 'channel is invalid', corsHeaders);
  }
  if (isSocialProviderInDevelopment(channel)) {
    return jsonError(
      400,
      'NOT_AVAILABLE',
      `${channel} is in development and has no queue channel`,
      corsHeaders,
    );
  }
  const accountExternalId = parseAccountExternalId(body.account_external_id);
  if (!accountExternalId) {
    return jsonError(400, 'BAD_REQUEST', 'account_external_id is required', corsHeaders);
  }
  const accountName = parseOptionalLabel(body.account_name, 200);
  if (!accountName.ok) return jsonError(400, 'BAD_REQUEST', 'account_name is invalid', corsHeaders);
  const accountKind = parseOptionalLabel(body.account_kind, 64);
  if (!accountKind.ok) return jsonError(400, 'BAD_REQUEST', 'account_kind is invalid', corsHeaders);
  const scopes = parseClientScopes(body.scopes);
  if (!scopes.ok) return jsonError(400, 'BAD_REQUEST', scopes.error, corsHeaders);

  const applied = await apply(admin, {
    p_op: 'configure',
    p_tenant_id: tenantId,
    p_actor_user_id: user.id,
    p_actor_email: user.email ?? null,
    p_channel: channel,
    p_account_external_id: accountExternalId,
    p_connection_id: null,
    p_account_name: accountName.value ?? null,
    p_account_kind: accountKind.value ?? null,
    p_scopes: scopes.scopes,
    p_display_name: accountName.value || channel,
  });
  if (!applied.ok) return applied.response;
  return jsonResponse({ ok: true, connection: applied.connection }, 200, corsHeaders);
}

async function rotate(
  admin: Admin,
  user: { id: string; email?: string },
  tenantId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  if (clientSuppliedCredentials(body)) return credentialsRejected();
  if (!isUuid(body.connection_id)) {
    return jsonError(400, 'BAD_REQUEST', 'connection_id is required', corsHeaders);
  }
  const scopes = parseClientScopes(body.scopes);
  if (!scopes.ok) return jsonError(400, 'BAD_REQUEST', scopes.error, corsHeaders);

  const { data: existing, error: existingErr } = await admin
    .from('social_channel_connections')
    .select('channel')
    .eq('id', body.connection_id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (existingErr) {
    const pg = existingErr && typeof existingErr === 'object' && 'code' in existingErr
      ? String((existingErr as { code: unknown }).code)
      : 'unknown';
    console.error(JSON.stringify({ level: 'error', scope: 'social_channel_rotate_lookup', pg_code: pg }));
    return jsonError(500, 'INTERNAL', 'Verbindung konnte nicht gespeichert werden', corsHeaders);
  }
  if (!existing) return jsonError(404, 'NOT_FOUND', 'connection not found', corsHeaders);
  if (isSocialProviderInDevelopment(existing.channel)) {
    return jsonError(
      400,
      'NOT_AVAILABLE',
      `${existing.channel} is in development and has no queue channel`,
      corsHeaders,
    );
  }

  const applied = await apply(admin, {
    p_op: 'rotate',
    p_tenant_id: tenantId,
    p_actor_user_id: user.id,
    p_actor_email: user.email ?? null,
    p_channel: null,
    p_account_external_id: null,
    p_connection_id: body.connection_id,
    p_account_name: null,
    p_account_kind: null,
    p_scopes: scopes.scopes,
    p_display_name: null,
  });
  if (!applied.ok) return applied.response;
  return jsonResponse({ ok: true, connection: applied.connection }, 200, corsHeaders);
}

async function remove(
  admin: Admin,
  user: { id: string; email?: string },
  tenantId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  if (!isUuid(body.connection_id)) {
    return jsonError(400, 'BAD_REQUEST', 'connection_id is required', corsHeaders);
  }
  const applied = await apply(admin, {
    p_op: 'remove',
    p_tenant_id: tenantId,
    p_actor_user_id: user.id,
    p_actor_email: user.email ?? null,
    p_channel: null,
    p_account_external_id: null,
    p_connection_id: body.connection_id,
    p_account_name: null,
    p_account_kind: null,
    p_scopes: null,
    p_display_name: null,
  });
  if (!applied.ok) return applied.response;
  return jsonResponse({ ok: true }, 200, corsHeaders);
}
