import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSeoForPath } from '../../src/config/seo';
import {
  PRODUCT_AREAS,
  SOLUTIONS,
  allFeatures,
  productBySlug,
} from '../../src/marketing/products/registry';
import type { MarketingFeature } from '../../src/marketing/products/types';

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

function needsDemo(feature: MarketingFeature): boolean {
  return feature.showcase.kind !== 'none' && feature.status !== 'vorhanden';
}

describe('Landing v8 Produkt-Registry', () => {
  it('führt genau die fünf festgelegten Bereiche', () => {
    expect(PRODUCT_AREAS.map((area) => area.letter)).toEqual([...LETTERS]);
    expect(PRODUCT_AREAS.map((area) => area.name)).toEqual([
      'AI Governance & Compliance',
      'AI Agent Studio',
      'AI Creative Studio',
      'AI Website & Business Builder',
      'AI Operations & Automation',
    ]);
  });

  it('verlangt je Bereich die Pflichtfelder und eindeutige Slugs', () => {
    const slugs = PRODUCT_AREAS.map((area) => area.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const area of PRODUCT_AREAS) {
      expect(area.slug).toMatch(/^[a-z0-9-]+$/);
      expect(area.role.length).toBeGreaterThan(0);
      expect(area.summary.length).toBeGreaterThan(0);
      expect(area.features.length).toBeGreaterThan(0);
      expect(productBySlug(area.slug)?.letter).toBe(area.letter);
    }
    const ids = allFeatures().map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const feature of allFeatures()) {
      expect(feature.name.length).toBeGreaterThan(0);
      expect(feature.summary.length).toBeGreaterThan(0);
      expect(feature.evidence.length).toBeGreaterThan(0);
      expect(['vorhanden', 'vorschau', 'in-entwicklung']).toContain(feature.status);
    }
  });

  it('setzt das Demo-Kennzeichen, wo eine Fläche gezeigt wird und nicht vorhanden ist', () => {
    for (const feature of allFeatures()) {
      if (needsDemo(feature)) {
        expect(feature.demo, feature.id).toBe(true);
      }
      if (feature.status === 'in-entwicklung') {
        expect(feature.showcase.kind, feature.id).toBe('none');
        expect(feature.demo, feature.id).toBe(false);
      }
    }
    expect(allFeatures().some((feature) => feature.demo)).toBe(true);
    expect(allFeatures().some((feature) => feature.status === 'in-entwicklung')).toBe(true);
  });

  it('verlinkt Lösungen nur auf vorhandene Routen', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    for (const solution of SOLUTIONS) {
      const path = solution.href.split('?')[0] ?? solution.href;
      expect(app).toContain(`path="${path}"`);
    }
  });

  it('setzt noindex für den gesamten /v8-Namensraum', () => {
    expect(getSeoForPath('/v8').noIndex).toBe(true);
    expect(getSeoForPath('/v8/produkte/governance').noIndex).toBe(true);
    expect(getSeoForPath('/v8/preise').noIndex).toBe(true);
    expect(getSeoForPath('/').noIndex).not.toBe(true);
  });
});
