import { describe, it, expect, vi } from 'vitest';
import {
  normalizeRuntimeUrl,
  detectMixedContent,
  probeRuntime,
  connectionOutcome,
  chatJson,
} from '@/src/features/local-ai/runtimeClient';

const HTTP_PAGE = { pageOrigin: 'http://localhost:3000' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('normalizeRuntimeUrl', () => {
  it('accepts loopback and strips paths', () => {
    expect(normalizeRuntimeUrl('http://127.0.0.1:11434/api/tags')).toEqual({ ok: true, data: 'http://127.0.0.1:11434' });
    expect(normalizeRuntimeUrl('localhost:11434')).toEqual({ ok: true, data: 'http://localhost:11434' });
  });

  it('accepts private LAN addresses and *.local', () => {
    expect(normalizeRuntimeUrl('http://192.168.1.20:11434').ok).toBe(true);
    expect(normalizeRuntimeUrl('http://10.0.0.5:11434').ok).toBe(true);
    expect(normalizeRuntimeUrl('http://172.20.1.1:11434').ok).toBe(true);
    expect(normalizeRuntimeUrl('http://gpu-box.local:11434').ok).toBe(true);
  });

  it('rejects public hosts — a local AI must be local', () => {
    const r = normalizeRuntimeUrl('https://ollama.example.com');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NON_LOCAL_HOST');
    const r2 = normalizeRuntimeUrl('http://172.32.0.1:11434');
    expect(!r2.ok && r2.error.code).toBe('NON_LOCAL_HOST');
  });

  it('rejects credentials, bad protocols and empty input', () => {
    const cred = normalizeRuntimeUrl('http://user:pw@127.0.0.1:11434');
    expect(!cred.ok && cred.error.code).toBe('URL_CREDENTIALS_NOT_ALLOWED');
    const proto = normalizeRuntimeUrl('ftp://127.0.0.1');
    expect(!proto.ok && proto.error.code).toBe('INVALID_URL');
    const empty = normalizeRuntimeUrl('   ');
    expect(!empty.ok && empty.error.code).toBe('INVALID_URL');
  });
});

describe('detectMixedContent', () => {
  it('blocks http LAN targets from an https page, allows loopback', () => {
    expect(detectMixedContent('http://192.168.1.2:11434', 'https://realsyncdynamicsai.de')?.code).toBe('MIXED_CONTENT_BLOCKED');
    expect(detectMixedContent('http://127.0.0.1:11434', 'https://realsyncdynamicsai.de')).toBeNull();
    expect(detectMixedContent('https://gpu.local', 'https://realsyncdynamicsai.de')).toBeNull();
  });
});

describe('probeRuntime', () => {
  it('returns models and latency on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ models: [{ name: 'granite4.2:8b' }, { name: '' }, {}] }));
    let t = 0;
    const r = await probeRuntime('http://127.0.0.1:11434', { ...HTTP_PAGE, fetchImpl, now: () => (t += 42) });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.models).toEqual(['granite4.2:8b']);
      expect(r.data.latencyMs).toBe(42);
    }
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:11434/api/tags', expect.objectContaining({ method: 'GET' }));
    expect(connectionOutcome(r)).toBe('reachable');
  });

  it('reports no_models when Ollama runs without models', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ models: [] }));
    const r = await probeRuntime('http://127.0.0.1:11434', { ...HTTP_PAGE, fetchImpl });
    expect(connectionOutcome(r)).toBe('no_models');
  });

  it('classifies CORS when the no-cors retry reaches the host', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const r = await probeRuntime('http://127.0.0.1:11434', { ...HTTP_PAGE, fetchImpl });
    expect(!r.ok && r.error.code).toBe('CORS_BLOCKED');
    expect(!r.ok && r.error.hint).toContain('OLLAMA_ORIGINS');
    expect(connectionOutcome(r)).toBe('blocked');
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({ mode: 'no-cors' });
  });

  it('classifies unreachable when both requests fail', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const r = await probeRuntime('http://127.0.0.1:11434', { ...HTTP_PAGE, fetchImpl });
    expect(!r.ok && r.error.code).toBe('RUNTIME_UNREACHABLE');
    expect(connectionOutcome(r)).toBe('unreachable');
  });

  it('maps an abort to TIMEOUT', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fetchImpl = vi.fn().mockRejectedValue(abort);
    const r = await probeRuntime('http://127.0.0.1:11434', { ...HTTP_PAGE, fetchImpl });
    expect(!r.ok && r.error.code).toBe('TIMEOUT');
  });

  it('fails closed on non-Ollama responses and HTTP errors', async () => {
    const notOllama = await probeRuntime('http://127.0.0.1:11434', { ...HTTP_PAGE, fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ hello: 1 })) });
    expect(!notOllama.ok && notOllama.error.code).toBe('NOT_OLLAMA');
    const http = await probeRuntime('http://127.0.0.1:11434', { ...HTTP_PAGE, fetchImpl: vi.fn().mockResolvedValue(jsonResponse({}, 500)) });
    expect(!http.ok && http.error.code).toBe('RUNTIME_HTTP_ERROR');
  });

  it('never fetches a public host', async () => {
    const fetchImpl = vi.fn();
    const r = await probeRuntime('https://evil.example.com', { ...HTTP_PAGE, fetchImpl });
    expect(connectionOutcome(r)).toBe('invalid');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('chatJson', () => {
  it('sends a non-streaming JSON request and returns content', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ message: { content: '{"a":1}' } }));
    const r = await chatJson({ runtimeUrl: 'http://127.0.0.1:11434', model: 'm', system: 's', prompt: 'p' }, { ...HTTP_PAGE, fetchImpl });
    expect(r.ok && r.data.content).toBe('{"a":1}');
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).toMatchObject({ model: 'm', stream: false, format: 'json' });
  });

  it('maps 404 to MODEL_NOT_INSTALLED with pull hint and empty content to EMPTY_RESPONSE', async () => {
    const missing = await chatJson(
      { runtimeUrl: 'http://127.0.0.1:11434', model: 'granite4.2:8b', system: 's', prompt: 'p' },
      { ...HTTP_PAGE, fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ error: 'not found' }, 404)) },
    );
    expect(!missing.ok && missing.error.code).toBe('MODEL_NOT_INSTALLED');
    expect(!missing.ok && missing.error.hint).toBe('ollama pull granite4.2:8b');
    const empty = await chatJson(
      { runtimeUrl: 'http://127.0.0.1:11434', model: 'm', system: 's', prompt: 'p' },
      { ...HTTP_PAGE, fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ message: { content: '  ' } })) },
    );
    expect(!empty.ok && empty.error.code).toBe('EMPTY_RESPONSE');
  });
});
