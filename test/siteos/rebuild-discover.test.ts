// Rebuild-Workflow — DISCOVER und ASSESS.
//
// Was hier festgehalten wird:
//   • Die SSRF-Schranke gilt für jede Schreibweise einer privaten Adresse.
//   • robots.txt wird beachtet — auch mit `*` und `$`.
//   • Die Unterseiten-Auswahl bevorzugt, was für einen Rebuild trägt
//     (Kontakt, Leistungen), und meidet Blog, Login, Archive.
//   • Jede Aussage hat einen Beleg, jeder Beleg einen Hash — und es wird
//     kein HTML gespeichert.
//   • Was nicht bestimmbar ist, heißt `unknown` und trägt einen Grund.

import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_EXCERPT_MAX,
  buildSnapshot,
  canonicalHash,
  discoverPageResources,
  isBlockedAddress,
  isPublicHttpUrl,
  normalizeInputUrl,
  parseRobots,
  parseSitemap,
  planCrawl,
  robotsAllows,
  sealSnapshot,
} from '../../packages/siteos-core/src/index';
import { fixture, rebuildCase, snapshotInput } from './rebuild-helpers';

describe('DISCOVER — Eingabe und SSRF-Schranke', () => {
  it('normalisiert Nutzereingaben nachsichtig beim Schema', () => {
    expect(normalizeInputUrl('mueller-haustechnik.de')?.toString()).toBe('https://mueller-haustechnik.de/');
    expect(normalizeInputUrl(' http://beispiel.de/kontakt#x ')?.toString()).toBe('http://beispiel.de/kontakt');
    expect(normalizeInputUrl('ftp://beispiel.de')).toBeNull();
    expect(normalizeInputUrl('')).toBeNull();
  });

  it.each([
    'http://127.0.0.1/', 'http://10.0.0.8/', 'http://192.168.1.1/', 'http://172.20.0.1/', 'http://169.254.169.254/latest/meta-data',
    'http://[::1]/', 'http://[fd00::1]/', 'http://2130706433/', 'http://0x7f000001/', 'http://localhost/', 'http://intranet.local/',
    'http://user:pass@beispiel.de/', 'http://beispiel.de:8080/', 'http://100.64.0.1/',
  ])('weist %s ab', (url) => {
    expect(isPublicHttpUrl(new URL(url)).ok).toBe(false);
  });

  it('lässt öffentliche Adressen auf Standard-Ports durch', () => {
    expect(isPublicHttpUrl(new URL('https://www.beispiel.de/')).ok).toBe(true);
    expect(isPublicHttpUrl(new URL('http://beispiel.de:80/leistungen')).ok).toBe(true);
    expect(isBlockedAddress('93.184.216.34')).toBe(false);
    expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true);
  });

  it('sperrt nur die reservierten 192.0.x-Bereiche und die Dokumentationsnetze', () => {
    expect(isBlockedAddress('192.0.78.24')).toBe(false); // öffentlich (u. a. Hosting)
    expect(isBlockedAddress('192.0.0.8')).toBe(true);
    expect(isBlockedAddress('192.0.2.10')).toBe(true); // TEST-NET-1
    expect(isBlockedAddress('198.51.100.7')).toBe(true); // TEST-NET-2
    expect(isBlockedAddress('203.0.113.9')).toBe(true); // TEST-NET-3
  });
});

describe('DISCOVER — robots.txt und Sitemap', () => {
  const robots = parseRobots([
    'User-agent: *',
    'Disallow: /intern/',
    'Disallow: /*.pdf$',
    'Allow: /intern/presse',
    'Sitemap: https://beispiel.de/sitemap.xml',
  ].join('\n'));

  it('wendet die längste passende Regel an, bei Gleichstand Allow', () => {
    expect(robotsAllows('/', robots)).toBe(true);
    expect(robotsAllows('/intern/geheim', robots)).toBe(false);
    expect(robotsAllows('/intern/presse', robots)).toBe(true);
    expect(robotsAllows('/datei.pdf', robots)).toBe(false);
    expect(robotsAllows('/datei.pdf?x=1', robots)).toBe(true);
    expect(robots.sitemaps).toEqual(['https://beispiel.de/sitemap.xml']);
  });

  it('beachtet eine Gruppe für die eigene Kennung vorrangig', () => {
    const own = parseRobots('User-agent: *\nAllow: /\n\nUser-agent: RealSyncDynamicsAI\nDisallow: /');
    expect(robotsAllows('/', own)).toBe(false);
    const byFullName = parseRobots('User-agent: *\nAllow: /\n\nUser-agent: RealSyncDynamicsAI-SiteOS-Rebuild\nDisallow: /');
    expect(robotsAllows('/', byFullName)).toBe(false);
    const unrelated = parseRobots('User-agent: *\nAllow: /\n\nUser-agent: sync\nDisallow: /');
    expect(robotsAllows('/', unrelated)).toBe(true);
  });

  it('unterscheidet Sitemap-Index und URL-Liste', () => {
    expect(parseSitemap('<urlset><url><loc>https://a.de/</loc></url><url><loc>https://a.de/kontakt</loc></url></urlset>')).toEqual({ urls: ['https://a.de/', 'https://a.de/kontakt'], sitemaps: [] });
    expect(parseSitemap('<sitemapindex><sitemap><loc>https://a.de/s1.xml</loc></sitemap></sitemapindex>')).toEqual({ urls: [], sitemaps: ['https://a.de/s1.xml'] });
  });
});

describe('DISCOVER — Auswahl der Unterseiten', () => {
  const start = new URL('https://www.beispiel.de/');
  const candidates = [
    { url: 'https://www.beispiel.de/blog/2024/05/neuigkeit', label: 'News' },
    { url: 'https://www.beispiel.de/kontakt', label: 'Kontakt', inNavigation: true },
    { url: 'https://www.beispiel.de/leistungen', label: 'Leistungen', inNavigation: true },
    { url: 'https://www.beispiel.de/wp-login.php', label: 'Login' },
    { url: 'https://www.beispiel.de/ueber-uns', label: 'Über uns', inNavigation: true },
    { url: 'https://fremd.example/kontakt', label: 'Kontakt' },
    { url: 'https://www.beispiel.de/intern/kontakt', label: 'Kontakt intern' },
    { url: 'https://www.beispiel.de/preise.pdf', label: 'Preise' },
  ];

  it('wählt Kontakt, Leistungen, Über uns — nicht Blog, Login, fremde Hosts, Dateien', () => {
    const plan = planCrawl(start, candidates, 5, parseRobots('User-agent: *\nDisallow: /intern/'));
    expect(plan).toEqual(['https://www.beispiel.de/kontakt', 'https://www.beispiel.de/leistungen', 'https://www.beispiel.de/ueber-uns']);
  });

  it('hält das Limit ein und ist deterministisch', () => {
    const a = planCrawl(start, candidates, 2);
    expect(a).toHaveLength(2);
    expect(planCrawl(start, [...candidates].reverse(), 2)).toEqual(a);
  });

  it('wendet robots.txt-Regeln auf Pfad und Query an', () => {
    const withQuery = [
      { url: 'https://www.beispiel.de/leistungen?seite=2', label: 'Leistungen', inNavigation: true },
      { url: 'https://www.beispiel.de/kontakt', label: 'Kontakt', inNavigation: true },
    ];
    expect(planCrawl(start, withQuery, 5, parseRobots('User-agent: *\nDisallow: /*?'))).toEqual(['https://www.beispiel.de/kontakt']);
  });

  it('findet Stylesheets derselben Website und interne Links', () => {
    const html = fixture('handwerk-home.html');
    const found = discoverPageResources(html, 'https://www.mueller-haustechnik.example/');
    expect(found.stylesheets.every((s) => s.startsWith('https://www.mueller-haustechnik.example/'))).toBe(true);
    expect(found.candidates.some((c) => c.url.includes('/kontakt'))).toBe(true);
    expect(found.candidates.every((c) => new URL(c.url).hostname.endsWith('mueller-haustechnik.example'))).toBe(true);
  });
});

describe('DISCOVER — Snapshot und Belege', () => {
  it('versiegelt jeden Beleg und speichert kein HTML', async () => {
    const { snapshot } = await rebuildCase('handwerk');
    expect(snapshot.sealed).toBe(true);
    expect(snapshot.evidence.length).toBeGreaterThan(20);
    for (const item of snapshot.evidence) {
      expect(item.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(item.excerpt.length).toBeLessThanOrEqual(EVIDENCE_EXCERPT_MAX);
      expect(item.observedAt).toBe(snapshot.fetchedAt);
    }
    // Das Dokument selbst ist nicht Teil des Snapshots — nur sein Hash.
    expect(JSON.stringify(snapshot)).not.toContain('<!DOCTYPE');
    expect(JSON.stringify(snapshot)).not.toContain('<html');
    expect(snapshot.pages[0].documentSha256).toBe('a'.repeat(64));
  });

  it('ist deterministisch: gleiche Eingabe, gleicher Hash', async () => {
    const a = await sealSnapshot(buildSnapshot(snapshotInput('steuer')));
    const b = await sealSnapshot(buildSnapshot(snapshotInput('steuer')));
    expect(await canonicalHash(a)).toBe(await canonicalHash(b));
  });

  it('liest Kontakt, Formulare, Fremd-Einbindungen und Marke der Ausgangsseite', async () => {
    const { snapshot } = await rebuildCase('handwerk');
    const home = snapshot.pages[0];
    expect(home.forms.map((f) => f.purpose)).toContain('contact');
    expect(home.contact.phones.length).toBeGreaterThan(0);
    expect(home.thirdParty.map((t) => t.category)).toContain('analytics');
    expect(home.colors[0].hex).toBe('#c8102e');
    expect(home.fonts.map((f) => f.family)).toEqual(expect.arrayContaining(['Open Sans', 'Roboto Slab']));
    expect(home.absences.viewport).toBeDefined();
  });
});

describe('ASSESS — Positionierung ohne Raten', () => {
  it('belegt, was die Seite sagt', async () => {
    const { positioning, snapshot } = await rebuildCase('handwerk');
    expect(positioning.companyName.value).toBe('Müller Haustechnik GmbH');
    expect(positioning.locality.value).toBe('Leipzig');
    expect(positioning.industry.value).toBe('handwerk');
    const ids = new Set(snapshot.evidence.map((e) => e.id));
    for (const field of Object.values(positioning)) {
      if (field.status === 'known') {
        expect(field.evidence.length).toBeGreaterThan(0);
        for (const ev of field.evidence) expect(ids.has(ev)).toBe(true);
      }
    }
  });

  it('nennt Unbestimmtes `unknown` mit Grund — statt eine Branche oder einen Ort zu erfinden', async () => {
    const { positioning } = await rebuildCase('saas');
    expect(positioning.industry.status).toBe('unknown');
    expect(positioning.locality.status).toBe('unknown');
    if (positioning.industry.status === 'unknown') expect(positioning.industry.reason.length).toBeGreaterThan(10);
  });
});

describe('ASSESS — Bewertung mit Beleg je Befund', () => {
  it('hängt jeden Befund an vorhandene Belege', async () => {
    for (const name of ['handwerk', 'steuer', 'saas'] as const) {
      const { assessment, snapshot } = await rebuildCase(name);
      const ids = new Set(snapshot.evidence.map((e) => e.id));
      for (const finding of assessment.findings) {
        expect(finding.evidence.length, finding.code).toBeGreaterThan(0);
        for (const ev of finding.evidence) expect(ids.has(ev), `${finding.code} → ${ev}`).toBe(true);
      }
      for (const criterion of assessment.criteria) {
        expect(criterion.score).toBeGreaterThanOrEqual(0);
        expect(criterion.score).toBeLessThanOrEqual(100);
      }
      expect(assessment.criteria).toHaveLength(8);
    }
  });

  it('erkennt die typischen Schwächen der Handwerker-Seite', async () => {
    const { assessment } = await rebuildCase('handwerk');
    const codes = assessment.findings.map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining([
      'rebuild.hero.generic-headline',
      'rebuild.mobile.no-viewport',
      'rebuild.cta.phone-not-clickable',
      'rebuild.trust.tracking-without-consent-tool',
    ]));
    const mobile = assessment.criteria.find((c) => c.criterion === 'mobile-ux');
    expect(mobile?.status).toBe('poor');
  });
});
