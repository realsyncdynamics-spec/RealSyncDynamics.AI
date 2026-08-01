import { describe, it, expect } from 'vitest';
import {
  buildSiteFromPrompt,
  canonicalHash,
  detectIndustry,
  detectLocality,
  mergeBrief,
  parseBrief,
  synthesizeBlueprint,
} from '../../packages/siteos-core/src/index';

describe('detectIndustry', () => {
  it('erkennt die Branche aus dem Beispiel-Prompt', () => {
    expect(detectIndustry('Erstelle eine Website für einen Zahnarzt in Hamburg.')).toEqual({
      industry: 'zahnarzt', confident: true,
    });
  });

  it('erkennt weitere Branchen über ihre Begriffe', () => {
    expect(detectIndustry('Kanzlei für Arbeitsrecht').industry).toBe('rechtsanwalt');
    expect(detectIndustry('Wir sind ein Dachdecker-Betrieb').industry).toBe('handwerk');
    expect(detectIndustry('Ein Restaurant mit Mittagstisch').industry).toBe('gastronomie');
  });

  it('fällt ohne Treffer auf sonstiges zurück und meldet das offen', () => {
    expect(detectIndustry('Etwas völlig anderes')).toEqual({ industry: 'sonstiges', confident: false });
  });

  it('ist unabhängig von der Groß- und Kleinschreibung', () => {
    expect(detectIndustry('ZAHNARZT').industry).toBe('zahnarzt');
  });
});

describe('detectLocality', () => {
  it('zieht den Ort aus der in-Wendung', () => {
    expect(detectLocality('Website für einen Zahnarzt in Hamburg.')).toBe('Hamburg');
  });

  it('erkennt zweiteilige Ortsnamen', () => {
    expect(detectLocality('Eine Kanzlei in Frankfurt Main')).toBe('Frankfurt Main');
  });

  it('schneidet Satzzeichen ab', () => {
    expect(detectLocality('Praxis in Köln!')).toBe('Köln');
  });

  it('liefert null, wenn kein Ort erkennbar ist', () => {
    expect(detectLocality('Eine Website für eine Praxis')).toBeNull();
  });
});

describe('parseBrief', () => {
  it('baut aus dem Beispiel-Prompt einen vollständigen Brief', () => {
    const brief = parseBrief('Erstelle eine Website für einen Zahnarzt in Hamburg.');
    expect(brief.industry).toBe('zahnarzt');
    expect(brief.locality).toBe('Hamburg');
    expect(brief.name).toBe('Zahnarztpraxis Hamburg');
    expect(brief.services.length).toBeGreaterThan(0);
    expect(brief.locale).toBe('de');
  });

  it('liefert auch bei leerem Prompt einen gültigen Brief', () => {
    const brief = parseBrief('');
    expect(brief.industry).toBe('sonstiges');
    expect(brief.industryConfident).toBe(false);
    expect(brief.name).not.toBe('');
  });
});

describe('mergeBrief', () => {
  const base = parseBrief('Zahnarzt in Hamburg');

  it('übernimmt Copy-Vorschläge des Modells', () => {
    const merged = mergeBrief(base, { name: 'Praxis Dr. Meier', summary: 'Kurz.' });
    expect(merged.name).toBe('Praxis Dr. Meier');
    expect(merged.summary).toBe('Kurz.');
  });

  it('lässt die Branche unangetastet — auch bei abweichendem Vorschlag', () => {
    // Das Modell darf eine Zahnarztpraxis nicht aus der Art.-9-Behandlung
    // herausdefinieren; `industry` ist in BriefEnrichment gar nicht vorgesehen.
    const merged = mergeBrief(base, { name: 'X' } as never);
    expect(merged.industry).toBe('zahnarzt');
  });

  it('unterscheidet „kein Ort" (null) von „keine Aussage" (undefined)', () => {
    expect(mergeBrief(base, { locality: null }).locality).toBeNull();
    expect(mergeBrief(base, {}).locality).toBe('Hamburg');
  });

  it('verwirft leere Leistungslisten statt die Basis zu überschreiben', () => {
    expect(mergeBrief(base, { services: [] }).services).toEqual(base.services);
    expect(mergeBrief(base, { services: ['  '] }).services).toEqual(base.services);
  });
});

describe('synthesizeBlueprint', () => {
  const brief = parseBrief('Erstelle eine Website für einen Zahnarzt in Hamburg.');

  it('erzeugt die gesetzlichen Pflichtseiten', () => {
    const bp = synthesizeBlueprint(brief);
    const paths = bp.pages.map((p) => p.path);
    expect(paths).toContain('/impressum');
    expect(paths).toContain('/datenschutz');
    expect(paths).toContain('/barrierefreiheit');
  });

  it('erzeugt die im Beispiel geforderten Bausteine', () => {
    const bp = synthesizeBlueprint(brief);
    const kinds = new Set(bp.pages.flatMap((p) => p.blocks.map((b) => b.kind)));
    for (const kind of ['navigation', 'hero', 'features', 'faq', 'contact-form', 'cta', 'footer'] as const) {
      expect(kinds.has(kind)).toBe(true);
    }
  });

  it('setzt auf jeder Seite mit generierten Inhalten einen Transparenzhinweis', () => {
    const bp = synthesizeBlueprint(brief, { source: 'ai-builder' });
    for (const page of bp.pages) {
      if (page.blocks.some((b) => b.aiGenerated)) {
        expect(page.blocks.some((b) => b.kind === 'ai-disclosure')).toBe(true);
      }
    }
  });

  it('leitet das Compliance-Profil eines Heilberufs ab', () => {
    const bp = synthesizeBlueprint(brief);
    expect(bp.compliance.specialCategories).toBe(true);
    expect(bp.compliance.dpiaRequired).toBe(true);
    expect(bp.compliance.legalBases).toContain('Art. 9 Abs. 2 lit. h DSGVO');
  });

  it('legt jedes Formular mit Rechtsgrundlage und Datenschutz-Link an', () => {
    const bp = synthesizeBlueprint(brief);
    const forms = bp.pages.flatMap((p) => p.blocks).filter((b) => b.kind === 'contact-form' || b.kind === 'booking');
    expect(forms.length).toBeGreaterThan(0);
    for (const form of forms) {
      expect(form.content.legalBasis).toBeTruthy();
      expect(form.content.privacyHref).toBe('/datenschutz');
      expect(form.processesPersonalData).toBe(true);
    }
  });

  it('stellt Drittanbieter-Einbindungen hinter eine Einwilligungsschranke', () => {
    const bp = synthesizeBlueprint(brief);
    for (const block of bp.pages.flatMap((p) => p.blocks)) {
      if (block.thirdPartyHosts.length > 0) expect(block.content.requiresConsent).toBe(true);
    }
  });

  it('erzeugt einen URL-tauglichen Slug', () => {
    expect(synthesizeBlueprint(parseBrief('Zahnarzt in München')).slug).toBe('zahnarztpraxis-muenchen');
  });

  it('ist deterministisch — gleicher Brief ergibt denselben Hash', async () => {
    const a = synthesizeBlueprint(brief);
    const b = synthesizeBlueprint(brief);
    expect(await canonicalHash(a)).toBe(await canonicalHash(b));
  });
});

describe('buildSiteFromPrompt', () => {
  it('erzeugt für das Beispiel eine Site ohne kritische Befunde', async () => {
    const result = await buildSiteFromPrompt('Erstelle eine Website für einen Zahnarzt in Hamburg.', {
      model: 'claude-opus-4', createdAt: '2026-07-28T10:00:00.000Z',
    });

    expect(result.blueprint.industry).toBe('zahnarzt');
    expect(result.blueprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.findings.filter((f) => f.severity === 'critical')).toEqual([]);
  });

  it('meldet ein fehlendes Modell als Transparenzlücke', async () => {
    const result = await buildSiteFromPrompt('Zahnarzt in Hamburg', { model: null });
    expect(result.findings.map((f) => f.code)).toContain('eu-ai-act.undocumented-model');
  });

  it('hält den Prompt nur als Hash fest, nicht im Klartext', async () => {
    const result = await buildSiteFromPrompt('Zahnarzt in Hamburg', { model: 'm' });
    expect(result.blueprint.origin.promptSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(result.blueprint)).not.toContain('Zahnarzt in Hamburg');
  });

  it('ist bei gleichem Zeitstempel reproduzierbar', async () => {
    const args = { model: 'm', createdAt: '2026-07-28T10:00:00.000Z' } as const;
    const a = await buildSiteFromPrompt('Kanzlei in Köln', args);
    const b = await buildSiteFromPrompt('Kanzlei in Köln', args);
    expect(a.blueprintSha256).toBe(b.blueprintSha256);
  });

  it('reiht für jeden Befund einen zuständigen Agenten ein', async () => {
    const result = await buildSiteFromPrompt('Zahnarzt in Hamburg', { model: null });
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.tasks.map((t) => t.agent)).toContain('compliance');
  });
});
