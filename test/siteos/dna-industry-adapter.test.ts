import { describe, expect, it } from 'vitest';
import { analyzeBlueprint, parseBrief, renderPage, renderThemeCss, synthesizeBlueprint, type IndustryKey, type SiteBlueprint } from '../../packages/siteos-core/src/index';
import { remixBoundDna, withIndustryDna } from '../../src/features/siteos/dna/bindIndustryDna';
import { INDUSTRY_GENERATOR_MAP, INDUSTRY_THEME_SEEDS } from '../../src/features/siteos/dna/industrySeeds';

const FIXED = '2026-11-13T12:00:00.000Z';
const LATER = '2026-11-13T12:05:00.000Z';

function carried(industry: IndustryKey): SiteBlueprint {
  const bp = synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'), { model: 'm', createdAt: FIXED });
  return { ...bp, industry };
}

describe('Branchen-Seeds über den bestehenden Generator', () => {
  it('lässt sonstiges ohne DNA und ohne neuen Hash-Bestandteil', async () => {
    const bp = carried('sonstiges');
    const result = withIndustryDna(bp, { now: FIXED });
    expect(result.blueprint).toBe(bp);
    expect(result.activated).toBe(false);
    expect(result.reason).toBe('kein-branchen-seed');
    expect(bp.dna).toBeUndefined();
  });

  it('aktiviert jede Seed-Branche, hält AA und übernimmt die Systemschrift', () => {
    for (const industry of Object.keys(INDUSTRY_THEME_SEEDS) as IndustryKey[]) {
      const seed = INDUSTRY_THEME_SEEDS[industry];
      const bp = carried(industry);
      const result = withIndustryDna(bp, { now: FIXED });
      expect(result.activated, `${industry}: ${result.reason}`).toBe(true);
      expect(bp.dna).toBeUndefined();
      expect(result.blueprint.theme).toEqual(bp.theme);
      expect(result.version?.rejectedTokens).toEqual([]);
      expect(result.version?.missingTokens).toEqual([]);
      expect(result.version?.overlay['type/family/body']).toBe(seed?.fontBody);
      expect(result.version?.overlay['type/family/display']).toBe(seed?.fontDisplay);
      expect(result.version?.generatorIndustry).toBe(INDUSTRY_GENERATOR_MAP[industry]?.generatorIndustry);
      const findings = analyzeBlueprint(result.blueprint)
        .filter((finding) => finding.code === 'accessibility.insufficient-contrast');
      expect(findings, industry).toEqual([]);
      const html = renderPage(result.blueprint, result.blueprint.pages[0]);
      expect(html).toContain(`<style>${renderThemeCss(bp.theme)}`);
      expect(html.indexOf('a{color:var(--color-text-primary);}')).toBeGreaterThan(html.indexOf('a{color:var(--accent);}'));
      expect(html).not.toContain('a{color:var(--color-accent-primary)}');
    }
  });

  it('behält beim Remix die ältere Fassung und die Schriftsperre', () => {
    const bp = carried('handwerk');
    const first = withIndustryDna(bp, { now: FIXED, locks: { dimensions: ['type'] } });
    const remixed = remixBoundDna(first.blueprint, { now: LATER });
    expect(remixed.activated).toBe(true);
    expect(remixed.blueprint.dna?.versions.some((item) => item.hash === first.version?.hash)).toBe(true);
    expect(remixed.version?.generatorInput.locks?.dimensions).toContain('type');
    expect(remixed.blueprint.dna?.versions.length).toBeGreaterThanOrEqual(1);
  });
});
