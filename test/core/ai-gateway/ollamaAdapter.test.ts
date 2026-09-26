import { describe, it, expect, vi } from 'vitest';
import { OllamaAdapter, buildOllamaAuthorization } from '../../../src/core/ai-gateway/providers/ollamaAdapter';
import type { AiGatewayRequest } from '../../../src/core/ai-gateway/types';

function req(over: Partial<AiGatewayRequest> = {}): AiGatewayRequest {
  return {
    feature: 'governance_chat',
    task_type: 'chat',
    model_profile: 'fast-local',
    input: 'Fasse den Prüfpfad zusammen.',
    ...over,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('OllamaAdapter', () => {
  it('reports id "ollama"', () => {
    const a = new OllamaAdapter({ model: 'llama3.1:8b', fetchImpl: (() => {}) as unknown as typeof fetch });
    expect(a.id).toBe('ollama');
  });

  it('health lists local models from /api/tags', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ models: [{ name: 'llama3.1:8b' }] })) as unknown as typeof fetch;
    const a = new OllamaAdapter({ model: 'llama3.1:8b', fetchImpl });
    const h = await a.health();
    expect(h.ok).toBe(true);
    expect(h.models).toContain('llama3.1:8b');
  });

  it('health returns not-ok (not throw) when the daemon is unreachable', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('connection refused');
    }) as unknown as typeof fetch;
    const a = new OllamaAdapter({ model: 'llama3.1:8b', fetchImpl });
    const h = await a.health();
    expect(h.ok).toBe(false);
    expect(h.error).toMatch(/connection refused/);
  });

  it('generates via /api/chat and maps token counts', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        model: 'llama3.1:8b',
        message: { role: 'assistant', content: 'Der Prüfpfad ist lückenlos.' },
        prompt_eval_count: 10,
        eval_count: 6,
      }),
    ) as unknown as typeof fetch;
    const a = new OllamaAdapter({ model: 'llama3.1:8b', fetchImpl });
    const r = await a.generate(req());
    expect(r.provider).toBe('ollama');
    expect(r.output).toContain('lückenlos');
    expect(r.usage).toMatchObject({ input_tokens: 10, output_tokens: 6, total_tokens: 16 });
  });

  it('defaults the base URL to localhost:11434 and strips trailing slashes', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: { content: 'ok' } })) as unknown as typeof fetch;
    const a = new OllamaAdapter({ model: 'llama3.1:8b', baseUrl: 'http://ollama.internal:11434/', fetchImpl });
    await a.generate(req());
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe('http://ollama.internal:11434/api/chat');
  });

  it('sets format=json for extractJson and parses the result', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: { content: '{"ok":true}' } })) as unknown as typeof fetch;
    const a = new OllamaAdapter({ model: 'llama3.1:8b', fetchImpl });
    const r = await a.extractJson<{ ok: boolean }>(req({ task_type: 'extract_json' }));
    expect(r.output.ok).toBe(true);
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.format).toBe('json');
    expect(body.stream).toBe(false);
  });

  it('throws a labelled error on non-2xx chat', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'model not found' }, 404)) as unknown as typeof fetch;
    const a = new OllamaAdapter({ model: 'nope', fetchImpl });
    await expect(a.generate(req())).rejects.toThrow(/model not found/);
  });

  it('embeds via /api/embeddings, using embeddingModel when set', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ embedding: [0.5, 0.6] })) as unknown as typeof fetch;
    const a = new OllamaAdapter({ model: 'llama3.1:8b', embeddingModel: 'nomic-embed-text', fetchImpl });
    const r = await a.embed(req({ task_type: 'embed' }));
    expect(r.output).toEqual([0.5, 0.6]);
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.model).toBe('nomic-embed-text');
  });
});


describe('Ollama auth compatibility', () => {
  it('infers Basic auth from user:password tokens', () => {
    expect(buildOllamaAuthorization('kodee:secret')).toBe(`Basic ${btoa('kodee:secret')}`);
  });

  it('infers Bearer auth from opaque tokens', () => {
    expect(buildOllamaAuthorization('abc123')).toBe('Bearer abc123');
  });

  it('respects explicit auth mode overrides', () => {
    expect(buildOllamaAuthorization('abc123', 'basic')).toBe(`Basic ${btoa('abc123')}`);
    expect(buildOllamaAuthorization('kodee:secret', 'bearer')).toBe('Bearer kodee:secret');
  });

  it('sends auth on health, chat and embeddings requests', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/api/tags')) return jsonResponse({ models: [] });
      if (url.endsWith('/api/embeddings')) return jsonResponse({ embedding: [0.1] });
      return jsonResponse({ message: { content: 'ok' } });
    }) as unknown as typeof fetch;

    const a = new OllamaAdapter({
      model: 'gemma3:4b',
      embeddingModel: 'nomic-embed-text',
      baseUrl: 'https://ollama.example.test',
      authToken: 'kodee:secret',
      fetchImpl,
    });

    await a.health();
    await a.generate(req());
    await a.embed(req({ task_type: 'embed' }));

    for (const call of calls) {
      const headers = new Headers(call.init?.headers);
      expect(headers.get('authorization')).toBe(`Basic ${btoa('kodee:secret')}`);
    }
  });
});
