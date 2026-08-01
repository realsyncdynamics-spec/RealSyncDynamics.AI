import { describe, it, expect } from 'vitest';
import {
  analyzeBlueprint,
  analyzeObservation,
  parseBrief,
  synthesizeBlueprint,
  THRESHOLDS,
  type SiteBlueprint,
  type SiteObservation,
} from '../../packages/siteos-core/src/index';

function baseBlueprint(): SiteBlueprint {
  return synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'), { model: 'm' });
}

function codes(findings: { code: string }[]): string[] {
  return findings.map((f) => f.code);
}

describe('analyzeBlueprint', () => {
  it('meldet für einen sauber synthetisierten Blueprint keinen kritischen Befund', () => {
    const findings = analyzeBlueprint(baseBlueprint());
    expect(findings.filter((f) => f.severity === 'critical')).toEqual([]);
  });

  it('erkennt ein fehlendes Impressum als kritisch', () => {
    const bp = baseBlueprint();
    bp.pages = bp.pages.filter((p) => p.path !== '/impressum');
    const finding = analyzeBlueprint(bp).find((f) => f.code === 'gdpr.missing-impressum');
    expect(finding?.severity).toBe('critical');
    expect(finding?.reference).toBe('§ 5 DDG');
  });

  it('erkennt eine fehlende Datenschutzerklärung als kritisch', () => {
    const bp = baseBlueprint();
    bp.pages = bp.pages.filter((p) => p.path !== '/datenschutz');
    expect(codes(analyzeBlueprint(bp))).toContain('gdpr.missing-privacy-policy');
  });

  it('erkennt ein Formular ohne Rechtsgrundlage', () => {
    const bp = baseBlueprint();
    const page = bp.pages.find((p) => p.blocks.some((b) => b.kind === 'contact-form'))!;
    const form = page.blocks.find((b) => b.kind === 'contact-form')!;
    delete (form.content as Record<string, unknown>).legalBasis;

    const finding = analyzeBlueprint(bp).find((f) => f.code === 'gdpr.form-without-legal-basis');
    expect(finding?.severity).toBe('high');
    expect(finding?.locator).toBe(`${page.path}#${form.id}`);
  });

  it('erkennt eine Drittanbieter-Einbindung ohne Einwilligungsschranke', () => {
    const bp = baseBlueprint();
    const page = bp.pages.find((p) => p.blocks.some((b) => b.thirdPartyHosts.length > 0))!;
    const block = page.blocks.find((b) => b.thirdPartyHosts.length > 0)!;
    (block.content as Record<string, unknown>).requiresConsent = false;

    expect(codes(analyzeBlueprint(bp))).toContain('tdddg.third-party-without-consent-gate');
  });

  it('erkennt generierte Inhalte ohne Transparenzhinweis', () => {
    const bp = baseBlueprint();
    bp.pages = bp.pages.map((p) => ({ ...p, blocks: p.blocks.filter((b) => b.kind !== 'ai-disclosure') }));
    expect(codes(analyzeBlueprint(bp))).toContain('eu-ai-act.missing-disclosure');
  });

  it('führt die DSFA-Pflicht eines Heilberufs als Befund', () => {
    expect(codes(analyzeBlueprint(baseBlueprint()))).toContain('gdpr.dpia-required');
  });

  it('meldet doppelte Seitentitel', () => {
    const bp = baseBlueprint();
    bp.pages[1].title = bp.pages[0].title;
    expect(codes(analyzeBlueprint(bp))).toContain('seo.duplicate-title');
  });
});

// ─────────────────────────────────────────────────────────────────────

function observation(overrides: Partial<SiteObservation> = {}): SiteObservation {
  return {
    url: 'https://beispiel.de/',
    observedAt: '2026-07-28T10:00:00.000Z',
    statusCode: 200,
    headers: {
      'strict-transport-security': 'max-age=31536000',
      'content-security-policy': "default-src 'self'",
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    },
    html: `<html lang="de"><head><title>Beispiel</title>
      <meta name="description" content="Beschreibung">
      <link rel="canonical" href="https://beispiel.de/"></head>
      <body><h1>Beispiel</h1>
      <a href="/datenschutz">Datenschutz</a><a href="/impressum">Impressum</a>
      </body></html>`,
    cookiesBeforeConsent: [],
    thirdPartyHosts: [],
    ttfbMs: 120,
    transferBytes: 50_000,
    ...overrides,
  };
}

describe('analyzeObservation', () => {
  it('meldet für eine saubere Auslieferung nichts', () => {
    expect(analyzeObservation(observation())).toEqual([]);
  });

  it('meldet ein Cookie vor der Einwilligung als kritisch', () => {
    const findings = analyzeObservation(observation({
      cookiesBeforeConsent: [{ name: '_ga', host: 'beispiel.de' }],
    }));
    const finding = findings.find((f) => f.code === 'tdddg.cookie-before-consent');
    expect(finding?.severity).toBe('critical');
    expect(finding?.reference).toContain('TDDDG');
  });

  it('meldet unverschlüsselte Auslieferung als kritisch', () => {
    const findings = analyzeObservation(observation({ url: 'http://beispiel.de/' }));
    expect(findings.find((f) => f.code === 'security.insecure-transport')?.severity).toBe('critical');
  });

  it('meldet fehlende Sicherheits-Header einzeln', () => {
    const findings = analyzeObservation(observation({ headers: {} }));
    expect(codes(findings)).toEqual(expect.arrayContaining([
      'security.missing-hsts',
      'security.missing-csp',
      'security.missing-content-type-options',
      'security.missing-referrer-policy',
    ]));
  });

  it('meldet fehlende Pflichtverlinkungen', () => {
    const findings = analyzeObservation(observation({ html: '<html lang="de"><body></body></html>' }));
    expect(codes(findings)).toEqual(expect.arrayContaining([
      'gdpr.privacy-link-not-delivered',
      'gdpr.imprint-link-not-delivered',
    ]));
  });

  it('zählt Bilder ohne Alternativtext, ohne ausgezeichnete mitzuzählen', () => {
    const html = observation().html.replace('<h1>Beispiel</h1>',
      '<h1>Beispiel</h1><img src="a.jpg"><img src="b.jpg" alt="">');
    const finding = analyzeObservation(observation({ html })).find((f) => f.code === 'accessibility.image-without-alt');
    expect(finding?.title).toBe('1 von 2 Bildern ohne alt-Attribut');
  });

  it('meldet ein Formular ohne jede Beschriftung', () => {
    const html = observation().html.replace('<h1>Beispiel</h1>', '<form><input name="a"></form>');
    expect(codes(analyzeObservation(observation({ html })))).toContain('accessibility.form-without-labels');
  });

  it('akzeptiert aria-label als Beschriftung', () => {
    const html = observation().html.replace('<h1>Beispiel</h1>',
      '<h1>x</h1><form><input name="a" aria-label="Name"></form>');
    expect(codes(analyzeObservation(observation({ html })))).not.toContain('accessibility.form-without-labels');
  });

  it('staffelt die Serverantwortzeit nach Schwellwert', () => {
    const elevated = analyzeObservation(observation({ ttfbMs: THRESHOLDS.ttfbGoodMs + 1 }));
    expect(codes(elevated)).toContain('performance.elevated-ttfb');

    const slow = analyzeObservation(observation({ ttfbMs: THRESHOLDS.ttfbPoorMs + 1 }));
    expect(slow.find((f) => f.code === 'performance.slow-ttfb')?.severity).toBe('high');
  });

  it('verlangt den KI-Hinweis nur, wenn er erwartet wird', () => {
    expect(codes(analyzeObservation(observation(), {}))).not.toContain('eu-ai-act.disclosure-not-delivered');
    expect(codes(analyzeObservation(observation(), { expectsAiDisclosure: true })))
      .toContain('eu-ai-act.disclosure-not-delivered');
  });

  it('erkennt einen ausgelieferten KI-Hinweis über die Auszeichnung', () => {
    const html = observation().html.replace('<h1>Beispiel</h1>', '<p data-ai-disclosure>Hinweis</p>');
    expect(codes(analyzeObservation(observation({ html }), { expectsAiDisclosure: true })))
      .not.toContain('eu-ai-act.disclosure-not-delivered');
  });

  it('meldet eine abweichende Sprachauszeichnung', () => {
    const html = observation().html.replace('lang="de"', 'lang="en"');
    expect(codes(analyzeObservation(observation({ html }), { expectedLang: 'de' })))
      .toContain('accessibility.lang-mismatch');
  });
});
