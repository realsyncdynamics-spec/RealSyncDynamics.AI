import { describe, expect, it } from 'vitest';
import {
  LEGAL_PAGE_PATHS,
  MAX_PAGES_PER_SITE,
  allowedPageOperations,
  analyzeBlueprint,
  applyPageEdits,
  applyPageOperations,
  buildSiteFromPrompt,
  canonicalHash,
  pageProtection,
  validatePageSlug,
  type PageOperation,
  type SiteBlueprint,
} from '../../packages/siteos-core/src/index';

/**
 * Seitenoperationen (Phase 2, Schritt B): anlegen, umbenennen, Slug ändern,
 * duplizieren, löschen — im Kern, nicht im Client.
 *
 * Geprüft wird vor allem, was der Server **nicht** tut: Rechtsseiten
 * anfassen, die Startseite löschen, einen Slug stillschweigend umschreiben,
 * eine Seite ohne Navigationslink zurücklassen, Verweise ins Leere zeigen
 * lassen. Und dass das Ergebnis deterministisch ist — gleiche Eingabe,
 * gleicher Hash —, weil darauf die Versionskette beruht.
 */
async function sample(prompt = 'Erstelle eine Website für einen Zahnarzt in Hamburg.'): Promise<SiteBlueprint> {
  const built = await buildSiteFromPrompt(prompt, { locale: 'de', model: 'test-model', createdAt: '2026-09-06T00:00:00.000Z' });
  return built.blueprint;
}

function paths(bp: SiteBlueprint): string[] {
  return bp.pages.map((p) => p.path);
}

function navLinks(bp: SiteBlueprint, path = '/'): { label: string; href: string }[] {
  const nav = bp.pages.find((p) => p.path === path)!.blocks.find((b) => b.kind === 'navigation')!;
  return nav.content.links as { label: string; href: string }[];
}

function allIds(bp: SiteBlueprint): string[] {
  return bp.pages.flatMap((p) => p.blocks.map((b) => b.id));
}

describe('Schutz — Rechtsseiten und Startseite', () => {
  it('erkennt Rechtsseiten am Pfad und am Rechtstext-Block, die Startseite am Pfad', async () => {
    const bp = await sample();
    for (const page of bp.pages) {
      const expected = LEGAL_PAGE_PATHS.includes(page.path) ? 'legal' : page.path === '/' ? 'home' : null;
      expect(pageProtection(page), page.path).toBe(expected);
    }
    // Ein Rechtstext unter fremdem Pfad ist trotzdem eine Rechtsseite.
    const legal = bp.pages.find((p) => p.path === '/datenschutz')!;
    expect(pageProtection({ ...legal, path: '/privacy' })).toBe('legal');
    expect(allowedPageOperations(legal).size).toBe(0);
    expect([...allowedPageOperations(bp.pages[0])].sort()).toEqual(['duplicate', 'rename']);
  });

  it('weist löschen, umbenennen, Slug und duplizieren auf Rechtsseiten ab — und die Seite bleibt unverändert', async () => {
    const bp = await sample();
    const before = await canonicalHash(bp);
    const ops: PageOperation[] = [
      { op: 'delete', path: '/impressum' },
      { op: 'rename', path: '/datenschutz', title: 'Kontakt' },
      { op: 'slug', path: '/datenschutz', slug: 'privacy' },
      { op: 'duplicate', path: '/impressum' },
      { op: 'delete', path: '/' },
      { op: 'slug', path: '/', slug: 'start' },
    ];
    const result = applyPageOperations(bp, ops);
    expect(result.rejected).toEqual([
      'page.protected:/impressum', 'page.protected:/datenschutz', 'page.protected:/datenschutz',
      'page.protected:/impressum', 'page.protected:/', 'page.protected:/',
    ]);
    expect(result.changes).toEqual([]);
    expect(await canonicalHash(result.blueprint)).toBe(before);
  });
});

describe('Slug-Prüfung', () => {
  it('nimmt nur kanonische Slugs an und schlägt die kanonische Form vor, statt still umzuschreiben', async () => {
    const bp = await sample();
    expect(validatePageSlug('waermepumpen', bp)).toEqual({ ok: true, slug: 'waermepumpen' });
    expect(validatePageSlug('Wärmepumpen', bp)).toEqual({ ok: false, reason: 'slug.invalid', suggestion: 'waermepumpen' });
    expect(validatePageSlug('a/b', bp)).toEqual({ ok: false, reason: 'slug.invalid', suggestion: 'a-b' });
    expect(validatePageSlug('', bp)).toEqual({ ok: false, reason: 'slug.empty', suggestion: null });
    expect(validatePageSlug('!!!', bp)).toEqual({ ok: false, reason: 'slug.invalid', suggestion: null });
    expect(validatePageSlug('impressum', bp)).toEqual({ ok: false, reason: 'slug.reserved', suggestion: null });
    expect(validatePageSlug('site', bp).ok).toBe(false);
    expect(validatePageSlug('leistungen', bp)).toEqual({ ok: false, reason: 'slug.taken', suggestion: 'leistungen-2' });
    // Die eigene Seite kollidiert nicht mit sich selbst.
    expect(validatePageSlug('leistungen', bp, '/leistungen')).toEqual({ ok: true, slug: 'leistungen' });
  });

  it('bleibt bei feindlichen Eingaben linear und kurz', async () => {
    const bp = await sample();
    const long = 'a'.repeat(100000) + '-'.repeat(100000) + '!'.repeat(100000);
    const started = Date.now();
    const result = validatePageSlug(long, bp);
    expect(Date.now() - started).toBeLessThan(500);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.suggestion?.length ?? 0).toBeLessThanOrEqual(64);
  });
});

describe('create', () => {
  it('legt die Seite mit Navigation aus der Startseite, Inhalt aus dem Brief und Fuß an — und verlinkt sie überall', async () => {
    const bp = await sample();
    const result = applyPageOperations(bp, [{ op: 'create', title: 'Wärmepumpen' }]);
    expect(result.rejected).toEqual([]);
    expect(result.changes.map((c) => c.code)).toEqual(['page.created']);
    const page = result.blueprint.pages.find((p) => p.path === '/waermepumpen')!;
    expect(page.title).toBe('Wärmepumpen');
    expect(page.description).toBe('Wärmepumpen — Zahnarztpraxis Hamburg in Hamburg.');
    expect(page.blocks.map((b) => b.kind)).toEqual(['navigation', 'hero', 'features', 'cta', 'ai-disclosure', 'footer']);
    // Navigation der neuen Seite ist die der Startseite (samt Links), nicht der Preset-Plan.
    expect(navLinks(result.blueprint, '/waermepumpen')).toEqual(navLinks(result.blueprint, '/'));
    for (const p of result.blueprint.pages) {
      const nav = p.blocks.find((b) => b.kind === 'navigation');
      if (nav) expect((nav.content.links as { href: string }[]).some((l) => l.href === '/waermepumpen')).toBe(true);
    }
    // IDs bleiben eindeutig über die ganze Site.
    const ids = allIds(result.blueprint);
    expect(new Set(ids).size).toBe(ids.length);
    // KI-Kennzeichnung wie beim Erstbau: Inhalt stammt aus dem Brief des KI-Baus.
    expect(page.blocks.find((b) => b.kind === 'hero')!.aiGenerated).toBe(true);
    expect(page.blocks.find((b) => b.kind === 'navigation')!.aiGenerated).toBe(false);
  });

  it('nimmt einen Wunsch-Slug nur in kanonischer Form und weist Kollisionen und Reserviertes ab', async () => {
    const bp = await sample();
    const result = applyPageOperations(bp, [
      { op: 'create', title: 'Team', slug: 'Team' },
      { op: 'create', title: 'Leistungen 2', slug: 'leistungen' },
      { op: 'create', title: 'AGB', slug: 'agb' },
      { op: 'create', title: '   ' },
      { op: 'create', title: 'Team', slug: 'team' },
    ]);
    expect(result.rejected).toEqual(['slug.invalid:Team→team', 'slug.taken:leistungen→leistungen-2', 'slug.reserved:agb', 'title.empty']);
    expect(paths(result.blueprint)).toContain('/team');
    expect(result.changes).toHaveLength(1);
  });

  it('hält die Obergrenze je Site', async () => {
    const bp = await sample();
    const ops: PageOperation[] = Array.from({ length: MAX_PAGES_PER_SITE }, (_, i) => ({ op: 'create', title: `Seite ${i}` }));
    const result = applyPageOperations(bp, ops);
    expect(result.blueprint.pages).toHaveLength(MAX_PAGES_PER_SITE);
    expect(result.rejected.filter((r) => r.startsWith('pages.limit:'))).toHaveLength(ops.length - (MAX_PAGES_PER_SITE - bp.pages.length));
  });
});

describe('rename', () => {
  it('ändert Titel, Navigationsbeschriftung und die abgeleitete Beschreibung — Pfad und IDs bleiben', async () => {
    const bp = await sample();
    const idsBefore = allIds(bp);
    const result = applyPageOperations(bp, [{ op: 'rename', path: '/leistungen', title: 'Unsere Leistungen' }]);
    expect(result.rejected).toEqual([]);
    const page = result.blueprint.pages.find((p) => p.path === '/leistungen')!;
    expect(page.title).toBe('Unsere Leistungen');
    expect(page.description).toBe('Unsere Leistungen — Zahnarztpraxis Hamburg in Hamburg.');
    expect(navLinks(result.blueprint).find((l) => l.href === '/leistungen')!.label).toBe('Unsere Leistungen');
    expect(allIds(result.blueprint)).toEqual(idsBefore);
    expect(result.changes[0]).toMatchObject({ code: 'page.renamed', path: '/leistungen', previousPath: null });
  });

  it('lässt eine redigierte Beschreibung stehen und erkennt eine unbekannte Seite', async () => {
    const bp = await sample();
    const edited: SiteBlueprint = { ...bp, pages: bp.pages.map((p) => (p.path === '/leistungen' ? { ...p, description: 'Handgeschrieben.' } : p)) };
    const result = applyPageOperations(edited, [{ op: 'rename', path: '/leistungen', title: 'Angebot' }, { op: 'rename', path: '/nix', title: 'X' }]);
    expect(result.blueprint.pages.find((p) => p.path === '/leistungen')!.description).toBe('Handgeschrieben.');
    expect(result.rejected).toEqual(['page.unknown:/nix']);
  });
});

describe('slug', () => {
  it('verschiebt die Seite und zieht jeden Verweis nach — Navigation, CTA, Anker', async () => {
    const bp = await sample();
    // Ein CTA mit Anker auf die Seite, um die Nachziehung über die Navigation hinaus zu prüfen.
    const withCta: SiteBlueprint = {
      ...bp,
      pages: bp.pages.map((p) => (p.path === '/' ? {
        ...p,
        blocks: p.blocks.map((b) => (b.kind === 'cta' ? { ...b, content: { ...b.content, href: '/termin#formular' } } : b)),
      } : p)),
    };
    const result = applyPageOperations(withCta, [{ op: 'slug', path: '/termin', slug: 'termin-buchen' }]);
    expect(result.rejected).toEqual([]);
    expect(paths(result.blueprint)).toContain('/termin-buchen');
    expect(paths(result.blueprint)).not.toContain('/termin');
    expect(navLinks(result.blueprint).some((l) => l.href === '/termin-buchen')).toBe(true);
    expect(navLinks(result.blueprint).some((l) => l.href === '/termin')).toBe(false);
    const cta = result.blueprint.pages[0].blocks.find((b) => b.kind === 'cta')!;
    expect(cta.content.href).toBe('/termin-buchen#formular');
    expect(result.changes[0]).toMatchObject({ code: 'page.moved', path: '/termin-buchen', previousPath: '/termin' });
    // Block-IDs bleiben Identität.
    expect(allIds(result.blueprint).sort()).toEqual(allIds(bp).sort());
  });

  it('weist einen nicht kanonischen oder belegten Slug ab', async () => {
    const bp = await sample();
    const result = applyPageOperations(bp, [{ op: 'slug', path: '/termin', slug: 'Termin Buchen' }, { op: 'slug', path: '/termin', slug: 'kontakt' }]);
    expect(result.rejected).toEqual(['slug.invalid:Termin Buchen→termin-buchen', 'slug.taken:kontakt→kontakt-2']);
    expect(paths(result.blueprint)).toContain('/termin');
  });
});

describe('duplicate', () => {
  it('kopiert Blöcke mit neuen IDs unter freiem Slug, verlinkt die Kopie und behält Merkmale', async () => {
    const bp = await sample();
    const result = applyPageOperations(bp, [{ op: 'duplicate', path: '/termin' }]);
    expect(result.rejected).toEqual([]);
    const copy = result.blueprint.pages.find((p) => p.path === '/termin-kopie')!;
    const source = bp.pages.find((p) => p.path === '/termin')!;
    expect(copy.title).toBe('Termin vereinbaren (Kopie)');
    expect(copy.blocks.map((b) => b.kind)).toEqual(source.blocks.map((b) => b.kind));
    // Inhalt byte-gleich — bis auf die Navigation, die den Link zur Kopie dazubekommt.
    const body = (page: typeof copy) => page.blocks.filter((b) => b.kind !== 'navigation').map((b) => b.content);
    expect(body(copy)).toEqual(body(source));
    expect(copy.blocks.map((b) => b.processesPersonalData)).toEqual(source.blocks.map((b) => b.processesPersonalData));
    expect(copy.blocks.every((b, i) => b.id !== source.blocks[i].id && b.id.startsWith('termin-kopie--'))).toBe(true);
    expect(navLinks(result.blueprint).some((l) => l.href === '/termin-kopie')).toBe(true);
    expect(result.changes[0]).toMatchObject({ code: 'page.duplicated', path: '/termin-kopie', previousPath: '/termin' });
    expect(result.changes[0].complianceNote).toMatch(/personenbezogene Daten/);
    const ids = allIds(result.blueprint);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('wählt bei wiederholtem Duplizieren freie Slugs und nimmt Wunschtitel und -slug an', async () => {
    const bp = await sample();
    const result = applyPageOperations(bp, [
      { op: 'duplicate', path: '/' },
      { op: 'duplicate', path: '/' },
      { op: 'duplicate', path: '/leistungen', title: 'Leistungen Privat', slug: 'privat' },
    ]);
    expect(result.rejected).toEqual([]);
    expect(paths(result.blueprint)).toEqual(expect.arrayContaining(['/startseite-kopie', '/startseite-kopie-2', '/privat']));
    expect(result.blueprint.pages.find((p) => p.path === '/privat')!.title).toBe('Leistungen Privat');
  });
});

describe('delete', () => {
  it('entfernt die Seite, ihre Navigationslinks und lässt andere Verweise auf die Startseite zeigen', async () => {
    const bp = await sample();
    const withCta: SiteBlueprint = {
      ...bp,
      pages: bp.pages.map((p) => (p.path === '/' ? {
        ...p,
        blocks: p.blocks.map((b) => (b.kind === 'cta' ? { ...b, content: { ...b.content, href: '/termin' } } : b)),
      } : p)),
    };
    const result = applyPageOperations(withCta, [{ op: 'delete', path: '/termin' }]);
    expect(result.rejected).toEqual([]);
    expect(paths(result.blueprint)).not.toContain('/termin');
    for (const p of result.blueprint.pages) {
      const nav = p.blocks.find((b) => b.kind === 'navigation');
      if (nav) expect((nav.content.links as { href: string }[]).some((l) => l.href === '/termin')).toBe(false);
    }
    expect(result.blueprint.pages[0].blocks.find((b) => b.kind === 'cta')!.content.href).toBe('/');
    expect(result.changes[0]).toMatchObject({ code: 'page.deleted', path: '/termin' });
    expect(result.changes[0].summary).toMatch(/Verweis/);
    expect(result.changes[0].complianceNote).toMatch(/entfällt eine Verarbeitung/);
    expect(analyzeBlueprint(result.blueprint).length).toBeGreaterThanOrEqual(0);
  });
});

describe('Determinismus und Compliance-Profil', () => {
  it('liefert für dieselbe Eingabe denselben Hash', async () => {
    const bp = await sample();
    const ops: PageOperation[] = [
      { op: 'create', title: 'Wärmepumpen' },
      { op: 'rename', path: '/leistungen', title: 'Angebot' },
      { op: 'slug', path: '/praxis', slug: 'ueber-uns' },
      { op: 'duplicate', path: '/kontakt' },
      { op: 'delete', path: '/termin' },
    ];
    const a = await canonicalHash(applyPageOperations(bp, ops).blueprint);
    const b = await canonicalHash(applyPageOperations(bp, ops).blueprint);
    expect(a).toBe(b);
    expect(a).not.toBe(await canonicalHash(bp));
  });

  it('leitet das Compliance-Profil nach Struktur- und Blockänderungen neu ab', async () => {
    // Das Preset ist die Untergrenze des Profils; was die Blöcke darüber hinaus
    // auslösen (Einwilligungskategorie eines Drittanbieters), muss dem Stand
    // der Blöcke folgen — bis 2026-09-07 blieb das Profil nach Block-
    // bearbeitungen auf dem Stand des Erstbaus stehen.
    const bp = await sample('Erstelle eine Website für eine Werbeagentur in Köln.');
    expect(bp.pages.flatMap((p) => p.blocks).some((b) => b.kind === 'map')).toBe(false);
    const home = bp.pages[0];

    // Karte per Blockbearbeitung hinzufügen → Drittanbieter-Kategorie kommt ins Profil.
    const added = applyPageEdits(bp, [{ path: '/', blocks: [...home.blocks.map((b) => ({ id: b.id, kind: b.kind })), { kind: 'map' as const }] }]);
    const map = added.blueprint.pages[0].blocks.find((b) => b.kind === 'map')!;
    const category = typeof map.content.consentCategory === 'string' ? map.content.consentCategory : 'extern';
    expect(bp.compliance.consentCategories).not.toContain(category);
    expect(added.blueprint.compliance.consentCategories).toContain(category);

    // Die Seite mit der Karte duplizieren, dann das Original leeren: Die
    // Kategorie bleibt, solange die Kopie sie trägt …
    const dup = applyPageOperations(added.blueprint, [{ op: 'duplicate', path: '/', slug: 'karte' }]).blueprint;
    const stripped = applyPageEdits(dup, [{ path: '/', blocks: home.blocks.map((b) => ({ id: b.id, kind: b.kind })) }]).blueprint;
    expect(stripped.compliance.consentCategories).toContain(category);
    // … und verschwindet mit dem Löschen der Kopie.
    const deleted = applyPageOperations(stripped, [{ op: 'delete', path: '/karte' }]).blueprint;
    expect(deleted.compliance.consentCategories).not.toContain(category);
    expect(deleted.compliance.consentCategories).toEqual(bp.compliance.consentCategories);
  });
});
