#!/usr/bin/env node
/**
 * Erreichbarkeits-Analyse für `src/`
 *
 * Beantwortet eine Frage, die Grep nicht beantworten kann: Hängt diese Datei
 * noch an irgendetwas? Gezählt wird nicht, wie oft ein Name irgendwo vorkommt
 * — `Grid`, `Modal` und `Container` stehen auch in Fließtext — sondern ob es
 * eine Importkette vom Einstiegspunkt bis zur Datei gibt.
 *
 * Anlass: Am 2026-09-19 stellte sich beim Schreiben der Design-Regel heraus,
 * dass `GovernanceFooter` als Referenz dokumentiert war, obwohl die Datei im
 * ganzen Repo keinen Importeur hat. 23 der 32 Dateien in
 * `components/landing/` waren in derselben Lage. Solche Leichen kosten nicht
 * nur Bundle, sie führen die nächste Session in die Irre.
 *
 * ## Zwei Messungen
 *
 *   npm run check:dead              App + Tests + Skripte + Worker
 *   npm run check:dead -- --app-only   nur die ausgelieferte App
 *
 * Die zweite Zahl ist immer größer. Die Differenz sind Dateien, die nur noch
 * ein Test am Leben hält — auch ein Befund, aber ein anderer: Dort ist der
 * Test zu löschen oder die Datei wieder zu verdrahten.
 *
 * ## Grenzen, die man kennen muss
 *
 * Aufgelöst werden relative Importe und der `@/`-Alias aus `vite.config.ts`.
 * Nicht erkannt werden Dateien, die ausschließlich über einen zur Laufzeit
 * gebauten Pfad geladen werden (`import(variable)`). Davon gibt es im Projekt
 * derzeit keine; falls doch welche dazukommen, meldet dieses Skript sie
 * fälschlich als tot. Deshalb: Vor dem Löschen immer gegenprüfen.
 *
 * `*.d.ts` zählt nie als tot — Ambient-Deklarationen werden nie importiert.
 *
 * Kein CI-Gate. Das Skript misst, es blockiert nicht: Der Bestand ist zu
 * groß, um ihn in einem Zug aufzuräumen, und ein rotes Gate ohne Basislinie
 * hilft niemandem.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const EXT = ['.tsx', '.ts', '.jsx', '.js'];
const APP_ONLY = process.argv.includes('--app-only');

/** Einstiegspunkte der ausgelieferten App. */
const APP_ENTRIES = ['src/main.tsx', 'src/App.tsx'];

/** Alles ausserhalb von `src/`, das auf `src/` zeigen darf. */
const EXTRA_ROOTS = ['test', 'tests', 'e2e', 'scripts', 'workers', 'worker', 'packages', 'shared'];

/**
 * Tests liegen nicht nur in `test/`, sondern auch mitten in `src/` — als
 * `*.test.ts` neben der Datei oder in einem `__tests__/`-Ordner. Sie sind
 * ebenso Einstiegspunkte: Was nur ein solcher Test importiert, ist nicht
 * verwaist, sondern getestet und nicht ausgeliefert.
 *
 * Ohne diese Zeile meldete das Skript am 2026-09-19 zehn Testdateien selbst
 * als tot — und alles, was nur an ihnen hing, gleich mit.
 */
const TEST_FILE = /(?:\.(?:test|spec)\.[jt]sx?$)|(?:[\\/]__tests__[\\/])/;

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = resolve(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null; // Paket aus node_modules

  for (const ext of ['', ...EXT]) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  for (const ext of EXT) {
    const candidate = join(base, `index${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

// `from '…'` deckt Import und Re-Export ab, dazu dynamisches import() und require().
const IMPORT_RE =
  /(?:from\s*['"]([^'"]+)['"])|(?:import\s*\(\s*['"]([^'"]+)['"]\s*\))|(?:require\(\s*['"]([^'"]+)['"]\s*\))/g;

function collectFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(path, out);
    else if (EXT.some((ext) => entry.name.endsWith(ext))) out.push(path);
  }
  return out;
}

const allSrcFiles = collectFiles(SRC);
const queue = APP_ENTRIES.map((e) => join(ROOT, e)).filter((p) => existsSync(p));
if (!APP_ONLY) {
  for (const root of EXTRA_ROOTS) queue.push(...collectFiles(join(ROOT, root)));
  queue.push(...allSrcFiles.filter((f) => TEST_FILE.test(relative(ROOT, f))));
}

const reached = new Set();
while (queue.length > 0) {
  const file = queue.pop();
  if (reached.has(file)) continue;
  reached.add(file);

  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const match of text.matchAll(IMPORT_RE)) {
    const target = resolveImport(file, match[1] ?? match[2] ?? match[3]);
    if (target && !reached.has(target)) queue.push(target);
  }
}

const allSrc = allSrcFiles;
const dead = allSrc
  .filter((f) => !reached.has(f) && !f.endsWith('.d.ts'))
  .map((f) => relative(ROOT, f))
  .sort();

const scope = APP_ONLY ? 'nur App-Einstieg' : 'App + Tests + Skripte + Worker';
console.log(`Erreichbarkeit von src/ (${scope})\n`);
console.log(`  Dateien unter src/      ${String(allSrc.length).padStart(5)}`);
console.log(`  davon erreichbar        ${String(allSrc.length - dead.length).padStart(5)}`);
console.log(`  ohne Importeur          ${String(dead.length).padStart(5)}`);

if (dead.length === 0) {
  console.log('\nKeine verwaisten Dateien.');
  process.exit(0);
}

const byDir = new Map();
for (const file of dead) {
  const dir = dirname(file);
  if (!byDir.has(dir)) byDir.set(dir, []);
  byDir.get(dir).push(file.slice(dir.length + 1));
}

const sorted = [...byDir.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
console.log('\nNach Verzeichnis:\n');
for (const [dir, names] of sorted) {
  console.log(`  ${dir}  (${names.length})`);
  for (const name of names.sort()) console.log(`      ${name}`);
}

console.log('\nVor dem Löschen gegenprüfen — siehe Kopf dieser Datei.');
