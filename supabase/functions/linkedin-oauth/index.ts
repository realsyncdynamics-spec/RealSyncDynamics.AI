// linkedin-oauth — serverseitiger LinkedIn Authorization Code Flow.
//
// POST { op: 'start', tenant_id, return_to? }   Nutzer-JWT, owner/admin
// GET  ?code=&state= | ?error=&state=           Browser-Redirect von LinkedIn
//
// verify_jwt ist false, weil LinkedIn kein Supabase-JWT mitschickt.
// start prueft das JWT selbst. callback vertraut nur dem einmaligen State.
// redirect_uri nur aus LINKEDIN_OAUTH_REDIRECT_URI.
// Tokens nur versiegelt (secretBox). Audit-Fehler: commitWithAudit
// nimmt die Schreibe zurueck. revert_failed ist kein Erfolg.
// Die Verbindung entsteht vor der Registratur, wie
// social_channel_connection_apply. Das Siegel schreibt diese RPC
// nicht; der OAuth-Pfad bleibt bei commitWithAudit.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requireAuthAndTenant, requireTenantMembership } from '../_shared/auth.ts';
import { audit } from '../_shared/auditLog.ts';
import { jsonError } from '../_shared/gateway.ts';
import {
  decideConsume,
  handleLinkedInOAuth,
  registryScopeLabel,
  type ConnectionSnapshot,
  type LinkedInOAuthDeps,
  type LinkedInStateRow,
  type StateStore,
} from '../_shared/linkedinOAuth.ts';
import {
  clientSuppliedCredentials,
  loadIntegrationSealKey,
  sealSocialCredentials,
} from '../_shared/socialChannelCredentials.ts';

// deno-lint-ignore no-explicit-any
type Admin = any;

function dbCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  return 'unknown';
}

function asIso(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

function asTextArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null;
  return value as string[];
}

function mapState(raw: unknown): LinkedInStateRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const expiresAt = asIso(row.expires_at);
  const scopes = asTextArray(row.scopes);
  if (typeof row.state_hash !== 'string' || typeof row.tenant_id !== 'string') return null;
  if (typeof row.user_id !== 'string' || typeof row.return_url !== 'string') return null;
  if (!expiresAt || !scopes) return null;
  return {
    stateHash: row.state_hash,
    tenantId: row.tenant_id,
    userId: row.user_id,
    returnUrl: row.return_url,
    scopes,
    expiresAt,
    consumedAt: asIso(row.consumed_at),
  };
}

function stateStore(admin: Admin): StateStore {
  return {
    async insert(row) {
      const { error } = await admin.from('linkedin_oauth_states').insert({
        state_hash: row.stateHash,
        tenant_id: row.tenantId,
        user_id: row.userId,
        return_url: row.returnUrl,
        scopes: row.scopes,
        expires_at: row.expiresAt,
      });
      if (error) {
        console.error('[linkedin-oauth] state insert failed', dbCode(error));
        return false;
      }
      return true;
    },
    async peek(stateHash) {
      const { data, error } = await admin
        .from('linkedin_oauth_states')
        .select('state_hash, tenant_id, user_id, return_url, scopes, expires_at, consumed_at')
        .eq('state_hash', stateHash)
        .maybeSingle();
      if (error) {
        console.error('[linkedin-oauth] state read failed', dbCode(error));
        return null;
      }
      return mapState(data);
    },
    async consume(stateHash, nowIso, claimedTenantId) {
      let update = admin
        .from('linkedin_oauth_states')
        .update({ consumed_at: nowIso })
        .eq('state_hash', stateHash)
        .is('consumed_at', null)
        .gt('expires_at', nowIso);
      if (claimedTenantId !== null) update = update.eq('tenant_id', claimedTenantId);
      const { data, error } = await update
        .select('state_hash, tenant_id, user_id, return_url, scopes, expires_at, consumed_at')
        .maybeSingle();
      if (error) {
        console.error('[linkedin-oauth] state update failed', dbCode(error));
        return { ok: false as const, reason: 'missing' as const, row: null };
      }
      if (data) {
        const row = mapState(data);
        if (!row) return { ok: false as const, reason: 'missing' as const, row: null };
        return { ok: true as const, row };
      }

      const { data: existing, error: readErr } = await admin
        .from('linkedin_oauth_states')
        .select('state_hash, tenant_id, user_id, return_url, scopes, expires_at, consumed_at')
        .eq('state_hash', stateHash)
        .maybeSingle();
      if (readErr || !existing) return { ok: false as const, reason: 'missing' as const, row: null };
      const row = mapState(existing);
      if (!row) return { ok: false as const, reason: 'missing' as const, row: null };
      const decision = decideConsume(row, new Date(nowIso), claimedTenantId);
      if (decision.action === 'reject_and_consume') {
        await admin
          .from('linkedin_oauth_states')
          .update({ consumed_at: nowIso })
          .eq('state_hash', stateHash)
          .is('consumed_at', null);
        return { ok: false as const, reason: decision.reason, row: { ...row, consumedAt: nowIso } };
      }
      if (decision.action === 'reject') {
        return { ok: false as const, reason: decision.reason, row };
      }
      return { ok: false as const, reason: 'reused' as const, row };
    },
  };
}

function snapshot(raw: Record<string, unknown> | null): ConnectionSnapshot | null {
  if (!raw) return null;
  const scopes = raw.scopes == null ? null : asTextArray(raw.scopes);
  if (raw.scopes != null && !scopes) return null;
  return {
    credentialsEnc: typeof raw.credentials_enc === 'string' ? raw.credentials_enc : null,
    status: typeof raw.status === 'string' ? raw.status : 'pending',
    tokenExpiresAt: asIso(raw.token_expires_at),
    scopes,
    accountName: typeof raw.account_name === 'string' ? raw.account_name : null,
    accountKind: typeof raw.account_kind === 'string' ? raw.account_kind : null,
    connectedAt: asIso(raw.connected_at),
    registryId: typeof raw.registry_id === 'string' ? raw.registry_id : null,
    lastError: typeof raw.last_error === 'string' ? raw.last_error : null,
  };
}

async function ensureRegistry(
  admin: Admin,
  input: { tenantId: string; registryId: string | null; displayName: string; scopes: string[] },
): Promise<{ id: string; created: boolean } | null> {
  const scope = registryScopeLabel(input.scopes);
  if (input.registryId) return { id: input.registryId, created: false };
  const { data, error } = await admin
    .from('connector_registry')
    .insert({
      tenant_id: input.tenantId,
      system_type: 'social_channel',
      display_name: input.displayName,
      auth_kind: 'oauth2',
      scope,
      status: 'pending',
    })
    .select('id')
    .maybeSingle();
  if (error || !data?.id) {
    console.error('[linkedin-oauth] registry insert failed', dbCode(error));
    return null;
  }
  return { id: data.id as string, created: true };
}

async function undoConnection(
  admin: Admin,
  id: string,
  tenantId: string,
  previous: ConnectionSnapshot | null,
): Promise<void> {
  if (previous) {
    await admin.from('social_channel_connections').update({
      credentials_enc: previous.credentialsEnc,
      status: previous.status,
      token_expires_at: previous.tokenExpiresAt,
      scopes: previous.scopes,
      account_name: previous.accountName,
      account_kind: previous.accountKind,
      connected_at: previous.connectedAt,
      registry_id: previous.registryId,
      last_error: previous.lastError,
      updated_at: new Date().toISOString(),
    }).eq('id', id).eq('tenant_id', tenantId);
    return;
  }
  await admin.from('social_channel_connections').delete().eq('id', id).eq('tenant_id', tenantId);
}

function connectionDeps(admin: Admin): Pick<LinkedInOAuthDeps, 'savePending' | 'restore' | 'activate' | 'audit' | 'isOwnerOrAdmin'> {
  return {
    async isOwnerOrAdmin(tenantId, userId) {
      return requireTenantMembership(admin, userId, tenantId, ['owner', 'admin']);
    },
    async savePending(input) {
      const { data: existing, error: existingErr } = await admin
        .from('social_channel_connections')
        .select('id, credentials_enc, status, token_expires_at, scopes, account_name, account_kind, connected_at, registry_id, last_error')
        .eq('tenant_id', input.tenantId)
        .eq('channel', 'linkedin')
        .eq('account_external_id', input.accountExternalId)
        .maybeSingle();
      if (existingErr) {
        console.error('[linkedin-oauth] lookup failed', dbCode(existingErr));
        return { ok: false };
      }
      let previous = snapshot(existing);
      if (existing && !previous) return { ok: false };
      const displayName = input.accountName?.trim() || 'LinkedIn';

      // Zuerst die Verbindung, die Registratur erst danach — dieselbe
      // Reihenfolge wie social_channel_connection_apply. Das Siegel kann
      // diese RPC nicht schreiben (kein Credential-Parameter); deshalb
      // bleibt der OAuth-Pfad bei commitWithAudit.
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = {
        credentials_enc: input.sealed,
        status: 'pending',
        last_error: null,
        connected_at: null,
        token_expires_at: input.tokenExpiresAt,
        scopes: input.scopes,
        account_name: input.accountName,
        account_kind: 'member',
        registry_id: previous?.registryId ?? null,
        updated_at: now,
      };
      const write = existing?.id
        ? admin.from('social_channel_connections').update(patch).eq('id', existing.id).eq('tenant_id', input.tenantId)
        : admin.from('social_channel_connections').insert({
          tenant_id: input.tenantId,
          channel: 'linkedin',
          account_external_id: input.accountExternalId,
          created_by: input.userId,
          ...patch,
        });
      let { data: row, error } = await write.select('id').maybeSingle();
      // Zwei Callbacks derselben URN: der zweite Insert trifft die Unique-
      // Bedingung. Vor dem Update den Bestand lesen, sonst nimmt ein
      // fehlgeschlagenes Audit die gerade geschriebene Zeile des ersten mit.
      if (error && dbCode(error) === '23505') {
        const { data: raced, error: raceErr } = await admin
          .from('social_channel_connections')
          .select('id, credentials_enc, status, token_expires_at, scopes, account_name, account_kind, connected_at, registry_id, last_error')
          .eq('tenant_id', input.tenantId)
          .eq('channel', 'linkedin')
          .eq('account_external_id', input.accountExternalId)
          .maybeSingle();
        const racedSnap = snapshot(raced);
        if (raceErr || !raced?.id || !racedSnap) {
          console.error('[linkedin-oauth] conflict reread failed', dbCode(raceErr));
          return { ok: false };
        }
        previous = racedSnap;
        patch.registry_id = racedSnap.registryId;
        const retried = await admin
          .from('social_channel_connections')
          .update(patch)
          .eq('id', raced.id)
          .eq('tenant_id', input.tenantId)
          .select('id')
          .maybeSingle();
        row = retried.data;
        error = retried.error;
      }
      if (error || !row?.id) {
        console.error('[linkedin-oauth] write failed', dbCode(error));
        return { ok: false };
      }

      const connectionId = row.id as string;
      let createdRegistryId: string | null = null;
      if (!previous?.registryId) {
        const registry = await ensureRegistry(admin, {
          tenantId: input.tenantId,
          registryId: null,
          displayName,
          scopes: input.scopes,
        });
        if (!registry) {
          await undoConnection(admin, connectionId, input.tenantId, previous);
          return { ok: false };
        }
        const { error: linkErr } = await admin
          .from('social_channel_connections')
          .update({ registry_id: registry.id, updated_at: new Date().toISOString() })
          .eq('id', connectionId)
          .eq('tenant_id', input.tenantId);
        if (linkErr) {
          console.error('[linkedin-oauth] registry link failed', dbCode(linkErr));
          await admin.from('connector_registry').delete().eq('id', registry.id).eq('tenant_id', input.tenantId);
          await undoConnection(admin, connectionId, input.tenantId, previous);
          return { ok: false };
        }
        createdRegistryId = registry.id;
      } else {
        const { error: labelErr } = await admin
          .from('connector_registry')
          .update({
            display_name: displayName,
            auth_kind: 'oauth2',
            scope: registryScopeLabel(input.scopes),
            updated_at: new Date().toISOString(),
          })
          .eq('id', previous.registryId)
          .eq('tenant_id', input.tenantId);
        if (labelErr) {
          console.error('[linkedin-oauth] registry label failed', dbCode(labelErr));
          await undoConnection(admin, connectionId, input.tenantId, previous);
          return { ok: false };
        }
      }

      return {
        ok: true,
        value: {
          id: connectionId,
          previous,
          createdRegistryId,
        },
      };
    },
    async restore(id, tenantId, previous, createdRegistryId) {
      if (previous) {
        await admin.from('social_channel_connections').update({
          credentials_enc: previous.credentialsEnc,
          status: previous.status,
          token_expires_at: previous.tokenExpiresAt,
          scopes: previous.scopes,
          account_name: previous.accountName,
          account_kind: previous.accountKind,
          connected_at: previous.connectedAt,
          registry_id: previous.registryId,
          last_error: previous.lastError,
          updated_at: new Date().toISOString(),
        }).eq('id', id).eq('tenant_id', tenantId);
      } else {
        await admin.from('social_channel_connections').delete().eq('id', id).eq('tenant_id', tenantId);
      }
      if (createdRegistryId) {
        await admin.from('connector_registry').delete().eq('id', createdRegistryId).eq('tenant_id', tenantId);
      }
    },
    async activate(id, tenantId, scopes) {
      const now = new Date().toISOString();
      const { data, error } = await admin
        .from('social_channel_connections')
        .update({
          status: 'connected',
          connected_at: now,
          last_error: null,
          updated_at: now,
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .select('id, registry_id')
        .maybeSingle();
      if (error || !data?.id) {
        console.error('[linkedin-oauth] activate failed', dbCode(error));
        return false;
      }
      if (typeof data.registry_id === 'string') {
        const { error: registryErr } = await admin
          .from('connector_registry')
          .update({
            scope: registryScopeLabel(scopes),
            auth_kind: 'oauth2',
            updated_at: now,
          })
          .eq('id', data.registry_id)
          .eq('tenant_id', tenantId);
        if (registryErr) {
          console.error('[linkedin-oauth] registry label failed', dbCode(registryErr));
        }
      }
      return true;
    },
    async audit(input) {
      const result = await audit(admin, {
        tenant_id: input.tenantId,
        actor_user_id: input.userId,
        actor_email: null,
        action: 'social_channel.oauth_connect',
        target_type: 'social_channel_connection',
        target_id: input.targetId,
        payload: input.payload,
      });
      return { ok: result.ok };
    },
  };
}

function adminClient(): Admin | null {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

Deno.serve(async (req) => {
  const admin = adminClient();
  if (!admin) return jsonError(500, 'INTERNAL', 'Supabase environment variables missing');

  let sealKey: CryptoKey | null | undefined;
  const deps: LinkedInOAuthDeps = {
    now: () => new Date(),
    env: (name) => Deno.env.get(name),
    states: stateStore(admin),
    fetch: globalThis.fetch.bind(globalThis),
    clientSuppliedCredentials,
    log: (event) => {
      console.error(JSON.stringify({ scope: 'linkedin_oauth', ...event }));
    },
    async authorizeStart(request, tenantId) {
      const auth = await requireAuthAndTenant(request, tenantId, ['owner', 'admin']);
      if (auth instanceof Response) return { ok: false, response: auth };
      return { ok: true, tenantId: auth.tenantId, userId: auth.user.id };
    },
    async sealConfigured() {
      if (sealKey === undefined) sealKey = await loadIntegrationSealKey(admin);
      return sealKey !== null;
    },
    async seal(credentials) {
      if (sealKey === undefined) sealKey = await loadIntegrationSealKey(admin);
      if (!sealKey) return { ok: false, error: 'seal key missing' };
      return sealSocialCredentials(sealKey, credentials);
    },
    ...connectionDeps(admin),
  };
  return handleLinkedInOAuth(req, deps);
});
