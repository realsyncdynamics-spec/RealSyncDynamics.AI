import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ADDONS,
  RUNTIME_CREDIT_PACK_STUBS,
  planByKey,
  type ExecutionZone,
  type RuntimeClass,
} from '../../shared/pricing';

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
    expect(AI_SHARED).toContain("args.residency === 'eu_local' ? 'eu_private' : 'governed_cloud'");
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

  it('does not introduce wallet, credit-ledger or customer-charge enforcement', () => {
    expect(AI_SHARED).not.toContain("from('credit_accounts')");
    expect(AI_SHARED).not.toContain("from('credit_ledger')");
    expect(AI_SHARED).not.toContain("from('credit_reservations')");
    expect(AI_SHARED).not.toContain('WALLET_ENFORCEMENT');
  });
});
