import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  ADDONS,
  RUNTIME_CREDIT_PACK_STUBS,
  planByKey,
  type ExecutionZone,
  type RuntimeClass,
} from '../../shared/pricing';
import { mapResidencyToExecutionZone } from '../../shared/runtime-zone';

const AI_SHARED = readFileSync('supabase/functions/_shared/ai.ts', 'utf8');

describe('Runtime Credits — shadow only', () => {
  it('keeps the runtime vocabulary typed without making credits money', () => {
    const classes: RuntimeClass[] = [
      'c0_local',
      'c1_standard',
      'c2_agent',
      'c3_page_builder',
      'c4_app_builder',
    ];
    const zones: ExecutionZone[] = ['device_local', 'eu_private', 'governed_cloud'];
    expect(classes).toHaveLength(5);
    expect(zones).toHaveLength(3);
  });

  it('maps residency into the three-zone execution model and fail-closes unknown values', () => {
    const warn = vi.fn();

    expect(mapResidencyToExecutionZone('device_local', warn)).toBe('device_local');
    expect(mapResidencyToExecutionZone('eu_local', warn)).toBe('eu_private');
    expect(mapResidencyToExecutionZone('cloud', warn)).toBe('governed_cloud');
    expect(mapResidencyToExecutionZone('unexpected', warn)).toBe('governed_cloud');
    expect(warn).toHaveBeenCalledWith(
      '[runtime-zone] unknown residency "unexpected", defaulting to cloud',
    );
  });

  it('keeps every credit pack internal and unpriced until calibration', () => {
    expect(RUNTIME_CREDIT_PACK_STUBS.length).toBeGreaterThan(0);
    for (const pack of RUNTIME_CREDIT_PACK_STUBS) {
      expect(pack.availability).toBe('internal');
      expect(pack.priceEur).toBe(0);
      expect(pack.credits).toBeNull();
    }
  });

  it('does not mutate the current Response Pack or Governance Launch SKU', () => {
    const responsePack = ADDONS.find((addon) => addon.id === 'response_pack');
    expect(responsePack?.priceEur).toBe(49);
    expect(responsePack?.grants['limit.bot_messages_monthly']).toBe(5_000);

    const launch = planByKey('governance_launch');
    expect(launch?.price.oneTimeEur).toBe(349);
    expect(launch?.purchaseMode).toBe('one_time');
  });

  it('records a non-billable shadow envelope on the canonical runAiTool path', () => {
    expect(AI_SHARED).toContain("runtimeClass ?? 'c1_standard'");
    expect(AI_SHARED).toContain('const residency = normalizeRuntimeResidency(args.residency)');
    expect(AI_SHARED).toContain('executionZoneFromResidency(residency)');
    expect(AI_SHARED).toContain("shadow_rating_status: 'uncalibrated'");
    expect(AI_SHARED).toContain('shadow_credit_estimate: 0');
    expect(AI_SHARED).toContain('wallet_enforced: false');
    expect(AI_SHARED).toContain('customer_charge: 0');
    expect(AI_SHARED).toContain('actual_provider_cost_usd');
  });

  it('makes server-derived shadow fields authoritative over caller metadata', () => {
    const successInsert = AI_SHARED.slice(
      AI_SHARED.indexOf("const { data: run } = await admin.from('ai_tool_runs').insert"),
      AI_SHARED.indexOf("const totalTokens = result.inputTokens"),
    );
    expect(successInsert.indexOf('...(opts.metadata ?? {})')).toBeLessThan(
      successInsert.indexOf('...shadowRating'),
    );
  });

  it('refuses device-local residency before any server-side provider call', async () => {
    vi.resetModules();

    const gateFeature = vi.fn().mockResolvedValue(undefined);
    const getCurrentTotal = vi.fn().mockResolvedValue(0);
    const recordUsage = vi.fn().mockResolvedValue(undefined);
    const callProvider = vi.fn();
    const reserveLlmBudget = vi.fn();
    const settleLlmBudget = vi.fn();

    class EntitlementError extends Error {
      code = 'ENTITLED';
    }
    class UsageError extends Error {
      code = 'USAGE_ERROR';
    }
    class ProviderError extends Error {
      code = 'PROVIDER_ERROR';
    }
    class CostCapError extends Error {
      capUsed = 0;
      capTotal = 0;
      capRemaining = 0;
    }

    vi.doMock('../../supabase/functions/_shared/entitlements.ts', () => ({
      gateFeature,
      EntitlementError,
    }));
    vi.doMock('../../supabase/functions/_shared/usage.ts', () => ({
      recordUsage,
      getCurrentTotal,
      UsageError,
    }));
    vi.doMock('../../supabase/functions/_shared/providers.ts', () => ({
      callProvider,
      ProviderError,
    }));
    vi.doMock('../../supabase/functions/_shared/cost-cap.ts', () => ({
      reserveLlmBudget,
      settleLlmBudget,
      CostCapError,
    }));

    const { runAiTool } = await import('../../supabase/functions/_shared/ai.ts');

    const insertRun = vi.fn().mockResolvedValue({});
    const toolRow = {
      id: 'tool-1',
      key: 'code_explain',
      model_provider: 'openai' as const,
      model_id: 'gpt-5-mini',
      ollama_model_id: 'qwen2.5:7b-instruct-q4_K_M',
      system_prompt: null,
      max_tokens: 200,
      temperature: 0,
      cost_input_per_million_usd: 1,
      cost_output_per_million_usd: 1,
      required_entitlement_key: null,
      enabled: true,
    };

    const admin = {
      rpc: vi.fn((name: string) => {
        if (name === 'resolve_ai_residency') {
          return Promise.resolve({ data: 'device_local', error: null });
        }
        if (name === 'tenant_entitlements') {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({ data: null, error: { message: `unexpected rpc ${name}` } });
      }),
      from: vi.fn((table: string) => {
        if (table === 'ai_tools') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: toolRow, error: null }),
              })),
            })),
          };
        }

        if (table === 'ai_tool_runs') {
          return { insert: insertRun };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    await expect(
      runAiTool(admin as never, 'tenant-1', 'user-1', 'code_explain', 'hello'),
    ).rejects.toMatchObject({
      code: 'DEVICE_RUNTIME_REQUIRED',
      status: 501,
      details: {
        zone: 'device_local',
        reason: 'server_cannot_execute_zone0',
      },
    });

    expect(callProvider).not.toHaveBeenCalled();
    expect(reserveLlmBudget).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
    expect(insertRun).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      error_code: 'DEVICE_RUNTIME_REQUIRED',
      metadata: expect.objectContaining({
        residency: 'device_local',
        execution_zone: 'device_local',
        shadow_rating_status: 'uncalibrated',
        shadow_credit_estimate: 0,
        wallet_enforced: false,
        customer_charge: 0,
      }),
    }));
  });

  it('keeps VPS ollama on zone 1 with local_open telemetry', () => {
    expect(AI_SHARED).toContain("if (residency === 'eu_local')");
    expect(AI_SHARED).toContain("effectiveProvider = 'ollama'");
    expect(AI_SHARED).toContain("args.provider === 'ollama' ? 'local_open' : 'managed_cloud'");
  });

  it('does not introduce wallet, credit-ledger or customer-charge enforcement', () => {
    expect(AI_SHARED).not.toContain("from('credit_accounts')");
    expect(AI_SHARED).not.toContain("from('credit_ledger')");
    expect(AI_SHARED).not.toContain("from('credit_reservations')");
    expect(AI_SHARED).not.toContain('WALLET_ENFORCEMENT');
  });
});
