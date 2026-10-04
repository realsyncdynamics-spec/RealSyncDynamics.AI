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

/**
 * Design-Vorlagen werden Teil der Version.
 *
 * Bis 2026-10 wirkte eine Vorlage nur in der Vorschau des Workspace: gezeigt
 * wurde sie, gespeichert und vom Publish Gate bewertet wurde das Theme des
 * Bauplans. Außerdem verlor die Vorlage ihre Schriften. Geprüft wird, dass
 * der Kern die Vorlage vollständig überträgt, dass der Server nur eine ID
 * annimmt und dass eine unbekannte ID benannt abgewiesen wird.
 */
async function sample(): Promise<SiteBlueprint> {
  const built = await buildSiteFromPrompt('Erstelle eine Website für einen Zahnarzt in Hamburg.', {
    locale: 'de', model: 'test-model', createdAt: '2026-09-06T00:00:00.000Z',
  });
  return built.blueprint;
}

describe('applySiteDesignTemplate — vollständige Vorlage', () => {
  it.each(DESIGN_TEMPLATES.map((t) => [t.id, t] as const))('%s überträgt Farben, Radius und Schriften', async (_id, template) => {
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
    // Seiten und Inhalte bleiben unberührt — eine Vorlage ist reine Darstellung.
    expect(themed.pages).toBe(bp.pages);
  });
});

describe('matchDesignTemplate', () => {
  it('erkennt jede Vorlage nach dem Anwenden wieder', async () => {
    const bp = await sample();
    for (const template of DESIGN_TEMPLATES) {
      expect(matchDesignTemplate(applySiteDesignTemplate(bp, template.id).theme)).toBe(template.id);
    }
  });

  it('meldet ein eigenes Theme als null, statt eine Vorlage zu unterstellen', async () => {
    const bp = await sample();
    expect(matchDesignTemplate(bp.theme)).toBeNull();
    expect(matchDesignTemplate(undefined)).toBeNull();
  });

  it('ist bei Groß-/Kleinschreibung der Farben tolerant, nicht bei abweichenden Werten', async () => {
    const bp = applySiteDesignTemplate(await sample(), 'bento-bold');
    expect(matchDesignTemplate({ ...bp.theme, accent: bp.theme.accent.toLowerCase() })).toBe('bento-bold');
    expect(matchDesignTemplate({ ...bp.theme, radiusPx: 3 })).toBeNull();
  });
});

describe('isDesignTemplate', () => {
  it('kennt nur die IDs aus DESIGN_TEMPLATES', () => {
    for (const template of DESIGN_TEMPLATES) expect(isDesignTemplate(template.id)).toBe(true);
    for (const value of ['', 'Modern Minimal', 'modern-minimal ', null, undefined, 42, {}]) {
      expect(isDesignTemplate(value)).toBe(false);
    }
  });
});

describe('applySiteEdits — Redaktion plus Vorlage', () => {
  it('ohne Vorlage und ohne Bearbeitung bleibt der Bauplan identisch', async () => {
    const bp = await sample();
    const result = applySiteEdits(bp, [], null);
    expect(result.blueprint).toBe(bp);
    expect(result.themeChange).toBeNull();
    expect(result.changes).toEqual([]);
    expect(result.rejected).toEqual([]);
  });

  it('übernimmt eine Vorlage allein und benennt die Änderung', async () => {
    const bp = await sample();
    const result = applySiteEdits(bp, [], 'dark-professional');
    expect(result.blueprint.theme.mode).toBe('dark');
    expect(result.themeChange).toEqual({ template: 'dark-professional', summary: expect.stringContaining('Dark Professional') });
    expect(await canonicalHash(result.blueprint)).not.toBe(await canonicalHash(bp));
  });

  it('meldet keine Änderung, wenn die Site die Vorlage schon trägt', async () => {
    const bp = applySiteDesignTemplate(await sample(), 'modern-minimal');
    const result = applySiteEdits(bp, [], 'modern-minimal');
    expect(result.themeChange).toBeNull();
    expect(await canonicalHash(result.blueprint)).toBe(await canonicalHash(bp));
  });

  it('weist eine unbekannte Vorlage benannt ab und lässt das Theme stehen', async () => {
    const bp = await sample();
    const result = applySiteEdits(bp, [], 'neon-chaos');
    expect(result.themeChange).toBeNull();
    expect(result.rejected).toContain('theme.unknown-template:neon-chaos');
    expect(result.blueprint.theme).toEqual(bp.theme);
  });

  it('wendet Blockbearbeitung und Vorlage gemeinsam an', async () => {
    const bp = await sample();
    const page = bp.pages.find((p) => p.path === '/') ?? bp.pages[0];
    const edits = [{
      path: page.path,
      blocks: page.blocks.map((b) => (b.kind === 'hero'
        ? { id: b.id, kind: b.kind, content: { ...b.content, headline: 'Praxis Dr. Muster' } }
        : { id: b.id, kind: b.kind, content: b.content })),
    }];
    const result = applySiteEdits(bp, edits, 'bento-bold');
    const hero = result.blueprint.pages.find((p) => p.path === page.path)!.blocks.find((b) => b.kind === 'hero')!;
    expect(hero.content.headline).toBe('Praxis Dr. Muster');
    expect(result.blueprint.theme.fontDisplay).toBe('Space Grotesk, system-ui, sans-serif');
    expect(result.themeChange?.template).toBe('bento-bold');
  });
});

describe('siteos/edit — Vertrag im Quelltext', () => {
  const handler = () => readFileSync('supabase/functions/siteos/handlers/edit.ts', 'utf8');

  it('nimmt nur eine Vorlagen-ID an und prüft sie gegen den Kern', () => {
    const src = handler();
    expect(src).toContain('isDesignTemplate(body.design_template)');
    expect(src).toContain('applySiteEdits(row.blueprint, edits, designTemplate)');
    // Kein Theme aus dem Browser.
    expect(src).not.toMatch(/body\.theme\b/);
  });

  it('nennt die Vorlage im Prüfpfad und in der Antwort', () => {
    const src = handler();
    expect(src).toContain("'theme.template'");
    expect(src).toMatch(/theme_change: applied\.themeChange/);
  });
});
