import { describe, expect, it } from 'vitest';
import {
  parseShadowRuntimeSample,
  summarizeShadowRuntime,
  type AiRun,
} from '../../../src/core/ai/runs';

function run(overrides: Partial<AiRun> = {}): AiRun {
  return {
    id: 'run-1',
    tenant_id: 'tenant-1',
    tool_key: 'bot_reply',
    user_id: null,
    input_tokens: 100,
    output_tokens: 50,
    cached_tokens: 0,
    cost_usd: 0.01,
    duration_ms: 100,
    status: 'success',
    error_code: null,
    error_message: null,
    metadata: {
      runtime_class: 'c1_standard',
      execution_zone: 'governed_cloud',
      provider_class: 'managed_cloud',
      model_ref: 'model-a',
      actual_provider_cost_usd: 0.01,
      retry_count: 0,
      verifier_runs: 0,
      duration_ms: 100,
      shadow_rating_status: 'uncalibrated',
      shadow_credit_estimate: 0,
      wallet_enforced: false,
      customer_charge: 0,
    },
    created_at: '2026-09-22T00:00:00Z',
    ...overrides,
  };
}

describe('shadow runtime calibration read model', () => {
  it('ignores pre-shadow rows instead of inventing a runtime class', () => {
    expect(parseShadowRuntimeSample(run({ metadata: {} }))).toBeNull();
  });

  it('extracts only valid server-emitted dimensions', () => {
    const sample = parseShadowRuntimeSample(run());
    expect(sample).toMatchObject({
      runtimeClass: 'c1_standard',
      executionZone: 'governed_cloud',
      providerClass: 'managed_cloud',
      totalTokens: 150,
      providerCostUsd: 0.01,
      retryCount: 0,
      verifierRuns: 0,
    });
  });

  it('groups by class × zone × provider and computes nearest-rank p50/p90/p99', () => {
    const rows = [1, 2, 3, 4].map((n) => run({
      id: `run-${n}`,
      input_tokens: n * 100,
      output_tokens: 0,
      duration_ms: n * 100,
      metadata: {
        ...run().metadata,
        actual_provider_cost_usd: n,
        duration_ms: n * 100,
        retry_count: n === 4 ? 1 : 0,
        verifier_runs: n >= 3 ? 1 : 0,
      },
    }));

    const [group] = summarizeShadowRuntime(rows);
    expect(group.runs).toBe(4);
    expect(group.costUsd).toEqual({ p50: 2, p90: 4, p99: 4 });
    expect(group.tokens).toEqual({ p50: 200, p90: 400, p99: 400 });
    expect(group.durationMs).toEqual({ p50: 200, p90: 400, p99: 400 });
    expect(group.retryShare).toBe(0.25);
    expect(group.verifierShare).toBe(0.5);
  });

  it('keeps error runs in run counts while excluding unknown provider cost from percentiles', () => {
    const errorRun = run({
      id: 'run-error',
      status: 'error',
      input_tokens: 0,
      output_tokens: 0,
      metadata: {
        ...run().metadata,
        actual_provider_cost_usd: null,
      },
    });

    const [group] = summarizeShadowRuntime([run(), errorRun]);
    expect(group.runs).toBe(2);
    expect(group.successRuns).toBe(1);
    expect(group.errorRuns).toBe(1);
    expect(group.costUsd.p50).toBe(0.01);
  });

  it('does not use historical cost_usd as a substitute when the new shadow field is absent', () => {
    const sample = parseShadowRuntimeSample(run({
      cost_usd: 9.99,
      metadata: {
        ...run().metadata,
        actual_provider_cost_usd: null,
      },
    }));
    expect(sample?.providerCostUsd).toBeNull();
  });
});
