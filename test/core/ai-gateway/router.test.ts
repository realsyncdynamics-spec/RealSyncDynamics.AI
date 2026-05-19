import { describe, it, expect, vi } from 'vitest';
import { AiGateway } from '../../../src/core/ai-gateway/router';
import type {
  AiGatewayRequest,
  AiGatewayResponse,
  AiProviderAdapter,
} from '../../../src/core/ai-gateway/types';

function stubAdapter(): AiProviderAdapter {
  const generate = vi.fn(async (req: AiGatewayRequest): Promise<AiGatewayResponse<string>> => ({
    provider: 'lm_studio',
    model: 'stub-model',
    profile: req.model_profile,
    output: 'stubbed output',
    trace_id: req.trace_id ?? 'fallback-trace',
    latency_ms: 1,
  }));
  async function extractJson<T>(req: AiGatewayRequest): Promise<AiGatewayResponse<T>> {
    return {
      provider: 'lm_studio',
      model: 'stub-model',
      profile: req.model_profile,
      output: { ok: true } as unknown as T,
      trace_id: req.trace_id ?? 'fallback-trace',
      latency_ms: 1,
    };
  }
  const embed = vi.fn(async (req: AiGatewayRequest): Promise<AiGatewayResponse<number[]>> => ({
    provider: 'lm_studio',
    model: 'stub-model',
    profile: req.model_profile,
    output: [0.1, 0.2],
    trace_id: req.trace_id ?? 'fallback-trace',
    latency_ms: 1,
  }));
  return {
    id: 'lm_studio',
    health: vi.fn(async () => ({ ok: true, models: ['stub-model'] })),
    generate,
    extractJson,
    embed,
  };
}

function chatRequest(overrides: Partial<AiGatewayRequest> = {}): AiGatewayRequest {
  return {
    feature: 'governance_chat',
    task_type: 'chat',
    model_profile: 'fast-local',
    input: 'hi',
    ...overrides,
  };
}

describe('AiGateway', () => {
  it('applies a trace_id when the caller does not supply one', async () => {
    const adapter = stubAdapter();
    const gateway = new AiGateway({ lmStudio: adapter });

    const response = await gateway.generate(chatRequest());
    expect(response.trace_id).toBeTruthy();
    expect(response.trace_id).not.toBe('fallback-trace'); // gateway-generated, not adapter's fallback
  });

  it('forwards an explicit trace_id', async () => {
    const adapter = stubAdapter();
    const gateway = new AiGateway({ lmStudio: adapter });

    const response = await gateway.generate(chatRequest({ trace_id: 'caller-provided-trace' }));
    expect(response.trace_id).toBe('caller-provided-trace');
  });

  it('applies default timeout/maxTokens/temperature when omitted', async () => {
    const adapter = stubAdapter();
    const gateway = new AiGateway({ lmStudio: adapter });

    await gateway.generate(chatRequest());
    const last = (adapter.generate as ReturnType<typeof vi.fn>).mock.calls[0][0] as AiGatewayRequest;
    expect(last.timeout_ms).toBe(8_000);
    expect(last.max_tokens).toBe(1200);
    expect(last.temperature).toBe(0.2);
  });

  it('routes lm_studio profiles to the LM Studio adapter', async () => {
    const adapter = stubAdapter();
    const gateway = new AiGateway({ lmStudio: adapter });

    await gateway.generate(chatRequest({ model_profile: 'quality-local' }));
    expect(adapter.generate).toHaveBeenCalledTimes(1);
  });

  it('rejects cloud-fallback profile when no Anthropic adapter is wired', async () => {
    const adapter = stubAdapter();
    const gateway = new AiGateway({ lmStudio: adapter });

    expect(gateway.hasCloudFallback()).toBe(false);
    await expect(
      gateway.generate(chatRequest({ model_profile: 'cloud-fallback' })),
    ).rejects.toThrow(/Provider not configured/);
  });

  it('health() proxies to the LM Studio adapter', async () => {
    const adapter = stubAdapter();
    const gateway = new AiGateway({ lmStudio: adapter });

    const result = await gateway.health();
    expect(result.ok).toBe(true);
    expect(result.models).toContain('stub-model');
  });

  // ── Cloud-fallback (Anthropic) ────────────────────────────────────

  function anthropicStub(over: { generate?: AiProviderAdapter['generate'] } = {}): AiProviderAdapter {
    const gen: AiProviderAdapter['generate'] = over.generate ?? (async (req) => ({
      provider: 'anthropic' as const,
      model:    'claude-haiku-4-5',
      profile:  req.model_profile,
      output:   'anthropic-output',
      trace_id: req.trace_id ?? 't',
      latency_ms: 1,
    }));
    const ej = async <T>(req: AiGatewayRequest): Promise<AiGatewayResponse<T>> => ({
      provider: 'anthropic' as const,
      model:    'claude-haiku-4-5',
      profile:  req.model_profile,
      output:   ({ ok: true } as unknown) as T,
      trace_id: req.trace_id ?? 't',
      latency_ms: 1,
    });
    return {
      id: 'anthropic',
      health:      vi.fn(async () => ({ ok: true, models: ['claude-haiku-4-5'] })),
      generate:    vi.fn(gen),
      extractJson: vi.fn(ej) as unknown as AiProviderAdapter['extractJson'],
      embed:       vi.fn(async () => { throw new Error('Anthropic offers no embeddings API'); }),
    };
  }

  it('hasCloudFallback() returns true when an Anthropic adapter is wired', () => {
    const gateway = new AiGateway({ lmStudio: stubAdapter(), anthropic: anthropicStub() });
    expect(gateway.hasCloudFallback()).toBe(true);
  });

  it('falls back to Anthropic when the primary throws a DNS error', async () => {
    const primary = stubAdapter();
    primary.generate = vi.fn(async () => { throw new Error('failed to lookup address information: lmstudio.internal'); });
    const anthropic = anthropicStub();

    const gateway = new AiGateway({ lmStudio: primary, anthropic });
    const result = await gateway.generate(chatRequest());

    expect(result.provider).toBe('anthropic');
    expect(result.output).toBe('anthropic-output');
    expect(primary.generate).toHaveBeenCalledTimes(1);
    expect(anthropic.generate).toHaveBeenCalledTimes(1);
  });

  it('falls back on connection-refused, timeout, no-model-available, 5xx', async () => {
    const messages = [
      'connect ECONNREFUSED 127.0.0.1:1234',
      'The signal has been aborted',
      'No LM Studio model available',
      'LM Studio HTTP 503',
    ];
    for (const m of messages) {
      const primary = stubAdapter();
      primary.generate = vi.fn(async () => { throw new Error(m); });
      const anthropic = anthropicStub();
      const gateway = new AiGateway({ lmStudio: primary, anthropic });
      const result = await gateway.generate(chatRequest());
      expect(result.provider, `should fall back on: ${m}`).toBe('anthropic');
    }
  });

  it('does NOT fall back on 4xx validation errors', async () => {
    const primary = stubAdapter();
    primary.generate = vi.fn(async () => { throw new Error('LM Studio HTTP 400: invalid request'); });
    const anthropic = anthropicStub();

    const gateway = new AiGateway({ lmStudio: primary, anthropic });
    await expect(gateway.generate(chatRequest())).rejects.toThrow(/HTTP 400/);
    expect(anthropic.generate).not.toHaveBeenCalled();
  });

  it('falls back for extractJson via the JSON path', async () => {
    const primary = stubAdapter();
    primary.extractJson = vi.fn(async () => { throw new Error('failed to lookup address information'); }) as never;
    const anthropic = anthropicStub();

    const gateway = new AiGateway({ lmStudio: primary, anthropic });
    const result = await gateway.extractJson(chatRequest({ task_type: 'extract_json' }));

    expect(result.provider).toBe('anthropic');
    expect(anthropic.extractJson).toHaveBeenCalledTimes(1);
    expect(anthropic.generate).not.toHaveBeenCalled();
  });

  it('embed() never falls back — Anthropic has no embeddings', async () => {
    const primary = stubAdapter();
    primary.embed = vi.fn(async () => { throw new Error('failed to lookup address information'); });
    const anthropic = anthropicStub();

    const gateway = new AiGateway({ lmStudio: primary, anthropic });
    await expect(gateway.embed(chatRequest({ task_type: 'embed' }))).rejects.toThrow(/lookup address/);
    // Anthropic adapter is NOT consulted at all for embed.
    expect(anthropic.generate).not.toHaveBeenCalled();
  });
});

// ── isTransportLevelFailure pure-fn coverage ──────────────────────

describe('isTransportLevelFailure', () => {
  it('returns true for known transport patterns', async () => {
    const { isTransportLevelFailure } = await import('../../../src/core/ai-gateway/router');
    expect(isTransportLevelFailure(new Error('failed to lookup address information'))).toBe(true);
    expect(isTransportLevelFailure(new Error('dns error'))).toBe(true);
    expect(isTransportLevelFailure(new Error('connect ECONNREFUSED'))).toBe(true);
    expect(isTransportLevelFailure(new Error('fetch failed'))).toBe(true);
    expect(isTransportLevelFailure(new Error('The signal has been aborted'))).toBe(true);
    expect(isTransportLevelFailure(new Error('No LM Studio model available'))).toBe(true);
    expect(isTransportLevelFailure(new Error('LM Studio HTTP 502'))).toBe(true);
  });

  it('returns false for 4xx / validation errors', async () => {
    const { isTransportLevelFailure } = await import('../../../src/core/ai-gateway/router');
    expect(isTransportLevelFailure(new Error('LM Studio HTTP 400: bad input'))).toBe(false);
    expect(isTransportLevelFailure(new Error('LM Studio HTTP 422'))).toBe(false);
    expect(isTransportLevelFailure(new Error('invalid json'))).toBe(false);
  });

  it('returns false for null/undefined', async () => {
    const { isTransportLevelFailure } = await import('../../../src/core/ai-gateway/router');
    expect(isTransportLevelFailure(null)).toBe(false);
    expect(isTransportLevelFailure(undefined)).toBe(false);
  });
});
