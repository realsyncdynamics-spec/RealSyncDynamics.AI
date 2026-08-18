/**
 * Wächter: Was die SEO-Planung als Zielseite führt, muss es geben — und
 * auffindbar sein.
 *
 * `src/marketing/landing/seo-keywords.ts` ist die erklärte Absicht: welche
 * URLs auf welche Suchanfragen einzahlen sollen. Jeder Eintrag trägt ein Feld
 * `existsAsRoute`, das behauptet, ob die Seite schon gebaut ist.
 *
 * ## Warum dieser Test entstand
 *
 * Die Behauptung wurde von niemandem geprüft, und sie stimmte nicht:
 *
 * - `/bait-marisk-guide` stand mit `existsAsRoute: true` in der Registry. Die
 *   Seite existiert — aber unter `/bait-marisk-compliance-guide`. Die
 *   SEO-Planung zeigte also auf einen 404.
 * - `/pre-consent-tracking`, `/evidence` und `/google-analytics-consent`
 *   waren korrekt als vorhanden geführt, fehlten aber in `public/sitemap.xml`.
 *   Damit wurden sie weder indexiert noch vorgerendert (der Prerenderer liest
 *   seine Routenliste aus der Sitemap).
 *
 * Beide Fehlerarten sind still: Niemand merkt, dass eine geplante Landeseite
 * keinen Verkehr bekommt, bis jemand die Zahlen daneben legt.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Muss zu `PRIORITY_MIN` in scripts/prerender.mjs passen. */
const PRERENDER_PRIORITY_MIN = 0.6;

const root = resolve(__dirname, '../..');
const keywords = readFileSync(resolve(root, 'src/marketing/landing/seo-keywords.ts'), 'utf8');
const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
const sitemap = readFileSync(resolve(root, 'public/sitemap.xml'), 'utf8');

/** Alle Einträge als (URL, existsAsRoute). */
const targets = [
  ...keywords.matchAll(
    /targetUrl:\s*'([^']+)',\s*\n\s*intentTier:\s*'[^']*',\s*\n\s*existsAsRoute:\s*(true|false)/g,
  ),
].map((m) => ({ url: m[1], declared: m[2] === 'true' }));

const declaredExisting = targets.filter((t) => t.declared);

function hasRoute(url: string): boolean {
  return app.includes(`path="${url}"`);
}

function priorityOf(url: string): number | null {
  const block = sitemap.match(
    new RegExp(`<url>\\s*<loc>[^<]*${url.replace(/\//g, '\\/')}</loc>[\\s\\S]*?</url>`),
  );
  if (!block) return null;
  const prio = block[0].match(/<priority>([\d.]+)<\/priority>/);
  return prio ? parseFloat(prio[1]) : 0.5;
}

describe('SEO-Ziele — Absicht deckt sich mit dem, was existiert', () => {
  it('die Registry enthält Einträge', () => {
    expect(targets.length).toBeGreaterThan(0);
    expect(declaredExisting.length).toBeGreaterThan(0);
  });

  it.each(declaredExisting.map((t) => t.url))(
    '%s ist als vorhanden geführt und hat eine Route',
    (url) => {
      expect(
        hasRoute(url),
        `seo-keywords.ts führt ${url} mit existsAsRoute: true, aber App.tsx ` +
          'kennt diese Route nicht. Entweder ist die URL falsch geschrieben ' +
          'oder das Flag gehört auf false.',
      ).toBe(true);
    },
  );

  it.each(declaredExisting.map((t) => t.url))('%s steht in der Sitemap', (url) => {
    if (!hasRoute(url)) return; // vom Test darüber bereits gemeldet
    expect(
      priorityOf(url),
      `${url} ist ein erklärtes SEO-Ziel mit echter Route, fehlt aber in ` +
        'public/sitemap.xml — die Seite wird weder indexiert noch vorgerendert.',
    ).not.toBeNull();
  });

  it.each(declaredExisting.map((t) => t.url))('%s wird vorgerendert', (url) => {
    const prio = priorityOf(url);
    if (!hasRoute(url) || prio === null) return;
    expect(
      prio,
      `${url} steht mit Priorität ${prio} in der Sitemap; der Prerenderer ` +
        `rendert erst ab ${PRERENDER_PRIORITY_MIN}. Crawler bekämen die leere Hülle.`,
    ).toBeGreaterThanOrEqual(PRERENDER_PRIORITY_MIN);
  });

  it('als „noch nicht gebaut" geführte Ziele haben wirklich keine Route', () => {
    // Die Gegenrichtung: Ein Flag auf false, obwohl die Seite längst steht,
    // heisst, dass niemand sie in die Sitemap aufnimmt.
    const wrong = targets.filter((t) => !t.declared && hasRoute(t.url)).map((t) => t.url);
    expect(
      wrong,
      'Diese Ziele sind als nicht-existent geführt, haben aber eine Route. ' +
        '`existsAsRoute` gehört auf true — sonst bleibt die Seite unindexiert.',
    ).toEqual([]);
  });
});
