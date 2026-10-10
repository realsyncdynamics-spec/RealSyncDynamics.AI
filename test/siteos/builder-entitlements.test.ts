/**
 * Builder entitlement adapter — consumes siteos.builder / siteos.publish /
 * limit.sites only (Monetisierung SSoT). No second price ladder.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ENTITLEMENT_KEYS,
  planById,
  planEntitlementValue,
  planGrants,
} from '../../shared/pricing';
import {
  SITEOS_BUILDER_KEY,
  SITEOS_PUBLISH_KEY,
  SITEOS_SITES_LIMIT_KEY,
  builderUpgradeHref,
  builderUpgradeTarget,
  canOpenAppBuilder,
  canPublishSite,
  canUseFrontendDesigner,
  isWithinSiteCap,
  resolveBuilderEntitlements,
  siteosSsotReady,
  studioPreviewUntilSsot,
} from '../../src/features/siteos/builderEntitlements';
import { CI_FORBIDDEN_CTA } from '../../src/content/runtimeVocab';

const ROOT = resolve(__dirname, '../..');

describe('builderEntitlements — siteos.* keys', () => {
  it('uses canonical entitlement key constants', () => {
    expect(SITEOS_BUILDER_KEY).toBe('siteos.builder');
    expect(SITEOS_PUBLISH_KEY).toBe('siteos.publish');
    expect(SITEOS_SITES_LIMIT_KEY).toBe('limit.sites');
  });

  it('ssotReady tracks whether siteos.builder is in ENTITLEMENT_KEYS', () => {
    const inKeys = (ENTITLEMENT_KEYS as readonly string[]).includes('siteos.builder');
    expect(siteosSsotReady()).toBe(inKeys);
  });

  it('resolves from useEntitlements feature map without inventing permissions', () => {
    const snap = resolveBuilderEntitlements('free', {
      'siteos.builder': 1,
      'siteos.publish': 0,
      'limit.sites': 1,
    });
    // Live features win even if SSoT on this branch is still pending.
    expect(snap.builder).toBe(true);
    expect(snap.publish).toBe(false);
    expect(snap.sites).toBe(1);
  });

  it('gates studio on siteos.builder once SSoT is ready', () => {
    const free = resolveBuilderEntitlements('free');
    const starter = resolveBuilderEntitlements('starter');
    if (!siteosSsotReady()) {
      expect(canOpenAppBuilder(free)).toBe(false);
      expect(canOpenAppBuilder(starter)).toBe(false);
      expect(studioPreviewUntilSsot(starter)).toBe(true);
      return;
    }
    expect(canOpenAppBuilder(free)).toBe(false);
    expect(canOpenAppBuilder(starter)).toBe(true);
    expect(canUseFrontendDesigner(starter)).toBe(true);
    expect(canUseFrontendDesigner(free)).toBe(false);
    expect(studioPreviewUntilSsot(starter)).toBe(false);
    expect(planGrants('starter', 'siteos.builder')).toBe(true);
    expect(planGrants('free_audit', 'siteos.builder')).toBe(false);
  });

  it('Frontend Designer follows siteos.builder (no separate permission)', () => {
    const src = readFileSync(
      resolve(ROOT, 'src/features/siteos/builderEntitlements.ts'),
      'utf8',
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/frontendDesigner/);
    expect(code).not.toMatch(/builderRunsPerMonth/);
    expect(code).not.toMatch(/appBuilder/);
    expect(canUseFrontendDesigner(resolveBuilderEntitlements('starter'))).toBe(
      canOpenAppBuilder(resolveBuilderEntitlements('starter')),
    );
  });

  it('publish gate uses siteos.publish and never fakes deploy', () => {
    if (!siteosSsotReady()) {
      expect(canPublishSite(resolveBuilderEntitlements('starter'))).toBe(false);
      return;
    }
    expect(canPublishSite(resolveBuilderEntitlements('free'))).toBe(false);
    expect(canPublishSite(resolveBuilderEntitlements('starter'))).toBe(true);
    // governance_launch: builder yes, publish no (when SSoT present)
    const launch = resolveBuilderEntitlements('governance_launch');
    if (launch.ssotReady) {
      expect(launch.builder).toBe(true);
      expect(launch.publish).toBe(false);
    }
  });

  it('site cap uses limit.sites only', () => {
    const snap = resolveBuilderEntitlements('starter', { 'limit.sites': 1 });
    expect(isWithinSiteCap(snap, 0)).toBe(true);
    expect(isWithinSiteCap({ ...snap, ssotReady: true, sites: 1 }, 1)).toBe(false);
    expect(isWithinSiteCap({ ...snap, ssotReady: true, sites: -1 }, 99)).toBe(true);
  });

  it('never uses plan-name string compares in adapter code', () => {
    const src = readFileSync(
      resolve(ROOT, 'src/features/siteos/builderEntitlements.ts'),
      'utf8',
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/plan\s*===\s*['"]agency['"]/);
    expect(code).not.toMatch(/planId\s*===\s*['"]agency['"]/);
  });

  it('does not invent a second price ladder', () => {
    const src = readFileSync(
      resolve(ROOT, 'src/features/siteos/builderEntitlements.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/\b79\b/);
    expect(src).not.toMatch(/\b249\b/);
    expect(src).not.toMatch(/\b699\b/);
    expect(src).toContain('checkoutHrefForPlan');
  });

  it('upgrade href is monthly starter checkout, never yearly', () => {
    const href = builderUpgradeHref('free');
    expect(href).toContain('/checkout/starter');
    expect(href).not.toContain('yearly');
    expect(href).not.toContain('interval=year');
  });

  it('upgrade target follows the actual lock reason', () => {
    expect(builderUpgradeTarget('free', 'no_entitlement').id).toBe('starter');
    expect(builderUpgradeTarget('starter', 'sites_exhausted').id).toBe('growth');
    expect(builderUpgradeTarget('growth', 'sites_exhausted').id).toBe('agency');
    expect(builderUpgradeTarget('free', 'sites_exhausted').id).toBe('starter');
    expect(builderUpgradeHref('agency', 'sites_exhausted')).toContain('/contact-sales');
    expect(builderUpgradeTarget('free', 'publish_locked').id).toBe('starter');

    // Besitzt der aktuelle Plan das fehlende Recht laut SSoT bereits,
    // ist kein höherer Upsell nötig.
    expect(builderUpgradeTarget('growth', 'publish_locked').id).toBe('growth');
    expect(builderUpgradeTarget('growth', 'no_entitlement').id).toBe('growth');
  });

  it('every sites_exhausted target really raises limit.sites', () => {
    for (const plan of ['free', 'starter', 'growth'] as const) {
      const current = planEntitlementValue(plan, 'limit.sites') ?? 0;
      const target = builderUpgradeTarget(plan, 'sites_exhausted');
      const next = planEntitlementValue(target.planKey, 'limit.sites') ?? 0;
      expect(next === -1 || next > current).toBe(true);
      expect(planGrants(target.planKey, 'siteos.builder')).toBe(true);
    }
  });

  it('upgrade panel forwards its reason into the plan resolver', () => {
    const panel = readFileSync(
      resolve(ROOT, 'src/features/siteos/BuilderUpgradePanel.tsx'),
      'utf8',
    );
    expect(panel).toContain('builderUpgradeHref(snapshot.planId, reason)');
  });
});

describe('Build studio — CTA + yearly regression', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const studioSrc = readFileSync(
    resolve(ROOT, 'src/unified-entry/pages/BuildStudioPage.tsx'),
    'utf8',
  );
  const panelSrc = readFileSync(
    resolve(ROOT, 'src/features/siteos/BuilderUpgradePanel.tsx'),
    'utf8',
  );

  it('locked studio and upgrade panel avoid forbidden CTA phrases', () => {
    for (const phrase of CI_FORBIDDEN_CTA) {
      expect(strip(studioSrc).toLowerCase()).not.toContain(phrase.toLowerCase());
      expect(strip(panelSrc).toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it('upgrade panel offers Plan freischalten or Enterprise anfragen only', () => {
    expect(panelSrc).toContain('Plan freischalten');
    expect(panelSrc).toContain('Enterprise anfragen');
    expect(panelSrc).not.toMatch(/runs_exhausted/);
    expect(panelSrc).not.toMatch(/designer_locked/);
  });

  it('studio stays Preview for publish and does not fake deploy success', () => {
    expect(studioSrc).toMatch(/Preview · kein Publish/);
    expect(studioSrc).toMatch(/kein Live-Deploy|kein erfolgreiches Deploy/i);
    expect(strip(studioSrc)).not.toMatch(/Abo aktiv/);
    expect(strip(studioSrc)).not.toMatch(/Deploy erfolgreich|erfolgreich veröffentlicht/i);
    expect(studioSrc).not.toMatch(/publishOk\s*\|\|\s*previewUntilSsot/);
    expect(studioSrc).toMatch(/publishOk=\{publishOk\}/);
  });

  it('yearly checkout remains unavailable on paid self-service plans', () => {
    for (const id of ['starter', 'growth', 'agency'] as const) {
      expect(planById(id).yearlyCheckoutUnavailable).toBe(true);
    }
  });

  it('auth gate sends signed-out users to /welcome?next=/build', () => {
    // Ruecksprung behaelt die Query (kind, prompt) — Verhalten in test/build-studio/build-entry.test.tsx.
    expect(studioSrc).toContain('encodeURIComponent(buildReturnPath)');
    expect(studioSrc).toContain("query ? `/build?${query}` : '/build'");
    expect(studioSrc).toContain('/welcome?next=');
  });

  it('renders upgrade panel when entitlement missing (not a 500)', () => {
    expect(studioSrc).toContain('BuilderUpgradePanel');
    expect(studioSrc).toContain('no_entitlement');
    expect(studioSrc).toContain("canAccess('siteos.builder')");
    expect(studioSrc).not.toContain('runs_exhausted');
  });
});
