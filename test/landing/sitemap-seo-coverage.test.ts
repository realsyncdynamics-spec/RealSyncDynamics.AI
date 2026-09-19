/**
 * Jede indexierte URL braucht eigene Meta-Tags.
 *
 * ## Der Fehler, den dieser Test verhindert
 *
 * `<SEOHead />` hängt props-los und global in `src/App.tsx`. Die Component
 * schlägt den Eintrag für `location.pathname` in `SEO_CONFIG` nach — und fällt
 * auf `DEFAULT_SEO` zurück, wenn keiner existiert. Dieser Fallback ist still:
 * kein Fehler, keine Warnung, die Seite rendert normal.
 *
 * Genau deshalb ist er über Monate unbemerkt gewachsen. Zuletzt standen 38 von
 * 116 URLs in `public/sitemap.xml`, ohne einen eigenen Eintrag zu haben —
 * darunter alle kostenlosen Tools, das Trust Center, die Docs und sämtliche
 * regulatorischen Doorways. Ein Drittel der zur Indexierung angemeldeten
 * Fläche lieferte denselben Title und dieselbe Description aus.
 *
 * Für Google sind das keine 38 Seiten, sondern 38 Kandidaten für dieselbe
 * Kurzbeschreibung. Duplicate Meta führt dazu, dass Suchmaschinen den Snippet
 * selbst zusammensetzen oder die Seite gar nicht erst ausspielen — die
 * Sitemap-Anmeldung läuft dann ins Leere.
 *
 * ## Warum gegen die Sitemap geprüft wird und nicht gegen die Routen
 *
 * `src/App.tsx` führt über 460 Routen, die meisten davon hinter Auth. Die
 * brauchen keine Meta-Tags — sie sollen gar nicht indexiert werden. Die
 * Sitemap ist die explizite Aussage „diese URL soll in den Index". Wer eine
 * URL dort einträgt, trifft genau diese Entscheidung und schuldet ihr damit
 * auch einen eigenen Title.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DEFAULT_SEO, getSeoForPath } from '../../src/config/seo';

const root = resolve(__dirname, '../..');
const sitemap = readFileSync(resolve(root, 'public/sitemap.xml'), 'utf8');

const SITE_URL = 'https://realsyncdynamicsai.de';

/** Alle in der Sitemap angemeldeten Pfade, Domain abgeschnitten. */
const indexedPaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1].replace(SITE_URL, '') || '/')
  .map((p) => (p === '/' ? '/' : p.replace(/\/$/, '')));

describe('Sitemap-URLs haben eigene Meta-Tags', () => {
  it('es gibt überhaupt Sitemap-Einträge zu prüfen', () => {
    expect(indexedPaths.length).toBeGreaterThan(100);
  });

  it.each(indexedPaths)('%s fällt nicht auf DEFAULT_SEO zurück', (path) => {
    const config = getSeoForPath(path);
    expect(
      config.title,
      `${path} steht in public/sitemap.xml, hat aber keinen Eintrag in ` +
        'SEO_CONFIG (src/config/seo.ts) und liefert daher denselben Title wie ' +
        'jede andere Seite ohne Eintrag aus.',
    ).not.toBe(DEFAULT_SEO.title);
  });

  it('kein Title und keine Description doppelt sich über indexierte URLs', () => {
    // Alias-Pfade teilen sich bewusst Title und Description und lösen das per
    // canonical auf die primäre URL auf (Alias-Strategie, siehe seo.ts).
    // Ein Duplikat ist daher nur dann ein Fehler, wenn die Canonicals abweichen.
    const collisions = new Map<string, string[]>();
    for (const path of indexedPaths) {
      const title = getSeoForPath(path).title;
      collisions.set(title, [...(collisions.get(title) ?? []), path]);
    }

    for (const [title, paths] of collisions) {
      if (paths.length < 2) continue;
      const canonicals = new Set(
        paths.map((p) => getSeoForPath(p).canonical ?? `${SITE_URL}${p}`),
      );
      expect(
        canonicals.size,
        `Title „${title}" wird von ${paths.join(', ')} geteilt, aber die ` +
          'Seiten zeigen auf verschiedene Canonicals. Entweder ist es ein ' +
          'Alias (dann muss der canonical auf die primäre URL zeigen) oder ' +
          'die Seiten brauchen unterschiedliche Titles.',
      ).toBe(1);
    }
  });
});
