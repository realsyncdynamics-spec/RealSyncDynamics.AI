// DISCOVER — abgerufene Seiten → ein Snapshot mit versiegelten Belegen.
//
// Der Snapshot ist das, was vom Abruf bleibt: abgeleitete Signale und kurze
// Auszüge, kein HTML. Er ist die Eingabe aller weiteren Stufen — und weil er
// gespeichert wird, können Richtungen, Verfeinerungen und der
// Backend-Vergleich im Publish Gate später serverseitig aus derselben Quelle
// neu abgeleitet werden, statt einem Client zu glauben.

import { canonicalHash } from '../canonical.ts';
import { extractPage, type ExtractInput } from './extract.ts';
import { REBUILD_ENGINE_VERSION, type EvidenceItem, type SourceSnapshot } from './types.ts';
import { toWellFormed } from './well-formed.ts';

export interface SnapshotInput {
  sourceUrl: string;
  resolvedUrl: string;
  fetchedAt: string;
  /** Erste Seite = Startseite. */
  pages: ExtractInput[];
  robots: { found: boolean; sitemaps: string[]; disallowAll: boolean; url: string | null };
  sitemap: { found: boolean; url: string | null; urlCount: number };
  crawl: SourceSnapshot['crawl'];
}

export function buildSnapshot(input: SnapshotInput): SourceSnapshot {
  const evidence: EvidenceItem[] = [];
  const pages = input.pages.map((page, index) => {
    const result = extractPage(page, index);
    evidence.push(...result.evidence);
    return result.page;
  });

  let resourceCounter = 0;
  const resourceEv = (url: string, path: string, excerpt: string): string => {
    resourceCounter += 1;
    const id = `r-e${resourceCounter}`;
    evidence.push({ id, kind: 'resource', url, path, excerpt, observedAt: input.fetchedAt, sha256: null });
    return id;
  };

  const origin = safeOrigin(input.resolvedUrl);
  const robotsEv = input.robots.url
    ? resourceEv(
      input.robots.url,
      'robots.txt',
      input.robots.found
        ? `robots.txt gelesen: ${input.robots.sitemaps.length} Sitemap-Verweis(e)${input.robots.disallowAll ? ', Abruf für diese Kennung untersagt' : ''}.`
        : 'Keine robots.txt gefunden (HTTP-Fehler oder nicht vorhanden).',
    )
    : null;
  const sitemapEv = input.sitemap.url || !input.sitemap.found
    ? resourceEv(
      input.sitemap.url ?? `${origin}/sitemap.xml`,
      'sitemap',
      input.sitemap.found ? `Sitemap gelesen: ${input.sitemap.urlCount} Adressen.` : 'Keine Sitemap gefunden (weder in robots.txt noch unter /sitemap.xml).',
    )
    : null;

  // Speicherbar machen, bevor irgendetwas gehasht wird: Gekürzte Auszüge
  // können ein Emoji halbiert haben (siehe `well-formed.ts`).
  return toWellFormed({
    engineVersion: REBUILD_ENGINE_VERSION,
    sourceUrl: input.sourceUrl,
    resolvedUrl: input.resolvedUrl,
    host: safeHost(input.resolvedUrl),
    fetchedAt: input.fetchedAt,
    pages,
    robots: { found: input.robots.found, sitemaps: input.robots.sitemaps, disallowAll: input.robots.disallowAll, ev: robotsEv },
    sitemap: { found: input.sitemap.found, url: input.sitemap.url, urlCount: input.sitemap.urlCount, ev: sitemapEv },
    crawl: input.crawl,
    evidence,
    sealed: false,
  } satisfies SourceSnapshot);
}

/**
 * Versiegelt jeden Beleg: SHA-256 über Art, Adresse, Pfad, Auszug,
 * Zeitpunkt und den Hash des Gesamtdokuments. Damit ist jeder Auszug an die
 * Fassung der Seite gebunden, aus der er stammt — auch ohne dass das HTML
 * gespeichert wird.
 */
export async function sealSnapshot(snapshot: SourceSnapshot): Promise<SourceSnapshot> {
  const documentHashes = new Map(snapshot.pages.map((p) => [p.url, p.documentSha256]));
  const evidence: EvidenceItem[] = [];
  for (const item of snapshot.evidence) {
    const sha256 = await canonicalHash({
      kind: item.kind,
      url: item.url,
      path: item.path,
      excerpt: item.excerpt,
      observedAt: item.observedAt,
      documentSha256: documentHashes.get(item.url) ?? null,
    });
    evidence.push({ ...item, sha256 });
  }
  return { ...snapshot, evidence, sealed: true };
}

/** Beleg nach Kennung (für Oberflächen und Befunde). */
export function evidenceById(snapshot: Pick<SourceSnapshot, 'evidence'>): Map<string, EvidenceItem> {
  return new Map(snapshot.evidence.map((e) => [e.id, e]));
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}
