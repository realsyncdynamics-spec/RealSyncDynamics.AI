import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Sitzung wie supabase-js sie liefert; je Test überschreibbar.
const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
}));
vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => ({ auth }),
}));

import {
  EDGE_AUTH_REQUIRED_MESSAGE,
  isEdgeAuthRequiredError,
  postEdgeFunction,
} from '../../src/lib/edgeFunction';

const signedIn = () => ({ data: { session: { access_token: 'mock-jwt-token-test' } }, error: null });
const signedOut = () => ({ data: { session: null }, error: null });

describe('postEdgeFunction', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    auth.getSession.mockReset();
    auth.getSession.mockResolvedValue(signedIn());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns parsed JSON on ok:true response', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, score: 88 }), { status: 200 }),
    );
    const data = await postEdgeFunction<{ ok: boolean; score: number }>('gdpr-audit', { url: 'https://x.de' });
    expect(data.score).toBe(88);
  });

  it('throws error message from ok:false JSON body', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: { code: 'RATE_LIMITED', message: 'too many audits' } }), { status: 429 }),
    );
    await expect(postEdgeFunction('gdpr-audit', {})).rejects.toThrow('too many audits');
  });

  it('turns a network/CORS failure into a readable message that names the function', async () => {
    // Genau so sah der Ausfall vom 2026-08-11 aus: die Function stürzte ab, die
    // Edge-Runtime antwortete mit 500 ohne CORS-Header, der Browser verwarf die
    // Antwort und fetch() rejectete mit `TypeError: Failed to fetch`.
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(postEdgeFunction('gdpr-audit', {})).rejects.toThrow(
      'Backend nicht erreichbar (gdpr-audit). Bitte Netzwerkverbindung prüfen und erneut versuchen.',
    );
  });

  it('throws a readable error on empty response body instead of a JSON.parse SyntaxError', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('', { status: 405 }));
    await expect(postEdgeFunction('gdpr-audit', {})).rejects.toThrow('HTTP 405');
  });

  it('throws a readable error on non-JSON (HTML) response body', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('<!doctype html><html>...</html>', { status: 200 }));
    await expect(postEdgeFunction('gdpr-audit', {})).rejects.toThrow(/Ungültige Server-Antwort/);
  });

  it('sends the access token of the Supabase session as Bearer header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    global.fetch = fetchMock;
    await postEdgeFunction('create-trial-subscription', { planKey: 'growth' });
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer mock-jwt-token-test');
  });

  it('ignores the legacy localStorage key sb-auth-token — only the real session counts', async () => {
    // Regression: Der Helper las `sb-auth-token`, das nichts schreibt
    // (supabase-js speichert unter `sb-<projekt>-auth-token`). Angemeldete
    // Nutzer scheiterten deshalb an Growth-Testphase und Firmenprofil.
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'stale-token'), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() });
    auth.getSession.mockResolvedValue(signedOut());
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    await expect(postEdgeFunction('save-company-profile', {})).rejects.toThrow(EDGE_AUTH_REQUIRED_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws before fetching when a JWT is required but there is no session', async () => {
    // Anonymous visitor: no session. Default (auth-required) must fail fast.
    auth.getSession.mockResolvedValue(signedOut());
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    await expect(postEdgeFunction('some-protected-fn', {})).rejects.toThrow(
      'Nicht authentifiziert – keine gültige Sitzung',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a failing session lookup as not authenticated (fail closed)', async () => {
    auth.getSession.mockRejectedValue(new Error('storage blocked'));
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    await expect(postEdgeFunction('some-protected-fn', {})).rejects.toThrow(EDGE_AUTH_REQUIRED_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls a public function (requireAuth:false) for anon visitors without an Authorization header', async () => {
    // Regression: the free Audit flow (gdpr-audit, verify_jwt=false) must work
    // for logged-out visitors. Previously this threw because postEdgeFunction
    // defaulted to requiring a JWT.
    auth.getSession.mockResolvedValue(signedOut());
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, score: 73 }), { status: 200 }),
    );
    global.fetch = fetchMock;
    const data = await postEdgeFunction<{ score: number }>(
      'gdpr-audit',
      { url: 'https://x.de' },
      { requireAuth: false },
    );
    expect(data.score).toBe(73);
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it('falls back to the production Supabase URL when VITE_SUPABASE_URL is not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, score: 42 }), { status: 200 }),
    );
    global.fetch = fetchMock;
    const data = await postEdgeFunction<{ score: number }>('gdpr-audit', {});
    expect(data.score).toBe(42);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/gdpr-audit',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('isEdgeAuthRequiredError', () => {
  it('matches the guard message thrown without a token', () => {
    expect(isEdgeAuthRequiredError(EDGE_AUTH_REQUIRED_MESSAGE)).toBe(true);
    expect(isEdgeAuthRequiredError('Nicht authentifiziert – kein Token in localStorage')).toBe(true);
    expect(isEdgeAuthRequiredError('Nicht authentifiziert – keine gültige Sitzung')).toBe(true);
    expect(isEdgeAuthRequiredError('Backend nicht erreichbar (gdpr-audit).')).toBe(false);
    expect(isEdgeAuthRequiredError(null)).toBe(false);
  });
});
