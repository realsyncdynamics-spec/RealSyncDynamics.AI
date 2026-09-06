#!/usr/bin/env node
/**
 * Prüft: Trägt die Sitemap eine URL, für die es keine Route gibt?
 *
 * ## Warum das ein eigener Check ist
 *
 * `scripts/prerender.mjs` liest seine Routenliste aus `public/sitemap.xml`.
 * Steht dort eine URL ohne Route in `src/App.tsx`, rendert der Prerender
 * dafür die NotFoundPage in eine echte Datei — ausgeliefert wird sie dann
 * mit HTTP 200 und dem Titel „Seite nicht gefunden". Google bekommt die URL
 * per Sitemap serviert, holt sie ab, sieht 200 und indexiert einen Soft-404.
 *
 * Gemessen am 2026-08-30: `/dsgvo-website` war so ein Fall — die Route war
 * beim „Product Clarity Cleanup" bewusst entfernt worden, der
 * Sitemap-Eintrag blieb stehen. Der Fehler ist von außen unsichtbar, solange
 * niemand die erzeugte Datei aufmacht; deshalb diese Ratsche.
 *
 * Der umgekehrte Fall (Route ohne Sitemap-Eintrag) ist KEIN Fehler: Viele
 * Routen sind auth-gated, Weiterleitungen oder bewusst nicht indexiert.
 */
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const routes = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);

/** `/pfad/:id` und Splats in einen Matcher übersetzen. */
const toRegExp = (route) => {
  if (route === '*') return null;
  const parts = route
    .split('/')
    .filter(Boolean)
    .map((seg) =>
      seg.startsWith(':') ? '[^/]+' : seg === '*' ? '.*' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
  return new RegExp(`^/${parts.join('/')}/?$`);
};

const matchers = routes.map(toRegExp).filter(Boolean);
const hasRoute = (pathname) => matchers.some((re) => re.test(pathname));

const xml = readFileSync('public/sitemap.xml', 'utf8');
const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]).pathname);

const orphans = urls.filter((p) => !hasRoute(p));

if (orphans.length > 0) {
  console.error(`✗ ${orphans.length} Sitemap-URL(s) ohne Route in src/App.tsx:\n`);
  for (const p of orphans) console.error(`    ${p}`);
  console.error(
    '\n  Diese URLs werden als 404-Seite vorgerendert und mit HTTP 200 ausgeliefert.',
  );
  console.error('  Entweder die Route anlegen oder den Sitemap-Eintrag entfernen.');
  process.exit(1);
}

console.log(`✓ ${urls.length} Sitemap-URLs, alle mit Route.`);
