import { describe, it, expect, vi } from 'vitest';
import { LMStudioAdapter } from '../../../src/core/ai-gateway/providers/lmStudioAdapter';
import type { AiGatewayRequest } from '../../../src/core/ai-gateway/types';

function makeFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => {
  status?: number; body: unknown;
}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const { status = 200, body } = handler(input, init);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as unknown as Response;
  });
}

function chatRequest(overrides: Partial<AiGatewayRequest> = {}): AiGatewayRequest {
  return {
    feature: 'governance_chat',
    task_type: 'chat',
    model_profile: 'fast-local',
    input: 'Was ist DSGVO Art. 6?',
    ...overrides,
  };
}

describe('LMStudioAdapter', () => {
  it('health() maps /models response to a list of model ids', async () => {
    const fetchImpl = makeFetch(() => ({
      body: { data: [{ id: 'qwen2.5-7b' }, { id: 'nomic-embed' }] },
    }));
    const adapter = new LMStudioAdapter({ baseUrl: 'http://x:1234/v1', fetchImpl });

    const result = await adapter.health();
    expect(result.ok).toBe(true);
    expect(result.models).toEqual(['qwen2.5-7b', 'nomic-embed']);
  });

  it('health() returns ok=false with the error string on HTTP failure', async () => {
    const fetchImpl = makeFetch(() => ({ status: 503, body: {} }));
    const adapter = new LMStudioAdapter({ baseUrl: 'http://x:1234/v1', fetchImpl });

    const result = await adapter.health();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('503');
  });

  it('generate() resolves a model via health() and normalises chat/completions', async () => {
    const fetchImpl = makeFetch((input) => {
      if (String(input).endsWith('/models')) {
        return { body: { data: [{ id: 'qwen2.5-7b' }] } };
      }
      return {
        body: {
          choices: [{ message: { content: 'Art. 6 listet sechs Rechtsgrundlagen.' } }],
          usage: { prompt_tokens: 12, completion_tokens: 19, total_tokens: 31 },
        },
      };
    });
    const adapter = new LMStudioAdapter({ baseUrl: 'http://x:1234/v1', fetchImpl });

    const response = await adapter.generate(chatRequest());

    expect(response.provider).toBe('lm_studio');
    expect(response.model).toBe('qwen2.5-7b');
    expect(response.output).toBe('Art. 6 listet sechs Rechtsgrundlagen.');
    expect(response.usage?.total_tokens).toBe(31);
    expect(response.trace_id).toBeTruthy();
    expect(response.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('extractJson() rejects invalid JSON output', async () => {
    const fetchImpl = makeFetch((input) => {
      if (String(input).endsWith('/models')) {
        return { body: { data: [{ id: 'qwen2.5-7b' }] } };
      }
      return {
        body: { choices: [{ message: { content: 'not json at all' } }] },
      };
    });
    const adapter = new LMStudioAdapter({ baseUrl: 'http://x:1234/v1', fetchImpl });

    await expect(
      adapter.extractJson(chatRequest({ task_type: 'extract_json', model_profile: 'strict-json' })),
    ).rejects.toThrow(/invalid JSON/i);
  });

  it('extractJson() parses valid JSON and re-shapes the response', async () => {
    const fetchImpl = makeFetch((input) => {
      if (String(input).endsWith('/models')) {
        return { body: { data: [{ id: 'qwen2.5-7b' }] } };
      }
      return {
        body: { choices: [{ message: { content: '{"risk_class":"limited"}' } }] },
      };
    });
    const adapter = new LMStudioAdapter({ baseUrl: 'http://x:1234/v1', fetchImpl });

    const response = await adapter.extractJson<{ risk_class: string }>(
      chatRequest({ task_type: 'extract_json', model_profile: 'strict-json' }),
    );
    expect(response.output.risk_class).toBe('limited');
  });

  it('resolveModel() fails cleanly when health returns no models', async () => {
    const fetchImpl = makeFetch(() => ({ body: { data: [] } }));
    const adapter = new LMStudioAdapter({ baseUrl: 'http://x:1234/v1', fetchImpl });

    await expect(adapter.generate(chatRequest())).rejects.toThrow(/No LM Studio model available/);
  });
});
