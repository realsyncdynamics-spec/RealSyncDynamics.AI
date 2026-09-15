import { describe, expect, it } from 'vitest';
import {
  buildSiteFromPrompt,
  renderBlockHtml,
  renderPage,
  renderPageBlocks,
} from '../../packages/siteos-core/src/index';

/**
 * `renderPageBlocks` ist die Grundlage des Block-Editors: Er zeigt Blöcke
 * einzeln, muss dabei aber dasselbe Markup liefern wie die ausgelieferte
 * Seite — sonst bearbeitet der Kunde eine Vorschau, die nicht die Website ist.
 */
describe('renderPageBlocks', () => {
  it('ergibt aneinandergehängt byte-gleich den Seitenrumpf von renderPage', async () => {
    const { blueprint } = await buildSiteFromPrompt('Erstelle eine Website für einen Zahnarzt in Hamburg.', {
      locale: 'de', model: null, createdAt: '2026-09-06T00:00:00.000Z',
    });
    for (const page of blueprint.pages) {
      const body = renderPageBlocks(blueprint, page).map((b) => b.html).join('\n');
      const full = renderPage(blueprint, page);
      expect(full).toContain(body);
    }
  });

  it('vergibt genau eine H1 je Seite und meldet die Ebene je Block', async () => {
    const { blueprint } = await buildSiteFromPrompt('Erstelle eine Website für einen Zahnarzt in Hamburg.', {
      locale: 'de', model: null, createdAt: '2026-09-06T00:00:00.000Z',
    });
    const home = blueprint.pages.find((p) => p.path === '/')!;
    const blocks = renderPageBlocks(blueprint, home);

    expect(blocks.filter((b) => b.heading === 'h1')).toHaveLength(1);
    expect(blocks.find((b) => b.heading === 'h1')?.id).toContain('--hero--');
    // Navigation und Fuß führen keine Seitenüberschrift.
    expect(blocks[0].heading).toBeNull();
    expect(blocks[blocks.length - 1].heading).toBeNull();
    // Die gemeldete Ebene stimmt mit dem Markup überein.
    for (const block of blocks) {
      if (block.heading === 'h1') expect(block.html).toContain('<h1');
      if (block.heading === 'h2') expect(block.html).not.toContain('<h1');
    }
  });

  it('rendert einen einzelnen Block mit vorgegebener Ebene identisch zum Seitenkontext', async () => {
    const { blueprint } = await buildSiteFromPrompt('Erstelle eine Website für einen Zahnarzt in Hamburg.', {
      locale: 'de', model: null, createdAt: '2026-09-06T00:00:00.000Z',
    });
    const home = blueprint.pages.find((p) => p.path === '/')!;
    for (const rendered of renderPageBlocks(blueprint, home)) {
      const block = home.blocks.find((b) => b.id === rendered.id)!;
      const level = rendered.heading ?? 'h2';
      expect(renderBlockHtml(blueprint, block, level)).toBe(rendered.html);
    }
  });
});
