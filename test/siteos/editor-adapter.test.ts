import { describe, expect, it } from 'vitest';
import {
  EDITABLE_CONTENT,
  applyPageEdits,
  buildSiteFromPrompt,
  canonicalHash,
  type BlockKind,
  type SiteBlueprint,
} from '../../packages/siteos-core/src/index';
import {
  blockToProps,
  isStoredId,
  pageToPuckData,
  propsToBlock,
  puckDataToBlueprint,
  toPageEdit,
  type BlockProps,
  type PuckPageData,
} from '../../src/features/siteos/editor/blueprintPuckAdapter';
import { adaptPresentationCssForCanvas, renderCanvasCss } from '../../src/features/siteos/editor/editorCss';
import { renderPresentationCss } from '../../packages/siteos-core/src/render/presentation';
import { THEME_FALLBACK } from '../../packages/siteos-core/src/render/theme';

/**
 * Die Brücke zwischen Blueprint und Puck. Entscheidend ist der Rundweg: Was
 * in den Editor geht und unverändert wieder herauskommt, muss byte-gleich
 * denselben Blueprint ergeben — sonst erzeugte das bloße Öffnen des Editors
 * eine neue Version mit neuem Hash.
 */
async function sample(): Promise<SiteBlueprint> {
  const built = await buildSiteFromPrompt('Erstelle eine Website für einen Zahnarzt in Hamburg.', {
    locale: 'de', model: 'test-model', createdAt: '2026-09-06T00:00:00.000Z',
  });
  return built.blueprint;
}

describe('Blueprint ↔ Puck', () => {
  it('überlebt den Rundweg ohne Änderung — gleicher Hash', async () => {
    const bp = await sample();
    for (const page of bp.pages) {
      const data = pageToPuckData(page);
      const back = puckDataToBlueprint(bp, page.path, data);
      expect(await canonicalHash(back)).toBe(await canonicalHash(bp));
    }
  });

  it('zeigt je Block genau die Felder aus EDITABLE_CONTENT und trägt den Rest mit', async () => {
    const bp = await sample();
    for (const block of bp.pages.flatMap((p) => p.blocks)) {
      const props = blockToProps(block);
      const editable = Object.keys(EDITABLE_CONTENT[block.kind]);
      for (const key of editable) expect(props).toHaveProperty(key);
      expect(props.__content).toBe(block.content);
      expect(props.__meta).toEqual({
        processesPersonalData: block.processesPersonalData,
        thirdPartyHosts: block.thirdPartyHosts,
        aiGenerated: block.aiGenerated,
      });
      // Nicht editierbare Felder tauchen nicht als eigene Props auf.
      for (const key of Object.keys(block.content)) {
        if (!editable.includes(key)) expect(props).not.toHaveProperty(key);
      }
    }
  });

  it('schickt in der Anfrage nur editierbare Felder — nie Merkmale', async () => {
    const bp = await sample();
    const page = bp.pages.find((p) => p.blocks.some((b) => b.kind === 'contact-form'))!;
    const edit = toPageEdit(page.path, pageToPuckData(page));
    for (const block of edit.blocks) {
      const allowed = Object.keys(EDITABLE_CONTENT[block.kind]);
      for (const key of Object.keys(block.content ?? {})) expect(allowed).toContain(key);
      expect(block.content).not.toHaveProperty('legalBasis');
      expect(block).not.toHaveProperty('aiGenerated');
      expect(block).not.toHaveProperty('thirdPartyHosts');
    }
    // Unberührte Felder werden gar nicht erst geschickt — der Server behält
    // seinen Stand, und ein Speichern ohne Änderung ändert keinen Hash.
    expect(edit.blocks.every((b) => Object.keys(b.content ?? {}).length === 0)).toBe(true);

    // Ein geändertes Formular schickt seine Felder als Namen, nicht als Objekte.
    const data = pageToPuckData(page);
    const form = data.content.find((item) => item.type === 'contact-form')!;
    form.props = { ...form.props, fields: [...(form.props.fields as { name: string }[]), { name: 'phone' }] };
    const changed = toPageEdit(page.path, data).blocks.find((b) => b.kind === 'contact-form')!;
    expect(changed.content?.fields).toEqual(['name', 'email', 'message', 'phone']);
  });

  it('lässt von Puck vergebene IDs neuer Blöcke nicht als gespeicherte durchgehen', async () => {
    const bp = await sample();
    const page = bp.pages.find((p) => p.path === '/')!;
    const data = pageToPuckData(page);
    const fresh: BlockProps = { ...blockToProps(page.blocks.find((b) => b.kind === 'hero')!), id: 'faq-3f2a9c1e' };
    const withNew: PuckPageData = { ...data, content: [...data.content, { type: 'faq' as BlockKind, props: fresh }] };
    const edit = toPageEdit(page.path, withNew);
    const added = edit.blocks[edit.blocks.length - 1];
    expect(added.id).toBeUndefined();
    expect(isStoredId('root--hero--1')).toBe(true);
    expect(isStoredId('faq-3f2a9c1e')).toBe(false);

    // Der Server legt den Block dann selbst an — mit eigener ID.
    const applied = applyPageEdits(bp, [edit]);
    const faq = applied.blueprint.pages[0].blocks.filter((b) => b.kind === 'faq');
    expect(faq.some((b) => /^root--faq--\d+$/.test(b.id))).toBe(true);
  });

  it('rekonstruiert aus Props den Block für die Leinwand samt Merkmalen', async () => {
    const bp = await sample();
    const block = bp.pages.flatMap((p) => p.blocks).find((b) => b.kind === 'hero')!;
    const props = blockToProps(block);
    props.headline = 'Neu';
    props.emphasis = 'tall';
    const back = propsToBlock('hero', props);
    expect(back.content.headline).toBe('Neu');
    expect(back.content.emphasis).toBe('tall');
    expect(back.content.media).toEqual(block.content.media);
    expect(back.aiGenerated).toBe(block.aiGenerated);
    expect(back.id).toBe(block.id);
  });
});

describe('Leinwand-Stylesheet', () => {
  it('schreibt jeden Strukturselektor der Layoutschicht auf den Block-Wrapper um', () => {
    const css = renderPresentationCss(THEME_FALLBACK);
    const adapted = adaptPresentationCssForCanvas(css);
    expect(adapted).not.toContain('body>');
    expect(adapted).not.toContain('body main>');
    expect(adapted).toContain('[data-siteos-block]>header');
    expect(adapted).toContain('[data-siteos-block]>section');
    // Die Block-Selektoren bleiben wörtlich erhalten.
    expect(adapted).toContain('[id*="--hero--"]');
  });

  it('enthält Theme und Layoutschicht — keine dritte Optik', () => {
    const canvas = renderCanvasCss(THEME_FALLBACK);
    expect(canvas).toContain('--accent:');
    expect(canvas).toContain('--maxw:');
    expect(canvas).toContain('[data-siteos-block]{display:block;}');
  });
});
