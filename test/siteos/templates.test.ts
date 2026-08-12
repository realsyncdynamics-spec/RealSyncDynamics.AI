import { describe, expect, it } from 'vitest';
import { applySiteDesignTemplate, SITE_DESIGN_TEMPLATES } from '../../packages/siteos-core/src/render/templates.ts';
import type { SiteBlueprint } from '../../packages/siteos-core/src/types.ts';

const blueprint = {
  version: 1,
  name: 'Preview Site',
  summary: 'Test site',
  locales: { default: 'de' },
  theme: {
    mode: 'light',
    accent: '#000000',
    surface: '#ffffff',
    foreground: '#000000',
    radiusPx: 8,
  },
  seo: { defaultTitle: 'Preview', defaultDescription: 'Preview' },
  pages: [],
} as unknown as SiteBlueprint;

describe('SiteOS redesign templates', () => {
  it('exposes exactly the three customer preview templates', () => {
    expect(SITE_DESIGN_TEMPLATES.map((item) => item.id)).toEqual([
      'modern-minimal',
      'bento-bold',
      'dark-professional',
    ]);
  });

  it('changes presentation without changing blueprint content', () => {
    const result = applySiteDesignTemplate(blueprint, 'bento-bold');
    expect(result.name).toBe(blueprint.name);
    expect(result.seo).toEqual(blueprint.seo);
    expect(result.pages).toEqual(blueprint.pages);
    expect(result.theme.accent).toBe('#7F56D9');
    expect(result.theme.radiusPx).toBe(18);
  });
});
