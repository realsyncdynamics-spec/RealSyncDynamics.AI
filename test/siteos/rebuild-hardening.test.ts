// Rebuild-Workflow — Härtung nach dem unabhängigen Review (2026-09-29).
//
// Festgehalten wird, was ein Review mit synthetischen Seiten gezeigt hatte:
//   • keine erfundenen Aussagen aus Fehllesungen der Quelle (Ort „Sachen
//     Dachsanierung", Jahresangabe aus „Kunden über 60 Jahre", H1
//     „Startseite", unsichtbare JSON-LD-Bewertung als sichtbare Behauptung);
//   • der Backend-Vergleich meldet Erhalt nur, wo er ihn prüfen konnte;
//   • die Site ist an ihren Analyse-Lauf gebunden (im Hash);
//   • Freigaben hängen am Vergleich, den sie gesehen haben;
//   • Felder mit Rechtswirkung werden als solche erkannt;
//   • feindliche Seiten verbrauchen keine quadratische Rechenzeit;
//   • gespeichert wird nur, was Postgres annimmt (keine halben Emoji).

import { describe, expect, it } from 'vitest';
import {
  backendDigest,
  buildDeploymentArtifact,
  buildDirection,
  buildPublishChecklist,
  buildSnapshot,
  canonicalHash,
  compareBackend,
  composeHero,
  composeSeo,
  derivePositioning,
  extractPage,
  isBlockedAddress,
  localityFromText,
  planNextSteps,
  protectedFieldChanges,
  renderSite,
  sealSnapshot,
  toWellFormed,
  verifyArtifactFiles,
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

// ─────────────────────────────────────────────────────────────────────
// Keine erfundenen Aussagen
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

// ─────────────────────────────────────────────────────────────────────
// Backend-Vergleich: Erhalt nur, wo geprüft
// ─────────────────────────────────────────────────────────────────────

describe('Backend-Vergleich ohne stille Zusagen', () => {
  it('ein Terminformular ist nicht erhalten, weil der Neubau auf die alte Seite verlinkt', async () => {
    const html = page(`${FILLER}<form action="/termin-senden" method="post"><label>Wunschtermin <input name="termin"></label><input name="email" type="email"><button>Termin anfragen</button></form>`);
    const snapshot = await sealSnapshot(buildSnapshot(snapshotInput(html)));
    const booking = snapshot.pages[0].forms[0];
    expect(booking.purpose).toBe('booking');
    const { builds } = await rebuildCase('handwerk');
    const bp = builds[0].blueprint;
    const withOldLink: SiteBlueprint = {
      ...bp,
      pages: bp.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.kind === 'hero' ? { ...b, content: { ...b.content, primaryCta: { label: 'Termin', href: `${PAGE}termin-senden` } } } : b)) })),
    };
    const report = compareBackend(snapshot, withOldLink);
    const item = report.items.find((i) => i.kind === 'booking');
    expect(item?.status).toBe('lost');
  });

  it('abgeschnittene Dokumente, Skript-Seiten und unbekannte Einbindungen verlangen eine Freigabe', async () => {
    const input = snapshotInput(page(`${FILLER}<script src="https://cdn.unbekannt-widgets.example/loader.js"></script>`));
    input.pages[0].truncated = true;
    input.pages.push({ url: `${PAGE}buchen`, html: page('<div id="app"></div><script src="/app.js"></script>'), statusCode: 200, fetchedAt: AT, documentSha256: 'b'.repeat(64) });
    input.crawl = { planned: [`${PAGE}buchen`], fetched: [PAGE, `${PAGE}buchen`], skipped: [] };
    const snapshot = await sealSnapshot(buildSnapshot(input));
    expect(snapshot.pages[0].truncated).toBe(true);
    const { builds } = await rebuildCase('handwerk');
    const unverified = compareBackend(snapshot, builds[0].blueprint).comparison.unverified ?? [];
    expect(unverified.some((u) => u.startsWith('Nur teilweise gelesen'))).toBe(true);
    expect(unverified.some((u) => u.startsWith('Kaum Text im ausgelieferten HTML') && u.includes('/buchen'))).toBe(true);
    // Die Startseite hat lesbaren Text — sie gilt nicht als Skript-Hülle.
    expect(unverified.some((u) => u.startsWith('Kaum Text im ausgelieferten HTML: /,'))).toBe(false);
    expect(unverified.some((u) => u.includes('cdn.unbekannt-widgets.example'))).toBe(true);
  });

  it('der Vergleichs-Hash ändert sich mit jedem Verzicht — eine Freigabe hängt an ihm', async () => {
    const { snapshot, builds } = await rebuildCase('handwerk');
    const bp = builds[0].blueprint;
    const before = compareBackend(snapshot, bp);
    const lost = before.items.find((i) => i.status === 'lost' && i.waivable);
    expect(lost).toBeDefined();
    const after = compareBackend(snapshot, bp, [{ key: lost!.key, reason: 'Anfragen laufen künftig telefonisch.', by: 'u-1', at: AT }]);
    const runId = '11111111-2222-4333-8444-555555555555';
    expect(await backendDigest(runId, before.comparison)).not.toBe(await backendDigest(runId, after.comparison));
    expect(await backendDigest(runId, before.comparison)).not.toBe(await backendDigest('22222222-2222-4333-8444-555555555555', before.comparison));
    expect(await backendDigest(runId, before.comparison)).toBe(await backendDigest(runId, compareBackend(snapshot, bp).comparison));
  });
});

// ─────────────────────────────────────────────────────────────────────
// Bindung an den Lauf
// ─────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────
// Rechtswirksame Felder, Checkliste, nächste Schritte
// ─────────────────────────────────────────────────────────────────────

describe('Felder mit Rechtswirkung', () => {
  it('erkennt Formularziel, Rechtstext, Sichtbarkeit und Bildrechte — nicht unveränderte Werte', async () => {
    const { builds } = await rebuildCase('handwerk');
    const bp = builds[0].blueprint;
    expect(protectedFieldChanges(bp, structuredClone(bp))).toEqual([]);
    const edit = (fn: (b: SiteBlueprint['pages'][number]['blocks'][number]) => SiteBlueprint['pages'][number]['blocks'][number]): SiteBlueprint => ({
      ...bp, pages: bp.pages.map((p) => ({ ...p, blocks: p.blocks.map(fn) })),
    });
    expect(protectedFieldChanges(bp, edit((b) => (b.kind === 'contact-form' ? { ...b, content: { ...b.content, target: 'https://formspree.io/f/abc' } } : b)))).toEqual(expect.arrayContaining([expect.stringContaining('Formularziel')]));
    expect(protectedFieldChanges(bp, edit((b) => (b.kind === 'legal-text' ? { ...b, content: { ...b.content, body: 'Angaben gemäß § 5 DDG …' } } : b))).some((c) => c.endsWith('Wortlaut'))).toBe(true);
    expect(protectedFieldChanges(bp, edit((b) => (b.kind === 'services' ? { ...b, content: { ...b.content, hidden: true } } : b))).some((c) => c.endsWith('Sichtbarkeit'))).toBe(true);
    expect(protectedFieldChanges(bp, edit((b) => (b.kind === 'hero' ? { ...b, content: { ...b.content, media: { kind: 'image', src: 'https://x.example/a.jpg', alt: 'Dach', rightsConfirmed: true } } } : b))).some((c) => c.endsWith('Bildrechte'))).toBe(true);
    // Redaktion ohne Rechtswirkung zählt nicht.
    expect(protectedFieldChanges(bp, edit((b) => (b.kind === 'hero' ? { ...b, content: { ...b.content, headline: 'Neue Überschrift' } } : b)))).toEqual([]);
  });
});

describe('Checkliste', () => {
  it('nennt eine andere Zieldomain und den Hinweis zu Kundenbewertungen', async () => {
    const { snapshot, builds } = await rebuildCase('handwerk');
    const bp = builds[0].blueprint;
    const artifact = await buildDeploymentArtifact(bp, { presentation: 'showcase' });
    const other = buildPublishChecklist({ blueprint: bp, files: artifact.files, baseUrl: 'https://neue-domain.example', sourceHost: snapshot.host, redirects: [] });
    const domain = other.items.find((i) => i.key === 'seo.domain');
    expect(domain?.status).toBe('todo');
    expect(domain?.detail).toContain(snapshot.host);
    const same = buildPublishChecklist({ blueprint: bp, files: artifact.files, baseUrl: `https://${snapshot.host}`, sourceHost: snapshot.host, redirects: [] });
    expect(same.items.find((i) => i.key === 'seo.domain')?.status).toBe('ok');

    const withReviews: SiteBlueprint = { ...bp, pages: bp.pages.map((p, i) => (i === 0 ? { ...p, blocks: [...p.blocks, { id: 'tst', kind: 'testimonials', aiGenerated: false, processesPersonalData: false, thirdPartyHosts: [], content: { heading: 'Stimmen', items: [{ quote: 'Sehr sauber gearbeitet.', author: 'A. K.' }] } }] } : p)) };
    const reviews = buildPublishChecklist({ blueprint: withReviews, files: artifact.files, baseUrl: null, sourceHost: null, redirects: [] });
    expect(reviews.items.find((i) => i.key === 'legal.reviews')?.status).toBe('todo');
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

// ─────────────────────────────────────────────────────────────────────
// Ausgabe und Bündel
// ─────────────────────────────────────────────────────────────────────

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

describe('Export-Prüfung', () => {
  it('erkennt veränderte Inhalte, abweichende Listen und falsche Bündel-Hashes', async () => {
    const { builds } = await rebuildCase('handwerk');
    const artifact = await buildDeploymentArtifact(builds[0].blueprint, { presentation: 'showcase' });
    const files = artifact.files.map((f) => ({ path: f.path, content: f.content, sha256: f.sha256 }));
    const manifest = { artifactSha256: artifact.artifactSha256, files: artifact.files.map((f) => ({ path: f.path, sha256: f.sha256 })) };
    expect(await verifyArtifactFiles(files, manifest)).toEqual({ ok: true });
    expect((await verifyArtifactFiles(files.map((f, i) => (i === 0 ? { ...f, content: `${f.content} ` } : f)), manifest)).ok).toBe(false);
    expect((await verifyArtifactFiles(files.slice(1), manifest)).ok).toBe(false);
    expect((await verifyArtifactFiles(files, { ...manifest, artifactSha256: '0'.repeat(64) })).ok).toBe(false);
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

// ─────────────────────────────────────────────────────────────────────
// Feindliche Seiten: linear statt quadratisch
// ─────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────
// Regex über fremdem Text: keine quadratische Rückverfolgung (CodeQL)
// ─────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────
// SSRF-Schranke: IPv6-Sonderbereiche
// ─────────────────────────────────────────────────────────────────────

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
