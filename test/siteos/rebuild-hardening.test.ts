// Rebuild-Workflow — Härtung nach dem unabhängigen Review (2026-09-29).
//
// Schnitte 2 und 2b aus #1727 (DISCOVER/ASSESS, REBUILD/REFINE/AUTOMATE).
// Festgehalten wird, was ein Review mit synthetischen Seiten gezeigt hatte:
//   • keine erfundenen Aussagen aus Fehllesungen der Quelle (Jahresangabe aus
//     „Kunden über 60 Jahre", unsichtbare JSON-LD-Bewertung als sichtbare Behauptung);
//   • feindliche Seiten verbrauchen keine quadratische Rechenzeit;
//   • gespeichert wird nur, was Postgres annimmt (keine halben Emoji);
//   • Adressen ohne Link-Charakter und gesperrte Adressbereiche werden erkannt;
//   • kein Ort aus Wendungen, kein Seitentitel „Startseite" als Überschrift;
//   • Bindung an den Analyse-Lauf, Hero-Variante nur aus der festen Menge.
// Die Fälle zu Backend-Vergleich, Checkliste, rechtswirksamen Feldern und
// Export folgen mit dem PUBLISH-Schnitt.

import { describe, expect, it } from 'vitest';
import {
  buildDirection,
  buildSnapshot,
  canonicalHash,
  composeHero,
  composeSeo,
  derivePositioning,
  extractPage,
  isBlockedAddress,
  localityFromText,
  planNextSteps,
  renderSite,
  sealSnapshot,
  toWellFormed,
  wellFormedText,
  type SiteBlueprint,
  type SnapshotInput,
} from '../../packages/siteos-core/src/index';
import { decodeEntities } from '../../packages/siteos-core/src/rebuild/html';
import { isScriptOrDataUrl, splitTitle, stripLegalSuffix } from '../../packages/siteos-core/src/rebuild/text';
import { AT, rebuildCase } from './rebuild-helpers';

const PAGE = 'https://www.dach-beispiel.example/';

function page(body: string, head = '<title>Dach Beispiel GmbH</title>'): string {
  return `<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width">${head}</head><body>${body}</body></html>`;
}

function snapshotInput(html: string, extra: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    sourceUrl: PAGE, resolvedUrl: PAGE, fetchedAt: AT,
    pages: [{ url: PAGE, html, statusCode: 200, fetchedAt: AT, documentSha256: 'a'.repeat(64) }],
    robots: { found: false, sitemaps: [], disallowAll: false, url: `${PAGE}robots.txt` },
    sitemap: { found: false, url: null, urlCount: 0 },
    crawl: { planned: [], fetched: [PAGE], skipped: [] },
    ...extra,
  };
}

const FILLER = '<p>Wir planen, decken und sanieren Dächer für private und gewerbliche Kunden. Jede Baustelle bekommt einen festen Ansprechpartner, einen schriftlichen Ablaufplan und eine saubere Übergabe mit Dokumentation.</p>';

describe('Jahresangaben nur über das Unternehmen', () => {
  const years = (body: string) => extractPage({ url: PAGE, html: page(body), statusCode: 200, fetchedAt: AT }, 0).page.trust.filter((t) => t.kind === 'years').map((t) => t.value);

  it('„Kunden über 60 Jahre" ist keine Firmengeschichte', () => {
    expect(years('<p>Wir beraten besonders gern Kunden über 60 Jahre, die ihr Dach altersgerecht umbauen möchten und dafür einen verlässlichen Partner suchen.</p>')).toEqual([]);
  });

  it('„Seit 2018 gilt die DSGVO" ist keine Firmengeschichte', () => {
    expect(years('<p>Seit 2018 gilt die Datenschutz-Grundverordnung für alle Unternehmen in der Europäischen Union, auch für kleine Betriebe.</p>')).toEqual([]);
  });

  it('Garantie ist keine Erfahrung', () => {
    expect(years('<p>Auf alle Dacharbeiten erhalten Sie eine Garantie über 10 Jahre, schriftlich und ohne Kleingedrucktes für jedes Projekt.</p>')).toEqual([]);
  });

  it('„Seit 1998 Ihr Meisterbetrieb" und ein Siegel „Über 25 Jahre Erfahrung" zählen', () => {
    expect(years('<p>Seit 1998 sind wir Ihr Meisterbetrieb für Dach und Fassade im ganzen Landkreis und darüber hinaus.</p>')).toEqual(['Seit 1998']);
    expect(years('<ul><li>Über 25 Jahre Erfahrung</li></ul>')).toEqual(['Über 25 Jahre Erfahrung']);
  });
});

describe('Bewertungen nur, wenn die Quelle sie zeigt', () => {
  const jsonLd = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"RoofingContractor","name":"Dach Beispiel GmbH","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.9","reviewCount":"123"}}</script>';
  const rating = (body: string) => extractPage({ url: PAGE, html: page(body, `<title>Dach Beispiel</title>${jsonLd}`), statusCode: 200, fetchedAt: AT }, 0).page.trust.filter((t) => t.kind === 'rating');

  it('eine nur in JSON-LD stehende Bewertung wird nicht übernommen', () => {
    expect(rating(FILLER)).toEqual([]);
  });

  it('eine sichtbare Bewertung wird übernommen — mit Plattform, wo belegt', () => {
    const visible = rating(`${FILLER}<p><strong>4,9</strong> von 5 Sternen bei 123 Bewertungen</p><iframe src="https://widget.provenexpert.com/x"></iframe>`);
    expect(visible).toHaveLength(1);
    expect(visible[0].value).toBe('4,9 von 5 (123 Bewertungen)');
    expect(visible[0].detail).toBe('ProvenExpert');
  });
});

describe('Speicherbar (Postgres json/jsonb)', () => {
  it('entfernt einzelne Surrogate und NUL, lässt ganze Emoji stehen', () => {
    expect(wellFormedText('Dach 🏠')).toBe('Dach 🏠');
    expect(wellFormedText('Dach \uD83C')).toBe('Dach ');
    expect(wellFormedText('\uDFE0x')).toBe('x');
    expect(wellFormedText('a\u0000b')).toBe('ab');
    const clean = { a: ['x', { b: 'y' }] };
    expect(toWellFormed(clean)).toBe(clean);
  });

  it('ein vom Auszug halbiertes Emoji landet nicht im Snapshot', async () => {
    const long = `${'Wir decken Dächer. '.repeat(15)}${'🏠'.repeat(200)}`;
    const snapshot = await sealSnapshot(buildSnapshot(snapshotInput(page(`<h1>Dach Beispiel</h1><p>${long}</p>`))));
    const text = JSON.stringify(snapshot);
    expect(/\\ud[89ab][0-9a-f]{2}(?!\\ud[c-f])/i.test(text)).toBe(false);
    expect(/(?<!\\ud[89ab][0-9a-f]{2})\\ud[c-f][0-9a-f]{2}/i.test(text)).toBe(false);
  });
});

describe('Rechenzeit bei feindlichen Seiten', () => {
  const within = (ms: number, fn: () => void) => {
    const started = performance.now();
    fn();
    return performance.now() - started < ms;
  };

  it('Entitäten: 200 000 „&" ohne Semikolon', () => {
    const input = '&a'.repeat(200_000);
    let out = '';
    expect(within(1500, () => { out = decodeEntities(input); })).toBe(true);
    expect(out).toBe(input);
    expect(decodeEntities('A &amp; B &#x2764; &unbekannt; &')).toBe('A & B ❤ &unbekannt; &');
  });

  // Größen nahe der Knotengrenze des Parsers (80 000): Die frühere Fassung
  // brauchte dafür je Fall viele Sekunden (quadratisch), die jetzige
  // Bruchteile davon.
  const extract = (html: string, stylesheets?: { url: string; css: string }[]) =>
    extractPage({ url: PAGE, html, statusCode: 200, fetchedAt: AT, stylesheets }, 0);

  it('Definitionslisten mit Zehntausenden Einträgen', () => {
    const html = page(`<dl>${'<dt>Frage?</dt>'.repeat(35_000)}<dd>Antwort mit genug Text</dd></dl>`);
    expect(within(3000, () => { extract(html); })).toBe(true);
  });

  it('Zehntausende Fragen-Überschriften im selben Container', () => {
    const html = page(`<div>${'<h3>Wie lange dauert das?</h3>'.repeat(35_000)}</div>`);
    expect(within(3000, () => { extract(html); })).toBe(true);
  });

  it('Zehntausende gleiche Vertrauens-Listenpunkte erzeugen keine Belegflut', () => {
    const html = page(`<ul>${'<li>Meisterbetrieb</li>'.repeat(35_000)}</ul>`);
    let result: ReturnType<typeof extract> | null = null;
    expect(within(3000, () => { result = extract(html); })).toBe(true);
    expect(result!.page.trust.length).toBeLessThanOrEqual(24);
    expect(result!.evidence.length).toBeLessThan(200);
  });

  it('Zehntausende gleiche Frage-Antwort-Paare im selben Container', () => {
    const html = page(`<div>${'<h3>Wie lange dauert das?</h3><p>Etwa zwei Wochen ab Auftrag.</p>'.repeat(17_500)}</div>`);
    let result: ReturnType<typeof extract> | null = null;
    expect(within(3000, () => { result = extract(html); })).toBe(true);
    expect(result!.evidence.length).toBeLessThan(200);
  });

  it('Zehntausende „Kunden"-Überschriften über einem Logo-Abschnitt', () => {
    const html = page(`<section>${'<h3>Unsere Kunden</h3>'.repeat(35_000)}<img src="/a.png"><img src="/b.png"><img src="/c.png"></section>`);
    expect(within(3000, () => { extract(html); })).toBe(true);
  });

  it('CSS: tief verschachtelte @media-Blöcke und ein riesiger Selektor', () => {
    const nested = `${'@media x{'.repeat(40_000)}${'.a{color:#123456}'.repeat(12_000)}${'}'.repeat(40_000)}`;
    const selector = `${'.x '.repeat(100_000)}{${'color:#abcdef;'.repeat(20_000)}}`;
    expect(within(3000, () => {
      extract(page(FILLER), [{ url: `${PAGE}a.css`, css: nested.slice(0, 600_000) }, { url: `${PAGE}b.css`, css: selector.slice(0, 600_000) }]);
    })).toBe(true);
  });
});

describe('Fehlerhaftes JSON-LD', () => {
  it('überspringt FAQ-Einträge, die kein Objekt sind, statt die Seite abzubrechen', () => {
    const ld = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: [null, 'Text', { '@type': 'Question', name: 'Wie lange dauert eine Dachsanierung?', acceptedAnswer: null },
        { '@type': 'Question', name: 'Wie lange dauert eine Dachsanierung?', acceptedAnswer: { '@type': 'Answer', text: 'In der Regel zwei bis drei Wochen ab Auftrag.' } }],
    });
    const html = page(FILLER, `<title>Dach Beispiel GmbH</title><script type="application/ld+json">${ld}</script>`);
    const { page: extracted } = extractPage({ url: PAGE, html, statusCode: 200, fetchedAt: AT }, 0);
    expect(extracted.faqs.map((f) => f.question)).toEqual(['Wie lange dauert eine Dachsanierung?']);
  });
});

describe('Adressen, die kein Link und kein Formularziel sind', () => {
  it('javascript:, vbscript: und data: werden erkannt', () => {
    for (const value of ['javascript:alert(1)', ' JavaScript:void(0)', 'vbscript:msgbox', 'data:text/html;base64,PHNjcmlwdD4=']) {
      expect(isScriptOrDataUrl(value)).toBe(true);
    }
    expect(isScriptOrDataUrl('https://beispiel.example/')).toBe(false);
  });

  it('ein Formular mit data:-Ziel hat kein Ziel, ein data:-Link ist kein Link', () => {
    const extracted = extractPage({ url: PAGE, html: page(`${FILLER}<form action="data:text/html,x"><input name="email" type="email"><button>Senden</button></form><a class="btn" href="data:text/html,x">Jetzt anfragen</a>`), statusCode: 200, fetchedAt: AT }, 0).page;
    expect(extracted.forms[0]?.action ?? null).toBeNull();
    expect(extracted.ctas.every((c) => c.href === null || !c.href.startsWith('data:'))).toBe(true);
  });

  it('Google Fonts nur vom Host fonts.googleapis.com — nicht aus einer Adresse, die ihn nur enthält', () => {
    const fonts = (href: string) => extractPage({ url: PAGE, html: page(FILLER, `<title>Dach</title><link rel="stylesheet" href="${href}">`), statusCode: 200, fetchedAt: AT }, 0).page.fonts.map((f) => f.family);
    expect(fonts('https://fonts.googleapis.com/css2?family=Inter:wght@400;700')).toContain('Inter');
    expect(fonts('https://evil.example/?u=fonts.googleapis.com/css2&family=Evil')).not.toContain('Evil');
  });
});

describe('Gesperrte Adressbereiche', () => {
  it.each([
    ['::7f00:1', true],
    ['::ffff:127.0.0.1', true],
    ['::ffff:93.184.216.34', false],
    ['2002:7f00:1::', true],
    ['2002:c0a8:101::1', true],
    ['2002:5db8:d822::1', false],
    ['2001:0:4136:e378::1', true],
    ['2001::1', true],
    ['2001:4860:4860::8888', false],
    ['100::1', true],
    ['fd12:3456::1', true],
    ['fe80::1', true],
  ])('%s → gesperrt: %s', (address, blocked) => {
    expect(isBlockedAddress(address)).toBe(blocked);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Neubau (Schnitt 2b): keine erfundenen Aussagen, Bindung, Ausgabe
// ─────────────────────────────────────────────────────────────────────

describe('Ort nur, wo einer steht', () => {
  it.each([
    ['Ihr Partner in Sachen Dachsanierung', null],
    ['Dachdecker in Leipzig', 'Leipzig'],
    ['Ihr Partner in Sachen Heizung in Leipzig und Umgebung', 'Leipzig'],
    ['Heizungsbau in Bad Homburg', 'Bad Homburg'],
    ['Handwerk in St. Ingbert', 'St. Ingbert'],
    ['Qualität in Handwerksqualität', null],
    ['Schnelle Hilfe in Ihrer Nähe', null],
    ['Beratung in Deutsch und Englisch', null],
    ['In Leipzig seit 1998.', 'Leipzig'],
    ['Fertig in Rekordzeit', null],
  ])('„%s" → %s', (text, expected) => {
    expect(localityFromText(text)).toBe(expected);
  });

  it('eine Wendung wie „in Sachen …" wird nicht zum Ort der Site', async () => {
    const html = page(`<h1>Ihr Partner in Sachen Dachsanierung</h1>${FILLER}`, '<title>Ihr Partner in Sachen Dachsanierung</title>');
    const snapshot = await sealSnapshot(buildSnapshot(snapshotInput(html)));
    const positioning = derivePositioning(snapshot);
    expect(positioning.locality.status).toBe('unknown');
    const hero = composeHero(snapshot, positioning, 'local-trust', []);
    expect(hero.eyebrow ?? '').not.toContain('Sachen');
    expect(hero.headline).not.toMatch(/(aus|in) Sachen Dachsanierung (aus|in) /);
    // Kein Ort in JSON-LD, Seitentitel oder Überschrift der gebauten Site.
    const build = buildDirection(snapshot, positioning, { engineVersion: 'x', assessedAt: AT, criteria: [], findings: [], overall: 0 }, 'local-trust', { createdAt: AT });
    expect(build.blueprint.seo.locality).toBeNull();
    expect(build.blueprint.seo.defaultTitle).not.toMatch(/(in|aus) Sachen Dachsanierung (in|aus) /);
  });
});

describe('Seitentitel ohne Aussage wird keine Überschrift', () => {
  it('„Startseite – Müller Bau" ergibt weder H1 noch Seitentitel „Startseite"', async () => {
    const html = page(`<header><a href="/"><img src="/logo.png" alt="Müller Bau Logo"></a></header><main>${FILLER}</main>`, '<title>Startseite – Müller Bau</title>');
    const snapshot = await sealSnapshot(buildSnapshot(snapshotInput(html)));
    const positioning = derivePositioning(snapshot);
    const hero = composeHero(snapshot, positioning, 'clean-enterprise', []);
    const seo = composeSeo(snapshot, positioning);
    expect(hero.headline).not.toMatch(/^Startseite/);
    expect(seo.title).not.toMatch(/^Startseite in/);
  });
});

describe('Bindung an den Analyse-Lauf', () => {
  it('steht im Blueprint und damit in seinem Hash', async () => {
    const { snapshot, positioning, assessment } = await rebuildCase('handwerk');
    const run = { id: '11111111-2222-4333-8444-555555555555', snapshotSha256: await canonicalHash(snapshot) };
    const unbound = buildDirection(snapshot, positioning, assessment, 'local-trust', { createdAt: AT });
    const bound = buildDirection(snapshot, positioning, assessment, 'local-trust', { createdAt: AT, run });
    const again = buildDirection(snapshot, positioning, assessment, 'local-trust', { createdAt: AT, run });
    expect(unbound.blueprint.origin.rebuild).toBeUndefined();
    expect(bound.blueprint.origin.rebuild).toEqual({ runId: run.id, snapshotSha256: run.snapshotSha256 });
    expect(await canonicalHash(bound.blueprint)).not.toBe(await canonicalHash(unbound.blueprint));
    expect(await canonicalHash(bound.blueprint)).toBe(await canonicalHash(again.blueprint));
    // Ausgeliefert wird die Bindung nicht — sie ist Nachweis, kein Inhalt.
    expect(renderSite(bound.blueprint, { presentation: 'showcase' }).map((p) => p.html).join('')).not.toContain(run.id);
  });
});

describe('Nächste Schritte', () => {
  it('„OpenAI (neu)" ist keine lokale KI, „Ollama (lokal)" schon', async () => {
    const { snapshot, builds } = await rebuildCase('steuer');
    const local = (name: string) => planNextSteps({ blueprint: builds[0].blueprint, snapshot, connectors: [{ systemType: 'ai_gateway', status: 'connected', displayName: name }] }).find((s) => s.key === 'local-ai')?.connection;
    expect(local('OpenAI (neu)')).toBe('not-connected');
    expect(local('Deutsch-Übersetzer')).toBe('not-connected');
    expect(local('Ollama (lokal)')).toBe('connected');
    expect(local('eu_local Gateway')).toBe('connected');
  });
});

describe('Gestalteter Renderer', () => {
  it('setzt die Hero-Variante nur aus der festen Menge in ein class-Attribut', async () => {
    const { builds } = await rebuildCase('handwerk');
    const bp = builds[0].blueprint;
    const hostile: SiteBlueprint = { ...bp, design: { ...(bp.design as NonNullable<SiteBlueprint['design']>), hero: '"><img src=x onerror=alert(1)>' as never } };
    const html = renderSite(hostile, { presentation: 'showcase' }).find((p) => p.path === '/')?.html ?? '';
    expect(html).not.toContain('onerror=alert(1)');
    expect(html).toMatch(/class="rs-hero rs-hero--(split|centered|editorial|compact)"/);
  });
});

describe('Titel, Namen und Anführungszeichen mit langen Leerraum- und Zeichenfolgen', () => {
  const runs = (ch: string) => `A${ch.repeat(60_000)}B`;
  const quick = (fn: () => void) => {
    const started = performance.now();
    fn();
    return performance.now() - started;
  };

  it('Titel-Segmente und Rechtsform — gleiches Ergebnis wie bisher, lineare Laufzeit', () => {
    expect(splitTitle('Müller Bau  |  Heizung – Leipzig')).toEqual(['Müller Bau', 'Heizung', 'Leipzig']);
    expect(splitTitle('Müller Bau|Sanitär')).toEqual(['Müller Bau', 'Sanitär']);
    expect(splitTitle('Bad-Sanierung Leipzig')).toEqual(['Bad-Sanierung Leipzig']);
    expect(stripLegalSuffix('Müller Haustechnik GmbH')).toBe('Müller Haustechnik');
    expect(stripLegalSuffix('Berger Steuerberatungsgesellschaft mbH')).toBe('Berger');
    expect(stripLegalSuffix('Kanzlei Weiß, PartG mbB')).toBe('Kanzlei Weiß');
    expect(stripLegalSuffix('Nordlicht AI GmbH & Co. KG')).toBe('Nordlicht AI');
    for (const ch of ['\t', ' ', '-', '|']) {
      expect(quick(() => { splitTitle(runs(ch)); stripLegalSuffix(runs(ch)); })).toBeLessThan(1000);
    }
  });

  it('Positionierung einer Seite mit feindlichem Titel bleibt schnell', async () => {
    const title = `Start${'\t'.repeat(40_000)}x${' '.repeat(40_000)}in${'\t'.repeat(20_000)}A${'-'.repeat(20_000)}`;
    const snapshot = await sealSnapshot(buildSnapshot(snapshotInput(page(`<h1>Dach</h1>${FILLER}`, `<title>${title}</title>`))));
    expect(quick(() => { derivePositioning(snapshot); })).toBeLessThan(2000);
  });

  it('Anführungszeichen um eine Kundenstimme', async () => {
    const { builds } = await rebuildCase('handwerk');
    const bp = builds[0].blueprint;
    const quote = `${'"'.repeat(60_000)}Sehr sauber gearbeitet.`;
    const withQuote: SiteBlueprint = { ...bp, pages: bp.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.kind === 'testimonials' ? { ...b, content: { ...b.content, items: [{ quote, author: 'A. K.' }] } } : b)) })) };
    expect(quick(() => { renderSite(withQuote, { presentation: 'showcase' }); })).toBeLessThan(2000);
  });
});
