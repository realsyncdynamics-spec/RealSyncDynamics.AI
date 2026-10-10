// Rebuild-Workflow — REBUILD: Design-System, Texte, Richtungen, Auslieferung.
//
// Festgehalten wird:
//   • Die Markenfarbe bleibt im Farbton, erreicht aber immer WCAG AA.
//   • Kein Text behauptet, was die Ausgangsseite nicht sagt (§ 5 UWG).
//   • Leere Abschnitte werden weggelassen und benannt, nicht aufgefüllt.
//   • Jede Richtung ist ein normaler Blueprint: Herkunft `import`,
//     deterministischer Hash, gerendert ohne Befund der Live-Analyse.
//   • Blueprints ohne Design-System rendern unverändert (Hash-Stabilität).

import { describe, expect, it } from 'vitest';
import {
  analyzeBlueprint,
  analyzeObservation,
  applySiteDesignTemplate,
  buildDirection,
  canonicalHash,
  contrastRatio,
  deriveDesignSpec,
  findUnbackedClaims,
  parseBrief,
  readBrandSignals,
  renderSite,
  sourceCorpus,
  synthesizeBlueprint,
} from '../../packages/siteos-core/src/index';
import { AT, allText, rebuildCase } from './rebuild-helpers';

// Sicherheits-Header der statischen Auslieferung; die Datei dazu
// (`deploy/site-files.ts`) folgt mit dem PUBLISH-Schnitt. Hier zählt nur,
// dass die gerenderten Seiten bei gesetzten Headern ohne Befund bleiben.
const STATIC_SITE_CSP = "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'none'; form-action 'self' https: mailto:; frame-ancestors 'self'; base-uri 'self'; object-src 'none'";

describe('REBUILD — Design-System aus der Marke', () => {
  it('übernimmt die Markenfarbe und hält AA auf der Fläche', async () => {
    const { snapshot } = await rebuildCase('handwerk');
    const brand = readBrandSignals(snapshot);
    expect(brand.brandColor).toBe('#c8102e');
    for (const key of ['clean-enterprise', 'conversion-focus', 'local-trust', 'premium-advisory'] as const) {
      const design = deriveDesignSpec(brand, key);
      expect(contrastRatio(design.palette.accent, design.palette.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(design.palette.accentText, design.palette.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(design.palette.foreground, design.palette.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(design.palette.muted, design.palette.surfaceAlt)).toBeGreaterThanOrEqual(4.5);
      expect(design.brand?.color).toBe('#c8102e');
      expect(design.notes.length).toBeGreaterThan(0);
    }
  });

  it('folgt Hell/Dunkel der Quelle nur, wo die Richtung es trägt', async () => {
    const { snapshot } = await rebuildCase('saas');
    const brand = readBrandSignals(snapshot);
    expect(brand.darkSource).toBe(true);
    expect(deriveDesignSpec(brand, 'clean-enterprise').mode).toBe('dark');
    expect(deriveDesignSpec(brand, 'conversion-focus').mode).toBe('light');
    expect(deriveDesignSpec(brand, 'local-trust').mode).toBe('light');
  });

  it('lädt keine Schrift von Google: Markenschrift im Stack, Systemschrift als Ersatz', async () => {
    const { builds } = await rebuildCase('handwerk');
    const pages = renderSite(builds[0].blueprint, { presentation: 'showcase' });
    for (const page of pages) {
      expect(page.html).not.toContain('fonts.googleapis.com');
      expect(page.html).not.toContain('fonts.gstatic.com');
    }
    expect(builds[0].blueprint.design?.typography.body).toMatch(/^"Open Sans", /);
  });
});

describe('REBUILD — keine unbelegten Behauptungen', () => {
  it('erkennt Zahlen und Behauptungswörter, die die Quelle nicht nennt', () => {
    expect(findUnbackedClaims('Seit 1998 Ihr Meisterbetrieb', 'Heizung und Sanitär in Leipzig')).toEqual(expect.arrayContaining(['1998', 'meisterbetrieb']));
    expect(findUnbackedClaims('Seit 1998 Ihr Meisterbetrieb', 'Meisterbetrieb seit 1998')).toEqual([]);
    expect(findUnbackedClaims('Die besten Preise, garantiert', 'Wir beraten Sie gern')).toEqual(expect.arrayContaining(['besten', 'garantiert']));
  });

  it('keine Richtung sagt etwas, das die Ausgangsseite nicht sagt', async () => {
    for (const name of ['handwerk', 'steuer', 'saas'] as const) {
      const { snapshot, builds } = await rebuildCase(name);
      const corpus = sourceCorpus(snapshot);
      for (const build of builds) {
        const text = allText(build.blueprint.pages.flatMap((p) => p.blocks.filter((b) => b.kind !== 'legal-text' && b.kind !== 'ai-disclosure' && b.kind !== 'contact-form').map((b) => b.content)));
        // Feste Wendungen der Plattform (Formular, Karte) sind keine Aussagen über das Unternehmen.
        expect(findUnbackedClaims(text, corpus), `${name}/${build.plan.key}`).toEqual([]);
      }
    }
  });
});

describe('REBUILD — Richtungen', () => {
  it('bietet zwei bis drei Richtungen an, die zur Site passen', async () => {
    expect((await rebuildCase('handwerk')).builds.map((b) => b.plan.key)).toEqual(['clean-enterprise', 'conversion-focus', 'local-trust']);
    expect((await rebuildCase('saas')).builds.map((b) => b.plan.key)).toEqual(['clean-enterprise', 'conversion-focus', 'premium-advisory']);
    for (const name of ['handwerk', 'steuer', 'saas'] as const) {
      for (const build of (await rebuildCase(name)).builds) {
        expect(build.plan.rationale.length).toBeGreaterThan(0);
        expect(build.blueprint.origin.source).toBe('import');
        expect(build.blueprint.origin.model).toBeNull();
        // Regelbasiert, nicht generiert: keine KI-Kennzeichnung nötig — und keine behauptet.
        expect(build.blueprint.pages.flatMap((p) => p.blocks).some((b) => b.aiGenerated)).toBe(false);
      }
    }
  });

  it('lässt leere Abschnitte weg und nennt den Grund', async () => {
    const { builds } = await rebuildCase('saas');
    const premium = builds.find((b) => b.plan.key === 'premium-advisory');
    expect(premium?.report.omitted.find((o) => o.kind === 'case-study')?.reason).toMatch(/Referenz/);
    const kinds = premium?.blueprint.pages[0].blocks.map((b) => b.kind) ?? [];
    expect(kinds).not.toContain('case-study');
  });

  it('übernimmt das Formularziel der Quelle nicht, sondern schlägt es vor', async () => {
    const { builds } = await rebuildCase('handwerk');
    const form = builds[0].blueprint.pages[0].blocks.find((b) => b.kind === 'contact-form');
    expect(form?.content.target).toBe('');
    expect(builds[0].report.formTargetHint?.backend).toBe('cms-plugin');
    expect(form?.content.legalBasis).toBeDefined();
  });

  it('ist deterministisch — Grundlage der serverseitigen Neuableitung beim Auswählen', async () => {
    const { snapshot, positioning, assessment, builds } = await rebuildCase('steuer');
    const again = buildDirection(snapshot, positioning, assessment, 'clean-enterprise', { createdAt: AT });
    expect(await canonicalHash(again.blueprint)).toBe(await canonicalHash(builds[0].blueprint));
  });

  it('verbindet Aufzählungen ohne doppeltes „und"', async () => {
    const { builds } = await rebuildCase('steuer');
    const local = builds.find((b) => b.plan.key === 'local-trust');
    const headline = String(local?.blueprint.pages[0].blocks.find((b) => b.kind === 'hero')?.content.headline);
    expect(headline).toBe('Finanz- und Lohnbuchhaltung sowie Jahresabschluss aus München');
  });
});

describe('REBUILD — Auslieferung', () => {
  it('rendert jede Richtung ohne Befund der Live-Analyse (mit den Export-Headern)', async () => {
    for (const name of ['handwerk', 'steuer', 'saas'] as const) {
      for (const build of (await rebuildCase(name)).builds) {
        for (const page of renderSite(build.blueprint, { baseUrl: 'https://neu.example', presentation: 'showcase' })) {
          const findings = analyzeObservation({
            url: `https://neu.example${page.path}`, observedAt: AT, statusCode: 200,
            headers: {
              'content-type': 'text/html; charset=utf-8', 'strict-transport-security': 'max-age=63072000',
              'content-security-policy': STATIC_SITE_CSP, 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin',
            },
            html: page.html, cookiesBeforeConsent: [], thirdPartyHosts: [], ttfbMs: 80, transferBytes: page.html.length,
          });
          expect(findings.map((f) => f.code), `${name}/${build.plan.key}${page.path}`).toEqual([]);
          expect((page.html.match(/<h1[\s>]/g) ?? []).length, `${name}/${build.plan.key}${page.path}`).toBe(1);
        }
      }
    }
  });

  it('sperrt die Veröffentlichung, bis Formularziel und Rechtstexte gesetzt sind', async () => {
    const { builds } = await rebuildCase('handwerk');
    const codes = analyzeBlueprint(builds[0].blueprint).map((f) => `${f.code}/${f.severity}`);
    expect(codes).toContain('content.form-target-missing/critical');
    expect(codes).toContain('gdpr.legal-text-empty/critical');
  });

  it('ändert nichts an Blueprints ohne Design-System', async () => {
    const legacy = synthesizeBlueprint(parseBrief('Zahnarztpraxis in Hamburg', 'de'), { source: 'ai-builder', model: null, createdAt: AT });
    expect(legacy.design).toBeUndefined();
    const findings = analyzeBlueprint(legacy).map((f) => f.code);
    expect(findings).not.toContain('content.form-target-missing');
    expect(findings).not.toContain('gdpr.legal-text-empty');
    const pages = renderSite(legacy);
    expect(pages[0].html).not.toContain('rs-hero');
    // Ohne eingesetzten Wortlaut bleibt die Markierung — byte-gleich wie bisher.
    expect(pages.find((p) => p.path === '/impressum')?.html).toContain('<!-- legal:content -->');
  });

  it('lässt Vorlagen ein Design-System nicht überschreiben', async () => {
    const { builds } = await rebuildCase('handwerk');
    expect(applySiteDesignTemplate(builds[0].blueprint, 'dark-professional')).toBe(builds[0].blueprint);
  });
});
