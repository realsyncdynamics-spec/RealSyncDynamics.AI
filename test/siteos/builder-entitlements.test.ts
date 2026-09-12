/**
 * Builder entitlement adapter + upgrade copy — studio consumes pricing SSoT,
 * never invents a second ladder or plan-name gates.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { planById } from '../../shared/pricing';
import {
  builderUpgradeHref,
  canOpenAppBuilder,
  canUseFrontendDesigner,
  isWithinBuilderRuns,
  isWithinSiteCap,
  resolveBuilderEntitlements,
  studioPreviewUntilSsot,
} from '../../src/features/siteos/builderEntitlements';
import { CI_FORBIDDEN_CTA } from '../../src/content/runtimeVocab';

const ROOT = resolve(__dirname, '../..');

describe('builderEntitlements — thin SSoT adapter', () => {
  it('marks ssotReady false until permissions.appBuilder exists', () => {
    const free = resolveBuilderEntitlements('free');
    const starter = resolveBuilderEntitlements('starter');
    const hasKey = Object.prototype.hasOwnProperty.call(
      planById('starter').permissions,
      'appBuilder',
    );
    if (!hasKey) {
      expect(free.ssotReady).toBe(false);
      expect(starter.ssotReady).toBe(false);
      expect(canOpenAppBuilder(free)).toBe(false);
      expect(canOpenAppBuilder(starter)).toBe(false);
      expect(studioPreviewUntilSsot(starter)).toBe(true);
    } else {
      expect(free.ssotReady).toBe(true);
      expect(canOpenAppBuilder(free)).toBe(false);
      expect(canOpenAppBuilder(starter)).toBe(true);
      expect(studioPreviewUntilSsot(starter)).toBe(false);
    }
  });

  it('never uses plan-name string compares in the adapter source', () => {
    const src = readFileSync(
      resolve(ROOT, 'src/features/siteos/builderEntitlements.ts'),
      'utf8',
    );
    // Strip block comments so documentation examples do not false-positive.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/plan\s*===\s*['"]agency['"]/);
    expect(code).not.toMatch(/planId\s*===\s*['"]agency['"]/);
    expect(code).not.toMatch(/if\s*\(\s*plan\s*===\s*['"]starter['"]/);
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

  it('limit helpers stay honest when SSoT caps exist', () => {
    const snap = resolveBuilderEntitlements('starter');
    if (!snap.ssotReady) {
      expect(isWithinBuilderRuns(snap, 999)).toBe(true);
      expect(isWithinSiteCap(snap, 999)).toBe(true);
      return;
    }
    expect(isWithinBuilderRuns(snap, snap.builderRunsPerMonth)).toBe(false);
    expect(isWithinSiteCap(snap, snap.sites)).toBe(false);
    expect(isWithinBuilderRuns(snap, 0)).toBe(snap.builderRunsPerMonth !== 0);
  });

  it('frontendDesigner follows SSoT when present', () => {
    const growth = resolveBuilderEntitlements('growth');
    const starter = resolveBuilderEntitlements('starter');
    if (!growth.ssotReady) {
      expect(canUseFrontendDesigner(growth)).toBe(false);
      return;
    }
    expect(canUseFrontendDesigner(starter)).toBe(
      (planById('starter').permissions as { frontendDesigner?: boolean })
        .frontendDesigner === true,
    );
    expect(canUseFrontendDesigner(growth)).toBe(
      (planById('growth').permissions as { frontendDesigner?: boolean })
        .frontendDesigner === true,
    );
  });
});

describe('Build studio — CTA + yearly regression', () => {
  const studioSrc = readFileSync(
    resolve(ROOT, 'src/unified-entry/pages/BuildStudioPage.tsx'),
    'utf8',
  );
  const panelSrc = readFileSync(
    resolve(ROOT, 'src/features/siteos/BuilderUpgradePanel.tsx'),
    'utf8',
  );

  it('locked studio and upgrade panel avoid forbidden CTA phrases', () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const studioCode = strip(studioSrc);
    const panelCode = strip(panelSrc);
    for (const phrase of CI_FORBIDDEN_CTA) {
      expect(studioCode.toLowerCase()).not.toContain(phrase.toLowerCase());
      expect(panelCode.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it('upgrade panel offers Plan freischalten or Enterprise anfragen only', () => {
    expect(panelSrc).toContain('Plan freischalten');
    expect(panelSrc).toContain('Enterprise anfragen');
    const panelCode = panelSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const phrase of CI_FORBIDDEN_CTA) {
      expect(panelCode.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it('studio stays Preview for publish and does not fake deploy success', () => {
    expect(studioSrc).toMatch(/Preview · kein Publish/);
    expect(studioSrc).toMatch(/kein Live-Deploy|kein erfolgreiches Deploy/i);
    const studioCode = studioSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(studioCode).not.toMatch(/Abo aktiv/);
    expect(studioCode).not.toMatch(/Deploy erfolgreich|erfolgreich veröffentlicht/i);
  });

  it('yearly checkout remains unavailable on paid self-service plans', () => {
    for (const id of ['starter', 'growth', 'agency'] as const) {
      expect(planById(id).yearlyCheckoutUnavailable).toBe(true);
    }
  });

  it('auth gate sends signed-out users to /welcome?next=/build', () => {
    expect(studioSrc).toContain("encodeURIComponent('/build')");
    expect(studioSrc).toContain('/welcome?next=');
  });

  it('renders upgrade panel when entitlement missing (not a 500)', () => {
    expect(studioSrc).toContain('BuilderUpgradePanel');
    expect(studioSrc).toContain('no_entitlement');
    expect(studioSrc).toContain('runs_exhausted');
  });
});
