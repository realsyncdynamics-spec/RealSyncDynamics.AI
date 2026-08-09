import { describe, it, expect } from 'vitest';
import {
  analyzeObservation,
  buildSiteFromPrompt,
  escapeHtml,
  jsonLdPayload,
  parseBrief,
  renderPage,
  renderSite,
  safeUrl,
  synthesizeBlueprint,
  type SiteBlueprint,
  type SiteObservation,
} from '../../packages/siteos-core/src/index';

function blueprint(): SiteBlueprint {
  return synthesizeBlueprint(parseBrief('Erstelle eine Website für einen Zahnarzt in Hamburg.'), {
    model: 'claude-opus-4',
  });
}

describe('escapeHtml', () => {
  it('neutralisiert alle fünf kritischen Zeichen', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('entschärft einen Script-Tag', () => {
    expect(escapeHtml('<script>alert(1)</script>')).not.toContain('<script>');
  });

  it('behandelt null und undefined als leeren Text', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('safeUrl', () => {
  it('lässt http, https, mailto und tel durch', () => {
    expect(safeUrl('https://beispiel.de/')).toBe('https://beispiel.de/');
    expect(safeUrl('mailto:info@beispiel.de')).toBe('mailto:info@beispiel.de');
    expect(safeUrl('tel:+4940123456')).toBe('tel:+4940123456');
  });

  it('lässt relative Pfade und Anker durch', () => {
    expect(safeUrl('/kontakt')).toBe('/kontakt');
    expect(safeUrl('#inhalt')).toBe('#inhalt');
  });

  it('verwirft javascript: und data:', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeUrl('JaVaScRiPt:alert(1)')).toBeNull();
  });

  it('verwirft protokollrelative URLs — sie wechseln den Host', () => {
    expect(safeUrl('//evil.example/x')).toBeNull();
  });

  it('verwirft leere und nicht parsebare Werte', () => {
    expect(safeUrl('')).toBeNull();
    expect(safeUrl('   ')).toBeNull();
    expect(safeUrl('nicht mal annähernd eine url')).toBeNull();
  });
});

describe('jsonLdPayload', () => {
  it('verhindert den Ausbruch aus dem script-Block', () => {
    const payload = jsonLdPayload({ name: '</script><script>alert(1)</script>' });
    expect(payload).not.toContain('</script>');
    expect(payload).toContain('\\u003c');
  });

  it('bleibt gültiges JSON', () => {
    expect(JSON.parse(jsonLdPayload({ a: 1, b: 'x' }))).toEqual({ a: 1, b: 'x' });
  });
});

describe('renderPage', () => {
  it('liefert ein vollständiges Dokument mit Sprachauszeichnung', () => {
    const bp = blueprint();
    const html = renderPage(bp, bp.pages[0]);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="de">');
  });

  it('vergibt genau eine H1 je Seite', () => {
    const bp = blueprint();
    for (const page of bp.pages) {
      const html = renderPage(bp, page);
      expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
    }
  });

  it('liefert Titel, Beschreibung und Canonical', () => {
    const bp = blueprint();
    const html = renderPage(bp, bp.pages[0], { baseUrl: 'https://beispiel.de' });
    expect(html).toMatch(/<title>.+<\/title>/);
    expect(html).toMatch(/<meta name="description" content=".+">/);
    expect(html).toContain('<link rel="canonical" href="https://beispiel.de/">');
  });

  it('bindet Drittanbieter nicht vor der Einwilligung ein', () => {
    const bp = blueprint();
    const page = bp.pages.find((p) => p.blocks.some((b) => b.thirdPartyHosts.length > 0))!;
    const html = renderPage(bp, page);

    // Der Host darf als Datenattribut auftauchen — aber nie in einem
    // ladenden Attribut, sonst kontaktiert schon der Seitenaufruf den
    // Dritten. Das führende \s grenzt `src` von `data-consent-src` ab.
    expect(html).toContain('data-consent-required');
    expect(html).not.toMatch(/<iframe/i);
    expect(html).not.toMatch(/\s(src|href)\s*=\s*"[^"]*openstreetmap/i);
    expect(html).toContain('data-consent-src="tile.openstreetmap.org"');
  });

  it('zeichnet den KI-Hinweis maschinenlesbar aus', () => {
    const bp = blueprint();
    const html = renderPage(bp, bp.pages[0]);
    expect(html).toContain('data-ai-disclosure');
  });

  it('gibt jedem Eingabefeld ein verbundenes Label', () => {
    const bp = blueprint();
    const page = bp.pages.find((p) => p.blocks.some((b) => b.kind === 'contact-form'))!;
    const html = renderPage(bp, page);

    const inputIds = [...html.matchAll(/<input id="([^"]+)"/g)].map((m) => m[1]);
    expect(inputIds.length).toBeGreaterThan(0);
    for (const id of inputIds) {
      expect(html).toContain(`<label for="${id}">`);
    }
  });

  it('rendert keine leere Bewertungsliste', () => {
    const bp = blueprint();
    // Alle testimonials-Blöcke sind bei der Synthese leer (§ 5 UWG).
    const html = bp.pages.map((p) => renderPage(bp, p)).join('');
    expect(html).not.toContain('Stimmen');
  });

  it('escaped Inhalte aus dem Blueprint', () => {
    const bp = blueprint();
    // Beide Werte werden tatsächlich gerendert: die Marke in der Navigation,
    // die Headline im Hero.
    (bp.pages[0].blocks.find((b) => b.kind === 'navigation')!.content as Record<string, unknown>).brand =
      '<script>alert(1)</script>';
    (bp.pages[0].blocks.find((b) => b.kind === 'hero')!.content as Record<string, unknown>).headline =
      '<img src=x onerror=alert(1)>';

    const html = renderPage(bp, bp.pages[0]);

    // Entscheidend ist nicht, ob die Zeichenfolge `onerror=...` im Dokument
    // vorkommt — sie tut es, als Text. Entscheidend ist, dass daraus kein
    // Element wird: solange die spitzen Klammern escaped sind, steht dort
    // sichtbarer Text und kein Handler.
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toMatch(/<img\b/i);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('verwirft ein unsicheres Link-Ziel, statt es auszuliefern', () => {
    const bp = blueprint();
    const hero = bp.pages[0].blocks.find((b) => b.kind === 'hero')!;
    (hero.content as { primaryCta: { href: string } }).primaryCta.href = 'javascript:alert(1)';

    expect(renderPage(bp, bp.pages[0])).not.toContain('javascript:');
  });

  it('ist deterministisch', () => {
    const bp = blueprint();
    expect(renderPage(bp, bp.pages[0])).toBe(renderPage(bp, bp.pages[0]));
  });
});

describe('renderSite', () => {
  it('rendert jede Seite des Blueprints', () => {
    const bp = blueprint();
    const rendered = renderSite(bp);
    expect(rendered.map((r) => r.path)).toEqual(bp.pages.map((p) => p.path));
  });

  it('setzt strukturierte Daten nur auf der Startseite', () => {
    const bp = blueprint();
    const rendered = renderSite(bp, { baseUrl: 'https://beispiel.de' });
    const home = rendered.find((r) => r.path === '/')!;
    const other = rendered.find((r) => r.path !== '/')!;

    expect(home.html).toContain('application/ld+json');
    expect(home.html).toContain('"Dentist"');
    expect(other.html).not.toContain('application/ld+json');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Der Kreis schließt sich: gerendertes HTML durch die Live-Analyse.
// ─────────────────────────────────────────────────────────────────────

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

describe('Renderer-Output besteht die Live-Analyse', () => {
  it('erzeugt für die Startseite keinen einzigen Befund', async () => {
    const result = await buildSiteFromPrompt('Erstelle eine Website für einen Zahnarzt in Hamburg.', {
      model: 'claude-opus-4',
    });
    const home = renderSite(result.blueprint, { baseUrl: 'https://beispiel.de' })
      .find((r) => r.path === '/')!;

    const findings = analyzeObservation(observationOf(home.html), {
      expectsAiDisclosure: true,
      expectedLang: 'de',
    });

    // Diese Zusicherung ist der eigentliche Zweck des Renderers: was der
    // Blueprint verspricht, wird auch ausgeliefert.
    expect(findings).toEqual([]);
  });

  it('gilt für jede Seite der Site', async () => {
    const result = await buildSiteFromPrompt('Kanzlei für Arbeitsrecht in Köln', { model: 'm' });

    for (const page of renderSite(result.blueprint, { baseUrl: 'https://kanzlei.de' })) {
      const findings = analyzeObservation(observationOf(page.html), {
        expectsAiDisclosure: true,
        expectedLang: 'de',
      });
      expect({ path: page.path, findings: findings.map((f) => f.code) })
        .toEqual({ path: page.path, findings: [] });
    }
  });
});
