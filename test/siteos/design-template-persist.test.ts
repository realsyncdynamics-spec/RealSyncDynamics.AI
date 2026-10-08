import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DESIGN_TEMPLATES,
  applySiteDesignTemplate,
  applySiteEdits,
  buildSiteFromPrompt,
  canonicalHash,
  isDesignTemplate,
  matchDesignTemplate,
  type SiteBlueprint,
} from '../../packages/siteos-core/src/index';

async function sample(): Promise<SiteBlueprint> {
  const built = await buildSiteFromPrompt(
    'Erstelle eine Website für einen Zahnarzt in Hamburg.',
    { locale: 'de', model: 'test-model', createdAt: '2026-10-06T00:00:00.000Z' },
  );
  return built.blueprint;
}

describe('SiteOS Design-Persistenz', () => {
  it.each(DESIGN_TEMPLATES.map((template) => [template.id, template] as const))(
    '%s überträgt Farben, Radius und Schriften',
    async (_id, template) => {
      const bp = await sample();
      const themed = applySiteDesignTemplate(bp, template.id);
      expect(themed.theme).toMatchObject({
        mode: template.mode,
        accent: template.accent,
        surface: template.surface,
        foreground: template.foreground,
        fontDisplay: template.fontDisplay,
        fontBody: template.fontBody,
        radiusPx: template.radiusPx,
      });
      expect(themed.pages).toBe(bp.pages);
      expect(matchDesignTemplate(themed.theme)).toBe(template.id);
    },
  );

  it('akzeptiert nur bekannte Template-IDs', () => {
    for (const template of DESIGN_TEMPLATES) expect(isDesignTemplate(template.id)).toBe(true);
    for (const value of ['', 'modern-minimal ', 'neon-chaos', null, undefined, 42]) {
      expect(isDesignTemplate(value)).toBe(false);
    }
  });

  it('macht eine reine Designänderung zu einer echten Blueprint-Änderung', async () => {
    const bp = await sample();
    const result = applySiteEdits(bp, [], 'dark-professional');
    expect(result.themeChange?.template).toBe('dark-professional');
    expect(result.blueprint.theme.mode).toBe('dark');
    expect(await canonicalHash(result.blueprint)).not.toBe(await canonicalHash(bp));
  });

  it('weist unbekannte Templates benannt ab und übernimmt keine Client-Theme-Werte', async () => {
    const bp = await sample();
    const result = applySiteEdits(bp, [], 'neon-chaos');
    expect(result.themeChange).toBeNull();
    expect(result.rejected).toContain('theme.unknown-template:neon-chaos');
    expect(result.blueprint.theme).toEqual(bp.theme);

    const handler = readFileSync('supabase/functions/siteos/handlers/edit.ts', 'utf8');
    expect(handler).toContain('isDesignTemplate(body.design_template)');
    expect(handler).toContain('applySiteEdits(row.blueprint, edits, designTemplate)');
    expect(handler).not.toMatch(/body\.theme\b/);
    expect(handler).toContain("'theme.template'");
    expect(handler).toContain('theme_change: applied.themeChange');
  });
});
