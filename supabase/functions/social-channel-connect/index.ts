// social-channel-connect — einziger Schreibpfad fuer Social-Kanal-Tokens.
//
// POST /functions/v1/social-channel-connect   (verify_jwt = true, Default)
//   { op: 'configure', tenant_id, channel, account_external_id, credentials, ... }
//   { op: 'rotate',    tenant_id, connection_id, credentials, ... }
//   { op: 'remove',    tenant_id, connection_id }
//
// Zugangsdaten werden AES-256-GCM-versiegelt (credentials_enc, secretBox)
// und verlassen die Serverseite nicht: keine Klartextspalte, kein Siegel
// und kein Token in der Antwort oder im Audit. Ohne Siegel-Schluessel
// wird nicht gespeichert (503, wie integration-credentials).
//
// owner/admin only. tenant_id wird gegen die Mitgliedschaft geprueft.

import { requireAuthAndTenant } from '../_shared/auth.ts';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';
import {
  SOCIAL_CONNECTION_PUBLIC_SELECT,
  isSocialProvider,
  isSocialProviderInDevelopment,
  loadIntegrationSealKey,
  parseAccountExternalId,
  parseOptionalLabel,
  parseOptionalScopes,
  parseOptionalTimestamp,
  sealSocialCredentials,
} from '../_shared/socialChannelCredentials.ts';

const corsHeaders = buildCorsHeaders('POST, OPTIONS');

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function dbCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  return 'unknown';
}

// deno-lint-ignore no-explicit-any
type Admin = any;

function sealMissing(): Response {
  return jsonError(
    503,
    'NOT_CONFIGURED',
    'INTEGRATION_CREDENTIALS_KEY fehlt — Zugangsdaten werden ohne Siegel nicht gespeichert',
    corsHeaders,
  );
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
  const scopes = parseOptionalScopes(body.scopes);
  if (!scopes.ok) return jsonError(400, 'BAD_REQUEST', scopes.error, corsHeaders);
  const expiresAt = parseOptionalTimestamp(body.token_expires_at);
  if (!expiresAt.ok) return jsonError(400, 'BAD_REQUEST', expiresAt.error, corsHeaders);

  const key = await loadIntegrationSealKey(admin);
  if (!key) return sealMissing();
  const sealed = await sealSocialCredentials(key, body.credentials);
  if (!sealed.ok) return jsonError(400, 'BAD_REQUEST', sealed.error, corsHeaders);

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    credentials_enc: sealed.sealed,
    status: 'connected',
    last_error: null,
    connected_at: now,
    updated_at: now,
  };
  if (accountName.value !== undefined) patch.account_name = accountName.value;
  if (accountKind.value !== undefined) patch.account_kind = accountKind.value;
  if (scopes.scopes !== undefined) patch.scopes = scopes.scopes;
  if (expiresAt.at !== undefined) patch.token_expires_at = expiresAt.at;

  const { data: existing, error: existingErr } = await admin
    .from('social_channel_connections')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('channel', channel)
    .eq('account_external_id', accountExternalId)
    .maybeSingle();
  if (existingErr) {
    console.error('[social-channel-connect] lookup failed', dbCode(existingErr));
    return jsonError(500, 'INTERNAL', 'Verbindung konnte nicht gespeichert werden', corsHeaders);
  }

  let write = existing?.id
    ? admin
        .from('social_channel_connections')
        .update(patch)
        .eq('id', existing.id)
        .eq('tenant_id', tenantId)
    : admin
        .from('social_channel_connections')
        .insert({
          tenant_id: tenantId,
          channel,
          account_external_id: accountExternalId,
          created_by: user.id,
          ...patch,
        });

  let { data: row, error } = await write
    .select(SOCIAL_CONNECTION_PUBLIC_SELECT)
    .maybeSingle();
  // Gleichzeitiges configure derselben Kennung: der zweite Insert trifft
  // die Unique-Bedingung. Dann aktualisieren, nicht das Siegel im Fehler
  // zurueckgeben.
  if (error && dbCode(error) === '23505') {
    write = admin
      .from('social_channel_connections')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('channel', channel)
      .eq('account_external_id', accountExternalId);
    const retried = await write.select(SOCIAL_CONNECTION_PUBLIC_SELECT).maybeSingle();
    row = retried.data;
    error = retried.error;
  }
  if (error || !row) {
    console.error('[social-channel-connect] write failed', dbCode(error));
    return jsonError(500, 'INTERNAL', 'Verbindung konnte nicht gespeichert werden', corsHeaders);
  }

  await audit(admin, {
    tenant_id: tenantId,
    actor_user_id: user.id,
    actor_email: user.email ?? null,
    action: 'social_channel.configure',
    target_type: 'social_channel_connection',
    target_id: row.id ?? null,
    payload: {
      channel,
      account_external_id: accountExternalId,
      credential_fields: sealed.fieldNames,
    },
  });

  return jsonResponse({ ok: true, connection: row }, 200, corsHeaders);
}

async function rotate(
  admin: Admin,
  user: { id: string; email?: string },
  tenantId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  if (!isUuid(body.connection_id)) {
    return jsonError(400, 'BAD_REQUEST', 'connection_id is required', corsHeaders);
  }
  const scopes = parseOptionalScopes(body.scopes);
  if (!scopes.ok) return jsonError(400, 'BAD_REQUEST', scopes.error, corsHeaders);
  const expiresAt = parseOptionalTimestamp(body.token_expires_at);
  if (!expiresAt.ok) return jsonError(400, 'BAD_REQUEST', expiresAt.error, corsHeaders);

  const { data: existing, error: existingErr } = await admin
    .from('social_channel_connections')
    .select('id, channel, account_external_id')
    .eq('id', body.connection_id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (existingErr) {
    console.error('[social-channel-connect] lookup failed', dbCode(existingErr));
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

  const key = await loadIntegrationSealKey(admin);
  if (!key) return sealMissing();
  const sealed = await sealSocialCredentials(key, body.credentials);
  if (!sealed.ok) return jsonError(400, 'BAD_REQUEST', sealed.error, corsHeaders);

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    credentials_enc: sealed.sealed,
    status: 'connected',
    last_error: null,
    connected_at: now,
    updated_at: now,
  };
  if (scopes.scopes !== undefined) patch.scopes = scopes.scopes;
  if (expiresAt.at !== undefined) patch.token_expires_at = expiresAt.at;

  const { data: row, error } = await admin
    .from('social_channel_connections')
    .update(patch)
    .eq('id', existing.id)
    .eq('tenant_id', tenantId)
    .select(SOCIAL_CONNECTION_PUBLIC_SELECT)
    .maybeSingle();
  if (error || !row) {
    console.error('[social-channel-connect] rotate failed', dbCode(error));
    return jsonError(500, 'INTERNAL', 'Verbindung konnte nicht gespeichert werden', corsHeaders);
  }

  await audit(admin, {
    tenant_id: tenantId,
    actor_user_id: user.id,
    actor_email: user.email ?? null,
    action: 'social_channel.rotate',
    target_type: 'social_channel_connection',
    target_id: existing.id,
    payload: {
      channel: existing.channel,
      account_external_id: existing.account_external_id,
      credential_fields: sealed.fieldNames,
    },
  });

  return jsonResponse({ ok: true, connection: row }, 200, corsHeaders);
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
  const { data: existing, error: existingErr } = await admin
    .from('social_channel_connections')
    .select('id, channel, account_external_id')
    .eq('id', body.connection_id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (existingErr) {
    console.error('[social-channel-connect] lookup failed', dbCode(existingErr));
    return jsonError(500, 'INTERNAL', 'Verbindung konnte nicht gespeichert werden', corsHeaders);
  }
  if (!existing) return jsonError(404, 'NOT_FOUND', 'connection not found', corsHeaders);

  const { error } = await admin
    .from('social_channel_connections')
    .update({
      status: 'revoked',
      credentials_enc: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .eq('tenant_id', tenantId);
  if (error) {
    console.error('[social-channel-connect] remove failed', dbCode(error));
    return jsonError(500, 'INTERNAL', 'Verbindung konnte nicht gespeichert werden', corsHeaders);
  }

  await audit(admin, {
    tenant_id: tenantId,
    actor_user_id: user.id,
    actor_email: user.email ?? null,
    action: 'social_channel.remove',
    target_type: 'social_channel_connection',
    target_id: existing.id,
    payload: {
      channel: existing.channel,
      account_external_id: existing.account_external_id,
      credentials_cleared: true,
    },
  });

  return jsonResponse({ ok: true }, 200, corsHeaders);
}
