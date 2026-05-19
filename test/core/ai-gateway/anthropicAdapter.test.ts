import { describe, it, expect, vi } from 'vitest';
import { AnthropicAdapter } from '../../../src/core/ai-gateway/providers/anthropicAdapter';
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
    id:    'msg_1',
    model: 'claude-haiku-4-5',
    content: [{ type: 'text', text: 'hi back' }],
    usage:   { input_tokens: 10, output_tokens: 4 },
  };
  return vi.fn(async () => ({
    ok,
    status,
    json: async () => body,
  } as unknown as Response)) as unknown as typeof fetch;
}

describe('AnthropicAdapter.health', () => {
  it('returns ok=true when an API key is present', async () => {
    const a = new AnthropicAdapter({ apiKey: 'sk-ant-...', model: 'claude-haiku-4-5' });
    expect(await a.health()).toEqual({ ok: true, models: ['claude-haiku-4-5'] });
  });

  it('returns ok=false when API key is empty', async () => {
    const a = new AnthropicAdapter({ apiKey: '', model: 'claude-haiku-4-5' });
    const h = await a.health();
    expect(h.ok).toBe(false);
    expect(h.error).toMatch(/not set/);
  });
});

describe('AnthropicAdapter.generate', () => {
  it('POSTs to /v1/messages with x-api-key + anthropic-version headers', async () => {
    const f = fakeFetch();
    const a = new AnthropicAdapter({ apiKey: 'sk-ant-test', model: 'claude-haiku-4-5', fetchImpl: f });
    await a.generate(req());

    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('returns the assistant text + usage', async () => {
    const a = new AnthropicAdapter({
      apiKey: 'k', model: 'claude-haiku-4-5',
      fetchImpl: fakeFetch({ body: {
        id: 'msg_2', model: 'claude-haiku-4-5',
        content: [{ type: 'text', text: 'Antwort A' }, { type: 'text', text: 'Antwort B' }],
        usage: { input_tokens: 12, output_tokens: 8, cache_creation_input_tokens: 4 },
      }}),
    });
    const out = await a.generate(req());
    expect(out.provider).toBe('anthropic');
    expect(out.output).toBe('Antwort A\nAntwort B');
    expect(out.usage?.input_tokens).toBe(12 + 4);     // cache-creation counts toward input
    expect(out.usage?.output_tokens).toBe(8);
  });

  it('omits temperature for Claude 4.x model ids (Anthropic deprecation)', async () => {
    const f = fakeFetch();
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-haiku-4-5-20251001', fetchImpl: f });
    await a.generate(req({ temperature: 0.5 }));
    const body = JSON.parse(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string);
    expect('temperature' in body).toBe(false);
  });

  it('does pass temperature for legacy model ids', async () => {
    const f = fakeFetch();
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-3-5-sonnet-20241022', fetchImpl: f });
    await a.generate(req({ temperature: 0.7 }));
    const body = JSON.parse(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string);
    expect(body.temperature).toBe(0.7);
  });

  it('throws when the API returns an error envelope', async () => {
    const a = new AnthropicAdapter({
      apiKey: 'k', model: 'claude-haiku-4-5',
      fetchImpl: fakeFetch({ ok: false, status: 401, body: { error: { message: 'invalid x-api-key' } } }),
    });
    await expect(a.generate(req())).rejects.toThrow(/invalid x-api-key/);
  });

  it('attaches system_prompt with cache_control: ephemeral', async () => {
    const f = fakeFetch();
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-haiku-4-5', fetchImpl: f });
    await a.generate(req({ system_prompt: 'You are the RealSync compliance assistant.' }));
    const body = JSON.parse(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string);
    expect(body.system).toEqual([
      { type: 'text', text: 'You are the RealSync compliance assistant.', cache_control: { type: 'ephemeral' } },
    ]);
  });
});

describe('AnthropicAdapter.extractJson', () => {
  it('returns parsed JSON when the model emits valid JSON', async () => {
    const a = new AnthropicAdapter({
      apiKey: 'k', model: 'claude-haiku-4-5',
      fetchImpl: fakeFetch({ body: {
        id: 'msg', model: 'claude-haiku-4-5',
        content: [{ type: 'text', text: '{"verdict":"compliant","score":92}' }],
        usage: { input_tokens: 5, output_tokens: 6 },
      }}),
    });
    const out = await a.extractJson<{ verdict: string; score: number }>(req({ task_type: 'extract_json' }));
    expect(out.output).toEqual({ verdict: 'compliant', score: 92 });
  });

  it('throws when the response is not valid JSON', async () => {
    const a = new AnthropicAdapter({
      apiKey: 'k', model: 'claude-haiku-4-5',
      fetchImpl: fakeFetch({ body: {
        id: 'msg', model: 'claude-haiku-4-5',
        content: [{ type: 'text', text: 'I think it is mostly compliant.' }],
        usage: { input_tokens: 5, output_tokens: 6 },
      }}),
    });
    await expect(a.extractJson(req({ task_type: 'extract_json' }))).rejects.toThrow(/invalid JSON/);
  });
});

describe('AnthropicAdapter.embed', () => {
  it('throws — Anthropic offers no embeddings API', async () => {
    const a = new AnthropicAdapter({ apiKey: 'k', model: 'claude-haiku-4-5' });
    await expect(a.embed(req({ task_type: 'embed' }))).rejects.toThrow(/no embeddings API/);
  });
});
