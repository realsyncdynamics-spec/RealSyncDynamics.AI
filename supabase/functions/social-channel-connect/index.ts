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
// Jede Änderung wird auditiert. Schlägt das Audit fehl, wird die
// Schreibe zurückgenommen und die Antwort ist kein 200.
//
// owner/admin only. tenant_id wird gegen die Mitgliedschaft geprüft.

import { requireAuthAndTenant } from '../_shared/auth.ts';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';
import {
  SOCIAL_CONNECTION_PUBLIC_SELECT,
  clientSuppliedCredentials,
  commitWithAudit,
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

function dbCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  return 'unknown';
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

function outcomeError(code: 'write_failed' | 'audit_failed'): Response {
  if (code === 'audit_failed') {
    return jsonError(
      500,
      'AUDIT_FAILED',
      'Änderung wurde nicht protokolliert und zurückgenommen',
      corsHeaders,
    );
  }
  return jsonError(500, 'INTERNAL', 'Verbindung konnte nicht gespeichert werden', corsHeaders);
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

  const { data: existing, error: existingErr } = await admin
    .from('social_channel_connections')
    .select('id, registry_id, account_name, account_kind, scopes')
    .eq('tenant_id', tenantId)
    .eq('channel', channel)
    .eq('account_external_id', accountExternalId)
    .maybeSingle();
  if (existingErr) {
    console.error('[social-channel-connect] lookup failed', dbCode(existingErr));
    return jsonError(500, 'INTERNAL', 'Verbindung konnte nicht gespeichert werden', corsHeaders);
  }

  const displayName = accountName.value || channel;
  const registryId = await upsertRegistry(admin, {
    tenantId,
    registryId: existing?.registry_id ?? null,
    displayName,
  });
  if (!registryId) {
    return jsonError(500, 'INTERNAL', 'Verbindung konnte nicht gespeichert werden', corsHeaders);
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    account_name: accountName.value ?? null,
    account_kind: accountKind.value ?? null,
    scopes: scopes.scopes,
    registry_id: registryId,
    updated_at: now,
  };

  const createdRegistry = !existing?.registry_id;
  const outcome = await commitWithAudit({
    write: async () => {
      const write = existing?.id
        ? admin.from('social_channel_connections').update(patch).eq('id', existing.id).eq('tenant_id', tenantId)
        : admin.from('social_channel_connections').insert({
          tenant_id: tenantId,
          channel,
          account_external_id: accountExternalId,
          status: 'pending',
          credentials_enc: null,
          created_by: user.id,
          ...patch,
        });
      const { data: row, error } = await write.select(SOCIAL_CONNECTION_PUBLIC_SELECT).maybeSingle();
      if (error || !row) {
        console.error('[social-channel-connect] write failed', dbCode(error));
        return { ok: false as const };
      }
      return { ok: true as const, value: row };
    },
    revert: async () => {
      if (existing?.id) {
        await admin.from('social_channel_connections').update({
          account_name: existing.account_name ?? null,
          account_kind: existing.account_kind ?? null,
          scopes: existing.scopes ?? null,
          registry_id: existing.registry_id ?? null,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id).eq('tenant_id', tenantId);
      } else {
        await admin.from('social_channel_connections')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('channel', channel)
          .eq('account_external_id', accountExternalId);
      }
      if (createdRegistry) {
        await admin.from('connector_registry').delete().eq('id', registryId).eq('tenant_id', tenantId);
      }
    },
    record: (row) => audit(admin, {
      tenant_id: tenantId,
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: 'social_channel.configure',
      target_type: 'social_channel_connection',
      target_id: row.id ?? null,
      payload: {
        channel,
        account_external_id: accountExternalId,
        registry_id: registryId,
        credentials_accepted: false,
      },
    }),
  });

  if (!outcome.ok) return outcomeError(outcome.code);
  return jsonResponse({ ok: true, connection: outcome.value }, 200, corsHeaders);
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
    .select('id, channel, account_external_id, scopes')
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

  const outcome = await commitWithAudit({
    write: async () => {
      const { data: row, error } = await admin
        .from('social_channel_connections')
        .update({ scopes: scopes.scopes, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .eq('tenant_id', tenantId)
        .select(SOCIAL_CONNECTION_PUBLIC_SELECT)
        .maybeSingle();
      if (error || !row) {
        console.error('[social-channel-connect] rotate failed', dbCode(error));
        return { ok: false as const };
      }
      return { ok: true as const, value: row };
    },
    revert: async () => {
      await admin.from('social_channel_connections').update({
        scopes: existing.scopes ?? null,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id).eq('tenant_id', tenantId);
    },
    record: () => audit(admin, {
      tenant_id: tenantId,
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: 'social_channel.rotate',
      target_type: 'social_channel_connection',
      target_id: existing.id,
      payload: {
        channel: existing.channel,
        account_external_id: existing.account_external_id,
        credentials_accepted: false,
      },
    }),
  });

  if (!outcome.ok) return outcomeError(outcome.code);
  return jsonResponse({ ok: true, connection: outcome.value }, 200, corsHeaders);
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
    .select('id, channel, account_external_id, status, credentials_enc, registry_id')
    .eq('id', body.connection_id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (existingErr) {
    console.error('[social-channel-connect] lookup failed', dbCode(existingErr));
    return jsonError(500, 'INTERNAL', 'Verbindung konnte nicht gespeichert werden', corsHeaders);
  }
  if (!existing) return jsonError(404, 'NOT_FOUND', 'connection not found', corsHeaders);

  const outcome = await commitWithAudit({
    write: async () => {
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
        return { ok: false as const };
      }
      return { ok: true as const, value: existing.id as string };
    },
    revert: async () => {
      await admin.from('social_channel_connections').update({
        status: existing.status,
        credentials_enc: existing.credentials_enc,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id).eq('tenant_id', tenantId);
    },
    record: () => audit(admin, {
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
    }),
  });

  if (!outcome.ok) return outcomeError(outcome.code);
  return jsonResponse({ ok: true }, 200, corsHeaders);
}

async function upsertRegistry(
  admin: Admin,
  input: { tenantId: string; registryId: string | null; displayName: string },
): Promise<string | null> {
  const row = {
    tenant_id: input.tenantId,
    system_type: 'social_channel',
    display_name: input.displayName,
    auth_kind: 'oauth2',
    scope: 'OpenID und Profil',
    status: 'pending',
  };
  if (input.registryId) {
    const patch: Record<string, unknown> = {
      display_name: input.displayName,
      auth_kind: 'oauth2',
      scope: 'OpenID und Profil',
    };
    const { data, error } = await admin
      .from('connector_registry')
      .update(patch)
      .eq('id', input.registryId)
      .eq('tenant_id', input.tenantId)
      .select('id')
      .maybeSingle();
    if (error || !data?.id) {
      console.error('[social-channel-connect] registry update failed', dbCode(error));
      return null;
    }
    return data.id as string;
  }
  const { data, error } = await admin
    .from('connector_registry')
    .insert(row)
    .select('id')
    .maybeSingle();
  if (error || !data?.id) {
    console.error('[social-channel-connect] registry insert failed', dbCode(error));
    return null;
  }
  return data.id as string;
}
