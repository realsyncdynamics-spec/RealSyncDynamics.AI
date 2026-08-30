import { describe, it, expect, vi } from 'vitest';
import { GoogleGenAIAdapter } from '../../../src/core/ai-gateway/providers/googleGenAIAdapter';
import type { AiGatewayRequest } from '../../../src/core/ai-gateway/types';

function req(over: Partial<AiGatewayRequest> = {}): AiGatewayRequest {
  return {
    feature: 'governance_chat',
    task_type: 'chat',
    model_profile: 'cloud-fallback',
    input: 'Was deckt der DSGVO-Audit ab?',
    ...over,
  };
}

function fakeFetch(opts: { ok?: boolean; status?: number; body?: unknown } = {}): typeof fetch {
  const ok = opts.ok ?? true;
  const status = opts.status ?? 200;
  const body = opts.body ?? {
    candidates: [{ content: { role: 'model', parts: [{ text: 'Der Scan prüft Cookies und Tracker.' }] } }],
    usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8, totalTokenCount: 20 },
  };
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
}

describe('GoogleGenAIAdapter', () => {
  it('reports unhealthy without an API key', async () => {
    const a = new GoogleGenAIAdapter({ apiKey: '', model: 'gemini-2.0-flash', fetchImpl: fakeFetch() });
    expect((await a.health()).ok).toBe(false);
  });

  it('generates text and maps usage from usageMetadata', async () => {
    const a = new GoogleGenAIAdapter({ apiKey: 'k', model: 'gemini-2.0-flash', fetchImpl: fakeFetch() });
    const r = await a.generate(req());
    expect(r.provider).toBe('google');
    expect(r.output).toContain('Cookies');
    expect(r.usage).toMatchObject({ input_tokens: 12, output_tokens: 8, total_tokens: 20 });
  });

  it('sends the API key as a query param and hits generateContent', async () => {
    const spy = fakeFetch();
    const a = new GoogleGenAIAdapter({ apiKey: 'secret-key', model: 'gemini-2.0-flash', fetchImpl: spy });
    await a.generate(req());
    const url = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain(':generateContent');
    expect(url).toContain('key=secret-key');
  });

  it('parses JSON in extractJson', async () => {
    const body = {
      candidates: [{ content: { parts: [{ text: '{"risk":"high"}' }] } }],
      usageMetadata: { totalTokenCount: 5 },
    };
    const a = new GoogleGenAIAdapter({ apiKey: 'k', model: 'gemini-2.0-flash', fetchImpl: fakeFetch({ body }) });
    const r = await a.extractJson<{ risk: string }>(req({ task_type: 'extract_json' }));
    expect(r.output.risk).toBe('high');
  });

  it('throws a labelled error on non-2xx', async () => {
    const a = new GoogleGenAIAdapter({
      apiKey: 'k',
      model: 'gemini-2.0-flash',
      fetchImpl: fakeFetch({ ok: false, status: 503, body: { error: { message: 'overloaded' } } }),
    });
    await expect(a.generate(req())).rejects.toThrow(/overloaded/);
  });

  it('embeds via embedContent', async () => {
    const body = { embedding: { values: [0.1, 0.2, 0.3] } };
    const a = new GoogleGenAIAdapter({
      apiKey: 'k',
      model: 'gemini-2.0-flash',
      embeddingModel: 'text-embedding-004',
      fetchImpl: fakeFetch({ body }),
    });
    const r = await a.embed(req({ task_type: 'embed' }));
    expect(r.output).toEqual([0.1, 0.2, 0.3]);
  });
});
