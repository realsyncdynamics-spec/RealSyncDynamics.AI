import { describe, expect, it } from 'vitest';
import {
  ADDABLE_KINDS,
  EDITABLE_CONTENT,
  PINNED_KINDS,
  applyPageEdits,
  buildSiteFromPrompt,
  canonicalHash,
  sanitizeValue,
  type BlockEdit,
  type BlockKind,
  type SiteBlueprint,
} from '../../packages/siteos-core/src/index';

/**
 * Das Bearbeitungsmodell des Block-Editors.
 *
 * Geprüft wird nicht, ob Felder ankommen, sondern was der Server aus einer
 * Anfrage **nicht** übernimmt: Rechtsgrundlagen, Drittanbieter-Hosts und die
 * KI-Kennzeichnung kommen nie vom Client. Genau das unterscheidet diesen
 * Pfad von einem Baukasten, der einen fertigen Blueprint entgegennimmt.
 */
async function sample(): Promise<SiteBlueprint> {
  const built = await buildSiteFromPrompt('Erstelle eine Website für einen Zahnarzt in Hamburg.', {
    locale: 'de', model: 'test-model', createdAt: '2026-09-06T00:00:00.000Z',
  });
  return built.blueprint;
}

function home(bp: SiteBlueprint) {
  return bp.pages.find((p) => p.path === '/')!;
}

function asEdits(bp: SiteBlueprint, overrides: Partial<Record<string, Partial<BlockEdit>>> = {}): BlockEdit[] {
  return home(bp).blocks.map((b) => ({ id: b.id, kind: b.kind, ...(overrides[b.kind] ?? {}) }));
}

describe('applyPageEdits — Redaktion ändert Inhalt, nicht Merkmale', () => {
  it('übernimmt redaktionelle Felder und kippt die KI-Kennzeichnung des Blocks', async () => {
    const bp = await sample();
    const hero = home(bp).blocks.find((b) => b.kind === 'hero')!;
    expect(hero.aiGenerated).toBe(true);

    const result = applyPageEdits(bp, [{
      path: '/',
      blocks: asEdits(bp, { hero: { content: { headline: 'Praxis Dr. Muster', subline: 'Seit 1998 in Altona.' } } }),
    }]);

    const edited = home(result.blueprint).blocks.find((b) => b.id === hero.id)!;
    expect(edited.content.headline).toBe('Praxis Dr. Muster');
    expect(edited.content.subline).toBe('Seit 1998 in Altona.');
    expect(edited.aiGenerated).toBe(false);
    expect(result.changes.map((c) => c.code)).toContain('block.edited');
    expect(result.rejected).toEqual([]);
  });

  it('lässt einen unveränderten generierten Block gekennzeichnet', async () => {
    const bp = await sample();
    const result = applyPageEdits(bp, [{ path: '/', blocks: asEdits(bp) }]);
    const hero = home(result.blueprint).blocks.find((b) => b.kind === 'hero')!;
    expect(hero.aiGenerated).toBe(true);
    expect(result.changes).toEqual([]);
    // Und: gleiche Struktur ⇒ gleicher Hash. Ein Speichern ohne Änderung
    // darf keine neue Version erzeugen.
    expect(await canonicalHash(result.blueprint)).toBe(await canonicalHash(bp));
  });

  it('ignoriert Compliance-Felder in der Anfrage', async () => {
    const bp = await sample();
    // Das Formular liegt auf der Kontaktseite, nicht auf der Startseite —
    // der Test sucht die Seite, statt sie anzunehmen.
    const page = bp.pages.find((p) => p.blocks.some((b) => b.kind === 'contact-form'))!;
    const form = page.blocks.find((b) => b.kind === 'contact-form')!;

    const result = applyPageEdits(bp, [{
      path: page.path,
      blocks: page.blocks.map((b) => b.id === form.id
        ? {
            id: b.id, kind: b.kind,
            content: {
              heading: 'Schreiben Sie uns',
              legalBasis: 'keine',
              privacyHref: 'javascript:alert(1)',
              fields: ['email', 'password', 'name', 'email'],
            },
          }
        : { id: b.id, kind: b.kind }),
    }]);

    const edited = result.blueprint.pages.find((p) => p.path === page.path)!.blocks.find((b) => b.id === form.id)!;
    expect(edited.content.heading).toBe('Schreiben Sie uns');
    expect(edited.content.legalBasis).toBe(form.content.legalBasis);
    expect(edited.content.privacyHref).toBe(form.content.privacyHref);
    // Unbekannte Felder fallen weg, Dubletten auch; Reihenfolge bleibt.
    expect(edited.content.fields).toEqual(['email', 'name']);
    expect(edited.processesPersonalData).toBe(true);
  });

  it('legt neue Blöcke über den einen Block-Bauer an — mit Rechtsgrundlage', async () => {
    const bp = await sample();
    const pageBlocks = asEdits(bp);
    const withoutForm = pageBlocks.filter((b) => b.kind !== 'contact-form' && b.kind !== 'booking');
    const result = applyPageEdits(bp, [{
      path: '/',
      blocks: [...withoutForm, { kind: 'booking', content: { heading: 'Termin online buchen' } }],
    }]);

    const booking = home(result.blueprint).blocks.find((b) => b.kind === 'booking')!;
    expect(booking.content.heading).toBe('Termin online buchen');
    expect(booking.content.legalBasis).toBe('Art. 6 Abs. 1 lit. b DSGVO');
    expect(booking.content.privacyHref).toBe('/datenschutz');
    expect(booking.processesPersonalData).toBe(true);
    expect(booking.aiGenerated).toBe(false);
    expect(booking.id).toMatch(/^root--booking--\d+$/);
    expect(result.changes.find((c) => c.code === 'block.added')?.complianceNote).toMatch(/personenbezogene Daten/);
  });

  it('vergibt neuen Blöcken eine freie, stabile ID', async () => {
    const bp = await sample();
    const result = applyPageEdits(bp, [{
      path: '/',
      blocks: [...asEdits(bp), { kind: 'faq' }, { kind: 'faq' }],
    }]);
    const ids = home(result.blueprint).blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id.includes('--faq--')).length).toBeGreaterThanOrEqual(2);
  });

  it('hält Navigation, KI-Hinweis und Fuß angeheftet, auch wenn die Anfrage sie weglässt oder verschiebt', async () => {
    const bp = await sample();
    const shuffled = asEdits(bp).filter((b) => b.kind !== 'ai-disclosure').reverse();
    const result = applyPageEdits(bp, [{ path: '/', blocks: shuffled }]);
    const blocks = home(result.blueprint).blocks;

    expect(blocks[0].kind).toBe('navigation');
    expect(blocks[blocks.length - 1].kind).toBe('footer');
    expect(blocks[blocks.length - 2].kind).toBe('ai-disclosure');
    expect(result.changes.some((c) => c.code === 'block.restored' && c.kind === 'ai-disclosure')).toBe(true);
  });

  it('weist an, was kein Redakteur anlegen darf, statt es still zu ignorieren', async () => {
    const bp = await sample();
    const result = applyPageEdits(bp, [{
      path: '/',
      blocks: [...asEdits(bp), { kind: 'footer' }, { kind: 'legal-text' }, { kind: 'unbekannt' as BlockKind }],
    }]);
    expect(result.rejected).toEqual(expect.arrayContaining(['block.pinned:footer', 'block.pinned:legal-text', 'block.unknown-kind:unbekannt']));
    expect(home(result.blueprint).blocks.filter((b) => b.kind === 'footer')).toHaveLength(1);
  });

  it('kann keine Seiten anlegen', async () => {
    const bp = await sample();
    const result = applyPageEdits(bp, [{ path: '/neu', blocks: [{ kind: 'hero' }] }]);
    expect(result.rejected).toContain('page.unknown:/neu');
    expect(result.blueprint.pages.map((p) => p.path)).toEqual(bp.pages.map((p) => p.path));
  });

  it('protokolliert Entfernen und Verschieben', async () => {
    const bp = await sample();
    const edits = asEdits(bp);
    const services = edits.findIndex((b) => b.kind === 'services');
    const removed = edits.splice(services, 1)[0];
    // Das zweite Inhaltselement nach vorn ziehen.
    const [nav, first, second, ...rest] = edits;
    const result = applyPageEdits(bp, [{ path: '/', blocks: [nav, second, first, ...rest] }]);
    const codes = result.changes.map((c) => `${c.code}:${c.kind}`);
    expect(codes).toContain(`block.removed:${removed.kind}`);
    expect(result.changes.some((c) => c.code === 'block.moved')).toBe(true);
  });
});

describe('Vokabular', () => {
  it('führt jeden Block-Typ genau einmal und hält Angeheftetes von Anlegbarem getrennt', () => {
    const kinds = Object.keys(EDITABLE_CONTENT);
    expect(kinds).toHaveLength(15);
    for (const kind of PINNED_KINDS) expect(ADDABLE_KINDS).not.toContain(kind);
  });

  it('bereinigt Werte nach ihrer Form', () => {
    expect(sanitizeValue({ type: 'text', maxLength: 5 }, ' ab cdefg ')).toBe('abcde');
    expect(sanitizeValue({ type: 'textarea', nullable: true }, '  ')).toBeNull();
    expect(sanitizeValue({ type: 'url' }, 'javascript:alert(1)')).toBe('');
    expect(sanitizeValue({ type: 'url' }, '/kontakt')).toBe('/kontakt');
    expect(sanitizeValue({ type: 'url' }, 'https://example.org/x')).toBe('https://example.org/x');
    expect(sanitizeValue({ type: 'enum', values: ['compact', 'tall'], optional: true }, 'riesig')).toBeUndefined();
    expect(sanitizeValue({ type: 'form-fields' }, [{ name: 'slot' }, 'phone', 'x'])).toEqual(['slot', 'phone']);
    expect(sanitizeValue({ type: 'list', max: 1, item: { label: { type: 'text' } } }, [{ label: 'a', extra: 1 }, { label: 'b' }])).toEqual([{ label: 'a' }]);
  });
});
