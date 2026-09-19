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
 *
 * ## Der zweite Mechanismus
 *
 * `SEO_CONFIG` ist nicht die einzige Stelle, die Meta-Tags setzt. 35
 * Komponenten rufen `usePageMeta` (src/lib/usePageMeta.ts) und schreiben
 * Title, Description und OG-Tags imperativ ins `document.head` — teils direkt,
 * teils über `src/pages/content/ContentPageLayout.tsx`.
 *
 * Bei doppelter Deckung gewinnt der Hook: `<SEOHead />` steht in `App.tsx` vor
 * `<RoutesWithTracking />`, sein Effect läuft also zuerst und wird vom
 * Seiten-Effect überschrieben. Was `SEOHead` beiträgt, bleibt trotzdem
 * wirksam — `canonical` und JSON-LD setzt `usePageMeta` nicht.
 *
 * Gefährlich ist nicht die Doppelung selbst, sondern die stille Divergenz:
 * Wer den Text in `SEO_CONFIG` pflegt und den Hook übersieht, ändert nichts
 * an dem, was ausgeliefert wird — und glaubt das Gegenteil. Der letzte Test
 * hier hält beide Fassungen deshalb wörtlich gleich.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DEFAULT_SEO, getSeoForPath } from '../../src/config/seo';

const root = resolve(__dirname, '../..');
const sitemap = readFileSync(resolve(root, 'public/sitemap.xml'), 'utf8');
const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');

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

/** Alle .tsx unter src/, damit die Komponente zu einer Route gefunden wird. */
function collectTsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) return collectTsx(full);
    return e.name.endsWith('.tsx') ? [full] : [];
  });
}

const tsxFiles = collectTsx(resolve(root, 'src'));

/** Komponentenname für eine Route aus App.tsx. */
function componentFor(path: string): string | null {
  const m = app.match(
    new RegExp(`<Route\\s+path="${path.replace(/\//g, '\\/')}"\\s+element=\\{<(\\w+)`),
  );
  return m ? m[1] : null;
}

/** Datei der Komponente — Dateiname entspricht im Repo dem Export. */
function fileFor(component: string): string | null {
  return tsxFiles.find((f) => f.endsWith(`/${component}.tsx`)) ?? null;
}

/**
 * Der Title, den `usePageMeta` für diese Seite setzt — direkt in der
 * Komponente. Seiten, die den Hook über ContentPageLayout beziehen, geben
 * ihren Text als Props weiter und werden hier nicht erfasst; für die greift
 * die Doppelung-Prüfung oben.
 */
function hookTitleOf(path: string): string | null {
  const component = componentFor(path);
  if (!component) return null;
  const file = fileFor(component);
  if (!file) return null;
  const src = readFileSync(file, 'utf8');
  const m = src.match(/usePageMeta\(\{\s*title:\s*'((?:[^'\\]|\\.)*)'/);
  return m ? m[1].replace(/\\'/g, "'") : null;
}

describe('SEO_CONFIG und usePageMeta widersprechen sich nicht', () => {
  const withHook = indexedPaths
    .map((path) => ({ path, hookTitle: hookTitleOf(path) }))
    .filter((e): e is { path: string; hookTitle: string } => e.hookTitle !== null);

  it('es gibt Seiten mit beiden Mechanismen zu prüfen', () => {
    expect(withHook.length).toBeGreaterThan(0);
  });

  it.each(withHook.map((e) => [e.path, e.hookTitle]))(
    '%s — SEO_CONFIG führt denselben Title wie usePageMeta',
    (path, hookTitle) => {
      expect(
        getSeoForPath(path).title,
        `${path} setzt seinen Title über usePageMeta. Der Hook gewinnt gegen ` +
          '<SEOHead />, weil sein Effect später läuft. Der Eintrag in ' +
          'SEO_CONFIG muss denselben Text führen — sonst pflegt man hier einen ' +
          'Text, den die Seite nie ausliefert.',
      ).toBe(hookTitle);
    },
  );
});
