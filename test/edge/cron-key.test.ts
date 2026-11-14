// _shared/cronKey.ts — Verhaltensvertrag für requireCronKey/resolveCronKey.
//
// Ohne Datenbank: Deno.env und fetch (Vault-Fallback über get_app_secret)
// werden gestubbt. Geprüft wird der fail-closed-Vertrag, den die Cron-
// Empfänger teilen: kein Key → 500 CRON_KEY_MISSING, falscher Bearer → 401,
// passender Bearer → null; der service_role-Key ist nie ein gültiger Bearer.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

declare global {
  // eslint-disable-next-line no-var
  var Deno: { env: { get(k: string): string | undefined } };
}

let env: Record<string, string | undefined> = {};
globalThis.Deno = { env: { get: (k: string) => env[k] } };

const { requireCronKey, resolveCronKey, __resetCronKeyCacheForTests } = await import(
  '../../supabase/functions/_shared/cronKey.ts'
);

const SRK = 'service-role-key-value';
const CRON = 'cron-key-value';

function req(auth?: string): Request {
  return new Request('https://example.test/functions/v1/x', {
    method: 'POST',
    headers: auth === undefined ? {} : { Authorization: auth },
  });
}

async function body(res: Response): Promise<{ ok: boolean; error: { code: string; message: string } }> {
  return res.json();
}

describe('requireCronKey', () => {
  beforeEach(() => {
    env = { SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: SRK };
    __resetCronKeyCacheForTests();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Function Secret gesetzt, passender Bearer → null (weiter)', async () => {
    env.CRON_X_KEY = CRON;
    expect(await requireCronKey(req(`Bearer ${CRON}`), 'CRON_X_KEY', 'cron_x_key')).toBeNull();
  });

  it('falscher Bearer → 401 cron only', async () => {
    env.CRON_X_KEY = CRON;
    const res = await requireCronKey(req('Bearer falsch'), 'CRON_X_KEY', 'cron_x_key');
    expect(res?.status).toBe(401);
    expect((await body(res!)).error.message).toBe('cron only');
  });

  it('fehlender Header → 401', async () => {
    env.CRON_X_KEY = CRON;
    const res = await requireCronKey(req(), 'CRON_X_KEY', 'cron_x_key');
    expect(res?.status).toBe(401);
  });

  it('der service_role-Key ist kein gültiger Bearer', async () => {
    env.CRON_X_KEY = CRON;
    const res = await requireCronKey(req(`Bearer ${SRK}`), 'CRON_X_KEY', 'cron_x_key');
    expect(res?.status).toBe(401);
  });

  it('ohne Function Secret: Vault-Fallback über get_app_secret', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(CRON), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await requireCronKey(req(`Bearer ${CRON}`), 'CRON_X_KEY', 'cron_x_key')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://db.example.test/rest/v1/rpc/get_app_secret');
    expect(JSON.parse(String(init.body))).toEqual({ secret_name: 'cron_x_key' });
  });

  it('weder Secret noch Vault-Wert → 500 CRON_KEY_MISSING (fail-closed)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('null', { status: 200 })));
    const res = await requireCronKey(req(`Bearer ${CRON}`), 'CRON_X_KEY', 'cron_x_key');
    expect(res?.status).toBe(500);
    expect((await body(res!)).error.code).toBe('CRON_KEY_MISSING');
  });

  it('Vault-Lookup scheitert → 500, kein Durchlass', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('denied', { status: 403 })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await requireCronKey(req('Bearer '), 'CRON_X_KEY', 'cron_x_key');
    expect(res?.status).toBe(500);
  });

  it('leerer Bearer passiert nie, auch nicht bei leerem Key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(''), { status: 200 })));
    const res = await requireCronKey(req('Bearer '), 'CRON_X_KEY', 'cron_x_key');
    expect(res?.status).toBe(500);
  });
});

describe('resolveCronKey', () => {
  beforeEach(() => {
    env = { SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: SRK };
    __resetCronKeyCacheForTests();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('Function Secret hat Vorrang, kein Vault-Roundtrip', async () => {
    env.CRON_X_KEY = `  ${CRON}  `;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await resolveCronKey('CRON_X_KEY', 'cron_x_key')).toBe(CRON);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Vault-Wert wird gecacht', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(CRON), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await resolveCronKey('CRON_X_KEY', 'cron_x_key');
    await resolveCronKey('CRON_X_KEY', 'cron_x_key');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
