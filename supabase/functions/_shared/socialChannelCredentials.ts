/**
 * socialChannelCredentials — Speichern, Lesen, Entsiegeln und Auswaehlen
 * von Social-Kanal-Tokens.
 *
 * Siegel nur ueber secretBox (AES-256-GCM, v1:<iv>:<ciphertext>).
 * Schluessel wie integration-credentials: INTEGRATION_CREDENTIALS_KEY,
 * sonst Vault-RPC get_app_secret('integration_credentials_key').
 * Kein Klartext-Fallback, kein zweites Krypto.
 *
 * Der Legacy-Env-Token (LINKEDIN_ACCESS_TOKEN) wird hier nur gelesen,
 * wenn SOCIAL_PUBLISHER_LEGACY_ENV_TOKEN exakt "on" ist UND fuer den
 * Mandanten keine Verbindungszeile existiert. Default ist aus
 * (fail-closed). Der Wert wird nie geloggt und nie in Fehlermeldungen
 * geschrieben.
 */

import { importSecretKey, open, seal } from './secretBox.ts';

export const SOCIAL_PROVIDERS = ['linkedin', 'instagram', 'facebook', 'tiktok', 'x'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/**
 * facebook ist in Entwicklung: kein Queue-Kanal, kein Publisher.
 * Nicht als verfuegbar darstellen. Die uebrigen Provider haben einen
 * Queue-Kanal; ihr Versand kann trotzdem noch offen sein.
 */
export const SOCIAL_PROVIDERS_IN_DEVELOPMENT = ['facebook'] as const;

export function isSocialProviderInDevelopment(provider: string): boolean {
  return (SOCIAL_PROVIDERS_IN_DEVELOPMENT as readonly string[]).includes(provider);
}

export const SOCIAL_CONNECTION_STATUSES = [
  'pending',
  'connected',
  'expired',
  'error',
  'disabled',
  'revoked',
] as const;

/**
 * Spalten, die authenticated und die Antwort der Edge Function sehen.
 * scopes, last_error, created_by, credentials_enc und registry_id nicht.
 */
export const SOCIAL_CONNECTION_PUBLIC_COLUMNS = [
  'id',
  'tenant_id',
  'channel',
  'account_external_id',
  'account_name',
  'status',
  'token_expires_at',
  'updated_at',
] as const;

export const SOCIAL_CONNECTION_PUBLIC_SELECT = SOCIAL_CONNECTION_PUBLIC_COLUMNS.join(', ');

/**
 * Queue-Kanal (distribution_queue_entries.channel) → Provider in
 * social_channel_connections.channel. facebook ist in Entwicklung und
 * hat keinen Queue-Kanal. Nicht als verfuegbar darstellen.
 */
const QUEUE_CHANNEL_PROVIDER: Record<string, SocialProvider> = {
  'linkedin.enterprise': 'linkedin',
  'linkedin.legal': 'linkedin',
  'instagram.reel': 'instagram',
  'tiktok.fast': 'tiktok',
  'x.alert': 'x',
};

/** Einschaltbarer Uebergang. Jeder andere Wert, auch leer, ist aus. */
export const LEGACY_ENV_TOKEN_FLAG = 'SOCIAL_PUBLISHER_LEGACY_ENV_TOKEN';

/**
 * LinkedIn-Versand. Default aus: ohne exakt "on" kein Siegel und kein HTTP.
 * Bleibt aus, bis OAuth und eine echte Autor-URN stehen.
 */
export const LINKEDIN_PUBLISH_FLAG = 'SOCIAL_PUBLISHER_LINKEDIN_ENABLED';

export const LINKEDIN_PUBLISH_DISABLED_MESSAGE =
  'LinkedIn publishing disabled; job not executed';

/** Scopes, die der Client an der Verbindung setzen darf. Keine Publish-Scopes. */
export const CLIENT_CONNECTION_SCOPES = ['openid', 'profile'] as const;

const CLIENT_SECRET_KEYS = [
  'credentials',
  'access_token',
  'refresh_token',
  'client_secret',
  'id_token',
  'token',
  'authorization_code',
] as const;

const SECRET_KEYS = ['access_token', 'refresh_token', 'token_type'] as const;

export interface SocialChannelSecrets {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
}

export interface SocialConnectionRow {
  id: string;
  tenant_id: string;
  channel: string;
  account_external_id: string;
  account_name: string | null;
  status: string;
  token_expires_at: string | null;
  credentials_enc: string | null;
}

export type ConnectionChoice =
  | { kind: 'use'; row: SocialConnectionRow }
  | { kind: 'none' }
  | { kind: 'ambiguous'; count: number }
  | { kind: 'expired' }
  | { kind: 'not_connected'; status: string };

export type TokenResolution =
  | {
      ok: true;
      source: 'connection';
      accessToken: string;
      connectionId: string;
      accountExternalId: string;
    }
  | {
      ok: true;
      source: 'legacy_env';
      accessToken: string;
      connectionId: null;
      accountExternalId: null;
    }
  | { ok: false; code: string; message: string };

export interface SocialChannelQuery {
  eq(column: string, value: string): SocialChannelQuery;
  then<TResult1 = { data: unknown; error: { message?: string } | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: { message?: string } | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

export interface SocialChannelAdmin {
  from(table: string): {
    select(columns: string): SocialChannelQuery;
  };
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error?: unknown }>;
}

export function isSocialProvider(value: string): value is SocialProvider {
  return (SOCIAL_PROVIDERS as readonly string[]).includes(value);
}

export function providerForQueueChannel(channel: string): SocialProvider | null {
  return QUEUE_CHANNEL_PROVIDER[channel] ?? null;
}

export function legacyEnvTokenEnabled(flag: string | undefined): boolean {
  return flag === 'on';
}

export function accountExternalIdFromPostData(postData: unknown): string | null {
  if (!postData || typeof postData !== 'object' || Array.isArray(postData)) return null;
  return parseAccountExternalId((postData as Record<string, unknown>).account_external_id);
}

export function parseAccountExternalId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 512) return null;
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  return trimmed;
}

export function parseOptionalLabel(
  value: unknown,
  max: number,
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, error: 'invalid text' };
  const trimmed = value.trim();
  if (trimmed.length > max) return { ok: false, error: 'text too long' };
  return { ok: true, value: trimmed.length === 0 ? null : trimmed };
}

export function linkedinPublishingEnabled(flag: string | undefined): boolean {
  return flag === 'on';
}

/** True, sobald der Client irgendein Zugangsdatum mitschickt — auch leer. */
export function clientSuppliedCredentials(body: Record<string, unknown>): boolean {
  return CLIENT_SECRET_KEYS.some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

export function parseClientScopes(
  value: unknown,
): { ok: true; scopes: string[] } | { ok: false; error: string } {
  const parsed = parseOptionalScopes(value);
  if (!parsed.ok) return parsed;
  const scopes = parsed.scopes ?? [...CLIENT_CONNECTION_SCOPES];
  if (scopes.length === 0) {
    return { ok: false, error: 'scopes are limited to openid and profile' };
  }
  const allowed = new Set<string>(CLIENT_CONNECTION_SCOPES);
  if (scopes.some((scope) => !allowed.has(scope))) {
    return { ok: false, error: 'scopes are limited to openid and profile' };
  }
  return { ok: true, scopes: [...new Set(scopes)] };
}

/**
 * Kompensierendes Audit für Aufrufer ohne gemeinsame DB-Transaktion.
 *
 * `social-channel-connect` nutzt das nicht mehr: dort schreibt
 * `social_channel_connection_apply` Verbindung, Registratur und Audit
 * in einer Transaktion. Diese Funktion bleibt, weil der OAuth-Flow
 * (#2221) sie mit genau dieser Signatur aufruft.
 *
 * Schlägt das Zurücknehmen fehl, ist der Code `revert_failed` (nicht
 * `audit_failed`). #2221 behandelt nur `audit_failed` als Audit-Grund
 * und jeden anderen Fehlcode als Speicherfehler.
 */
export async function commitWithAudit<T>(args: {
  write: () => Promise<{ ok: true; value: T } | { ok: false }>;
  revert: () => Promise<void>;
  record: (value: T) => Promise<{ ok: boolean }>;
}): Promise<{ ok: true; value: T } | { ok: false; code: 'write_failed' | 'audit_failed' | 'revert_failed' }> {
  const written = await args.write();
  if (!written.ok) return { ok: false, code: 'write_failed' };
  let audited = false;
  try {
    audited = (await args.record(written.value)).ok;
  } catch {
    audited = false;
  }
  if (!audited) {
    try {
      await args.revert();
    } catch {
      // Kein Exception-Text: der kann Zeileninhalte enthalten.
      console.error(JSON.stringify({
        level: 'error',
        scope: 'commit_with_audit',
        code: 'REVERT_FAILED',
      }));
      return { ok: false, code: 'revert_failed' };
    }
    return { ok: false, code: 'audit_failed' };
  }
  return written;
}

export function parseOptionalScopes(
  value: unknown,
): { ok: true; scopes: string[] | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, scopes: undefined };
  if (!Array.isArray(value)) return { ok: false, error: 'scopes must be an array' };
  if (value.length > 32) return { ok: false, error: 'too many scopes' };
  const scopes: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return { ok: false, error: 'scopes must be strings' };
    const trimmed = item.trim();
    if (trimmed.length < 1 || trimmed.length > 128) return { ok: false, error: 'invalid scope' };
    scopes.push(trimmed);
  }
  return { ok: true, scopes };
}

export function parseOptionalTimestamp(
  value: unknown,
): { ok: true; at: string | null | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, at: undefined };
  if (value === null) return { ok: true, at: null };
  if (typeof value !== 'string') return { ok: false, error: 'token_expires_at is invalid' };
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return { ok: false, error: 'token_expires_at is invalid' };
  return { ok: true, at: new Date(ms).toISOString() };
}

export function parseSocialCredentials(
  value: unknown,
): { ok: true; secrets: SocialChannelSecrets; fieldNames: string[] } | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'credentials must be an object' };
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 0) return { ok: false, error: 'credentials must be a non-empty object' };
  for (const key of keys) {
    if (!(SECRET_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: 'unknown credential field' };
    }
  }
  const access = record.access_token;
  if (typeof access !== 'string' || access.trim().length === 0 || access.trim().length > 8000) {
    return { ok: false, error: 'access_token is required' };
  }
  const secrets: SocialChannelSecrets = { access_token: access.trim() };
  if ('refresh_token' in record) {
    const refresh = record.refresh_token;
    if (typeof refresh !== 'string' || refresh.trim().length === 0 || refresh.trim().length > 8000) {
      return { ok: false, error: 'refresh_token is invalid' };
    }
    secrets.refresh_token = refresh.trim();
  }
  if ('token_type' in record) {
    const tokenType = record.token_type;
    if (typeof tokenType !== 'string' || tokenType.trim().length === 0 || tokenType.trim().length > 32) {
      return { ok: false, error: 'token_type is invalid' };
    }
    secrets.token_type = tokenType.trim();
  }
  return { ok: true, secrets, fieldNames: Object.keys(secrets).sort() };
}

export function connectionExpired(
  row: Pick<SocialConnectionRow, 'status' | 'token_expires_at'>,
  now: Date,
): boolean {
  if (row.status === 'expired') return true;
  if (row.status !== 'connected') return false;
  if (!row.token_expires_at) return false;
  const ms = Date.parse(row.token_expires_at);
  if (Number.isNaN(ms)) return true;
  return ms <= now.getTime();
}

export function chooseSocialConnection(
  rows: SocialConnectionRow[],
  accountExternalId: string | null,
  now: Date,
): ConnectionChoice {
  const scoped = accountExternalId
    ? rows.filter((row) => row.account_external_id === accountExternalId)
    : rows;
  if (scoped.length === 0) return { kind: 'none' };

  const usable = scoped.filter(
    (row) =>
      row.status === 'connected'
      && typeof row.credentials_enc === 'string'
      && row.credentials_enc.length > 0
      && !connectionExpired(row, now),
  );
  if (usable.length === 1) return { kind: 'use', row: usable[0]! };
  if (usable.length > 1) return { kind: 'ambiguous', count: usable.length };

  const expired = scoped.some(
    (row) => row.status === 'expired' || (row.status === 'connected' && connectionExpired(row, now)),
  );
  if (expired) return { kind: 'expired' };
  return { kind: 'not_connected', status: scoped[0]?.status ?? 'pending' };
}

function readEnvOrDeno(readEnv: ((name: string) => string | undefined) | undefined, name: string): string | undefined {
  if (readEnv) return readEnv(name);
  const deno = (globalThis as { Deno?: { env: { get(key: string): string | undefined } } }).Deno;
  return deno?.env.get(name) ?? undefined;
}

export async function loadIntegrationSealKey(
  admin: SocialChannelAdmin,
  readEnv?: (name: string) => string | undefined,
): Promise<CryptoKey | null> {
  let b64 = readEnvOrDeno(readEnv, 'INTEGRATION_CREDENTIALS_KEY') ?? null;
  if (!b64) {
    try {
      const { data } = await admin.rpc('get_app_secret', {
        secret_name: 'integration_credentials_key',
      });
      if (typeof data === 'string' && data.length > 0) b64 = data;
    } catch {
      /* Vault optional — env ist der Primaerweg */
    }
  }
  if (!b64) return null;
  try {
    return await importSecretKey(b64);
  } catch {
    // Kein Schluesselmaterial loggen. importSecretKey nennt nur die Laenge.
    console.error('[social-channel] invalid seal key');
    return null;
  }
}

export async function sealSocialCredentials(
  key: CryptoKey,
  credentials: unknown,
): Promise<{ ok: true; sealed: string; fieldNames: string[] } | { ok: false; error: string }> {
  const parsed = parseSocialCredentials(credentials);
  if (!parsed.ok) return parsed;
  const sealed = await seal(key, parsed.secrets);
  return { ok: true, sealed, fieldNames: parsed.fieldNames };
}

function asRows(data: unknown): SocialConnectionRow[] {
  if (!Array.isArray(data)) return [];
  const rows: SocialConnectionRow[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.tenant_id !== 'string') continue;
    if (typeof row.channel !== 'string' || typeof row.account_external_id !== 'string') continue;
    if (typeof row.status !== 'string') continue;
    rows.push({
      id: row.id,
      tenant_id: row.tenant_id,
      channel: row.channel,
      account_external_id: row.account_external_id,
      account_name: typeof row.account_name === 'string' ? row.account_name : null,
      status: row.status,
      token_expires_at: typeof row.token_expires_at === 'string' ? row.token_expires_at : null,
      credentials_enc: typeof row.credentials_enc === 'string' ? row.credentials_enc : null,
    });
  }
  return rows;
}

function choiceFailure(choice: Exclude<ConnectionChoice, { kind: 'use' } | { kind: 'none' }>): TokenResolution {
  if (choice.kind === 'ambiguous') {
    return {
      ok: false,
      code: 'ambiguous_connection',
      message: 'multiple social channel connections; account_external_id required',
    };
  }
  if (choice.kind === 'expired') {
    return { ok: false, code: 'expired', message: 'social channel token expired' };
  }
  return { ok: false, code: 'not_connected', message: 'social channel connection is not usable' };
}

/**
 * Oeffnet das Siegel fuer tenant + Queue-Kanal (+ optionales Konto).
 * Greift nicht still auf LINKEDIN_ACCESS_TOKEN zu.
 */
export async function resolveSocialAccessToken(
  admin: SocialChannelAdmin,
  input: {
    tenantId: string;
    queueChannel: string;
    accountExternalId?: string | null;
    now?: Date;
    readEnv?: (name: string) => string | undefined;
    /**
     * Default true: Legacy-Env nur ohne Zeile und nur mit Flag.
     * Der LinkedIn-Versand setzt false. Ohne Autor-URN aus der
     * Verbindung darf kein Plattform-Token verwendet werden.
     */
    allowLegacyEnv?: boolean;
  },
): Promise<TokenResolution> {
  const provider = providerForQueueChannel(input.queueChannel);
  if (!provider) {
    return { ok: false, code: 'unknown_channel', message: 'unknown social channel' };
  }
  const accountExternalId = input.accountExternalId ?? null;
  const now = input.now ?? new Date();

  const { data, error } = await admin
    .from('social_channel_connections')
    .select('id, tenant_id, channel, account_external_id, account_name, status, token_expires_at, credentials_enc')
    .eq('tenant_id', input.tenantId)
    .eq('channel', provider);

  if (error) {
    return { ok: false, code: 'lookup_failed', message: 'social channel lookup failed' };
  }

  const choice = chooseSocialConnection(asRows(data), accountExternalId, now);
  if (choice.kind === 'use') {
    const key = await loadIntegrationSealKey(admin, input.readEnv);
    if (!key) {
      return { ok: false, code: 'seal_key_missing', message: 'social channel seal key missing' };
    }
    try {
      const opened = await open(key, choice.row.credentials_enc ?? '');
      const parsed = parseSocialCredentials(opened);
      if (!parsed.ok) {
        return { ok: false, code: 'seal_invalid', message: 'social channel seal invalid' };
      }
      return {
        ok: true,
        source: 'connection',
        accessToken: parsed.secrets.access_token,
        connectionId: choice.row.id,
        accountExternalId: choice.row.account_external_id,
      };
    } catch {
      return { ok: false, code: 'seal_invalid', message: 'social channel seal invalid' };
    }
  }

  // Legacy nur ohne jede Zeile, ohne Konto-Hinweis und nur fuer LinkedIn.
  // Abgelaufene oder mehrdeutige Verbindungen fallen nicht auf das
  // Plattform-Token zurueck — das waere der falsche Account.
  if (
    input.allowLegacyEnv !== false
    && choice.kind === 'none'
    && !accountExternalId
    && provider === 'linkedin'
    && legacyEnvTokenEnabled(readEnvOrDeno(input.readEnv, LEGACY_ENV_TOKEN_FLAG))
  ) {
    const token = readEnvOrDeno(input.readEnv, 'LINKEDIN_ACCESS_TOKEN');
    if (typeof token === 'string' && token.trim().length > 0) {
      return {
        ok: true,
        source: 'legacy_env',
        accessToken: token.trim(),
        connectionId: null,
        accountExternalId: null,
      };
    }
  }

  if (choice.kind === 'none') {
    return { ok: false, code: 'no_connection', message: 'no social channel connection for tenant' };
  }
  return choiceFailure(choice);
}
