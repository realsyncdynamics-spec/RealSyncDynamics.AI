import { describe, expect, it } from 'vitest';
import { importSecretKey } from '../../supabase/functions/_shared/secretBox';
import {
  LINKEDIN_API_VERSION,
  LINKEDIN_POSTS_URL,
  LINKEDIN_RESTLI_PROTOCOL,
  escapeLinkedInCommentary,
  publishLinkedInQueueJob,
  publishLinkedInTextPost,
} from '../../supabase/functions/_shared/linkedinPosts';
import {
  LEGACY_ENV_TOKEN_FLAG,
  sealSocialCredentials,
  type SocialChannelAdmin,
  type SocialConnectionRow,
} from '../../supabase/functions/_shared/socialChannelCredentials';

const TOKEN = 'fixture-access-token';
const OTHER = 'fixture-other-token';
const ORG = 'urn:li:organization:5515715';
const PERSON = 'urn:li:person:5abc_dEfgH';

async function fixtureKey(): Promise<{ b64: string; key: CryptoKey }> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  let bin = '';
  for (const byte of raw) bin += String.fromCharCode(byte);
  const b64 = btoa(bin);
  return { b64, key: await importSecretKey(b64) };
}

function row(
  over: Partial<SocialConnectionRow> & Pick<SocialConnectionRow, 'id' | 'account_external_id'>,
): SocialConnectionRow {
  return {
    tenant_id: 'tenant-a',
    channel: 'linkedin',
    account_name: null,
    status: 'connected',
    token_expires_at: null,
    credentials_enc: null,
    ...over,
  };
}

function memoryAdmin(rows: SocialConnectionRow[]): SocialChannelAdmin {
  return {
    from(table: string) {
      if (table !== 'social_channel_connections') throw new Error(`unexpected table ${table}`);
      const filters: Array<[string, string]> = [];
      const builder = {
        select() {
          return builder;
        },
        eq(column: string, value: string) {
          filters.push([column, value]);
          return builder;
        },
        then(
          onfulfilled?: ((value: { data: unknown; error: null }) => unknown) | null,
          onrejected?: ((reason: unknown) => unknown) | null,
        ) {
          const data = rows.filter((item) =>
            filters.every(([column, value]) => String((item as unknown as Record<string, unknown>)[column]) === value),
          );
          return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
        },
      };
      return builder;
    },
    rpc() {
      return Promise.resolve({ data: null });
    },
  } as SocialChannelAdmin;
}

interface SeenRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
}

function mockFetch(status: number, headerId: string | null, body = ''): {
  fetchImpl: typeof fetch;
  calls: SeenRequest[];
} {
  const calls: SeenRequest[] = [];
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const raw = typeof init?.body === 'string' ? init.body : null;
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      headers,
      body: raw ? JSON.parse(raw) as Record<string, unknown> : null,
    });
    return new Response(body, {
      status,
      headers: headerId ? { 'x-restli-id': headerId } : undefined,
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe('LinkedIn Posts API', () => {
  it('escaped little-Text, damit reservierte Zeichen Klartext bleiben', () => {
    expect(escapeLinkedInCommentary('Hinweis (DSGVO) #Gov')).toBe('Hinweis \\(DSGVO\\) \\#Gov');
    expect(escapeLinkedInCommentary('a\\b')).toBe('a\\\\b');
  });

  it('setzt URL, Pflicht-Header und die Autor-URN der Verbindung', async () => {
    const { fetchImpl, calls } = mockFetch(201, 'urn:li:share:6844785523593134080');
    const result = await publishLinkedInTextPost({
      accessToken: TOKEN,
      authorUrn: ORG,
      commentary: 'Hinweis (DSGVO) #Gov',
      fetchImpl,
    });
    expect(result).toEqual({ ok: true, externalId: 'urn:li:share:6844785523593134080' });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(LINKEDIN_POSTS_URL);
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0]!.headers['linkedin-version']).toBe(LINKEDIN_API_VERSION);
    expect(LINKEDIN_API_VERSION).toBe('202610');
    expect(calls[0]!.headers['x-restli-protocol-version']).toBe(LINKEDIN_RESTLI_PROTOCOL);
    expect(calls[0]!.body).toMatchObject({
      author: ORG,
      commentary: 'Hinweis \\(DSGVO\\) \\#Gov',
      visibility: 'PUBLIC',
      lifecycleState: 'PUBLISHED',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
    });
    expect(JSON.stringify(calls[0]!.body)).not.toContain('ugcPosts');
    expect(JSON.stringify(calls[0]!.body)).not.toContain('shareMediaCategory');
    expect(calls[0]!.url).not.toContain('/rest/images');
  });

  it('nimmt die Post-ID nur aus x-restli-id', async () => {
    const { fetchImpl } = mockFetch(201, null, JSON.stringify({ id: 'urn:li:share:from-body' }));
    const result = await publishLinkedInTextPost({
      accessToken: TOKEN,
      authorUrn: PERSON,
      commentary: 'Text',
      fetchImpl,
    });
    expect(result).toEqual({ ok: false, error: 'LinkedIn 201 without x-restli-id' });
  });

  it('ruft LinkedIn nicht auf, wenn die Autor-URN keine Personen- oder Organisations-URN ist', async () => {
    const { fetchImpl, calls } = mockFetch(201, 'urn:li:share:1');
    const result = await publishLinkedInTextPost({
      accessToken: TOKEN,
      authorUrn: 'urn:li:person:ABC123 ist kein vertrag',
      commentary: 'Text',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  it('schreibt den Token nicht in die Fehlermeldung', async () => {
    const { fetchImpl } = mockFetch(401, null, `unauthorized ${TOKEN}`);
    const result = await publishLinkedInTextPost({
      accessToken: TOKEN,
      authorUrn: ORG,
      commentary: 'Text',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('LinkedIn 401');
    expect(result.error).not.toContain(TOKEN);
    expect(result.error).toContain('[redacted]');
  });

  it('verwendet die URN der Mandanten-Zeile und keinen Env-Token', async () => {
    const { key, b64 } = await fixtureKey();
    const sealed = await sealSocialCredentials(key, { access_token: TOKEN });
    if (!sealed.ok) throw new Error('seal failed');
    const { fetchImpl, calls } = mockFetch(201, 'urn:li:share:99');
    const result = await publishLinkedInQueueJob(
      memoryAdmin([
        row({ id: 'c1', account_external_id: ORG, credentials_enc: sealed.sealed }),
        row({ id: 'c2', account_external_id: PERSON, credentials_enc: sealed.sealed }),
      ]),
      {
        tenantId: 'tenant-a',
        queueChannel: 'linkedin.enterprise',
        body: 'Hinweis',
        accountExternalId: PERSON,
        fetchImpl,
        readEnv: (name) => {
          if (name === 'INTEGRATION_CREDENTIALS_KEY') return b64;
          if (name === LEGACY_ENV_TOKEN_FLAG) return 'on';
          if (name === 'LINKEDIN_ACCESS_TOKEN') return OTHER;
          return undefined;
        },
      },
    );
    expect(result).toEqual({ ok: true, externalId: 'urn:li:share:99' });
    expect(calls[0]!.body?.author).toBe(PERSON);
    expect(calls[0]!.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0]!.headers.authorization).not.toContain(OTHER);
  });

  it('schlaegt ohne Verbindung fehl und sendet das Plattform-Token nicht', async () => {
    const { fetchImpl, calls } = mockFetch(201, 'urn:li:share:1');
    const result = await publishLinkedInQueueJob(memoryAdmin([]), {
      tenantId: 'tenant-a',
      queueChannel: 'linkedin.legal',
      body: 'Hinweis',
      accountExternalId: null,
      fetchImpl,
      readEnv: (name) => {
        if (name === LEGACY_ENV_TOKEN_FLAG) return 'on';
        if (name === 'LINKEDIN_ACCESS_TOKEN') return TOKEN;
        return undefined;
      },
    });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  it('nimmt bei genau einer Verbindung deren URN, auch ohne Hinweis am Job', async () => {
    const { key, b64 } = await fixtureKey();
    const sealed = await sealSocialCredentials(key, { access_token: TOKEN });
    if (!sealed.ok) throw new Error('seal failed');
    const { fetchImpl, calls } = mockFetch(201, 'urn:li:ugcPost:1');
    const result = await publishLinkedInQueueJob(
      memoryAdmin([row({ id: 'c1', account_external_id: ORG, credentials_enc: sealed.sealed })]),
      {
        tenantId: 'tenant-a',
        queueChannel: 'linkedin.legal',
        body: 'Hinweis',
        accountExternalId: null,
        fetchImpl,
        readEnv: (name) => (name === 'INTEGRATION_CREDENTIALS_KEY' ? b64 : undefined),
      },
    );
    expect(result).toEqual({ ok: true, externalId: 'urn:li:ugcPost:1' });
    expect(calls[0]!.body?.author).toBe(ORG);
    expect(JSON.stringify(calls)).not.toContain(OTHER);
  });

  it('ruft bei mehreren Konten ohne Kennung niemanden auf', async () => {
    const { key, b64 } = await fixtureKey();
    const sealed = await sealSocialCredentials(key, { access_token: TOKEN });
    if (!sealed.ok) throw new Error('seal failed');
    const { fetchImpl, calls } = mockFetch(201, 'urn:li:share:1');
    const result = await publishLinkedInQueueJob(
      memoryAdmin([
        row({ id: 'c1', account_external_id: ORG, credentials_enc: sealed.sealed }),
        row({ id: 'c2', account_external_id: PERSON, credentials_enc: sealed.sealed }),
      ]),
      {
        tenantId: 'tenant-a',
        queueChannel: 'linkedin.enterprise',
        body: 'Hinweis',
        accountExternalId: null,
        fetchImpl,
        readEnv: (name) => (name === 'INTEGRATION_CREDENTIALS_KEY' ? b64 : undefined),
      },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('account_external_id');
    expect(calls).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });
});
