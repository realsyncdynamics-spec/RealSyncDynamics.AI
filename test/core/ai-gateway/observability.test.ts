import { describe, it, expect } from 'vitest';
import { toToolRunRow, classifyError } from '../../../src/core/ai-gateway/observability';
import type { AiGatewayRequest } from '../../../src/core/ai-gateway/types';

function req(over: Partial<AiGatewayRequest> = {}): AiGatewayRequest {
  return {
    tenant_id: 'tenant-1',
    user_id: 'user-1',
    feature: 'governance_chat',
    task_type: 'chat',
    model_profile: 'cloud-fallback',
    input: 'Was deckt der DSGVO-Audit ab?',
    ...over,
  };
}

describe('toToolRunRow', () => {
  it('maps a successful call into the ai_tool_runs shape', () => {
    const row = toToolRunRow(req(), {
      status: 'success',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      profile: 'cloud-fallback',
      usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 },
      durationMs: 142.6,
      traceId: 'trace-9',
    });
    expect(row).not.toBeNull();
    expect(row).toMatchObject({
      tenant_id: 'tenant-1',
      tool_id: null,
      tool_key: 'governance_chat',
      user_id: 'user-1',
      input_tokens: 12,
      output_tokens: 8,
      cached_tokens: 0,
      cost_usd: 0,
      duration_ms: 143, // rounded
      status: 'success',
    });
    expect(row!.metadata).toMatchObject({
      source: 'ai-gateway',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      task_type: 'chat',
      model_profile: 'cloud-fallback',
      trace_id: 'trace-9',
    });
    // success rows carry no error fields
    expect(row!.error_code).toBeUndefined();
    expect(row!.error_message).toBeUndefined();
  });

  it('returns null when tenant_id is absent (NOT NULL / no audit home)', () => {
    expect(toToolRunRow(req({ tenant_id: null }), { status: 'success', durationMs: 5 })).toBeNull();
    expect(toToolRunRow(req({ tenant_id: undefined }), { status: 'success', durationMs: 5 })).toBeNull();
  });

  it('captures error code/message on failure and truncates long messages', () => {
    const long = 'x'.repeat(5000);
    const row = toToolRunRow(req(), {
      status: 'error',
      durationMs: 30,
      errorCode: 'PROVIDER_ERROR',
      errorMessage: long,
    });
    expect(row!.status).toBe('error');
    expect(row!.error_code).toBe('PROVIDER_ERROR');
    expect(row!.error_message!.length).toBe(2000);
  });

  it('defaults token counts to zero when usage is missing', () => {
    const row = toToolRunRow(req(), { status: 'success', durationMs: 10 });
    expect(row).toMatchObject({ input_tokens: 0, output_tokens: 0, cached_tokens: 0 });
  });

  it('preserves caller metadata and never emits a negative duration', () => {
    const row = toToolRunRow(req({ metadata: { requestId: 'abc' } }), {
      status: 'success',
      durationMs: -50,
    });
    expect(row!.metadata.requestId).toBe('abc');
    expect(row!.duration_ms).toBe(0);
  });
});

describe('classifyError', () => {
  it('maps timeouts, rate limits and generic errors', () => {
    expect(classifyError(new Error('request aborted (timeout)'))).toEqual({ status: 'timeout', code: 'TIMEOUT' });
    expect(classifyError(new Error('OpenAI HTTP 429'))).toEqual({ status: 'quota_exceeded', code: 'RATE_LIMITED' });
    expect(classifyError(new Error('rate-limit hit'))).toEqual({ status: 'quota_exceeded', code: 'RATE_LIMITED' });
    expect(classifyError(new Error('boom'))).toEqual({ status: 'error', code: 'PROVIDER_ERROR' });
    expect(classifyError('plain string')).toEqual({ status: 'error', code: 'PROVIDER_ERROR' });
  });
});
