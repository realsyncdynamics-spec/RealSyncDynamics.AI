import { describe, it, expect } from 'vitest';
import {
  applyEdit,
  briefFromBlueprint,
  canonicalHash,
  EDIT_CAPABILITIES,
  parseBrief,
  parseEditIntent,
  PROTECTED_BLOCK_KINDS,
  renderSite,
  synthesizeBlueprint,
  withCompliance,
  type EditOp,
  type SiteBlueprint,
} from '../../packages/siteos-core/src/index';

function draft(prompt = 'Erstelle eine Website für einen Zahnarzt in Hamburg'): SiteBlueprint {
  return synthesizeBlueprint(parseBrief(prompt), { source: 'ai-builder', model: null });
}

/** Alles ausser den Seiten — dient dem Nachweis, dass nur das Gewollte wandert. */
function withoutPages(bp: SiteBlueprint): string {
  const { pages: _pages, ...rest } = bp;
  return JSON.stringify(rest);
}

function homeHtml(bp: SiteBlueprint): string {
  const pages = renderSite(bp, {});
  return pages.find((p) => p.path === '/')?.html ?? '';
}

describe('EDIT_CAPABILITIES', () => {
  // Der wichtigste Test dieser Datei. Die Liste ist das Versprechen an den
  // Besucher; jedes Beispiel darin muss erkannt werden UND etwas bewirken.
  // Ein Beispiel, das ins Leere läuft, ist schlimmer als ein fehlendes.
  it.each(EDIT_CAPABILITIES.map((c) => [c.label, c.example]))(
    'Beispiel „%s" wird erkannt und wirkt: %s',
    (_label, example) => {
      const intent = parseEditIntent(example) as EditOp | null;
      expect(intent, `nicht erkannt: ${example}`).not.toBeNull();

      // `block.add` setzt voraus, dass der Abschnitt gerade fehlt — die
      // Presets bringen ihn mit. Der Ausgangszustand wird deshalb passend
      // hergestellt, statt das Beispiel um diesen Umstand herum zu biegen.
      let start = draft();
      if (intent!.op === 'block.add') {
        start = applyEdit(start, { op: 'block.remove', kind: intent!.kind }).blueprint;
      }

      const result = applyEdit(start, intent as EditOp);
      expect(result.changed, `erkannt, aber wirkungslos: ${example} → ${JSON.stringify(result.rejection)}`).toBe(true);
    },
  );

  it('bietet nichts an, was applyEdit nicht kennt', () => {
    const ops = new Set(EDIT_CAPABILITIES.map((c) => parseEditIntent(c.example)?.op));
    expect(ops.has(undefined)).toBe(false);
  });
});

describe('parseEditIntent', () => {
  it('erkennt den Leitsatz', () => {
    expect(parseEditIntent('mach den Hero grösser')).toEqual({ op: 'hero.emphasis', value: 'large' });
    expect(parseEditIntent('Mach den Hero größer')).toEqual({ op: 'hero.emphasis', value: 'large' });
    expect(parseEditIntent('den titelbereich kleiner bitte')).toEqual({ op: 'hero.emphasis', value: 'compact' });
  });

  it('lehnt ab statt zu raten', () => {
    expect(parseEditIntent('mach es schöner')).toBeNull();
    expect(parseEditIntent('bau mir einen Onlineshop mit Zahlung')).toBeNull();
    expect(parseEditIntent('')).toBeNull();
    expect(parseEditIntent('   ')).toBeNull();
  });

  it('behandelt Zuweisungen als Text, nicht als Muster', () => {
    // „heller" im Wert darf nicht als Helligkeitswunsch gelesen werden.
    expect(parseEditIntent('Überschrift: Zahnarzt Hamburg heller')).toEqual({
      op: 'hero.headline',
      value: 'Zahnarzt Hamburg heller',
    });
    // „Name:" trifft den Namen, nicht die Überschrift.
    expect(parseEditIntent('Name: Praxis am Hafen')).toEqual({ op: 'site.name', value: 'Praxis am Hafen' });
    expect(parseEditIntent('Untertitel: auch samstags')).toEqual({ op: 'hero.subline', value: 'auch samstags' });
  });

  it('setzt die Farbe nur, wenn von Farbe die Rede ist', () => {
    expect(parseEditIntent('mach die Akzentfarbe grün')).toEqual({ op: 'theme.accent', value: '#3DD68C' });
    expect(parseEditIntent('die Farbe soll blau sein')).toEqual({ op: 'theme.accent', value: '#4C82FF' });
    // Ohne Farbsignal ist „grün" nur ein Wort im Satz.
    expect(parseEditIntent('der grüne Bereich stört')).toBeNull();
  });

  it('erkennt deutsche Farbwörter trotz ASCII-Wortgrenzen', () => {
    // `\b` scheitert an `ß` — deshalb die eigene Wortgrenze.
    expect(parseEditIntent('Akzentfarbe weiß')).toEqual({ op: 'theme.accent', value: '#FFFFFF' });
    expect(parseEditIntent('Akzentfarbe türkis')).toEqual({ op: 'theme.accent', value: '#4DD6D6' });
  });

  it('nimmt Hex-Angaben direkt', () => {
    expect(parseEditIntent('Akzent auf #FF0000')).toEqual({ op: 'theme.accent', value: '#FF0000' });
  });

  it('trennt Entfernen von Ergänzen', () => {
    expect(parseEditIntent('Entferne die Team-Sektion')).toEqual({ op: 'block.remove', kind: 'team' });
    expect(parseEditIntent('Füge ein Kontaktformular hinzu')).toEqual({ op: 'block.add', kind: 'contact-form' });
    // Ein Abschnittsbegriff ohne Verb ist keine Anweisung.
    expect(parseEditIntent('das Team ist wichtig')).toBeNull();
  });

  it('ist deterministisch', () => {
    const phrase = 'mach den Hero grösser';
    expect(parseEditIntent(phrase)).toEqual(parseEditIntent(phrase));
  });
});

describe('applyEdit — Betonung des Titelbereichs', () => {
  it('ändert nur den Hero, sonst nichts', () => {
    const before = draft();
    const after = applyEdit(before, { op: 'hero.emphasis', value: 'large' });

    expect(after.changed).toBe(true);
    // Theme, SEO, Compliance, Herkunft: unangetastet.
    expect(withoutPages(after.blueprint)).toBe(withoutPages(before));
    // Und auf den Seiten wirklich nur der eine Block.
    const changedBlocks = after.blueprint.pages.flatMap((page, i) =>
      page.blocks.filter((b, j) => JSON.stringify(b) !== JSON.stringify(before.pages[i].blocks[j])),
    );
    expect(changedBlocks).toHaveLength(1);
    expect(changedBlocks[0].kind).toBe('hero');
  });

  it('wird tatsächlich ausgeliefert', () => {
    const after = applyEdit(draft(), { op: 'hero.emphasis', value: 'large' }).blueprint;
    const html = homeHtml(after);
    expect(html).toContain('data-emphasis="large"');
    // Die zugehörige Regel muss im Stylesheet stehen, sonst wäre das
    // Attribut Zierde.
    expect(html).toContain('[data-emphasis="large"]');
  });

  it('setzt ohne Angabe kein Attribut', () => {
    // Genauer Anspruch: Die Erweiterung fügt dem Markup bestehender
    // Blueprints nichts hinzu. Die beiden CSS-Regeln stehen dagegen immer im
    // Stylesheet — sie sind ohne passendes Attribut wirkungslos.
    const html = homeHtml(draft());
    const markup = html.slice(html.indexOf('</style>'));
    expect(markup).not.toContain('data-emphasis');
    expect(html).toContain('[data-emphasis="large"]');
  });

  it('meldet „steht bereits so" statt eine leere Fassung zu erzeugen', () => {
    const once = applyEdit(draft(), { op: 'hero.emphasis', value: 'large' }).blueprint;
    const twice = applyEdit(once, { op: 'hero.emphasis', value: 'large' });
    expect(twice.changed).toBe(false);
    expect(twice.rejection?.code).toBe('NO_CHANGE');
  });

  it('erkennt „normal" als Ausgangswert', () => {
    const result = applyEdit(draft(), { op: 'hero.emphasis', value: 'normal' });
    expect(result.changed).toBe(false);
    expect(result.rejection?.code).toBe('NO_CHANGE');
  });
});

describe('applyEdit — Theme', () => {
  it('verwirft Werte, die aus dem Stylesheet ausbrechen würden', () => {
    const result = applyEdit(draft(), { op: 'theme.accent', value: 'red; } body { display: none } .x {' });
    expect(result.changed).toBe(false);
    expect(result.rejection?.code).toBe('VALUE_REJECTED');
  });

  it('führt Flächen- und Textfarbe mit, nicht nur den Modus', () => {
    // Der Renderer liest `mode` nicht. Ohne Palette wäre die Anweisung eine
    // Attrappe: neuer Hash, gleiche Ansicht.
    const before = draft();
    const after = applyEdit(before, { op: 'theme.appearance', value: 'light' });
    expect(after.changed).toBe(true);
    expect(after.blueprint.theme.surface).not.toBe(before.theme.surface);
    expect(after.blueprint.theme.foreground).not.toBe(before.theme.foreground);
    expect(homeHtml(after.blueprint)).toContain(`--surface:${after.blueprint.theme.surface}`);
  });

  it('begrenzt den Radius', () => {
    const after = applyEdit(draft(), { op: 'theme.radius', value: 9999 });
    expect(after.blueprint.theme.radiusPx).toBe(64);
  });

  it('lässt eine schwache Kontrastfarbe zu — sie ist ein Befund, kein Fehler', () => {
    // Bewusste Entscheidung: Der Publish Gate zeigt den Befund. Hier
    // abzulehnen hiesse, ihn zu verstecken.
    const after = applyEdit(draft(), { op: 'theme.accent', value: '#0052FF' });
    expect(after.changed).toBe(true);
  });
});

describe('applyEdit — Blöcke und Pflichtangaben', () => {
  it.each(PROTECTED_BLOCK_KINDS.map((k) => [k]))('entfernt %s nicht', (kind) => {
    const result = applyEdit(draft(), { op: 'block.remove', kind });
    expect(result.changed).toBe(false);
    expect(result.rejection?.code).toBe('PROTECTED_BLOCK');
  });

  it('behält den KI-Hinweis auch nach mehreren Änderungen', () => {
    // Art. 50 EU AI Act. Der Hinweis darf über keinen Pfad verschwinden.
    let bp = draft();
    for (const edit of [
      { op: 'block.remove', kind: 'team' },
      { op: 'block.remove', kind: 'testimonials' },
      { op: 'theme.appearance', value: 'light' },
      { op: 'hero.emphasis', value: 'large' },
    ] as EditOp[]) {
      bp = applyEdit(bp, edit).blueprint;
    }
    const disclosures = bp.pages.flatMap((p) => p.blocks).filter((b) => b.kind === 'ai-disclosure');
    expect(disclosures.length).toBeGreaterThan(0);
  });

  it('rechnet die Compliance nach dem Entfernen neu', () => {
    const before = draft('Zahnarzt in Hamburg');
    const withMap = before.pages.some((p) => p.blocks.some((b) => b.kind === 'map'));
    if (!withMap) return; // Preset ohne Karte — nichts zu zeigen.

    const after = applyEdit(before, { op: 'block.remove', kind: 'map' });
    expect(after.changed).toBe(true);
    expect(after.blueprint.compliance.consentCategories.length)
      .toBeLessThanOrEqual(before.compliance.consentCategories.length);
  });

  it('ergänzt einen Block so, wie die Synthese ihn gebaut hätte', () => {
    // Ein zweiter, hier gepflegter Bauplan würde mit der Zeit abweichen.
    let bp = draft();
    const original = bp.pages.flatMap((p) => p.blocks).find((b) => b.kind === 'contact-form');
    if (!original) return;

    bp = applyEdit(bp, { op: 'block.remove', kind: 'contact-form' }).blueprint;
    const added = applyEdit(bp, { op: 'block.add', kind: 'contact-form' });
    expect(added.changed).toBe(true);

    const rebuilt = added.blueprint.pages.flatMap((p) => p.blocks).find((b) => b.kind === 'contact-form');
    expect(rebuilt?.content).toEqual(original.content);
    expect(rebuilt?.processesPersonalData).toBe(original.processesPersonalData);
  });

  it('setzt einen ergänzten Block vor Pflichthinweis und Fusszeile', () => {
    let bp = draft();
    bp = applyEdit(bp, { op: 'block.remove', kind: 'faq' }).blueprint;
    const after = applyEdit(bp, { op: 'block.add', kind: 'faq' });
    if (!after.changed) return;

    const home = after.blueprint.pages.find((p) => p.path === '/')!;
    const faqIndex = home.blocks.findIndex((b) => b.kind === 'faq');
    const footerIndex = home.blocks.findIndex((b) => b.kind === 'footer');
    expect(faqIndex).toBeGreaterThan(-1);
    expect(faqIndex).toBeLessThan(footerIndex);
  });

  it('ergänzt nichts doppelt', () => {
    const result = applyEdit(draft(), { op: 'block.add', kind: 'hero' });
    expect(result.changed).toBe(false);
    expect(result.rejection?.code).toBe('BLOCK_ALREADY_PRESENT');
  });

  it('meldet einen fehlenden Abschnitt, statt ihn zu erfinden', () => {
    let bp = draft();
    bp = applyEdit(bp, { op: 'block.remove', kind: 'team' }).blueprint;
    const again = applyEdit(bp, { op: 'block.remove', kind: 'team' });
    expect(again.rejection?.code).toBe('BLOCK_NOT_PRESENT');
  });
});

describe('applyEdit — Name', () => {
  it('lässt den Slug stehen', () => {
    // Der Slug ist die Adresse. Ein mitwanderder Slug bräche die URL.
    const before = draft();
    const after = applyEdit(before, { op: 'site.name', value: 'Praxis am Hafen' });
    expect(after.blueprint.name).toBe('Praxis am Hafen');
    expect(after.blueprint.slug).toBe(before.slug);
  });

  it('zieht Navigation und SEO mit', () => {
    const after = applyEdit(draft(), { op: 'site.name', value: 'Praxis am Hafen' }).blueprint;
    expect(after.seo.siteName).toBe('Praxis am Hafen');
    expect(after.seo.defaultTitle).toContain('Praxis am Hafen');
    const nav = after.pages.flatMap((p) => p.blocks).find((b) => b.kind === 'navigation');
    expect((nav?.content as { brand?: string }).brand).toBe('Praxis am Hafen');
  });
});

describe('Determinismus und Hash-Kette', () => {
  it('gleiche Eingabe ⇒ gleicher Hash', async () => {
    const a = applyEdit(draft(), { op: 'hero.emphasis', value: 'large' }).blueprint;
    const b = applyEdit(draft(), { op: 'hero.emphasis', value: 'large' }).blueprint;
    expect(await canonicalHash(a)).toBe(await canonicalHash(b));
  });

  it('jede wirksame Änderung erzeugt einen neuen Hash', async () => {
    const seen = new Set<string>();
    let bp = draft();
    seen.add(await canonicalHash(bp));

    for (const edit of [
      { op: 'hero.emphasis', value: 'large' },
      { op: 'theme.accent', value: '#3DD68C' },
      { op: 'theme.radius', value: 12 },
      { op: 'site.name', value: 'Praxis am Hafen' },
      { op: 'block.remove', kind: 'team' },
    ] as EditOp[]) {
      const result = applyEdit(bp, edit);
      expect(result.changed, JSON.stringify(edit)).toBe(true);
      bp = result.blueprint;
      const hash = await canonicalHash(bp);
      expect(seen.has(hash), `Hash wiederholt sich nach ${edit.op}`).toBe(false);
      seen.add(hash);
    }
  });

  it('verändert den eingehenden Blueprint nicht', async () => {
    const before = draft();
    const hashBefore = await canonicalHash(before);
    applyEdit(before, { op: 'hero.emphasis', value: 'large' });
    expect(await canonicalHash(before)).toBe(hashBefore);
  });

  it('erhält die Herkunft — eine Änderung ist keine KI-Erzeugung', () => {
    // Art. 50 EU AI Act: `model` bleibt `null`, weil auch die Änderung
    // deterministisch ist. Ein hier gesetztes Modell wäre eine Falschangabe.
    const after = applyEdit(draft(), { op: 'hero.emphasis', value: 'large' }).blueprint;
    expect(after.origin.model).toBeNull();
    expect(after.origin.source).toBe('ai-builder');
  });
});

describe('briefFromBlueprint', () => {
  it('gewinnt die Leistungen aus dem Blueprint zurück', () => {
    const bp = draft();
    const brief = briefFromBlueprint(bp);
    expect(brief.name).toBe(bp.name);
    expect(brief.industry).toBe(bp.industry);
    expect(brief.services.length).toBeGreaterThan(0);
  });

  it('ist stabil: Compliance neu rechnen ändert nichts, wenn nichts anders ist', () => {
    const bp = draft();
    expect(withCompliance(bp).compliance).toEqual(bp.compliance);
  });
});
