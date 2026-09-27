/**
 * Architecture invariant: Entitlement ≠ Limit ≠ Usage ≠ One-Time Purchase.
 *
 * siteos.builder is a capability (boolean catalog key), not a credit meter.
 * Capacity lives on limit.* keys. Consumption lives on usage meters.
 * governance_launch is a one-time grant beside the subscription ladder.
 *
 * Do not "fix" a failing builder test by turning builder into credits.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ENTITLEMENT_KEYS,
  ONE_TIME_PLANS,
  PLAN_ORDER,
  isUpgrade,
  planById,
  planEntitlementValue,
  planGrants,
  planRank,
} from '../../shared/pricing';
import {
  SITEOS_BUILDER_KEY,
  SITEOS_PUBLISH_KEY,
  SITEOS_SITES_LIMIT_KEY,
  canOpenAppBuilder,
  canUseFrontendDesigner,
  isWithinSiteCap,
  resolveBuilderEntitlements,
} from '../../src/features/siteos/builderEntitlements';

const ROOT = resolve(__dirname, '../..');

const BOOLEAN_CAPABILITY_KEYS = ['siteos.builder', 'siteos.publish'] as const;
const CAPACITY_KEYS = ['limit.sites'] as const;

describe('Entitlement ≠ Limit ≠ Usage ≠ One-Time', () => {
  it('siteos.builder and siteos.publish live in the entitlement catalog', () => {
    expect(ENTITLEMENT_KEYS).toContain('siteos.builder');
    expect(ENTITLEMENT_KEYS).toContain('siteos.publish');
    expect(ENTITLEMENT_KEYS).toContain('limit.sites');
    expect(SITEOS_BUILDER_KEY).toBe('siteos.builder');
    expect(SITEOS_PUBLISH_KEY).toBe('siteos.publish');
    expect(SITEOS_SITES_LIMIT_KEY).toBe('limit.sites');
  });

  it('builder grant is a 0/1 capability, not a quota', () => {
    for (const key of BOOLEAN_CAPABILITY_KEYS) {
      for (const planKey of ['free_audit', 'starter', 'growth', 'agency', 'enterprise', 'governance_launch'] as const) {
        const value = planEntitlementValue(planKey, key);
        expect([0, 1]).toContain(value);
      }
    }
    expect(planGrants('free_audit', 'siteos.builder')).toBe(false);
    expect(planGrants('starter', 'siteos.builder')).toBe(true);
    expect(planEntitlementValue('starter', 'siteos.builder')).toBe(1);
  });

  it('capacity lives on limit.sites, separate from the builder capability', () => {
    expect(typeof planEntitlementValue('starter', 'limit.sites')).toBe('number');
    expect(planEntitlementValue('starter', 'limit.sites')).toBe(1);
    expect(planEntitlementValue('growth', 'limit.sites')).toBe(3);
    expect(planEntitlementValue('agency', 'limit.sites')).toBe(10);

    const growth = resolveBuilderEntitlements('growth');
    expect(growth.builder).toBe(true);
    expect(isWithinSiteCap({ ...growth, ssotReady: true, sites: 3 }, 2)).toBe(true);
    expect(isWithinSiteCap({ ...growth, ssotReady: true, sites: 3 }, 3)).toBe(false);
  });

  it('studio access follows the builder entitlement, not a credit balance', () => {
    const starter = resolveBuilderEntitlements('starter');
    const free = resolveBuilderEntitlements('free');
    expect(canOpenAppBuilder(starter)).toBe(true);
    expect(canOpenAppBuilder(free)).toBe(false);
    expect(canUseFrontendDesigner(starter)).toBe(canOpenAppBuilder(starter));
  });

  it('adapter and studio do not invent builder credits or run packs', () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const adapter = strip(readFileSync(resolve(ROOT, 'src/features/siteos/builderEntitlements.ts'), 'utf8'));
    const studio = strip(readFileSync(resolve(ROOT, 'src/unified-entry/pages/BuildStudioPage.tsx'), 'utf8'));
    const combined = `${adapter}\n${studio}`;
    expect(combined).not.toMatch(/builderRunsPerMonth|builder_credits|builderCredits|credits\s*>=\s*builder/i);
    expect(combined).not.toMatch(/siteos\.transform/);
  });

  it('governance_launch is one-time and not a rank on the subscription ladder', () => {
    const launch = planById('governance_launch');
    expect(launch.purchaseMode).toBe('one_time');
    expect(ONE_TIME_PLANS.map((p) => p.id)).toContain('governance_launch');
    expect(PLAN_ORDER).not.toContain('governance_launch');
    expect(planRank('governance_launch')).toBe(-1);
    expect(isUpgrade('free', 'governance_launch')).toBe(false);
    expect(isUpgrade('starter', 'governance_launch')).toBe(false);
    expect(planGrants('governance_launch', 'siteos.builder')).toBe(true);
    expect(planGrants('governance_launch', 'siteos.publish')).toBe(false);
  });

  it('capacity keys stay distinct from capability keys', () => {
    for (const cap of BOOLEAN_CAPABILITY_KEYS) {
      expect((CAPACITY_KEYS as readonly string[]).includes(cap)).toBe(false);
    }
  });
});
