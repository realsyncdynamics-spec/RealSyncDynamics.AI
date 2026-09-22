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

  it('refuses device-local residency before any server-side provider call', () => {
    expect(AI_SHARED).toContain('normalizeRuntimeResidency');
    expect(AI_SHARED).toContain('DEVICE_RUNTIME_REQUIRED');
    expect(AI_SHARED).toContain('server_cannot_execute_zone0');
    expect(AI_SHARED.indexOf("if (residency === 'device_local')")).toBeLessThan(
      AI_SHARED.indexOf('const result = await callProvider({'),
    );
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
