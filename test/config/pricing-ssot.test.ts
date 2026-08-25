import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADDONS,
  ALL_MODULES,
  ALL_PLANS_ORDERED,
  BOOKABLE_MODULES,
  FEATURE_GROUPS,
  ONE_TIME_PLANS,
  ORDERED_PLANS,
  PLANS,
  PLAN_ORDER,
  PRODUCT_AREAS,
  POLICY_PACK_IDS,
  RUNTIME_PIPELINE,
  addonsFor,
  allPlanKeys,
  checkoutHrefForPlan,
  hasUsageBasedModules,
  intervalForPlanKey,
  isOneTimePlan,
  isPlanId,
  isUpgrade,
  normalizePlanKey,
  planByKey,
  planById,
  planRank,
  priceForPlanKey,
  recommendPlan,
  resolvePlan,
} from '../../shared/pricing';
import { PLAN_CONFIG, diffPricingTiersAgainstPlanConfig } from '../../src/lib/billing/planConfig';
import { buildGenerated } from '../../scripts/sync-shared-pricing.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const sharedPricingSource = readFileSync(join(ROOT, 'shared', 'pricing.ts'), 'utf8');

describe('Commercial Pricing SSoT — canonical ladder', () => {
  it('defines exactly Free Audit → START → GROWTH → BUSINESS → ENTERPRISE', () => {
    expect(ORDERED_PLANS.map((p) => [p.id, p.name, p.price.monthlyEur, p.purchaseMode])).toEqual([
      ['free', 'Free Audit', 0, 'free'],
      ['starter', 'START', 59, 'checkout'],
      ['growth', 'GROWTH', 149, 'checkout'],
      ['business', 'BUSINESS', 349, 'checkout'],
      ['enterprise', 'ENTERPRISE', 0, 'inquiry'],
    ]);
    expect(PLAN_ORDER).toEqual(['free', 'starter', 'growth', 'business', 'enterprise']);
    expect(ORDERED_PLANS).toHaveLength(5);
  });

  it('keeps Enterprise sales-only and removes the former public price ladder', () => {
    const enterprise = planById('enterprise');
    expect(enterprise.purchaseMode).toBe('inquiry');
    expect(enterprise.yearlyPlanKey).toBeNull();
    expect(enterprise.price.monthlyEur).toBe(0);
    expect(enterprise.price.yearlyEur).toBeNull();
    expect(sharedPricingSource).not.toContain('699');
    expect(sharedPricingSource).not.toContain('1249');
    expect(sharedPricingSource).not.toContain('1999');
    expect(sharedPricingSource).not.toContain('6900');
    expect(sharedPricingSource).not.toContain('12490');
    expect(sharedPricingSource).not.toContain('19000');
    expect(ORDERED_PLANS.map((p) => p.name)).not.toContain('Agency');
    expect(ORDERED_PLANS.map((p) => p.name)).not.toContain('Partner');
    expect(ORDERED_PLANS.map((p) => p.name)).not.toContain('Scale');
    expect(allPlanKeys().some((key) => /^(agency|partner|scale)(?:_yearly)?$/i.test(key))).toBe(false);
  });

  it('allows only Growth to carry a 14-day trial', () => {
    expect(PLANS.filter((p) => p.trialDays > 0).map((p) => p.id)).toEqual(['growth']);
    expect(planById('growth').trialDays).toBe(14);
    expect(planById('starter').trialDays).toBe(0);
    expect(planById('business').trialDays).toBe(0);
    expect(planById('enterprise').trialDays).toBe(0);
    expect(planById('growth').highlight).toBe(true);
    expect(PLANS.filter((p) => p.highlight).map((p) => p.id)).toEqual(['growth']);
  });

  it('keeps Governance Launch outside the subscription ladder', () => {
    expect(ONE_TIME_PLANS.map((p) => p.id)).toEqual(['governance_launch']);
    expect(planByKey('governance_launch')?.price.oneTimeEur).toBe(349);
    expect(intervalForPlanKey('governance_launch')).toBe('one_time');
    expect(planRank('governance_launch')).toBe(-1);
    expect(isOneTimePlan('governance_launch')).toBe(true);
  });

  it('keeps canonical keys unique and complete', () => {
    expect(new Set(allPlanKeys()).size).toBe(allPlanKeys().length);
    expect(ALL_PLANS_ORDERED).toHaveLength(PLANS.length);
    expect(new Set(ALL_PLANS_ORDERED.map((p) => p.id)).size).toBe(PLANS.length);
  });
});

describe('Commercial Pricing SSoT — compatibility boundary', () => {
  it('normalizes legacy identifiers only as input compatibility', () => {
    expect(normalizePlanKey('agency')).toBe('business');
    expect(normalizePlanKey('agency_yearly')).toBe('business_yearly');
    expect(normalizePlanKey('partner')).toBe('enterprise');
    expect(normalizePlanKey('partner_yearly')).toBe('enterprise');
    expect(normalizePlanKey('scale')).toBe('enterprise');
    expect(normalizePlanKey('scale_yearly')).toBe('enterprise');
    expect(normalizePlanKey('free')).toBe('free_audit');
    expect(planByKey('agency')?.id).toBe('business');
    expect(planByKey('partner')?.id).toBe('enterprise');
    expect(resolvePlan('agency')?.id).toBe('business');
    expect(resolvePlan('partner')?.id).toBe('enterprise');
    expect(isPlanId('agency')).toBe(true);
    expect(isPlanId('partner')).toBe(true);
  });

  it('never emits legacy identifiers from the canonical catalog', () => {
    for (const key of allPlanKeys()) expect(key).not.toMatch(/agency|partner|scale/i);
    for (const plan of PLANS) expect(plan.planKey).not.toMatch(/agency|partner|scale/i);
  });
});

describe('Commercial Pricing SSoT — entitlements and feature store', () => {
  it('keeps entitlements monotonic along the public ladder', () => {
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      const lower = planById(PLAN_ORDER[i - 1]);
      const higher = planById(PLAN_ORDER[i]);
      for (const module of lower.modules) expect(higher.modules).toContain(module);
      for (const [key, enabled] of Object.entries(lower.permissions)) {
        if (enabled) expect(higher.permissions[key as keyof typeof higher.permissions]).toBe(true);
      }
      for (const key of Object.keys(lower.limits) as Array<keyof typeof lower.limits>) {
        const a = lower.limits[key];
        const b = higher.limits[key];
        if (b === -1) continue;
        expect(a === -1 ? Infinity : a).toBeLessThanOrEqual(b);
      }
    }
  });

  it('keeps product areas, Policy Packs, feature groups and module references consistent', () => {
    expect(PRODUCT_AREAS.map((a) => a.label)).toEqual(['GOVERN', 'AUTOMATE', 'ENGAGE']);
    expect(PRODUCT_AREAS.flatMap((a) => a.modules).sort()).toEqual(ALL_MODULES.map((m) => m.id).sort());
    expect(POLICY_PACK_IDS).toEqual(['dsgvo', 'eu_ai_act', 'nis2', 'dora', 'iso_27001', 'tisax']);
    expect(RUNTIME_PIPELINE.map((s) => s.label)).toEqual(['Website / API', 'Runtime Scan', 'Policy Engine', 'Evidence Vault', 'Risk Engine', 'Automation', 'Audit Export']);
    for (const plan of PLANS) {
      expect(Object.keys(plan.features).sort()).toEqual(FEATURE_GROUPS.map((g) => g.id).sort());
      expect(new Set(plan.modules).size).toBe(plan.modules.length);
      for (const module of plan.modules) expect(ALL_MODULES.some((m) => m.id === module)).toBe(true);
      for (const addon of plan.addons) expect(ADDONS.some((a) => a.id === addon)).toBe(true);
    }
    for (const addon of ADDONS) {
      for (const planId of addon.availableFor) expect(addonsFor(planId).some((a) => a.id === addon.id)).toBe(true);
    }
  });

  it('models AI Frontend Studio as credits/usage, not as a plan-included feature', () => {
    const frontend = BOOKABLE_MODULES.find((m) => m.id === 'ai_frontend');
    expect(frontend?.name).toBe('AI Frontend Studio');
    expect(frontend?.priceModel).toBe('credits');
    expect(frontend?.priceEur).toBe(0);
    expect(frontend?.usageNote).toContain('Credits');
    expect(hasUsageBasedModules(['ai_frontend'])).toBe(true);
    expect(planById('business').modules).not.toContain('ai_frontend' as never);
  });

  it('retains flat, flat_plus_usage and per_unit as commercial primitives', () => {
    expect(new Set(BOOKABLE_MODULES.map((m) => m.priceModel))).toEqual(new Set(['flat', 'flat_plus_usage', 'per_unit', 'credits']));
    expect(BOOKABLE_MODULES.find((m) => m.id === 'website_chat')?.priceModel).toBe('flat_plus_usage');
    expect(BOOKABLE_MODULES.find((m) => m.id === 'voice_bot')?.priceModel).toBe('flat_plus_usage');
    expect(BOOKABLE_MODULES.find((m) => m.id === 'whatsapp_bot')?.priceModel).toBe('flat_plus_usage');
    expect(BOOKABLE_MODULES.find((m) => m.id === 'additional_domain')?.priceModel).toBe('per_unit');
  });
});

describe('Commercial Pricing SSoT — checkout and recommendations', () => {
  it('emits only canonical checkout targets and only Growth gets pilot=true', () => {
    expect(checkoutHrefForPlan('starter')).toBe('/checkout/starter?source=pricing');
    expect(checkoutHrefForPlan('growth')).toBe('/checkout/growth?source=pricing&pilot=true');
    expect(checkoutHrefForPlan('business')).toBe('/checkout/business?source=pricing');
    expect(checkoutHrefForPlan('enterprise')).toBe('/contact-sales?plan=enterprise&source=pricing');
    expect(checkoutHrefForPlan('agency')).toBe('/checkout/business?source=pricing');
    expect(checkoutHrefForPlan('partner')).toBe('/contact-sales?plan=enterprise&source=pricing');
    expect(checkoutHrefForPlan('starter')).not.toContain('pilot');
    expect(checkoutHrefForPlan('business')).not.toContain('pilot');
    expect(checkoutHrefForPlan('enterprise')).not.toContain('pilot');
  });

  it('uses only defined annual variants', () => {
    expect(priceForPlanKey('starter_yearly')).toBe(590);
    expect(priceForPlanKey('growth_yearly')).toBe(1490);
    expect(priceForPlanKey('business_yearly')).toBe(3490);
    expect(planByKey('enterprise')?.yearlyPlanKey).toBeNull();
  });

  it('uses the new commercial endpoints for recommendations', () => {
    expect(recommendPlan({ score: 20 }).planId).toBe('growth');
    expect(recommendPlan({ score: 85 }).planId).toBe('starter');
    expect(recommendPlan({ score: 90, needsApi: true }).planId).toBe('business');
    expect(recommendPlan({ score: 90, domains: 8 }).planId).toBe('business');
    expect(recommendPlan({ score: 95, tenants: 3 }).planId).toBe('enterprise');
  });

  it('maps legacy upgrade ranks to canonical ranks', () => {
    expect(planRank('agency')).toBe(3);
    expect(planRank('partner')).toBe(4);
    expect(isUpgrade('starter', 'growth')).toBe(true);
    expect(isUpgrade('growth', 'business')).toBe(true);
    expect(isUpgrade('business', 'enterprise')).toBe(true);
    expect(isUpgrade('agency', 'growth')).toBe(false);
  });
});

describe('Commercial Pricing SSoT — Stripe mapping boundary', () => {
  it('derives PLAN_CONFIG from every canonical SSoT key without drift', () => {
    expect(Object.keys(PLAN_CONFIG).sort()).toEqual(allPlanKeys().sort());
    expect(diffPricingTiersAgainstPlanConfig()).toEqual([]);
    for (const key of allPlanKeys()) {
      expect(PLAN_CONFIG[key].price).toBe(priceForPlanKey(key));
      expect(PLAN_CONFIG[key].interval).toBe(intervalForPlanKey(key));
    }
  });
});

describe('Pricing SSoT — generated twin', () => {
  it('keeps the Supabase pricing twin byte-identical to the SSoT', () => {
    const target = readFileSync(join(ROOT, 'supabase', 'functions', '_shared', 'pricing.generated.ts'), 'utf8');
    expect(target).toBe(buildGenerated(sharedPricingSource));
  });
});
