// Gemeinsame Ausgangslage der Rebuild-Tests: drei Ausgangsseiten, wie sie
// der Edge-Handler abrufen würde (Handwerk mit Kontaktseite und Stylesheet,
// Steuerkanzlei mit Sitemap, Software-Anbieter mit dunkler Seite).
//
// Kein Test-File (kein `.test.`) — nur Bausteine.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assessSnapshot,
  buildDirections,
  buildSnapshot,
  derivePositioning,
  sealSnapshot,
  type Assessment,
  type DirectionBuild,
  type Positioning,
  type SnapshotInput,
  type SourceSnapshot,
} from '../../packages/siteos-core/src/index';

export const AT = '2026-09-29T10:00:00.000Z';

export function fixture(name: string): string {
  return readFileSync(resolve(__dirname, '../fixtures/rebuild', name), 'utf8');
}

export type CaseName = 'handwerk' | 'steuer' | 'saas';

export function snapshotInput(name: CaseName): SnapshotInput {
  switch (name) {
    case 'handwerk':
      return {
        sourceUrl: 'https://www.mueller-haustechnik.example/', resolvedUrl: 'https://www.mueller-haustechnik.example/', fetchedAt: AT,
        pages: [
          { url: 'https://www.mueller-haustechnik.example/', html: fixture('handwerk-home.html'), statusCode: 200, fetchedAt: AT, documentSha256: 'a'.repeat(64), stylesheets: [{ url: 'https://www.mueller-haustechnik.example/style.css', css: fixture('handwerk-style.css') }] },
          { url: 'https://www.mueller-haustechnik.example/kontakt/', html: fixture('handwerk-kontakt.html'), statusCode: 200, fetchedAt: AT, documentSha256: 'b'.repeat(64) },
        ],
        robots: { found: false, sitemaps: [], disallowAll: false, url: 'https://www.mueller-haustechnik.example/robots.txt' },
        sitemap: { found: false, url: null, urlCount: 0 },
        crawl: { planned: ['https://www.mueller-haustechnik.example/kontakt'], fetched: ['https://www.mueller-haustechnik.example/', 'https://www.mueller-haustechnik.example/kontakt/'], skipped: [] },
      };
    case 'steuer':
      return {
        sourceUrl: 'https://www.berger-steuer.example/', resolvedUrl: 'https://www.berger-steuer.example/', fetchedAt: AT,
        pages: [{ url: 'https://www.berger-steuer.example/', html: fixture('steuer-home.html'), statusCode: 200, fetchedAt: AT, documentSha256: 'c'.repeat(64) }],
        robots: { found: true, sitemaps: ['https://www.berger-steuer.example/sitemap.xml'], disallowAll: false, url: 'https://www.berger-steuer.example/robots.txt' },
        sitemap: { found: true, url: 'https://www.berger-steuer.example/sitemap.xml', urlCount: 14 },
        crawl: { planned: [], fetched: ['https://www.berger-steuer.example/'], skipped: [] },
      };
    case 'saas':
      return {
        sourceUrl: 'https://nordlicht-ai.example/', resolvedUrl: 'https://nordlicht-ai.example/', fetchedAt: AT,
        pages: [{ url: 'https://nordlicht-ai.example/', html: fixture('saas-home.html'), statusCode: 200, fetchedAt: AT, documentSha256: 'd'.repeat(64) }],
        robots: { found: true, sitemaps: [], disallowAll: false, url: 'https://nordlicht-ai.example/robots.txt' },
        sitemap: { found: true, url: 'https://nordlicht-ai.example/sitemap.xml', urlCount: 30 },
        crawl: { planned: [], fetched: ['https://nordlicht-ai.example/'], skipped: [] },
      };
  }
}

export interface RebuildCase {
  snapshot: SourceSnapshot;
  positioning: Positioning;
  assessment: Assessment;
  builds: DirectionBuild[];
}

const cache = new Map<CaseName, Promise<RebuildCase>>();

/** Versiegelter Snapshot → Positionierung → Bewertung → Richtungen (zwischengespeichert). */
export function rebuildCase(name: CaseName): Promise<RebuildCase> {
  let pending = cache.get(name);
  if (!pending) {
    pending = (async () => {
      const snapshot = await sealSnapshot(buildSnapshot(snapshotInput(name)));
      const positioning = derivePositioning(snapshot);
      const assessment = assessSnapshot(snapshot, positioning, AT);
      const builds = buildDirections(snapshot, positioning, assessment, { createdAt: AT });
      return { snapshot, positioning, assessment, builds };
    })();
    cache.set(name, pending);
  }
  return pending;
}

/** Alle Zeichenketten eines Werts, verkettet — für Behauptungsprüfungen. */
export function allText(value: unknown): string {
  const out: string[] = [];
  const walk = (v: unknown, key: string) => {
    if (typeof v === 'string') {
      if (!/^(href|src|id|target|anchor|variant|kind|documentRef|legalBasis|privacyHref|consentCategory|ratio|source|phoneHref)$/.test(key)) out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x, key);
      return;
    }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(value, '');
  return out.join(' \n ');
}
