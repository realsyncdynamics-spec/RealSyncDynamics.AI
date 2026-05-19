import { describe, it, expect, vi } from 'vitest';
import { OpenAIAdapter } from '../../../src/core/ai-gateway/providers/openaiAdapter';
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
    id:     'chatcmpl_1',
    model:  'gpt-4.1-mini',
    choices: [{ message: { role: 'assistant', content: 'hi back' } }],
    usage:   { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
  };
  return vi.fn(async () => ({
    ok,
    status,
    json: async () => body,
  } as unknown as Response)) as unknown as typeof fetch;
}

describe('OpenAIAdapter.health', () => {
  it('returns ok=true when an API key is present', async () => {
    const a = new OpenAIAdapter({ apiKey: 'sk-...', model: 'gpt-4.1-mini' });
    const h = await a.health();
    expect(h.ok).toBe(true);
    expect(h.models).toContain('gpt-4.1-mini');
  });

  it('lists the embeddingModel too when configured', async () => {
    const a = new OpenAIAdapter({
      apiKey: 'sk', model: 'gpt-4.1-mini', embeddingModel: 'text-embedding-3-small',
    });
    const h = await a.health();
    expect(h.models).toEqual(expect.arrayContaining(['gpt-4.1-mini', 'text-embedding-3-small']));
  });

  it('returns ok=false when API key is empty', async () => {
    const a = new OpenAIAdapter({ apiKey: '', model: 'gpt-4.1-mini' });
    const h = await a.health();
    expect(h.ok).toBe(false);
    expect(h.error).toMatch(/not set/);
  });
});

describe('OpenAIAdapter.generate', () => {
  it('POSTs to /v1/chat/completions with Bearer auth', async () => {
    const f = fakeFetch();
    const a = new OpenAIAdapter({ apiKey: 'sk-test', model: 'gpt-4.1-mini', fetchImpl: f });
    await a.generate(req());

    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['authorization']).toBe('Bearer sk-test');
  });

  it('returns the assistant text + usage', async () => {
    const a = new OpenAIAdapter({
      apiKey: 'sk', model: 'gpt-4.1-mini',
      fetchImpl: fakeFetch({ body: {
        id: 'x', model: 'gpt-4.1-mini',
        choices: [{ message: { role: 'assistant', content: 'Antwort hier' } }],
        usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
      }}),
    });
    const out = await a.generate(req());
    expect(out.provider).toBe('openai');
    expect(out.output).toBe('Antwort hier');
    expect(out.usage?.input_tokens).toBe(12);
    expect(out.usage?.output_tokens).toBe(8);
    expect(out.usage?.total_tokens).toBe(20);
  });

  it('includes a system message when system_prompt is set', async () => {
    const f = fakeFetch();
    const a = new OpenAIAdapter({ apiKey: 'sk', model: 'gpt-4.1-mini', fetchImpl: f });
    await a.generate(req({ system_prompt: 'Du bist der RealSync-Assistent.' }));
    const body = JSON.parse(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string);
    expect(body.messages).toEqual([
      { role: 'system', content: 'Du bist der RealSync-Assistent.' },
      { role: 'user',   content: 'Was deckt der DSGVO-Audit ab?' },
    ]);
  });

  it('throws when the API returns an error envelope', async () => {
    const a = new OpenAIAdapter({
      apiKey: 'sk', model: 'gpt-4.1-mini',
      fetchImpl: fakeFetch({ ok: false, status: 401, body: { error: { message: 'invalid api key' } } }),
    });
    await expect(a.generate(req())).rejects.toThrow(/invalid api key/);
  });
});

describe('OpenAIAdapter.extractJson', () => {
  it('sets response_format: json_object and returns parsed JSON', async () => {
    const f = fakeFetch({ body: {
      id: 'x', model: 'gpt-4.1-mini',
      choices: [{ message: { role: 'assistant', content: '{"verdict":"compliant","score":92}' } }],
      usage: { prompt_tokens: 5, completion_tokens: 6, total_tokens: 11 },
    }});
    const a = new OpenAIAdapter({ apiKey: 'sk', model: 'gpt-4.1-mini', fetchImpl: f });
    const out = await a.extractJson<{ verdict: string; score: number }>(req({ task_type: 'extract_json' }));
    expect(out.output).toEqual({ verdict: 'compliant', score: 92 });
    const body = JSON.parse(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('throws on invalid JSON', async () => {
    const a = new OpenAIAdapter({
      apiKey: 'sk', model: 'gpt-4.1-mini',
      fetchImpl: fakeFetch({ body: {
        id: 'x', model: 'gpt-4.1-mini',
        choices: [{ message: { role: 'assistant', content: 'not valid json' } }],
      }}),
    });
    await expect(a.extractJson(req({ task_type: 'extract_json' }))).rejects.toThrow(/invalid JSON/);
  });
});

describe('OpenAIAdapter.embed', () => {
  it('requires embeddingModel — throws when omitted', async () => {
    const a = new OpenAIAdapter({ apiKey: 'sk', model: 'gpt-4.1-mini' });
    await expect(a.embed(req({ task_type: 'embed' }))).rejects.toThrow(/embeddingModel not configured/);
  });

  it('POSTs to /v1/embeddings and returns the vector', async () => {
    const f = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 6, total_tokens: 6 },
      }),
    } as unknown as Response)) as unknown as typeof fetch;
    const a = new OpenAIAdapter({
      apiKey: 'sk', model: 'gpt-4.1-mini', embeddingModel: 'text-embedding-3-small',
      fetchImpl: f,
    });
    const out = await a.embed(req({ task_type: 'embed', model_profile: 'embed-default' }));
    expect(out.output).toEqual([0.1, 0.2, 0.3]);
    expect(out.provider).toBe('openai');
    expect(out.model).toBe('text-embedding-3-small');
    const [url] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/embeddings');
  });
});
