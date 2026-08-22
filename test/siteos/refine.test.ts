// Verfeinerung: Blueprint → geänderter Blueprint.
//
// Der Prüfschwerpunkt liegt nicht auf der Optik, sondern auf zwei Zusagen,
// die eine Verfeinerung leicht bricht: Das Compliance-Profil muss der
// tatsächlichen Struktur folgen, und eine nicht verstandene Anweisung darf
// nicht als „erledigt" durchgehen.

import { describe, it, expect } from 'vitest';
import {
  analyzeObservation,
  buildSiteFromPrompt,
  deriveRequests,
  parseBrief,
  refineBlueprint,
  renderSite,
  synthesizeBlueprint,
  type SiteBlueprint,
  type SiteObservation,
} from '../../packages/siteos-core/src/index';

function base(prompt = 'Erstelle eine Website für eine Kanzlei für Arbeitsrecht in Köln.'): SiteBlueprint {
  return synthesizeBlueprint(parseBrief(prompt), { model: 'claude-opus-5' });
}

function blockKinds(bp: SiteBlueprint, path = '/'): string[] {
  return bp.pages.find((page) => page.path === path)?.blocks.map((b) => b.kind) ?? [];
}

describe('refineBlueprint — Theme', () => {
  it('stellt auf dunkel um und tauscht Fläche und Text mit', () => {
    const light = refineBlueprint(base(), 'Mach es hell.').blueprint;
    const result = refineBlueprint(light, 'Mach das Ganze dunkel.');

    expect(result.understood).toBe(true);
    expect(result.blueprint.theme.mode).toBe('dark');
    expect(result.blueprint.theme.surface).toBe('#0A0A0B');
    expect(result.blueprint.theme.foreground).toBe('#E2E2E2');
  });

  it('ignoriert widersprüchliche Angaben, statt zu raten', () => {
    const result = refineBlueprint(base(), 'Hell oder dunkel, entscheide du.');
    expect(result.blueprint.theme.mode).toBe(base().theme.mode);
  });

  it('setzt eine benannte Akzentfarbe nur bei erkennbarer Farbabsicht', () => {
    expect(refineBlueprint(base(), 'Nimm grün als Akzentfarbe.').blueprint.theme.accent).toBe('#15803D');
    // „grüne Bereich" ist keine Farbanweisung.
    expect(refineBlueprint(base(), 'Der grüne Bereich ist zu lang.').changes).toEqual([]);
  });

  it('übernimmt Hex-Farben und meldet zu schwachen Kontrast als Befund', () => {
    const dark = refineBlueprint(base(), 'Mach es dunkel.').blueprint;
    const result = refineBlueprint(dark, 'Nimm #101014 als Buttonfarbe.');

    expect(result.blueprint.theme.accent).toBe('#101014');
    expect(result.changes[0].complianceNote).toMatch(/WCAG/);
  });

  it('rundet Ecken ab und setzt sie wieder auf Hard Edge', () => {
    const round = refineBlueprint(base(), 'Die Ecken bitte runder.');
    expect(round.blueprint.theme.radiusPx).toBe(16);
    expect(refineBlueprint(round.blueprint, 'Doch lieber kantig.').blueprint.theme.radiusPx).toBe(0);
  });

  it('wechselt die Schrift nur, wenn von Schrift die Rede ist', () => {
    expect(refineBlueprint(base(), 'Die Schrift gefällt mir nicht, nimm etwas Klassisches.')
      .blueprint.theme.fontDisplay).toMatch(/Georgia/);
    expect(refineBlueprint(base(), 'Sehr klassisch das Ganze.').changes).toEqual([]);
  });
});

describe('refineBlueprint — Inhalt', () => {
  it('vergrößert den Hero über eine Blueprint-Angabe, nicht über CSS allein', () => {
    const result = refineBlueprint(base(), 'Mach den Hero deutlich größer.');
    const hero = result.blueprint.pages[0].blocks.find((b) => b.kind === 'hero');

    expect(hero?.content.emphasis).toBe('tall');
    // Die Angabe muss im ausgelieferten Dokument ankommen — sonst wäre sie
    // eine Zusage, die nur im Datenmodell existiert.
    const html = renderSite(result.blueprint)[0].html;
    expect(html).toContain('data-emphasis="tall"');
  });

  it('ändert die Hero-Überschrift nur mit zitiertem Text', () => {
    expect(refineBlueprint(base(), 'Ändere die Überschrift zu "Recht, das trägt".')
      .blueprint.pages[0].blocks.find((b) => b.kind === 'hero')?.content.headline)
      .toBe('Recht, das trägt');
    expect(refineBlueprint(base(), 'Die Überschrift gefällt mir nicht.').changes).toEqual([]);
  });

  it('benennt die Website um und zieht Slug, SEO und Wortmarke nach', () => {
    const result = refineBlueprint(base(), 'Nenne die Website "Kanzlei Vogt & Partner".');
    const bp = result.blueprint;

    expect(bp.name).toBe('Kanzlei Vogt & Partner');
    expect(bp.slug).toBe('kanzlei-vogt-partner');
    expect(bp.seo.siteName).toBe('Kanzlei Vogt & Partner');
    expect(bp.pages[0].blocks[0].content.brand).toBe('Kanzlei Vogt & Partner');
  });
});

describe('refineBlueprint — Struktur und Compliance', () => {
  it('rüstet ein Kontaktformular samt Rechtsgrundlage nach', () => {
    const start = base('Website für ein Architekturbüro in Leipzig, dunkel und minimalistisch.');
    const before = start.compliance.legalBases.length;

    const result = refineBlueprint(start, 'Füge ein Kontaktformular hinzu.');
    const form = result.blueprint.pages[0].blocks.find((b) => b.kind === 'contact-form');

    expect(form?.processesPersonalData).toBe(true);
    expect(form?.content.legalBasis).toBe('Art. 6 Abs. 1 lit. b DSGVO');
    expect(result.blueprint.compliance.legalBases.length).toBeGreaterThanOrEqual(before);
    expect(result.changes[0].complianceNote).toMatch(/Art\. 6/);
  });

  it('setzt neue Blöcke vor Handlungsaufforderung, KI-Hinweis und Fuß', () => {
    const result = refineBlueprint(base(), 'Bitte eine Anfahrtskarte ergänzen.');
    const kinds = blockKinds(result.blueprint);

    expect(kinds).toContain('map');
    expect(kinds.indexOf('map')).toBeLessThan(kinds.indexOf('footer'));
    expect(kinds.indexOf('map')).toBeLessThan(kinds.indexOf('ai-disclosure'));
  });

  it('führt die Consent-Kategorie der Karte im Compliance-Profil', () => {
    const result = refineBlueprint(base(), 'Bitte eine Anfahrtskarte ergänzen.');
    expect(result.blueprint.compliance.consentCategories).toContain('karten');
  });

  it('entfernt einen Block und leitet das Profil danach neu ab', () => {
    const withMap = refineBlueprint(base(), 'Bitte eine Anfahrtskarte ergänzen.').blueprint;
    const without = refineBlueprint(withMap, 'Die Karte bitte wieder entfernen.');

    expect(blockKinds(without.blueprint)).not.toContain('map');
    expect(without.blueprint.compliance.consentCategories).not.toContain('karten');
  });

  it('legt eine neue Seite an und verlinkt sie in jeder Navigation', () => {
    const result = refineBlueprint(base(), 'Füge eine Referenzseite hinzu.');
    const page = result.blueprint.pages.find((p) => p.path === '/referenzen');

    expect(page).toBeDefined();
    expect(page?.blocks.map((b) => b.kind)).toContain('ai-disclosure');

    for (const other of result.blueprint.pages) {
      const nav = other.blocks.find((b) => b.kind === 'navigation');
      const links = (nav?.content.links ?? []) as { href: string }[];
      expect(links.map((l) => l.href)).toContain('/referenzen');
    }
  });

  it('nimmt auch frei benannte Seiten an', () => {
    const result = refineBlueprint(base(), 'Bitte eine Seite namens "Nachhaltigkeit" anlegen.');
    expect(result.blueprint.pages.some((p) => p.path === '/nachhaltigkeit')).toBe(true);
  });

  it('legt eine bereits vorhandene Seite nicht doppelt an', () => {
    const once = refineBlueprint(base(), 'Füge eine Referenzseite hinzu.').blueprint;
    const twice = refineBlueprint(once, 'Füge eine Referenzseite hinzu.');
    expect(twice.blueprint.pages.filter((p) => p.path === '/referenzen')).toHaveLength(1);
  });
});

describe('refineBlueprint — Grenzen', () => {
  it('lehnt das Entfernen des KI-Hinweises ab und begründet es', () => {
    const result = refineBlueprint(base(), 'Entferne bitte den KI-Hinweis unten.');

    expect(result.refusals[0]).toMatch(/Art\. 50/);
    expect(blockKinds(result.blueprint)).toContain('ai-disclosure');
  });

  it('meldet eine nicht verstandene Anweisung als solche', () => {
    const result = refineBlueprint(base(), 'Bau mir bitte einen Onlineshop mit Lagerverwaltung.');

    expect(result.understood).toBe(false);
    expect(result.changes).toEqual([]);
    expect(result.blueprint).toEqual(base());
  });

  it('verändert den Ausgangs-Blueprint nicht', () => {
    const start = base();
    const snapshot = JSON.stringify(start);
    refineBlueprint(start, 'Mach es hell, runder und füge ein Kontaktformular hinzu.');
    expect(JSON.stringify(start)).toBe(snapshot);
  });

  it('wendet mehrere Änderungen einer Anweisung gemeinsam an', () => {
    const result = refineBlueprint(base(), 'Mach es hell, die Ecken runder und nimm blau als Akzentfarbe.');
    expect(result.changes.map((c) => c.code).sort()).toEqual(['theme.accent', 'theme.mode', 'theme.radius']);
  });

  it('ist deterministisch — gleiche Anweisung, gleiches Ergebnis', () => {
    const a = refineBlueprint(base(), 'Füge ein Kontaktformular hinzu und mach es hell.');
    const b = refineBlueprint(base(), 'Füge ein Kontaktformular hinzu und mach es hell.');
    expect(JSON.stringify(a.blueprint)).toBe(JSON.stringify(b.blueprint));
  });
});

describe('Verfeinerte Blueprints bleiben auslieferbar', () => {
  function observationOf(html: string): SiteObservation {
    return {
      url: 'https://beispiel.de/',
      observedAt: '2026-07-29T10:00:00.000Z',
      statusCode: 200,
      headers: {
        'strict-transport-security': 'max-age=31536000',
        'content-security-policy': "default-src 'self'",
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
      },
      html,
      cookiesBeforeConsent: [],
      thirdPartyHosts: [],
      ttfbMs: 90,
      transferBytes: 40_000,
    };
  }

  it('erzeugt nach mehreren Verfeinerungen weiterhin keinen Befund', () => {
    let bp = base();
    for (const instruction of [
      'Mach es hell.',
      'Die Ecken runder.',
      'Füge ein Kontaktformular hinzu.',
      'Bitte eine Anfahrtskarte ergänzen.',
      'Füge eine Referenzseite hinzu.',
      'Mach den Hero größer.',
    ]) {
      bp = refineBlueprint(bp, instruction).blueprint;
    }

    for (const page of renderSite(bp, { baseUrl: 'https://beispiel.de', presentation: 'showcase' })) {
      const findings = analyzeObservation(observationOf(page.html), {
        expectsAiDisclosure: true,
        expectedLang: 'de',
      });
      expect({ path: page.path, findings: findings.map((f) => f.code) })
        .toEqual({ path: page.path, findings: [] });
    }
  });
});

describe('Prompt-Wünsche im Erstbau', () => {
  it('baut genannte Bausteine ein, auch wenn das Branchen-Preset sie nicht führt', async () => {
    const { blueprint } = await buildSiteFromPrompt(
      'Hochwertige Website für ein Architekturbüro in Leipzig. Dunkel und minimalistisch. Projekte, Teamseite, Kontaktformular und Terminbuchung.',
      { model: null },
    );

    const kinds = blueprint.pages.flatMap((page) => page.blocks.map((block) => block.kind));
    expect(kinds).toContain('booking');
    expect(kinds).toContain('contact-form');
    expect(blueprint.pages.map((page) => page.path)).toContain('/referenzen');
    // „Dunkel" im Prompt schlägt bis ins Theme durch.
    expect(blueprint.theme.mode).toBe('dark');
  });

  it('ergänzt nichts, was ausdrücklich ausgeschlossen wurde', () => {
    expect(deriveRequests('Website für eine Kanzlei, aber ohne Terminbuchung.')).not.toContain('Terminbuchung hinzufügen.');
  });

  it('verwechselt Zusammensetzungen nicht mit dem Begriff', () => {
    // „Speisekarte" darf keine Anfahrtskarte auslösen.
    expect(deriveRequests('Restaurant in Mainz mit Speisekarte und Mittagstisch.'))
      .not.toContain('Anfahrtskarte hinzufügen.');
    expect(deriveRequests('Praxis in Ulm, bitte mit Anfahrtskarte.')).toContain('Anfahrtskarte hinzufügen.');
  });

  it('bleibt deterministisch', async () => {
    const prompt = 'Zahnarztpraxis in Hamburg mit Online-Terminbuchung und Anfahrtskarte.';
    const a = await buildSiteFromPrompt(prompt, { model: null });
    const b = await buildSiteFromPrompt(prompt, { model: null });
    expect(a.blueprintSha256).toBe(b.blueprintSha256);
  });
});
