/**
 * Zusatz-Detektoren des öffentlichen Scans.
 *
 * Leitlinie dieser Tests: **Falschmeldungen sind teurer als Lücken.** Der
 * Bericht ist der Erstkontakt mit einem Interessenten; ein erfundener
 * Befund kostet Glaubwürdigkeit, ein übersehener nur eine Zeile. Deshalb
 * steht zu jedem Positivfall auch der Negativfall.
 */
import { describe, expect, it } from 'vitest';
import type { SiteObservation } from '../../packages/siteos-core/src/index';
import {
  collectSignals,
  detectAdditionalFindings,
} from '../../supabase/functions/_shared/public-scan/detectors';

function beobachtung(html: string, overrides: Partial<SiteObservation> = {}): SiteObservation {
  return {
    url: 'https://firma.de',
    observedAt: '2026-08-23T10:00:00.000Z',
    statusCode: 200,
    headers: {},
    html,
    cookiesBeforeConsent: [],
    thirdPartyHosts: [],
    ttfbMs: 120,
    transferBytes: 50_000,
    ...overrides,
  };
}

function codes(html: string): string[] {
  const obs = beobachtung(html);
  return detectAdditionalFindings(obs, collectSignals(obs)).map((f) => f.code);
}

// Eine unauffällige Seite als Ausgangspunkt: Viewport, strukturierte
// Daten, Datenschutz-Link, saubere Überschriften.
const SAUBER = `<!doctype html><html lang="de"><head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="application/ld+json">{"@type":"Organization"}</script>
</head><body><h1>Titel</h1><h2>Abschnitt</h2>
  <a href="/datenschutz">Datenschutz</a></body></html>`;

describe('Grundlinie', () => {
  it('meldet auf einer unauffälligen Seite nur den KI-Zustandshinweis', () => {
    const gefunden = codes(SAUBER);
    expect(gefunden).toEqual(['eu-ai-act.no-ai-signal-detected']);
  });

  it('stuft diesen Zustandshinweis als info ein — er ist kein Mangel', () => {
    const obs = beobachtung(SAUBER);
    const hinweis = detectAdditionalFindings(obs, collectSignals(obs))[0];
    expect(hinweis.severity).toBe('info');
    expect(hinweis.title).toMatch(/kein KI-System erkennbar/i);
  });
});

describe('EU AI Act — Erkennung vor Beurteilung', () => {
  it('erkennt einen eingebundenen KI-Dienst ohne Transparenzhinweis', () => {
    const html = SAUBER.replace('</body>', '<script>fetch("https://api.openai.com/v1/chat")</script></body>');
    const obs = beobachtung(html);
    const signale = collectSignals(obs);

    expect(signale.aiTools).toContain('OpenAI');
    expect(codes(html)).toContain('eu-ai-act.ai-service-without-disclosure');
  });

  it('meldet nichts, wenn der Transparenzhinweis vorhanden ist', () => {
    const html = SAUBER
      .replace('</body>', '<script src="https://api.anthropic.com/x"></script><p>Dieser Chat ist KI-gestützt.</p></body>');
    const gefunden = codes(html);

    expect(gefunden).not.toContain('eu-ai-act.ai-service-without-disclosure');
    expect(gefunden).not.toContain('eu-ai-act.no-ai-signal-detected');
  });

  it('erkennt ein Chat-Widget und stuft es milder ein als einen KI-Dienst', () => {
    const html = SAUBER.replace('</body>', '<script src="https://widget.intercom.io/w.js"></script></body>');
    const obs = beobachtung(html);
    const befunde = detectAdditionalFindings(obs, collectSignals(obs));
    const chat = befunde.find((f) => f.code === 'eu-ai-act.chat-widget-without-disclosure');

    expect(chat).toBeDefined();
    // Ein Chat-Widget kann auch rein menschlich bedient sein — dann greift
    // Art. 50 nicht. Deshalb `medium`, nicht `high`.
    expect(chat!.severity).toBe('medium');
    expect(chat!.remediation).toMatch(/menschlich/i);
  });

  it('hält einen Blogtext über KI nicht für einen eingesetzten KI-Dienst', () => {
    // Der häufigste denkbare Fehlalarm: eine Agentur, die über künstliche
    // Intelligenz schreibt, setzt deshalb noch keine ein.
    const html = SAUBER.replace('</body>', '<article>Wir beraten zu künstlicher Intelligenz im Mittelstand.</article></body>');
    const obs = beobachtung(html);
    const signale = collectSignals(obs);

    expect(signale.aiTools).toEqual([]);
    expect(signale.chatWidgets).toEqual([]);
    expect(codes(html)).toContain('eu-ai-act.no-ai-signal-detected');
  });
});

describe('DSGVO — fremd geladene Schriften', () => {
  it('erkennt Google Fonts und stuft sie als schwer ein', () => {
    const html = SAUBER.replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet"></head>');
    const obs = beobachtung(html);
    const befund = detectAdditionalFindings(obs, collectSignals(obs))
      .find((f) => f.code === 'gdpr.external-font-host');

    expect(befund).toBeDefined();
    expect(befund!.severity).toBe('high');
    expect(befund!.reference).toMatch(/LG München/);
  });

  it('erkennt andere Schrift-Dienste, stuft sie aber milder ein', () => {
    const html = SAUBER.replace('</head>', '<link href="https://use.typekit.net/abc.css" rel="stylesheet"></head>');
    const obs = beobachtung(html);
    const befund = detectAdditionalFindings(obs, collectSignals(obs))
      .find((f) => f.code === 'gdpr.external-font-host');

    expect(befund!.severity).toBe('medium');
    expect(befund!.reference).not.toMatch(/LG München/);
  });

  it('meldet lokal ausgelieferte Schriften nicht', () => {
    const html = SAUBER.replace('</head>', '<link href="/assets/inter.woff2" rel="preload" as="font"></head>');
    expect(codes(html)).not.toContain('gdpr.external-font-host');
  });

  it('listet jeden Fremd-Host nur einmal, auch bei mehreren Einbindungen', () => {
    const html = SAUBER.replace(
      '</head>',
      '<link href="https://fonts.googleapis.com/css2?family=A" rel="stylesheet">' +
      '<link href="https://fonts.googleapis.com/css2?family=B" rel="stylesheet"></head>',
    );
    expect(collectSignals(beobachtung(html)).externalFontHosts).toEqual(['fonts.googleapis.com']);
  });
});

describe('TDDDG — Einwilligung vor Analyse-Werkzeugen', () => {
  it('meldet ein Analyse-Werkzeug ohne Einwilligungs-Werkzeug', () => {
    const html = SAUBER.replace('</head>', '<script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script></head>');
    const obs = beobachtung(html);
    const befund = detectAdditionalFindings(obs, collectSignals(obs))
      .find((f) => f.code === 'tdddg.tracking-without-consent-manager');

    expect(befund).toBeDefined();
    expect(befund!.reference).toMatch(/§ 25/);
  });

  it('meldet nichts, wenn ein Einwilligungs-Werkzeug erkennbar ist', () => {
    const html = SAUBER.replace(
      '</head>',
      '<script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>' +
      '<script id="Cookiebot" src="https://consent.cookiebot.com/uc.js"></script></head>',
    );
    expect(codes(html)).not.toContain('tdddg.tracking-without-consent-manager');
  });

  it('meldet nichts, wenn gar kein Analyse-Werkzeug vorhanden ist', () => {
    expect(codes(SAUBER)).not.toContain('tdddg.tracking-without-consent-manager');
  });
});

describe('DSGVO — Formulare', () => {
  it('meldet ein Formular ohne Datenschutz-Hinweis auf derselben Seite', () => {
    const html = SAUBER.replace('<a href="/datenschutz">Datenschutz</a>', '<form><input name="mail"></form>');
    expect(codes(html)).toContain('gdpr.form-without-privacy-reference');
  });

  it('meldet nichts, wenn der Datenschutz-Link auf der Seite steht', () => {
    const html = SAUBER.replace('</body>', '<form><input name="mail"></form></body>');
    expect(codes(html)).not.toContain('gdpr.form-without-privacy-reference');
  });

  it('hält ein einzelnes Suchfeld nicht für eine Datenerhebung', () => {
    const html = SAUBER
      .replace('<a href="/datenschutz">Datenschutz</a>', '<form role="search"><input name="q"></form>');
    expect(codes(html)).not.toContain('gdpr.form-without-privacy-reference');
  });
});

describe('Darstellung und Struktur', () => {
  it('meldet eine fehlende Viewport-Angabe als schweren Befund', () => {
    const html = SAUBER.replace(/<meta name="viewport"[^>]*>/, '');
    const obs = beobachtung(html);
    const befund = detectAdditionalFindings(obs, collectSignals(obs))
      .find((f) => f.code === 'content.missing-viewport');

    expect(befund).toBeDefined();
    expect(befund!.severity).toBe('high');
  });

  it('meldet einen Sprung in der Überschriftenebene', () => {
    const html = SAUBER.replace('<h2>Abschnitt</h2>', '<h3>Abschnitt</h3>');
    expect(codes(html)).toContain('accessibility.heading-level-skip');
  });

  it('meldet eine lückenlose Gliederung nicht', () => {
    const html = SAUBER.replace('<h2>Abschnitt</h2>', '<h2>A</h2><h3>B</h3><h2>C</h2>');
    expect(codes(html)).not.toContain('accessibility.heading-level-skip');
  });

  it('meldet den Sprung nur einmal, nicht je Vorkommen', () => {
    const html = SAUBER.replace('<h2>Abschnitt</h2>', '<h3>A</h3><h1>B</h1><h4>C</h4>');
    expect(codes(html).filter((c) => c === 'accessibility.heading-level-skip')).toHaveLength(1);
  });
});

describe('Auffindbarkeit', () => {
  it('meldet fehlende strukturierte Daten', () => {
    const html = SAUBER.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '');
    expect(codes(html)).toContain('seo.missing-structured-data');
  });

  it('meldet ein noindex auf der Startseite als kritisch', () => {
    const html = SAUBER.replace('</head>', '<meta name="robots" content="noindex, nofollow"></head>');
    const obs = beobachtung(html);
    const befund = detectAdditionalFindings(obs, collectSignals(obs))
      .find((f) => f.code === 'seo.noindex-delivered');

    // Fast immer ein Versehen aus einer Testumgebung — und es nimmt die
    // Seite vollständig aus der Suche.
    expect(befund!.severity).toBe('critical');
  });

  it('meldet ein reines index,follow nicht', () => {
    const html = SAUBER.replace('</head>', '<meta name="robots" content="index, follow"></head>');
    expect(codes(html)).not.toContain('seo.noindex-delivered');
  });
});

describe('Technologie-Erkennung', () => {
  it('erkennt WordPress an ausgelieferten Pfaden', () => {
    const html = SAUBER.replace('</body>', '<link href="/wp-content/themes/x/style.css"></body>');
    expect(collectSignals(beobachtung(html)).technologies).toContain('WordPress');
  });

  it('erkennt mehrere Technologien nebeneinander', () => {
    const html = SAUBER.replace(
      '</body>',
      '<div id="__NEXT_DATA__"></div><script src="https://www.googletagmanager.com/gtm.js"></script></body>',
    );
    const erkannt = collectSignals(beobachtung(html)).technologies;
    expect(erkannt).toContain('Next.js');
    expect(erkannt).toContain('Google Tag Manager');
  });

  it('erfindet auf einer schlichten Seite keine Technologie', () => {
    expect(collectSignals(beobachtung(SAUBER)).technologies).toEqual([]);
  });
});

describe('Wiederholbarkeit', () => {
  it('liefert bei zweimaligem Aufruf dasselbe Ergebnis', () => {
    // Die Muster tragen teils das globale Flag. Ohne Sorgfalt behält ein
    // solcher Ausdruck `lastIndex` und liefert beim zweiten Lauf etwas
    // anderes — ein Fehler, der in Produktion nur sporadisch auffiele.
    const html = SAUBER.replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Inter"></head>');
    const obs = beobachtung(html);
    expect(collectSignals(obs)).toEqual(collectSignals(obs));
    expect(detectAdditionalFindings(obs, collectSignals(obs)))
      .toEqual(detectAdditionalFindings(obs, collectSignals(obs)));
  });
});

describe('Feindseliges HTML', () => {
  // Der Scanner liest bis zu 1,5 MB von einer **fremden** Seite, und der
  // Endpunkt ist ohne Anmeldung erreichbar. Ein unbegrenzter Quantor vor
  // einem Literal ist damit keine Stilfrage, sondern eine
  // Denial-of-Service-Lücke: Vor der Begrenzung kosteten 96 kB aus
  // Wiederholungen von '<meta ' bereits 1,3 s, mit quadratischem Wachstum.
  //
  // Die Grenze unten ist bewusst grosszügig — sie soll eine Rückkehr des
  // quadratischen Verhaltens anzeigen, nicht die Laufzeit feinmessen.
  const GRENZE_MS = 2000;

  it.each([
    ['<meta ', 'Meta-Tag-Anfänge'],
    ['<form ', 'Formular-Anfänge'],
    ['<script ', 'Skript-Anfänge'],
    ['name="generator" ', 'Generator-Angaben'],
  ])('verarbeitet 1,5 MB aus %s in vertretbarer Zeit (%s)', (baustein) => {
    const html = baustein.repeat(Math.ceil(1_500_000 / baustein.length));
    const obs = beobachtung(html);

    const start = Date.now();
    const signale = collectSignals(obs);
    detectAdditionalFindings(obs, signale);
    const dauer = Date.now() - start;

    expect(dauer).toBeLessThan(GRENZE_MS);
  });

  it('erkennt ein echtes Attribut weiterhin, trotz Begrenzung', () => {
    // Die Begrenzung darf die Erkennung nicht aushebeln: Ein gewöhnliches
    // Tag mit Zusatzattributen davor muss weiter gefunden werden.
    const html = SAUBER.replace(
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta data-x="1" class="a b c" name="viewport" content="width=device-width">',
    );
    expect(collectSignals(beobachtung(html)).hasViewportMeta).toBe(true);
    expect(codes(html)).not.toContain('content.missing-viewport');
  });
});

describe('Erkennung nur in Adressposition', () => {
  // CodeQL hat hier auf eine echte Ungenauigkeit gezeigt: Ein blosses
  // Host-Muster trifft die Zeichenfolge überall im Dokument. Für einen
  // Bericht, der dem Kunden sagt „wir haben X erkannt", ist das eine
  // Falschmeldung.
  it('hält einen Hostnamen im Fliesstext nicht für eingebundene Technik', () => {
    const html = SAUBER.replace(
      '</body>',
      '<p>Wir verzichten bewusst auf static.hotjar.com und auf ' +
      'www.googletagmanager.com/gtag/js — aus Datenschutzgründen.</p></body>',
    );
    expect(collectSignals(beobachtung(html)).technologies).toEqual([]);
  });

  it('erkennt denselben Host in einer echten Adresse', () => {
    const html = SAUBER.replace('</body>', '<script src="https://static.hotjar.com/c/hotjar.js"></script></body>');
    expect(collectSignals(beobachtung(html)).technologies).toContain('Hotjar');
  });

  it('erkennt einen Host auch mit Subdomain davor', () => {
    const html = SAUBER.replace('</head>', '<script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script></head>');
    expect(collectSignals(beobachtung(html)).technologies).toContain('Google Analytics');
  });

  it('hält eine erwähnte KI-Adresse im Text nicht für einen eingebundenen Dienst', () => {
    const html = SAUBER.replace('</body>', '<p>Unser Anbieter nutzt api.openai.com.</p></body>');
    expect(collectSignals(beobachtung(html)).aiTools).toEqual([]);
  });
});

describe('Google-Fonts-Zuordnung ist exakt', () => {
  it('zitiert das Urteil nicht für einen Host, der nur so endet', () => {
    // `endsWith('googleapis.com')` hätte hier zugeschlagen und dem Kunden
    // ein Gerichtsurteil zugeordnet, das den Sachverhalt nicht trifft.
    const obs = beobachtung(SAUBER);
    const signale = {
      ...collectSignals(obs),
      externalFontHosts: ['boesegoogleapis.com'],
    };
    const befund = detectAdditionalFindings(obs, signale)
      .find((f) => f.code === 'gdpr.external-font-host');

    expect(befund).toBeDefined();
    expect(befund!.severity).toBe('medium');
    expect(befund!.reference).not.toMatch(/LG München/);
  });

  it('zitiert es für den echten Host', () => {
    const obs = beobachtung(SAUBER);
    const signale = { ...collectSignals(obs), externalFontHosts: ['fonts.googleapis.com'] };
    const befund = detectAdditionalFindings(obs, signale)
      .find((f) => f.code === 'gdpr.external-font-host');

    expect(befund!.severity).toBe('high');
    expect(befund!.reference).toMatch(/LG München/);
  });
});

describe('Host-Vergleich statt Host-Muster', () => {
  it('erkennt einen Dienst an einer echten Subdomain', () => {
    const html = SAUBER.replace('</head>', '<script src="https://cdn.static.hotjar.com/x.js"></script></head>');
    expect(collectSignals(beobachtung(html)).technologies).toContain('Hotjar');
  });

  it('lässt sich von einem ähnlich benannten Host nicht täuschen', () => {
    // `static.hotjar.com.angreifer.example` endet nicht auf `.static.hotjar.com`
    // und ist ein völlig anderer Host. Ein Muster hätte hier zugeschlagen.
    const html = SAUBER.replace(
      '</head>',
      '<script src="https://static.hotjar.com.angreifer.example/x.js"></script></head>',
    );
    expect(collectSignals(beobachtung(html)).technologies).toEqual([]);
  });

  it('verlangt den Pfad, wo der Dienst nur daran erkennbar ist', () => {
    // googletagmanager.com liefert sowohl gtag/js als auch gtm.js — der
    // Host allein sagt nicht, welches der beiden eingebunden ist.
    const nurGtm = SAUBER.replace('</head>', '<script src="https://www.googletagmanager.com/gtm.js"></script></head>');
    const erkannt = collectSignals(beobachtung(nurGtm)).technologies;

    expect(erkannt).toContain('Google Tag Manager');
    expect(erkannt).not.toContain('Google Analytics');
  });

  it('erkennt eine schema-relative Adresse', () => {
    const html = SAUBER.replace('</head>', '<script src="//widget.intercom.io/w.js"></script></head>');
    expect(collectSignals(beobachtung(html)).chatWidgets).toContain('Intercom');
  });

  it('zählt einen Schrift-Host nur bei echter Zugehörigkeit', () => {
    const echt = SAUBER.replace('</head>', '<link href="https://fonts.googleapis.com/css2"></head>');
    const gefaelscht = SAUBER.replace('</head>', '<link href="https://fonts.googleapis.com.evil.example/css2"></head>');

    expect(collectSignals(beobachtung(echt)).externalFontHosts).toEqual(['fonts.googleapis.com']);
    expect(collectSignals(beobachtung(gefaelscht)).externalFontHosts).toEqual([]);
  });
});
