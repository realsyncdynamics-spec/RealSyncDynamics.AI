/**
 * Consistency contract for agent-run metering.
 *
 * The billing pipeline spans two files that must agree on one entitlement key:
 *   - migration 20260721000000_agent_runs_metering.sql  (declares the key,
 *     marks it metered, seeds per-plan allowances)
 *   - enterprise-ai-os-agents-run/index.ts               (records usage under
 *     that key on every executed run)
 *
 * These are Deno / SQL sources outside the tsc project, so we assert the
 * contract by reading them as text — catching key drift or an accidental
 * removal of the metered flag before it reaches Stripe.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENTITLEMENT_KEY = 'limit.agent_runs_monthly';
const ROOT = resolve(__dirname, '../..');
const migration = readFileSync(
  resolve(ROOT, 'supabase/migrations/20260721000000_agent_runs_metering.sql'),
  'utf8',
);
const runner = readFileSync(
  resolve(ROOT, 'supabase/functions/enterprise-ai-os-agents-run/index.ts'),
  'utf8',
);

describe('agent-runs metering migration', () => {
  it('registers the entitlement in the entitlements registry', () => {
    expect(migration).toContain(`INSERT INTO public.entitlements`);
    expect(migration).toContain(`'${ENTITLEMENT_KEY}'`);
  });

  it('marks the key as metered in usage_limits_config', () => {
    // The billing_mode for this key must be 'metered' so stripe-meter-sync
    // picks it up for overage billing.
    const cfgLine = migration
      .split('\n')
      .find((l) => l.includes(ENTITLEMENT_KEY) && l.includes('metered'));
    expect(cfgLine, 'usage_limits_config row must set billing_mode metered').toBeTruthy();
  });

  it('seeds per-plan allowances including free=0 and an unlimited tier', () => {
    expect(migration).toContain('product_entitlements');
    expect(migration).toMatch(/'free',\s*'limit\.agent_runs_monthly',\s*0/);
    // enterprise tiers get -1 (unlimited)
    expect(migration).toMatch(/'limit\.agent_runs_monthly',\s*-1/);
  });
});

describe('agents-run edge function', () => {
  it('imports and calls recordUsage for the same entitlement key', () => {
    expect(runner).toContain(`from '../_shared/usage.ts'`);
    expect(runner).toContain('recordUsage(');
    expect(runner).toContain(`'${ENTITLEMENT_KEY}'`);
  });

  it('only meters runs that executed (guards status !== error)', () => {
    expect(runner).toMatch(/status\s*!==\s*'error'/);
  });
});
