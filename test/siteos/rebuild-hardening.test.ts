// Rebuild-Workflow — Härtung nach dem unabhängigen Review (2026-09-29).
//
// Schnitt 2 aus #1727 (DISCOVER/ASSESS). Festgehalten wird, was ein Review mit
// synthetischen Seiten gezeigt hatte, soweit es Analyse und Bewertung betrifft:
//   • keine erfundenen Aussagen aus Fehllesungen der Quelle (Jahresangabe aus
//     „Kunden über 60 Jahre", unsichtbare JSON-LD-Bewertung als sichtbare Behauptung);
//   • feindliche Seiten verbrauchen keine quadratische Rechenzeit;
//   • gespeichert wird nur, was Postgres annimmt (keine halben Emoji);
//   • Adressen ohne Link-Charakter und gesperrte Adressbereiche werden erkannt.
// Die Fälle zu Richtungen, Backend-Vergleich, Checkliste und Export folgen mit
// den späteren Schnitten.

import { describe, expect, it } from 'vitest';
import {
  buildSnapshot,
  extractPage,
  isBlockedAddress,
  sealSnapshot,
  toWellFormed,
  wellFormedText,
  type SnapshotInput,
} from '../../packages/siteos-core/src/index';
import { decodeEntities } from '../../packages/siteos-core/src/rebuild/html';
import { isScriptOrDataUrl } from '../../packages/siteos-core/src/rebuild/text';
import { AT } from './rebuild-helpers';

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
