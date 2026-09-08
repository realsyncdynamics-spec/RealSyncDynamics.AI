import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applySiteDesignTemplate, DESIGN_TEMPLATES, defaultDesignTemplate, synthesizeBlueprint, parseBrief } from '../../packages/siteos-core/src/index';
import { meetsWcagAA } from '../../packages/siteos-core/src/render/theme';

describe('Enterprise-8K-Vorlagen', () => {
  it('sind die Vorgabe des Builders', () => {
    expect(defaultDesignTemplate()).toBe('enterprise-8k');
  });

  it('enthält die drei 8K-Vorlagen neben den Studio-Vorlagen', () => {
    const ids = DESIGN_TEMPLATES.map((t) => t.id);
    expect(ids).toContain('enterprise-8k');
    expect(ids).toContain('cinematic-obsidian');
    expect(ids).toContain('editorial-trust');
    expect(ids).toContain('modern-minimal');
    expect(DESIGN_TEMPLATES.filter((t) => t.tag === '8K')).toHaveLength(3);
  });

  it('wendet Schriften an — sonst wechselt die Auswahl nur Farben', () => {
    const blueprint = synthesizeBlueprint(parseBrief('Kanzlei in Hamburg'));
    const applied = applySiteDesignTemplate(blueprint, 'editorial-trust');
    const template = DESIGN_TEMPLATES.find((t) => t.id === 'editorial-trust')!;
    expect(applied.theme.fontDisplay).toBe(template.fontDisplay);
    expect(applied.theme.fontBody).toBe(template.fontBody);
    expect(applied.theme.accent).toBe(template.accent);
  });

  it.each(DESIGN_TEMPLATES)('$id erfüllt WCAG AA für Fließtext und großen Akzent', (template) => {
    expect(
      meetsWcagAA(template.foreground, template.surface),
      `${template.id}: ${template.foreground} auf ${template.surface}`,
    ).toBe(true);
    expect(
      meetsWcagAA(template.accent, template.surface, true),
      `${template.id}: Akzent ${template.accent} auf ${template.surface} (großer Text)`,
    ).toBe(true);
  });
});

describe('8K-Vorlagen im Builder erreichbar', () => {
  it('Build Studio bietet die Vorlagenwahl über SITE_DESIGN_TEMPLATES', () => {
    const source = readFileSync(resolve(__dirname, '../../src/unified-entry/pages/BuildStudioPage.tsx'), 'utf8');
    expect(source).toContain('SITE_DESIGN_TEMPLATES');
    expect(source).toContain('applySiteDesignTemplate');
    expect(source).toContain('defaultDesignTemplate');
  });
});
