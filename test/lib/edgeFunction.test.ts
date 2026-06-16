import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postEdgeFunction } from '../../src/lib/edgeFunction';

describe('postEdgeFunction', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
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

  it('throws immediately when VITE_SUPABASE_URL is not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    global.fetch = vi.fn();
    await expect(postEdgeFunction('gdpr-audit', {})).rejects.toThrow('VITE_SUPABASE_URL');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
