/**
 * Wächter: Eine öffentliche Fachseite, die nicht in der Sitemap steht, ist für
 * Suchmaschinen nicht vorhanden — und wird nicht vorgerendert.
 *
 * ## Der Befund, aus dem dieser Test entstand
 *
 * Unter `src/pages/content/` liegen sechs technisch ausführliche Modulseiten,
 * jede mit eigener Route. Keine davon stand in `public/sitemap.xml`. Das hat
 * zwei Folgen, die zusammen den Text wertlos machen:
 *
 * 1. Suchmaschinen finden sie nicht über die Sitemap.
 * 2. `scripts/prerender.mjs` liest seine Routenliste **aus der Sitemap**
 *    (`loadRoutes()`), und rendert nur, was dort mit `priority >=
 *    PRERENDER_PRIORITY_MIN` (Vorgabe 0.6) steht. Ein Crawler, der die Seite
 *    doch erreicht, bekam die leere SPA-Hülle.
 *
 * Für ein Repo, das SEO ausdrücklich über Prerendering löst (CLAUDE.md §2),
 * ist das kein Schönheitsfehler: Der Fachtext war geschrieben, bezahlt und
 * unsichtbar.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Muss zu `PRIORITY_MIN` in scripts/prerender.mjs passen. */
const PRERENDER_PRIORITY_MIN = 0.6;

const root = resolve(__dirname, '../..');
const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
const sitemap = readFileSync(resolve(root, 'public/sitemap.xml'), 'utf8');

/** Alle Fachseiten-Komponenten — das Layout selbst ist keine Seite. */
const components = readdirSync(resolve(root, 'src/pages/content'))
  .filter((f) => f.endsWith('.tsx') && f !== 'ContentPageLayout.tsx')
  .map((f) => f.replace(/\.tsx$/, ''));

/** Route zur Komponente aus App.tsx auflösen. */
function routeOf(component: string): string | null {
  const m = app.match(new RegExp(`path="([^"]+)"\\s+element=\\{<${component}\\s*/>`));
  return m ? m[1] : null;
}

/** Prioritätswert aus dem Sitemap-Eintrag dieser Route. */
function priorityOf(route: string): number | null {
  const block = sitemap.match(
    new RegExp(`<url>\\s*<loc>[^<]*${route.replace(/\//g, '\\/')}</loc>[\\s\\S]*?</url>`),
  );
  if (!block) return null;
  const prio = block[0].match(/<priority>([\d.]+)<\/priority>/);
  return prio ? parseFloat(prio[1]) : 0.5;
}

describe('Fachseiten sind auffindbar und werden vorgerendert', () => {
  it('es gibt überhaupt Fachseiten zu prüfen', () => {
    expect(components.length).toBeGreaterThan(0);
  });

  it.each(components)('%s ist geroutet', (component) => {
    expect(
      routeOf(component),
      `${component} hat keine Route in App.tsx — die Seite ist nicht erreichbar.`,
    ).not.toBeNull();
  });

  it.each(components)('%s steht in der Sitemap', (component) => {
    const route = routeOf(component);
    if (!route) return; // vom Test darüber bereits gemeldet
    expect(
      priorityOf(route),
      `${route} fehlt in public/sitemap.xml. Ohne Eintrag findet keine ` +
        'Suchmaschine die Seite — und der Prerenderer rendert sie nicht, weil ' +
        'er seine Routenliste aus der Sitemap liest.',
    ).not.toBeNull();
  });

  it.each(components)('%s wird vorgerendert (Priorität hoch genug)', (component) => {
    const route = routeOf(component);
    if (!route) return;
    const prio = priorityOf(route);
    if (prio === null) return; // vom Test darüber bereits gemeldet
    expect(
      prio,
      `${route} steht mit Priorität ${prio} in der Sitemap. Der Prerenderer ` +
        `rendert erst ab ${PRERENDER_PRIORITY_MIN} — darunter liefert die Route ` +
        'Crawlern eine leere SPA-Hülle.',
    ).toBeGreaterThanOrEqual(PRERENDER_PRIORITY_MIN);
  });
});
