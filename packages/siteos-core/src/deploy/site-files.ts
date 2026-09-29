// Begleitdateien einer statischen Auslieferung: robots.txt, sitemap.xml,
// Weiterleitungen und Sicherheits-Header.
//
// ## Warum im Artefakt und nicht daneben
//
// Der Publish Gate bewertet genau ein Bündel (G6). Kämen Weiterleitungen
// oder Header erst beim Export dazu, wäre ausgeliefert, was nie bewertet
// wurde — ein `_redirects`, das `/kontakt` auf eine fremde Adresse lenkt,
// ist genauso eine Änderung der Site wie eine geänderte Seite. Deshalb gehen
// diese Dateien in denselben Hash.
//
// Formate: `_redirects` und `_headers` verstehen Cloudflare Pages und
// Netlify unverändert; andere Hoster ignorieren sie. Keine Zeitstempel
// (`lastmod`): Das Bündel muss für gleiche Eingaben bytegleich bleiben.

import type { SiteBlueprint } from '../types.ts';

export interface SiteFilesOptions {
  /** Zieladresse (`https://www.beispiel.de`). Ohne sie keine Sitemap — relative Einträge sind dort ungültig. */
  baseUrl?: string;
  /** Alte Pfade → neue Seiten (301). */
  redirects?: { from: string; to: string }[];
}

export interface SiteFile {
  path: string;
  content: string;
}

const SAFE_PATH = /^\/[A-Za-z0-9._~%/-]{0,200}$/;

/**
 * Content-Security-Policy der gestalteten Auslieferung: kein Skript
 * (JSON-LD ist ein Datenblock und wird nicht ausgeführt), Stile inline,
 * Bilder nur per https, Formulare nur an https- oder mailto-Ziele.
 */
export const STATIC_SITE_CSP = [
  "default-src 'self'",
  "script-src 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data:",
  "font-src 'self'",
  "connect-src 'none'",
  "form-action 'self' https: mailto:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

export function buildSiteFiles(blueprint: SiteBlueprint, options: SiteFilesOptions): SiteFile[] {
  const files: SiteFile[] = [];
  const base = normalizeBase(options.baseUrl);

  files.push({
    path: '/robots.txt',
    content: ['User-agent: *', 'Allow: /', ...(base ? [`Sitemap: ${new URL('/sitemap.xml', base).toString()}`] : []), ''].join('\n'),
  });

  if (base) {
    const urls = blueprint.pages
      .filter((p) => !p.noindex)
      .map((p) => new URL(p.path, base).toString())
      .sort();
    files.push({
      path: '/sitemap.xml',
      content: [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map((u) => `  <url><loc>${xmlEscape(u)}</loc></url>`),
        '</urlset>',
        '',
      ].join('\n'),
    });
  }

  const pagePaths = new Set(blueprint.pages.map((p) => p.path));
  const redirects = (options.redirects ?? [])
    .filter((r) => SAFE_PATH.test(r.from) && SAFE_PATH.test(r.to) && r.from !== r.to && pagePaths.has(r.to) && !pagePaths.has(r.from))
    .filter((r, i, all) => all.findIndex((o) => o.from === r.from) === i)
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  if (redirects.length > 0) {
    files.push({ path: '/_redirects', content: `${redirects.map((r) => `${r.from} ${r.to} 301`).join('\n')}\n` });
  }

  files.push({
    path: '/_headers',
    content: [
      '/*',
      '  X-Content-Type-Options: nosniff',
      '  Referrer-Policy: strict-origin-when-cross-origin',
      '  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()',
      '  X-Frame-Options: SAMEORIGIN',
      `  Content-Security-Policy: ${STATIC_SITE_CSP}`,
      '',
    ].join('\n'),
  });

  return files;
}

function normalizeBase(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
