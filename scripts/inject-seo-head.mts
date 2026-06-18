// scripts/inject-seo-head.mts — Deterministische SEO-<head>-Injektion fuer die
// statisch ausgelieferten GitHub-Pages-HTML-Dateien.
//
// Problem (verifiziert 2026-06-18 via curl gegen die Live-Domain):
//   Jede Route — auch prerendere High-Priority-Routes wie /pricing — lieferte
//   den rohen SPA-Shell aus dist/index.html aus: <title> = Default,
//   <link rel="canonical"> = https://realsyncdynamicsai.de/ . Der Playwright-
//   Prerender (scripts/prerender.mjs) schreibt den korrekten Canonical nur,
//   wenn der Headless-Browser die SPA fehlerfrei hydriert — was im CI nicht
//   zuverlaessig passiert. Folge: alle Unterseiten kanonisieren auf Root /,
//   was Google dazu bringt, sie als Duplikate von / zu behandeln.
//
// Loesung: Nach `vite build` (+ optionalem Prerender + SPA-Fallback) schreibt
// dieses Script die SEO-relevanten <head>-Tags pro Route deterministisch aus
// der Single-Source-of-Truth src/config/seo.ts in dist/<route>/index.html —
// ohne Browser, ohne Hydration, damit reproduzierbar und CI-stabil.
//
// Es ersetzt nur die Kopf-Tags (title, description, canonical, OG/Twitter),
// der vom Prerender erzeugte Body-Content bleibt erhalten. Fehlt eine Datei,
// wird sie aus dem Shell dist/index.html erzeugt.
//
// Usage:
//   npx tsx scripts/inject-seo-head.mts        # nach build (+ prerender)

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SEO_CONFIG, getSeoForPath, type SEOConfig } from '../src/config/seo';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const SHELL = join(DIST, 'index.html');
// Quelle-of-truth ist public/sitemap.xml (so liest es auch der SPA-Fallback-
// Step in deploy-pages.yml); dist/sitemap.xml ist nur die kopierte Variante.
const SITEMAP_CANDIDATES = [join(ROOT, 'public', 'sitemap.xml'), join(DIST, 'sitemap.xml')];

const SITE_URL = 'https://realsyncdynamicsai.de';
const TITLE_SUFFIX = ' — RealSyncDynamics.AI';

// Brand-Suffix-Logik 1:1 aus src/components/SEOHead.tsx, damit der statische
// Output exakt dem entspricht, was die SPA zur Laufzeit setzen wuerde.
export function hasBrandMention(s: string): boolean {
  const lower = s.toLowerCase();
  return lower.includes('realsyncdynamics.ai') || lower.includes('realsyncdynamicsai');
}

export function withBrand(title: string): string {
  return hasBrandMention(title) ? title : title + TITLE_SUFFIX;
}

export function absUrl(canonical: string | undefined, route: string): string {
  if (canonical) {
    return canonical.startsWith('http')
      ? canonical
      : SITE_URL + (canonical.startsWith('/') ? canonical : '/' + canonical);
  }
  return SITE_URL + (route === '/' ? '/' : route);
}

// HTML-Attribut-/Text-Escaping. Titel + Descriptions enthalten u.a. "&"
// (z.B. "DSGVO, EU AI Act & digitale Souveränität") und Anfuehrungszeichen.
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface HeadValues {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  twitterTitle: string;
  twitterDescription: string;
}

export function resolveHead(route: string, cfg: SEOConfig): HeadValues {
  const title = withBrand(cfg.title);
  const description = cfg.description;
  const canonical = absUrl(cfg.canonical, route);
  const ogTitle = withBrand(cfg.ogTitle ?? cfg.title);
  const ogDescription = cfg.ogDescription ?? description;
  const twitterTitle = withBrand(cfg.twitterTitle ?? cfg.ogTitle ?? cfg.title);
  const twitterDescription = cfg.twitterDescription ?? cfg.ogDescription ?? description;
  return { title, description, canonical, ogTitle, ogDescription, twitterTitle, twitterDescription };
}

// Ersetzt genau ein Tag via Regex. Wirft, wenn das Tag nicht gefunden wird —
// so faellt eine Aenderung am Shell-Template (index.html) sofort im Build auf,
// statt still ein Tag zu verfehlen.
function replaceOrThrow(html: string, re: RegExp, replacement: string, label: string, route: string): string {
  if (!re.test(html)) {
    throw new Error(`[inject-seo] ${route}: Tag "${label}" nicht gefunden — Shell-Template geaendert?`);
  }
  return html.replace(re, replacement);
}

export function injectHead(html: string, h: HeadValues, route: string): string {
  let out = html;
  out = replaceOrThrow(out, /<title>[\s\S]*?<\/title>/,
    `<title>${esc(h.title)}</title>`, 'title', route);
  out = replaceOrThrow(out, /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${esc(h.description)}" />`, 'description', route);
  out = replaceOrThrow(out, /<meta property="og:title" content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${esc(h.ogTitle)}" />`, 'og:title', route);
  out = replaceOrThrow(out, /<meta property="og:description" content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${esc(h.ogDescription)}" />`, 'og:description', route);
  out = replaceOrThrow(out, /<meta property="og:url" content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${esc(h.canonical)}" />`, 'og:url', route);
  out = replaceOrThrow(out, /<meta name="twitter:title" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${esc(h.twitterTitle)}" />`, 'twitter:title', route);
  out = replaceOrThrow(out, /<meta name="twitter:description" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${esc(h.twitterDescription)}" />`, 'twitter:description', route);
  out = replaceOrThrow(out, /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${esc(h.canonical)}" />`, 'canonical', route);
  return out;
}

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

async function loadSitemapRoutes(): Promise<string[]> {
  for (const candidate of SITEMAP_CANDIDATES) {
    try {
      const xml = await readFile(candidate, 'utf8');
      return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    } catch {
      // naechsten Kandidaten probieren
    }
  }
  return [];
}

async function main(): Promise<void> {
  if (!(await fileExists(SHELL))) {
    console.error(`[inject-seo] FATAL: ${SHELL} fehlt — erst \`vite build\` ausfuehren.`);
    process.exit(2);
  }
  const shellHtml = await readFile(SHELL, 'utf8');

  // Route-Set: Sitemap (kanonische SEO-Seiten) ∪ alle SEO_CONFIG-Keys
  // (faengt Alias-Routes wie /behoerden -> /oeffentliche-verwaltung mit ab).
  const sitemapRoutes = await loadSitemapRoutes();
  const routeSet = new Set<string>(['/', ...sitemapRoutes, ...Object.keys(SEO_CONFIG)]);

  let written = 0;
  let fromShell = 0;
  const failures: string[] = [];

  for (const route of routeSet) {
    const cfg = getSeoForPath(route);
    const head = resolveHead(route, cfg);

    const target = route === '/'
      ? SHELL
      : join(DIST, route.replace(/\/$/, ''), 'index.html');

    let baseHtml: string;
    if (route !== '/' && !(await fileExists(target))) {
      baseHtml = shellHtml; // noch keine prerendered/Fallback-Datei -> aus Shell erzeugen
      fromShell++;
    } else {
      baseHtml = await readFile(target, 'utf8');
    }

    try {
      const out = injectHead(baseHtml, head, route);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, out, 'utf8');
      written++;
    } catch (e) {
      failures.push(`${route}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`[inject-seo] ${written} Dateien aktualisiert (${fromShell} neu aus Shell erzeugt)`);
  if (failures.length > 0) {
    for (const f of failures) console.error(`[inject-seo] FAIL ${f}`);
    process.exit(1);
  }
}

// Nur ausfuehren, wenn direkt gestartet (npx tsx ...). Beim Import in Tests
// (test/seo/inject-seo-head.test.ts) bleiben die Helfer pur, ohne Side-Effects.
const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((e) => {
    console.error('[inject-seo] FATAL:', e);
    process.exit(1);
  });
}
