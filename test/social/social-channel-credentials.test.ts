import { describe, expect, it } from 'vitest';
import { importSecretKey, open } from '../../supabase/functions/_shared/secretBox';
import {
  LEGACY_ENV_TOKEN_FLAG,
  LINKEDIN_PUBLISH_DISABLED_MESSAGE,
  accountExternalIdFromPostData,
  chooseSocialConnection,
  clientSuppliedCredentials,
  commitWithAudit,
  connectionExpired,
  legacyEnvTokenEnabled,
  linkedinPublishingEnabled,
  parseClientScopes,
  parseSocialCredentials,
  providerForQueueChannel,
  resolveSocialAccessToken,
  sealSocialCredentials,
  type SocialChannelAdmin,
  type SocialConnectionRow,
} from '../../supabase/functions/_shared/socialChannelCredentials';

const FIXTURE_TOKEN = 'fixture-access-token';
const OTHER_TOKEN = 'fixture-other-tenant-token';

async function fixtureKey(): Promise<{ b64: string; key: CryptoKey }> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  let bin = '';
  for (const byte of raw) bin += String.fromCharCode(byte);
  const b64 = btoa(bin);
  return { b64, key: await importSecretKey(b64) };
}

function row(over: Partial<SocialConnectionRow> & Pick<SocialConnectionRow, 'id' | 'tenant_id' | 'account_external_id'>): SocialConnectionRow {
  return {
    channel: 'linkedin',
    account_name: 'Seite',
    status: 'connected',
    token_expires_at: null,
    credentials_enc: 'v1:fixture:sealed',
    ...over,
  };
}

function memoryAdmin(rows: SocialConnectionRow[], rpcData: unknown = null): SocialChannelAdmin & { filters: Array<[string, string]> } {
  const filters: Array<[string, string]> = [];
  const admin = {
    filters,
    from(table: string) {
      if (table !== 'social_channel_connections') throw new Error(`unexpected table ${table}`);
      const local: Array<[string, string]> = [];
      const builder = {
        select(_columns: string) {
          return builder;
        },
        eq(column: string, value: string) {
          local.push([column, value]);
          filters.push([column, value]);
          return builder;
        },
        then(
          onfulfilled?: ((value: { data: unknown; error: { message?: string } | null }) => unknown) | null,
          onrejected?: ((reason: unknown) => unknown) | null,
        ) {
          const data = rows.filter((item) =>
            local.every(([column, value]) => String((item as unknown as Record<string, unknown>)[column]) === value),
          );
          return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
        },
      };
      return builder;
    },
    rpc(_fn: string, _args: Record<string, unknown>) {
      return Promise.resolve({ data: rpcData, error: null });
    },
  };
  return admin as SocialChannelAdmin & { filters: Array<[string, string]> };
}

describe('Social-Kanal-Tokens', () => {
  it('mappt Queue-Kanaele auf den Provider, nicht auf den Queue-Namen', () => {
    expect(providerForQueueChannel('linkedin.enterprise')).toBe('linkedin');
    expect(providerForQueueChannel('linkedin.legal')).toBe('linkedin');
    expect(providerForQueueChannel('instagram.reel')).toBe('instagram');
    expect(providerForQueueChannel('tiktok.fast')).toBe('tiktok');
    expect(providerForQueueChannel('x.alert')).toBe('x');
    expect(providerForQueueChannel('linkedin')).toBeNull();
    expect(providerForQueueChannel('facebook')).toBeNull();
  });

  it('schaltet den Legacy-Env-Token nur bei exakt "on" ein', () => {
    expect(legacyEnvTokenEnabled('on')).toBe(true);
    expect(legacyEnvTokenEnabled(undefined)).toBe(false);
    expect(legacyEnvTokenEnabled('')).toBe(false);
    expect(legacyEnvTokenEnabled('off')).toBe(false);
    expect(legacyEnvTokenEnabled('ON')).toBe(false);
    expect(legacyEnvTokenEnabled('true')).toBe(false);
  });

  it('liest die Konto-Kennung nur aus account_external_id', () => {
    expect(accountExternalIdFromPostData({ account_external_id: ' urn:li:organization:1 ' })).toBe('urn:li:organization:1');
    expect(accountExternalIdFromPostData({ account_external_id: FIXTURE_TOKEN })).toBe(FIXTURE_TOKEN);
    expect(accountExternalIdFromPostData({})).toBeNull();
    expect(accountExternalIdFromPostData(null)).toBeNull();
  });

  it('rundet Siegel und Oeffnen ohne Klartext-Fallback', async () => {
    const { key } = await fixtureKey();
    const sealed = await sealSocialCredentials(key, {
      access_token: FIXTURE_TOKEN,
      refresh_token: 'fixture-refresh-token',
      token_type: 'Bearer',
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(sealed.sealed.startsWith('v1:')).toBe(true);
    expect(sealed.sealed).not.toContain(FIXTURE_TOKEN);
    expect(sealed.fieldNames).toEqual(['access_token', 'refresh_token', 'token_type']);
    const opened = parseSocialCredentials(await open(key, sealed.sealed));
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.secrets.access_token).toBe(FIXTURE_TOKEN);

    const wrong = await fixtureKey();
    await expect(open(wrong.key, sealed.sealed)).rejects.toThrow();
    await expect(open(key, 'plaintext-token')).rejects.toThrow(/unknown seal format/);
  });

  it('lehnt leere und unbekannte Credential-Felder ab, ohne den Wert zu spiegeln', () => {
    expect(parseSocialCredentials({}).ok).toBe(false);
    expect(parseSocialCredentials({ access_token: '  ' }).ok).toBe(false);
    const unknown = parseSocialCredentials({ access_token: FIXTURE_TOKEN, extra: FIXTURE_TOKEN });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).not.toContain(FIXTURE_TOKEN);
  });

  it('behandelt abgelaufene Siegel als nicht benutzbar', () => {
    const now = new Date('2026-11-13T12:00:00.000Z');
    const base = row({ id: 'c1', tenant_id: 't1', account_external_id: 'urn:li:organization:1' });
    expect(connectionExpired({ ...base, token_expires_at: '2026-11-13T11:00:00.000Z' }, now)).toBe(true);
    expect(connectionExpired({ ...base, token_expires_at: '2026-11-14T00:00:00.000Z' }, now)).toBe(false);
    expect(connectionExpired({ ...base, token_expires_at: 'not-a-date' }, now)).toBe(true);
    expect(chooseSocialConnection([
      { ...base, token_expires_at: '2020-01-01T00:00:00.000Z' },
    ], null, now)).toEqual({ kind: 'expired' });
  });

  it('erlaubt zwei Konten, waehlt aber keines, wenn keins angegeben ist', () => {
    const now = new Date('2026-11-13T12:00:00.000Z');
    const choice = chooseSocialConnection([
      row({ id: 'c1', tenant_id: 't1', account_external_id: 'urn:li:organization:1' }),
      row({ id: 'c2', tenant_id: 't1', account_external_id: 'urn:li:person:2' }),
    ], null, now);
    expect(choice).toEqual({ kind: 'ambiguous', count: 2 });
    expect(chooseSocialConnection([
      row({ id: 'c1', tenant_id: 't1', account_external_id: 'urn:li:organization:1' }),
      row({ id: 'c2', tenant_id: 't1', account_external_id: 'urn:li:person:2' }),
    ], 'urn:li:person:2', now).kind).toBe('use');
  });

  it('oeffnet das Siegel des Mandanten und nicht das eines anderen', async () => {
    const { b64, key } = await fixtureKey();
    const own = await sealSocialCredentials(key, { access_token: FIXTURE_TOKEN });
    const other = await sealSocialCredentials(key, { access_token: OTHER_TOKEN });
    if (!own.ok || !other.ok) throw new Error('seal failed');
    const admin = memoryAdmin([
      row({ id: 'own', tenant_id: 'tenant-a', account_external_id: 'urn:li:organization:1', credentials_enc: own.sealed }),
      row({ id: 'other', tenant_id: 'tenant-b', account_external_id: 'urn:li:organization:9', credentials_enc: other.sealed }),
    ]);
    const resolved = await resolveSocialAccessToken(admin, {
      tenantId: 'tenant-a',
      queueChannel: 'linkedin.enterprise',
      readEnv: (name) => (name === 'INTEGRATION_CREDENTIALS_KEY' ? b64 : undefined),
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.source).toBe('connection');
    expect(resolved.accessToken).toBe(FIXTURE_TOKEN);
    if (resolved.source === 'connection') expect(resolved.connectionId).toBe('own');
    expect(admin.filters).toContainEqual(['tenant_id', 'tenant-a']);
    expect(admin.filters).toContainEqual(['channel', 'linkedin']);
  });

  it('greift ohne Flag nicht auf den Env-Token zu', async () => {
    const admin = memoryAdmin([]);
    const env = new Map<string, string>([
      [LEGACY_ENV_TOKEN_FLAG, 'off'],
      ['LINKEDIN_ACCESS_TOKEN', FIXTURE_TOKEN],
    ]);
    const resolved = await resolveSocialAccessToken(admin, {
      tenantId: 'tenant-a',
      queueChannel: 'linkedin.legal',
      readEnv: (name) => env.get(name),
    });
    expect(resolved).toEqual({
      ok: false,
      code: 'no_connection',
      message: 'no social channel connection for tenant',
    });
    expect(JSON.stringify(resolved)).not.toContain(FIXTURE_TOKEN);
  });

  it('nutzt den Env-Token nur als markierten Legacy-Fallback ohne Verbindungszeile', async () => {
    const admin = memoryAdmin([]);
    const resolved = await resolveSocialAccessToken(admin, {
      tenantId: 'tenant-a',
      queueChannel: 'linkedin.enterprise',
      readEnv: (name) => {
        if (name === LEGACY_ENV_TOKEN_FLAG) return 'on';
        if (name === 'LINKEDIN_ACCESS_TOKEN') return FIXTURE_TOKEN;
        return undefined;
      },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.source).toBe('legacy_env');
    expect(resolved.accessToken).toBe(FIXTURE_TOKEN);
  });

  it('faellt bei abgelaufener oder mehrdeutiger Verbindung nicht auf den Env-Token zurueck', async () => {
    const { key } = await fixtureKey();
    const sealed = await sealSocialCredentials(key, { access_token: FIXTURE_TOKEN });
    if (!sealed.ok) throw new Error('seal failed');
    const expired = memoryAdmin([
      row({
        id: 'c1',
        tenant_id: 'tenant-a',
        account_external_id: 'urn:li:organization:1',
        credentials_enc: sealed.sealed,
        token_expires_at: '2020-01-01T00:00:00.000Z',
      }),
    ]);
    const readEnv = (name: string) => {
      if (name === LEGACY_ENV_TOKEN_FLAG) return 'on';
      if (name === 'LINKEDIN_ACCESS_TOKEN') return OTHER_TOKEN;
      return undefined;
    };
    const expiredResult = await resolveSocialAccessToken(expired, {
      tenantId: 'tenant-a',
      queueChannel: 'linkedin.enterprise',
      now: new Date('2026-11-13T12:00:00.000Z'),
      readEnv,
    });
    expect(expiredResult).toMatchObject({ ok: false, code: 'expired' });
    expect(JSON.stringify(expiredResult)).not.toContain(OTHER_TOKEN);

    const ambiguous = memoryAdmin([
      row({ id: 'c1', tenant_id: 'tenant-a', account_external_id: 'urn:li:organization:1', credentials_enc: sealed.sealed }),
      row({ id: 'c2', tenant_id: 'tenant-a', account_external_id: 'urn:li:person:2', credentials_enc: sealed.sealed }),
    ]);
    const ambiguousResult = await resolveSocialAccessToken(ambiguous, {
      tenantId: 'tenant-a',
      queueChannel: 'linkedin.enterprise',
      readEnv,
    });
    expect(ambiguousResult).toMatchObject({ ok: false, code: 'ambiguous_connection' });
    expect(JSON.stringify(ambiguousResult)).not.toContain(FIXTURE_TOKEN);
  });

  it('lehnt Client-Credentials ab und begrenzt Scopes auf openid und profile', () => {
    expect(clientSuppliedCredentials({ credentials: { access_token: FIXTURE_TOKEN } })).toBe(true);
    expect(clientSuppliedCredentials({ access_token: '' })).toBe(true);
    expect(clientSuppliedCredentials({ refresh_token: null })).toBe(true);
    expect(clientSuppliedCredentials({ channel: 'linkedin', account_external_id: 'urn:li:organization:1' })).toBe(false);
    expect(JSON.stringify(clientSuppliedCredentials({ access_token: FIXTURE_TOKEN }))).not.toContain(FIXTURE_TOKEN);

    expect(parseClientScopes(undefined)).toEqual({ ok: true, scopes: ['openid', 'profile'] });
    expect(parseClientScopes(['openid'])).toEqual({ ok: true, scopes: ['openid'] });
    const broad = parseClientScopes(['openid', 'w_member_social']);
    expect(broad.ok).toBe(false);
    if (!broad.ok) expect(broad.error).not.toContain('w_member_social');
  });

  it('schaltet den LinkedIn-Aufruf nur bei exakt on ein', () => {
    expect(linkedinPublishingEnabled(undefined)).toBe(false);
    expect(linkedinPublishingEnabled('off')).toBe(false);
    expect(linkedinPublishingEnabled('true')).toBe(false);
    expect(linkedinPublishingEnabled('on')).toBe(true);
    expect(LINKEDIN_PUBLISH_DISABLED_MESSAGE).toMatch(/not executed/);
  });

  it('nimmt die Schreibe zurück, wenn das Audit fehlschlägt', async () => {
    const events: string[] = [];
    const failed = await commitWithAudit({
      write: async () => {
        events.push('write');
        return { ok: true as const, value: 'row-1' };
      },
      record: async () => {
        events.push('audit');
        return { ok: false };
      },
      revert: async () => {
        events.push('revert');
      },
    });
    expect(failed).toEqual({ ok: false, code: 'audit_failed' });
    expect(events).toEqual(['write', 'audit', 'revert']);

    const thrown = await commitWithAudit({
      write: async () => ({ ok: true as const, value: 'row-2' }),
      record: async () => {
        throw new Error('audit down');
      },
      revert: async () => {
        events.push('revert-throw');
      },
    });
    expect(thrown).toEqual({ ok: false, code: 'audit_failed' });
    expect(events).toContain('revert-throw');

    const ok = await commitWithAudit({
      write: async () => ({ ok: true as const, value: 'row-3' }),
      record: async () => ({ ok: true }),
      revert: async () => {
        events.push('revert-ok');
      },
    });
    expect(ok).toEqual({ ok: true, value: 'row-3' });
    expect(events).not.toContain('revert-ok');
  });

  it('speichert ohne Siegel-Schluessel nichts', async () => {
    const { key } = await fixtureKey();
    const sealed = await sealSocialCredentials(key, { access_token: FIXTURE_TOKEN });
    if (!sealed.ok) throw new Error('seal failed');
    const admin = memoryAdmin([
      row({ id: 'c1', tenant_id: 'tenant-a', account_external_id: 'urn:li:organization:1', credentials_enc: sealed.sealed }),
    ]);
    const resolved = await resolveSocialAccessToken(admin, {
      tenantId: 'tenant-a',
      queueChannel: 'linkedin.enterprise',
      readEnv: () => undefined,
    });
    expect(resolved).toEqual({
      ok: false,
      code: 'seal_key_missing',
      message: 'social channel seal key missing',
    });
    expect(JSON.stringify(resolved)).not.toContain(FIXTURE_TOKEN);
  });
});
