// Rebuild-Workflow — REFINE: Klartext-Überarbeitungen.
//
// Die zehn Anweisungen aus dem Auftrag sind benannte Regeln mit festem
// Umfang. Festgehalten wird:
//   • Jede wird aus dem Wortlaut erkannt.
//   • Jede ist idempotent — zweimal angewandt ändert nichts mehr.
//   • Keine erfindet Inhalte (Zahlen, Siegel, Versprechen).
//   • Ein Branchenwechsel senkt das Compliance-Profil nie.
//   • Ausgeblendetes bleibt ausgeblendet; ein fehlender Ort wird nicht geraten.
//   • Freitext erreicht die allgemeine Verfeinerung — und deren Farbwahl
//     kommt im Design-System an, AA-geprüft.

import { describe, expect, it } from 'vitest';
import {
  REVISION_INTENTS,
  contrastRatio,
  findUnbackedClaims,
  matchIntents,
  reviseBlueprint,
  sourceCorpus,
  type RevisionIntentKey,
  type SiteBlueprint,
} from '../../packages/siteos-core/src/index';
import { calm } from '../../packages/siteos-core/src/rebuild/intents';
import { allText, rebuildCase } from './rebuild-helpers';

const PHRASES: [string, RevisionIntentKey][] = [
  ['seriöser', 'serioeser'],
  ['mehr Vertrauen', 'mehr-vertrauen'],
  ['weniger Startup, mehr Mittelstand', 'mittelstand'],
  ['mehr lokal', 'mehr-lokal'],
  ['CTA stärker', 'cta-staerker'],
  ['Hero kürzer', 'hero-kuerzer'],
  ['mehr wie Premium-Beratung', 'premium-beratung'],
  ['für Handwerker', 'fuer-handwerker'],
  ['für Steuerberater', 'fuer-steuerberater'],
  ['für KI-Governance', 'fuer-ki-governance'],
];

describe('REFINE — Erkennung', () => {
  it.each(PHRASES)('„%s" → %s', (phrase, key) => {
    expect(matchIntents(phrase)).toEqual([key]);
  });

  it('erkennt mehrere Regeln in fester Reihenfolge', () => {
    expect(matchIntents('Bitte seriöser, aber die CTA stärker und den Hero kürzer')).toEqual(['serioeser', 'cta-staerker', 'hero-kuerzer']);
  });

  it('führt jede Regel mit Wirkungsbeschreibung', () => {
    expect(REVISION_INTENTS).toHaveLength(10);
    for (const intent of REVISION_INTENTS) expect(intent.effect.length).toBeGreaterThan(20);
  });
});

describe('REFINE — Wirkung', () => {
  it('jede Regel ist idempotent und erfindet nichts', async () => {
    for (const name of ['handwerk', 'steuer', 'saas'] as const) {
      const { snapshot, builds } = await rebuildCase(name);
      const corpus = sourceCorpus(snapshot);
      for (const build of builds) {
        const before = allText(build.blueprint.pages.map((p) => p.blocks.map((b) => b.content)));
        for (const intent of REVISION_INTENTS) {
          const once = reviseBlueprint(build.blueprint, { intents: [intent.key] });
          const twice = reviseBlueprint(once.blueprint, { intents: [intent.key] });
          expect(twice.changes.map((c) => c.code), `${name}/${build.plan.key}/${intent.key}`).toEqual([]);
          expect(once.blueprint.slug).toBe(build.blueprint.slug);
          const after = allText(once.blueprint.pages.map((p) => p.blocks.filter((b) => b.kind !== 'legal-text').map((b) => b.content)));
          expect(findUnbackedClaims(after, `${corpus}\n${before}`), `${name}/${build.plan.key}/${intent.key}`).toEqual([]);
        }
      }
    }
  });

  it('„CTA stärker" betont, ergänzt ein Band und setzt die Aktion in den Kopf', async () => {
    const { builds } = await rebuildCase('handwerk');
    const base = builds[0].blueprint;
    const result = reviseBlueprint(base, { intents: ['cta-staerker'] });
    expect(result.blueprint.design?.ctaEmphasis).toBe('strong');
    expect(result.blueprint.pages[0].blocks.some((b) => b.kind === 'cta')).toBe(true);
    expect(result.changes.map((c) => c.code)).toEqual(expect.arrayContaining(['intent.cta.design', 'intent.cta.band']));
  });

  it('„Hero kürzer" kürzt auf einen Satz und schneidet Nachsätze ab', async () => {
    const { builds } = await rebuildCase('saas');
    const result = reviseBlueprint(builds[0].blueprint, { intents: ['hero-kuerzer'] });
    const hero = result.blueprint.pages[0].blocks.find((b) => b.kind === 'hero');
    expect(hero?.content.headline).toBe('Mach deine KI-Nutzung prüfbar');
    expect(hero?.content.emphasis).toBe('compact');
    expect(String(hero?.content.subline).length).toBeLessThanOrEqual(121);
  });

  it('„mehr lokal" setzt den belegten Ort — und rät keinen, wo keiner belegt ist', async () => {
    const handwerk = reviseBlueprint((await rebuildCase('handwerk')).builds[0].blueprint, { intents: ['mehr-lokal'] });
    const hero = handwerk.blueprint.pages[0].blocks.find((b) => b.kind === 'hero');
    expect(hero?.content.eyebrow).toBe('Müller Haustechnik · Leipzig');
    expect(handwerk.blueprint.pages[0].blocks.some((b) => b.kind === 'map')).toBe(true);
    expect(handwerk.blueprint.compliance.consentCategories).toContain('karten');

    const saas = reviseBlueprint((await rebuildCase('saas')).builds[0].blueprint, { intents: ['mehr-lokal'] });
    expect(saas.blueprint.seo.locality).toBeNull();
    expect(saas.notes.join(' ')).toMatch(/Kein Ort belegt/);
  });

  it('„mehr Vertrauen" zeigt nichts, was ausgeblendet wurde', async () => {
    const { builds } = await rebuildCase('handwerk');
    const base = builds[0].blueprint;
    const hidden: SiteBlueprint = {
      ...base,
      pages: base.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.kind === 'testimonials' ? { ...b, content: { ...b.content, hidden: true } } : b)) })),
    };
    const result = reviseBlueprint(hidden, { intents: ['mehr-vertrauen'] });
    const testimonials = result.blueprint.pages[0].blocks.find((b) => b.kind === 'testimonials');
    expect(testimonials?.content.hidden).toBe(true);
    expect(result.notes.join(' ')).toMatch(/ausgeblendet/);
  });

  it('„mehr wie Premium-Beratung" wechselt die Richtung aus denselben Markensignalen', async () => {
    const { builds } = await rebuildCase('handwerk');
    const result = reviseBlueprint(builds[0].blueprint, { intents: ['premium-beratung'] });
    expect(result.blueprint.design?.direction).toBe('premium-advisory');
    expect(result.blueprint.design?.brand?.color).toBe('#c8102e');
    expect(result.blueprint.theme.accent).toBe(result.blueprint.design?.palette.accent);
    const hero = result.blueprint.pages[0].blocks.find((b) => b.kind === 'hero');
    expect(hero?.content.variant).toBe('editorial');
  });
});

describe('REFINE — Zielgruppe mit Compliance-Untergrenze', () => {
  it('„für Handwerker" senkt das Profil einer Praxis nicht', async () => {
    const { builds } = await rebuildCase('handwerk');
    const base = builds[0].blueprint;
    const praxis: SiteBlueprint = {
      ...base,
      industry: 'zahnarzt',
      compliance: {
        ...base.compliance,
        specialCategories: true,
        dpiaRequired: true,
        policyPackIds: ['dsgvo-core', 'dsgvo-health', 'eu-ai-act-transparency'],
        controlRefs: ['GDPR-ART-9', 'GDPR-ART-32', 'GDPR-ART-35'],
        legalBases: [...base.compliance.legalBases, 'Art. 9 Abs. 2 lit. h DSGVO'],
      },
    };
    const result = reviseBlueprint(praxis, { intents: ['fuer-handwerker'] });
    expect(result.blueprint.industry).toBe('handwerk');
    expect(result.blueprint.compliance.specialCategories).toBe(true);
    expect(result.blueprint.compliance.dpiaRequired).toBe(true);
    expect(result.blueprint.compliance.policyPackIds).toEqual(expect.arrayContaining(['dsgvo-health']));
    expect(result.blueprint.compliance.controlRefs).toEqual(expect.arrayContaining(['GDPR-ART-35']));
    expect(result.changes.find((c) => c.code === 'intent.handwerker.industry')?.complianceNote).toMatch(/mindestens so streng/);
  });

  it('„für Steuerberater" benennt das Angebot und ordnet Ablauf und Fragen vor das Gespräch', async () => {
    const { builds } = await rebuildCase('handwerk');
    const result = reviseBlueprint(builds[0].blueprint, { intents: ['fuer-steuerberater'] });
    expect(result.blueprint.industry).toBe('steuerberatung');
    const services = result.blueprint.pages[0].blocks.find((b) => b.kind === 'services');
    expect(services?.content.heading).toBe('Beratungsfelder');
    const form = result.blueprint.pages[0].blocks.find((b) => b.kind === 'contact-form');
    expect(form?.content.heading).toBe('Gespräch vereinbaren');
  });

  it('„für KI-Governance" ändert die Branche nicht und rückt die Transparenz nach vorn', async () => {
    const { builds } = await rebuildCase('steuer');
    const result = reviseBlueprint(builds[0].blueprint, { intents: ['fuer-ki-governance'] });
    expect(result.blueprint.industry).toBe('steuerberatung');
    const kinds = result.blueprint.pages[0].blocks.map((b) => b.kind);
    expect(kinds.indexOf('governance')).toBe(kinds.indexOf('services') + 1);
    expect(result.notes.join(' ')).toMatch(/Positionierung/);
  });
});

describe('REFINE — Freitext und Grenzen', () => {
  it('überträgt eine Farbwahl ins Design-System — AA-geprüft', async () => {
    const { builds } = await rebuildCase('handwerk');
    const result = reviseBlueprint(builds[0].blueprint, { instruction: 'Akzentfarbe #22c55e' });
    expect(result.usedGeneralRefine).toBe(true);
    const design = result.blueprint.design;
    expect(design?.palette.accent).not.toBe('#c8102e');
    expect(result.blueprint.theme.accent).toBe(design?.palette.accent);
    expect(contrastRatio(design?.palette.accent ?? '', design?.palette.surface ?? '')).toBeGreaterThanOrEqual(4.5);
  });

  it('meldet einen nicht einlösbaren Moduswechsel, statt ihn zu behaupten', async () => {
    const { builds } = await rebuildCase('handwerk');
    const conversion = builds.find((b) => b.plan.key === 'conversion-focus');
    const result = reviseBlueprint(conversion!.blueprint, { instruction: 'dunkel' });
    expect(result.blueprint.design?.mode).toBe('light');
    expect(result.changes.some((c) => c.code === 'theme.mode')).toBe(false);
    expect(result.notes.join(' ')).toMatch(/hell angelegt/);
  });

  it('behält den Slug, auch wenn die Website umbenannt wird', async () => {
    const { builds } = await rebuildCase('handwerk');
    const result = reviseBlueprint(builds[0].blueprint, { instruction: 'Nenne die Website „Müller Bad & Heizung"' });
    expect(result.blueprint.name).toBe('Müller Bad & Heizung');
    expect(result.blueprint.slug).toBe(builds[0].blueprint.slug);
  });

  it('sagt ehrlich, wenn nichts verstanden wurde', async () => {
    const { builds } = await rebuildCase('handwerk');
    const result = reviseBlueprint(builds[0].blueprint, { instruction: 'Mach irgendwas Schönes' });
    expect(result.understood).toBe(false);
    expect(result.changes).toEqual([]);
  });

  it('nimmt Ausrufezeichen heraus, ohne Sätze zu verstümmeln', () => {
    expect(calm('Jetzt anrufen!')).toBe('Jetzt anrufen');
    expect(calm('Wir sind für Sie da! Rufen Sie an!')).toBe('Wir sind für Sie da. Rufen Sie an.');
    expect(calm('Ohne Zeichen')).toBe('Ohne Zeichen');
  });
});
