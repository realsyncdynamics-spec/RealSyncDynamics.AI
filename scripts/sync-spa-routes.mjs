#!/usr/bin/env node
/**
 * Erzeugt `src/config/spaRoutes.generated.ts` — die Pfadmuster aller Routen
 * aus `src/App.tsx` (plus die Altpfade aus `src/enterprise-os/legacyRouteMap.ts`).
 *
 * ## Wofür
 *
 * Cloudflare Pages liefert über `/* /index.html 200` (public/_redirects) für
 * JEDEN unbekannten Pfad die SPA-Shell mit HTTP 200 aus — die
 * „Seite nicht gefunden“-Ansicht rendert erst im Browser. Für Crawler sind das
 * Soft-404s. `functions/_middleware.ts` setzt deshalb für HTML-Antworten auf
 * Pfade ohne passende Route den Status 404; dafür braucht die Middleware die
 * Routenliste, die sonst nur im React-Baum steht.
 *
 * Den Fallback in `_redirects` auf ein anderes Ziel umzubiegen ist keine
 * Option (PR #966: 308-Schleife bzw. ausgehängte Bundles) — deshalb Status in
 * der Middleware statt Ziel im Redirect.
 *
 * ## Aufruf
 *
 *   node scripts/sync-spa-routes.mjs           schreibt die Datei
 *   node scripts/sync-spa-routes.mjs --check   Exit 1, wenn sie veraltet ist
 *
 * `build:base` ruft den Sync vor `vite build` auf; damit ist die Liste beim
 * Deploy nie älter als App.tsx. `test/routing/spa-not-found.test.ts` prüft
 * zusätzlich, dass die eingecheckte Datei aktuell ist.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'src/App.tsx');
const LEGACY = join(ROOT, 'src/enterprise-os/legacyRouteMap.ts');
const TARGET = join(ROOT, 'src/config/spaRoutes.generated.ts');

/** Alle Routenmuster: `path="…"` aus App.tsx, Altpfade aus der Legacy-Map. */
export function extractSpaRoutes(appSource, legacySource) {
  const fromApp = [...appSource.matchAll(/\bpath="([^"]+)"/g)].map((m) => m[1]);
  const fromLegacy = [...legacySource.matchAll(/\[\s*'(\/[^']*)'\s*,/g)].map((m) => m[1]);
  return [...new Set([...fromApp, ...fromLegacy])].filter((p) => p !== '*').sort();
}

export function renderModule(routes) {
  const lines = routes.map((r) => `  ${JSON.stringify(r)},`).join('\n');
  return `// Erzeugt von scripts/sync-spa-routes.mjs aus src/App.tsx — nicht von Hand bearbeiten.
// Neu erzeugen: npm run sync:spa-routes

/** Pfadmuster aller React-Router-Routen (ohne den Catch-all \`*\`). */
export const SPA_ROUTE_PATTERNS: readonly string[] = [
${lines}
];
`;
}

function main() {
  const routes = extractSpaRoutes(readFileSync(APP, 'utf8'), readFileSync(LEGACY, 'utf8'));
  const next = renderModule(routes);
  let current = '';
  try { current = readFileSync(TARGET, 'utf8'); } catch { /* fehlt noch */ }
  if (process.argv.includes('--check')) {
    if (current !== next) {
      console.error('✗ src/config/spaRoutes.generated.ts ist veraltet — npm run sync:spa-routes');
      process.exit(1);
    }
    console.log(`✓ ${routes.length} SPA-Routen aktuell.`);
    return;
  }
  if (current !== next) writeFileSync(TARGET, next, 'utf8');
  console.log(`✓ src/config/spaRoutes.generated.ts (${routes.length} Routen)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
