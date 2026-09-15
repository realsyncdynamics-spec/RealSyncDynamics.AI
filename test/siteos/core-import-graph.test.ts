import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Der Kern bleibt zyklenfrei.
 *
 * `packages/siteos-core` läuft unverändert im Browser, in Deno und in Node.
 * Ein Importzyklus ist dort nicht bloß unschön: Je nach Auswertungsreihenfolge
 * ist eine Bindung beim ersten Zugriff noch nicht initialisiert, und der
 * Fehler tritt in **einer** der drei Laufzeiten auf und in den anderen nicht.
 *
 * Anlass: `pages.ts` importierte `briefFromBlueprint` aus `refine.ts`. Sollte
 * `refine.ts` die kanonische Seitenoperation benutzen — und das muss es, seit
 * die Seiten-Invarianten für jeden Erzeugungspfad gelten —, entstünde genau
 * so ein Zyklus. Deshalb liegt `briefFromBlueprint` jetzt in `brief.ts`.
 * Hintergrund: `docs/product/page-creation-invarianten.md`.
 */

const CORE = resolve(__dirname, '../../packages/siteos-core/src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.d.ts') ? [full] : [];
  });
}

/** Nur relative Importe; Pakete interessieren hier nicht. */
function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const specifiers = [...source.matchAll(/(?:^|\n)\s*(?:import|export)[^'"\n]*from\s*['"](\.[^'"]+)['"]/g)];
  return specifiers.map((match) => resolve(dirname(file), match[1]));
}

describe('siteos-core — Importgraph', () => {
  it('enthält keinen Zyklus', () => {
    const files = sourceFiles(CORE);
    const graph = new Map(files.map((file) => [file, importsOf(file).filter((t) => files.includes(t))]));

    const cycles: string[] = [];
    const state = new Map<string, 'open' | 'done'>();

    const walk = (node: string, path: string[]): void => {
      if (state.get(node) === 'done') return;
      if (state.get(node) === 'open') {
        const from = path.indexOf(node);
        cycles.push([...path.slice(from), node].map((f) => relative(CORE, f)).join(' → '));
        return;
      }
      state.set(node, 'open');
      for (const target of graph.get(node) ?? []) walk(target, [...path, node]);
      state.set(node, 'done');
    };

    // `index.ts` ist die Sammelstelle und importiert alles — vom Rand aus laufen.
    for (const file of files) if (!file.endsWith('index.ts')) walk(file, []);

    expect(cycles).toEqual([]);
  });

  it('hält `pages.ts` frei von einem Rückgriff auf `refine.ts`', () => {
    const pages = readFileSync(join(CORE, 'blueprint/pages.ts'), 'utf8');
    expect(pages).not.toMatch(/from '\.\/refine\.ts'/);
    expect(pages).toMatch(/from '\.\/brief\.ts'/);
  });
});
