/**
 * Jede Seite muss erreichbar sein.
 *
 * ## Warum das ein eigener Test ist
 *
 * CLAUDE.md §14: *„Fertiger Code, den niemand erreichen kann, ist
 * verschwendete Arbeit."* Eine Seitendatei ohne Weg dorthin kostet trotzdem
 * Pflege, taucht in jeder Suche auf und wird bei Umbauten mitgeschleppt — sie
 * sieht aus wie Produktionscode und ist keiner.
 *
 * Am 2026-08-19 traf das sieben Dateien, alle aus derselben Funktion: der
 * SiteOS-Builder-Vorschau. Sie exportieren einander im Kreis
 * (`WowPreviewPage` → `PreviewSelectionPage`, `WebsiteBuilderWowFlow` →
 * dieselbe Datei, `routes/wowPreview.tsx` → dieselbe Datei), und **keiner**
 * dieser Wege ist in `src/App.tsx` registriert.
 *
 * ## Warum über den Importgraph
 *
 * Ein Namensvergleich („kommt `Foo` in App.tsx vor?") liegt hier zweimal
 * falsch. `WebsiteTransformationFlow` steht nirgends in `App.tsx` und ist
 * trotzdem erreichbar — als `/handwerk-website`, über zwei
 * Wiederausfuhren (`KmuWebsiteLanding` → `WebsiteBuilderLanding` →
 * `WebsiteTransformationFlow`). Umgekehrt kann ein Name zufällig in einem
 * Kommentar stehen. Deshalb wird ab `src/main.tsx` den echten relativen
 * Importen gefolgt.
 *
 * Das beantwortet „ist die Datei Teil der Anwendung?" — nicht „hat sie eine
 * URL". Für die sieben Waisen genügt das: Sie sind nicht einmal verlinkt.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const SRC = join(ROOT, 'src');
const ENTRY = join(SRC, 'main.tsx');

/** Verzeichnisse, in denen eine Datei je Route liegt (CLAUDE.md §7). */
const PAGE_DIRS = ['src/pages', 'src/unified-entry/pages'];

const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

/**
 * Bekannt nicht erreichbar — mit Grund.
 *
 * Ein Eintrag hier ist eine bewusste Entscheidung, kein Freibrief: Der Test
 * schlägt auch fehl, wenn eine dieser Dateien wieder erreichbar wird. Dann
 * gehört der Eintrag entfernt, nicht der Test angepasst.
 */
const KNOWN_UNREACHABLE: Readonly<Record<string, string>> = {
  'src/pages/WebsiteBuilderWowFlow.tsx':
    'Wiederausfuhr von PreviewSelectionPage. Die Seite selbst ist seit dem 2026-08-19 unter /app/siteos/builder erreichbar; dieser Wrapper bleibt ungenutzt.',
  'src/pages/WowWebsitePreview.tsx':
    'Variante der Builder-Vorschau ohne Route.',
  'src/unified-entry/pages/TransformationPreviewPage.tsx':
    'Zweite Vorschau-Variante derselben Funktion, ohne Route.',
  'src/unified-entry/pages/WebsitePreviewRoute.tsx':
    'Router-Wrapper, der selbst nirgends registriert ist.',
  'src/unified-entry/pages/WowPreviewEntryPage.tsx':
    'Einstiegsvariante der Builder-Vorschau, ohne Route.',
  'src/unified-entry/pages/WowPreviewPage.tsx':
    'Wiederausfuhr von PreviewSelectionPage. Die Seite selbst ist geroutet; dieser Wrapper bleibt ungenutzt.',
};

function resolveSpecifier(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null; // Pakete interessieren hier nicht.
  const base = resolve(dirname(fromFile), spec);
  for (const ext of EXTENSIONS) if (existsSync(base + ext)) return base + ext;
  for (const ext of EXTENSIONS) {
    const asIndex = join(base, `index${ext}`);
    if (existsSync(asIndex)) return asIndex;
  }
  return existsSync(base) && statSync(base).isFile() ? base : null;
}

/** Alle ab `main.tsx` über relative Importe erreichbaren Module. */
function reachableModules(): Set<string> {
  const seen = new Set<string>();
  const queue = [ENTRY];

  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || seen.has(file) || !existsSync(file)) continue;
    seen.add(file);

    const source = readFileSync(file, 'utf8');
    const specs = [
      ...source.matchAll(/from\s+['"]([^'"]+)['"]/g),
      // Lazy-Routen: `lazy(() => import('./features/...'))`
      ...source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
    ].map((match) => match[1]);

    for (const spec of specs) {
      const resolved = resolveSpecifier(file, spec);
      if (resolved) queue.push(resolved);
    }
  }
  return seen;
}

function allPageFiles(): string[] {
  const files: string[] = [];
  for (const dir of PAGE_DIRS) {
    for (const entry of readdirSync(join(ROOT, dir))) {
      if (entry.endsWith('.tsx')) files.push(join(ROOT, dir, entry));
    }
  }
  return files;
}

const REACHABLE = reachableModules();
const PAGES = allPageFiles();
const rel = (file: string) => relative(ROOT, file).split('\\').join('/');

describe('Erreichbarkeit der Seiten', () => {
  it('findet den Einstiegspunkt und einen plausiblen Graphen', () => {
    // Ohne diese Zusicherung wäre ein kaputter Auflöser ein grüner Test:
    // Fände er nichts, gälten alle Seiten als verwaist — fände er alles,
    // keine.
    expect(existsSync(ENTRY), 'src/main.tsx fehlt').toBe(true);
    expect(REACHABLE.size).toBeGreaterThan(200);
    expect(PAGES.length).toBeGreaterThan(100);
  });

  it('kennt keine unerwartet verwaiste Seite', () => {
    const orphans = PAGES.map(rel).filter(
      (page) => !REACHABLE.has(join(ROOT, page)) && !(page in KNOWN_UNREACHABLE)
    );

    expect(
      orphans.sort(),
      'Seite ohne Weg dorthin. Entweder in src/App.tsx registrieren und ' +
        'verlinken — oder in KNOWN_UNREACHABLE mit Grund eintragen ' +
        '(CLAUDE.md §14).'
    ).toEqual([]);
  });

  it('meldet Einträge in KNOWN_UNREACHABLE, die inzwischen erreichbar sind', () => {
    const resolved = Object.keys(KNOWN_UNREACHABLE).filter((page) =>
      REACHABLE.has(join(ROOT, page))
    );

    expect(
      resolved.sort(),
      'Diese Dateien sind inzwischen eingebunden. Eintrag entfernen — sonst ' +
        'beschreibt die Liste einen Zustand, den es nicht mehr gibt.'
    ).toEqual([]);
  });

  it('begründet jeden Eintrag', () => {
    for (const [page, reason] of Object.entries(KNOWN_UNREACHABLE)) {
      expect(existsSync(join(ROOT, page)), `${page} existiert nicht mehr`).toBe(true);
      expect(reason.length, `${page}: Begründung zu knapp`).toBeGreaterThan(20);
    }
  });
});
