import { describe, expect, it } from 'vitest';
import {
  MAX_PAGES_PER_SITE,
  applyPageOperations,
  buildSiteFromPrompt,
  exceedsPageLimit,
  refineBlueprint,
  type SiteBlueprint,
  type SitePage,
} from '../../packages/siteos-core/src/index';

/**
 * Seiten-Invarianten gelten unabhängig von der Eintrittsroute.
 *
 * Bis zum 2026-09-07 gab es **zwei** Wege, eine Seite anzulegen, und sie
 * hielten verschiedene Regeln ein: `pages.ts` mit Obergrenze,
 * Slug-Validierung und reservierten Pfaden — `refine.ts` mit keinem davon.
 * Damit hing die Sicherheitslage einer Seite daran, über welchen Weg sie
 * entstanden ist. Befund und Entscheidung:
 * `docs/product/page-creation-invarianten.md`.
 *
 * Diese Datei prüft deshalb **beide** Wege gegen dieselben Regeln — ein Test
 * nur auf dem kanonischen Weg hätte den Befund nie gefunden.
 */

async function sample(): Promise<SiteBlueprint> {
  const built = await buildSiteFromPrompt('Erstelle eine Website für einen Zahnarzt in Hamburg.', {
    locale: 'de',
    model: 'test-model',
    createdAt: '2026-09-06T00:00:00.000Z',
  });
  return built.blueprint;
}

/**
 * Erzeugt einen Bestand mit `total` Seiten **unter Umgehung** der Operation —
 * so, wie ein Blueprint aus der Zeit vor der Grenze aussieht. Genau diese
 * Bestände dürfen nicht kaputtgehen.
 */
function legacyBlueprintWith(bp: SiteBlueprint, total: number): SiteBlueprint {
  const filler: SitePage[] = [];
  const template = bp.pages.find((p) => p.path === '/leistungen') ?? bp.pages[1];
  for (let i = bp.pages.length; i < total; i += 1) {
    filler.push({
      ...template,
      path: `/alt-${i}`,
      title: `Alt ${i}`,
      blocks: template.blocks.map((b) => ({ ...b, id: `alt-${i}--${b.kind}--${b.id.split('--').pop()}` })),
    });
  }
  return { ...bp, pages: [...bp.pages, ...filler] };
}

describe('Obergrenze — Create-Invariante, kein Zustandsurteil', () => {
  it('fragt, was die Operation ergäbe, nicht was schon da ist', () => {
    const bp = { pages: new Array(39).fill(null) } as unknown as SiteBlueprint;
    expect(exceedsPageLimit(bp, 1)).toBe(false); // 39 → 40
    expect(exceedsPageLimit({ pages: new Array(40).fill(null) } as unknown as SiteBlueprint, 1)).toBe(true); // 40 → 41
    expect(exceedsPageLimit({ pages: new Array(38).fill(null) } as unknown as SiteBlueprint, 2)).toBe(false); // 38 → 40
    expect(exceedsPageLimit({ pages: new Array(39).fill(null) } as unknown as SiteBlueprint, 2)).toBe(true); // 39 → 41
    // Ein Bestand über der Grenze ist für sich genommen kein Verstoß.
    expect(exceedsPageLimit({ pages: new Array(47).fill(null) } as unknown as SiteBlueprint, 0)).toBe(false);
  });

  it('folgt der verbindlichen Beispielkette: 47 bleibt, 48 nicht, bereinigen und neu anlegen geht', async () => {
    const base = await sample();
    let bp = legacyBlueprintWith(base, 47);
    expect(bp.pages).toHaveLength(47);

    // 47 → 48 abgelehnt, Bestand unverändert.
    const grow = applyPageOperations(bp, [{ op: 'create', title: 'Noch eine' }]);
    expect(grow.rejected).toContain(`pages.limit:${MAX_PAGES_PER_SITE}`);
    expect(grow.blueprint.pages).toHaveLength(47);

    // 47 → 46 erlaubt: der Bestand bleibt bereinigbar.
    const shrink = applyPageOperations(bp, [{ op: 'delete', path: '/alt-46' }]);
    expect(shrink.rejected).toEqual([]);
    expect(shrink.blueprint.pages).toHaveLength(46);

    // Bereinigen bis 39.
    bp = shrink.blueprint;
    for (let i = 45; i >= 39; i -= 1) {
      bp = applyPageOperations(bp, [{ op: 'delete', path: `/alt-${i}` }]).blueprint;
    }
    expect(bp.pages).toHaveLength(39);

    // 39 → 40 erlaubt.
    const ok = applyPageOperations(bp, [{ op: 'create', title: 'Wieder erlaubt' }]);
    expect(ok.rejected).toEqual([]);
    expect(ok.blueprint.pages).toHaveLength(40);

    // 40 → 41 abgelehnt.
    const stop = applyPageOperations(ok.blueprint, [{ op: 'create', title: 'Eine zu viel' }]);
    expect(stop.rejected).toContain(`pages.limit:${MAX_PAGES_PER_SITE}`);
    expect(stop.blueprint.pages).toHaveLength(40);
  });

  it('lässt einen Bestand über der Grenze lesbar und bearbeitbar', async () => {
    const bp = legacyBlueprintWith(await sample(), 47);
    const renamed = applyPageOperations(bp, [{ op: 'rename', path: '/alt-46', title: 'Umbenannt' }]);

    expect(renamed.rejected).toEqual([]);
    expect(renamed.blueprint.pages.find((p) => p.path === '/alt-46')?.title).toBe('Umbenannt');
    expect(renamed.blueprint.pages).toHaveLength(47);
  });
});

describe('Der Verfeinerungspfad hält dieselben Regeln ein', () => {
  it('legt eine Seite weiterhin an und verlinkt sie', async () => {
    const result = refineBlueprint(await sample(), 'Füge eine Referenzseite hinzu.');
    const page = result.blueprint.pages.find((p) => p.path === '/referenzen');

    expect(page).toBeDefined();
    expect(result.changes.some((c) => c.code === 'structure.page-added')).toBe(true);
    for (const other of result.blueprint.pages) {
      const nav = other.blocks.find((b) => b.kind === 'navigation');
      expect(((nav?.content.links ?? []) as { href: string }[]).map((l) => l.href)).toContain('/referenzen');
    }
  });

  it('beachtet die Obergrenze — und sagt es', async () => {
    const bp = legacyBlueprintWith(await sample(), MAX_PAGES_PER_SITE);
    const result = refineBlueprint(bp, 'Füge eine Referenzseite hinzu.');

    expect(result.blueprint.pages).toHaveLength(MAX_PAGES_PER_SITE);
    expect(result.blueprint.pages.some((p) => p.path === '/referenzen')).toBe(false);
    expect(result.refusals.join(' ')).toMatch(new RegExp(`${MAX_PAGES_PER_SITE} Seiten`));
  });

  it('belegt keinen für Rechtstexte reservierten Pfad', async () => {
    const result = refineBlueprint(await sample(), 'Bitte eine Seite namens "Widerruf" anlegen.');

    expect(result.blueprint.pages.some((p) => p.path === '/widerruf')).toBe(false);
    expect(result.refusals.join(' ')).toMatch(/reserviert/);
  });

  it('nennt eine bereits vorhandene Seite, statt still nichts zu tun', async () => {
    const once = refineBlueprint(await sample(), 'Füge eine Referenzseite hinzu.').blueprint;
    const twice = refineBlueprint(once, 'Füge eine Referenzseite hinzu.');

    expect(twice.blueprint.pages.filter((p) => p.path === '/referenzen')).toHaveLength(1);
    expect(twice.refusals.join(' ')).toMatch(/gibt es bereits/);
  });

  it('erzeugt über beide Wege dieselbe Seite — gleicher Pfad, gleiche Blockarten', async () => {
    const bp = await sample();
    const viaRefine = refineBlueprint(bp, 'Füge eine Referenzseite hinzu.').blueprint;
    const viaOperation = applyPageOperations(bp, [{ op: 'create', title: 'Referenzen', slug: 'referenzen' }]).blueprint;

    const a = viaRefine.pages.find((p) => p.path === '/referenzen')!;
    const b = viaOperation.pages.find((p) => p.path === '/referenzen')!;

    expect(a.title).toBe(b.title);
    expect(a.description).toBe(b.description);
    expect(a.blocks.map((x) => x.kind)).toEqual(b.blocks.map((x) => x.kind));
  });
});
