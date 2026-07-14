import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postEdgeFunction } from '../../src/lib/edgeFunction';

describe('postEdgeFunction', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    // Mock localStorage for auth-required functions
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => {
        if (key === 'sb-auth-token') return 'mock-jwt-token-test';
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
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

  it('throws a readable error on empty response body instead of a JSON.parse SyntaxError', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('', { status: 405 }));
    await expect(postEdgeFunction('gdpr-audit', {})).rejects.toThrow('HTTP 405');
  });

  it('throws a readable error on non-JSON (HTML) response body', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('<!doctype html><html>...</html>', { status: 200 }));
    await expect(postEdgeFunction('gdpr-audit', {})).rejects.toThrow(/Ungültige Server-Antwort/);
  });

  it('throws before fetching when a JWT is required but no token is in localStorage', async () => {
    // Anonymous visitor: no sb-auth-token. Default (auth-required) must fail fast.
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    await expect(postEdgeFunction('some-protected-fn', {})).rejects.toThrow(
      'Nicht authentifiziert – kein Token in localStorage',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls a public function (requireAuth:false) for anon visitors without an Authorization header', async () => {
    // Regression: the free Audit flow (gdpr-audit, verify_jwt=false) must work
    // for logged-out visitors. Previously this threw because postEdgeFunction
    // defaulted to requiring a localStorage JWT.
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
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
