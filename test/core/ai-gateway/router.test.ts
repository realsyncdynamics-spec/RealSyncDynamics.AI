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

  it('rejects unknown providers (cloud-fallback adapter not yet wired)', async () => {
    const adapter = stubAdapter();
    const gateway = new AiGateway({ lmStudio: adapter });

    await expect(
      gateway.generate(chatRequest({ model_profile: 'cloud-fallback' })),
    ).rejects.toThrow(/Provider not implemented/);
  });

  it('health() proxies to the LM Studio adapter', async () => {
    const adapter = stubAdapter();
    const gateway = new AiGateway({ lmStudio: adapter });

    const result = await gateway.health();
    expect(result.ok).toBe(true);
    expect(result.models).toContain('stub-model');
  });
});
