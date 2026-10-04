/**
 * SiteOS Builder monetization — SSoT + gate wiring.
 *
 * Limits/permissions live only in shared/pricing.ts. Gates must use
 * plan.permissions / plan.limits / entitlement keys — never plan names.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  PLAN_ENTITLEMENTS,
  planById,
  planEntitlementValue,
  planGrants,
  hasPermission,
  limitOf,
} from '../../shared/pricing';

describe('SiteOS Builder — Pricing SSoT', () => {
  it('Free Audit: kein Builder, kein Publish, 0 Sites', () => {
    const free = planById('free');
    expect(limitOf(free, 'sites')).toBe(0);
    expect(hasPermission(free, 'siteosBuilder')).toBe(false);
    expect(hasPermission(free, 'siteosPublish')).toBe(false);
    expect(planGrants('free_audit', 'siteos.builder')).toBe(false);
    expect(planGrants('free_audit', 'siteos.publish')).toBe(false);
    expect(planEntitlementValue('free_audit', 'limit.sites')).toBe(0);
  });

  it('Self-Service ladder: Starter 1 / Growth 3 / Agency 10 Sites', () => {
    expect(limitOf(planById('starter'), 'sites')).toBe(1);
    expect(limitOf(planById('growth'), 'sites')).toBe(3);
    expect(limitOf(planById('agency'), 'sites')).toBe(10);

    expect(planEntitlementValue('starter', 'limit.sites')).toBe(1);
    expect(planEntitlementValue('growth', 'limit.sites')).toBe(3);
    expect(planEntitlementValue('agency', 'limit.sites')).toBe(10);
  });

  it('Paid self-service plans grant builder + publish via keys, not plan names', () => {
    for (const key of ['starter', 'growth', 'agency'] as const) {
      const plan = planById(key);
      expect(hasPermission(plan, 'siteosBuilder')).toBe(true);
      expect(hasPermission(plan, 'siteosPublish')).toBe(true);
      expect(planGrants(key, 'siteos.builder')).toBe(true);
      expect(planGrants(key, 'siteos.publish')).toBe(true);
    }
  });

  it('Enterprise contract: sites display 25, entitlement unlimited (-1)', () => {
    expect(limitOf(planById('enterprise'), 'sites')).toBe(25);
    expect(planEntitlementValue('enterprise', 'limit.sites')).toBe(-1);
    expect(planGrants('enterprise', 'siteos.builder')).toBe(true);
  });

  it('PLAN_ENTITLEMENTS mirrors plan.limits.sites for self-service ladder', () => {
    for (const id of ['starter', 'growth', 'agency'] as const) {
      const plan = planById(id);
      expect(PLAN_ENTITLEMENTS[id]?.['limit.sites']).toBe(plan.limits.sites);
    }
  });
});

describe('SiteOS gates — no plan-name hardcoding', () => {
  const files = [
    'supabase/functions/siteos/site-entitlements.ts',
    'supabase/functions/siteos/handlers/builder.ts',
    'supabase/functions/siteos/handlers/publish-gate.ts',
    'supabase/functions/siteos/handlers/anonymous.ts',
    'supabase/functions/siteos/handlers/edit.ts',
    'src/features/siteos/workspace/AppBuilderWorkspacePage.tsx',
  ];

  it.each(files)('%s never branches on plan id strings', (path) => {
    const src = readFileSync(path, 'utf8');
    // Functional gates only — comments may mention plan names as anti-examples.
    const withoutComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/plan\s*===\s*['"]agency['"]/);
    expect(withoutComments).not.toMatch(/plan\s*===\s*['"]starter['"]/);
    expect(withoutComments).not.toMatch(/plan\s*===\s*['"]growth['"]/);
    expect(withoutComments).not.toMatch(/tier\s*===\s*['"]agency['"]/);
  });

  it('create path gates siteos.builder + limit.sites', () => {
    const helper = readFileSync('supabase/functions/siteos/site-entitlements.ts', 'utf8');
    expect(helper).toContain("'siteos.builder'");
    expect(helper).toContain("'limit.sites'");
    expect(helper).toContain('requireQuota');
    const builder = readFileSync('supabase/functions/siteos/handlers/builder.ts', 'utf8');
    expect(builder).toContain('gateSiteCreate');
    expect(builder).toContain("'siteos.builder'");
    const claim = readFileSync('supabase/functions/siteos/handlers/anonymous.ts', 'utf8');
    expect(claim).toContain('gateSiteCreate');
  });

  it('publish path gates siteos.publish', () => {
    const publish = readFileSync('supabase/functions/siteos/handlers/publish-gate.ts', 'utf8');
    expect(publish).toContain('gateSitePublish');
    const helper = readFileSync('supabase/functions/siteos/site-entitlements.ts', 'utf8');
    expect(helper).toContain("'siteos.publish'");
  });

  it('edit path gates siteos.builder — nach der Mitgliedschaft, vor dem Laden', () => {
    const helper = readFileSync('supabase/functions/siteos/site-entitlements.ts', 'utf8');
    const gate = helper.slice(helper.indexOf('export async function gateSiteEdit'));
    expect(gate).toMatch(/requireFeature\(ent, 'siteos\.builder'\)/);
    // Bearbeiten legt keine neue Site an — kein zweites limit.sites.
    expect(gate.slice(0, gate.indexOf('\n}\n'))).not.toContain('requireQuota');

    const edit = readFileSync('supabase/functions/siteos/handlers/edit.ts', 'utf8');
    const membership = edit.indexOf("not a member of this tenant");
    const gateCall = edit.indexOf('gateSiteEdit(admin, tenantId)');
    const load = edit.indexOf(".from('siteos_blueprints')");
    expect(membership).toBeGreaterThan(-1);
    expect(gateCall).toBeGreaterThan(membership);
    expect(load).toBeGreaterThan(gateCall);
  });

  it('workspace /builder/:slug schließt ohne siteos.builder über das Upgrade-Panel', () => {
    const page = readFileSync('src/features/siteos/workspace/AppBuilderWorkspacePage.tsx', 'utf8');
    expect(page).toContain('useEntitlements');
    expect(page).toContain('canOpenAppBuilder(');
    expect(page).toContain('<BuilderUpgradePanel');
  });
});
