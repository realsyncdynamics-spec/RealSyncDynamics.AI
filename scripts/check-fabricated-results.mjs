#!/usr/bin/env node
// Ratsche gegen selbst erfundene Werte in Oberflächen.
//
// ## Was hier verteidigt wird
//
// Eine Fläche, die eine Zahl, eine Kennung oder einen Hash zeigt, behauptet
// damit eine Messung. Am 2026-09-14 stimmte das an neun Stellen nicht: das
// Monitoring-Dashboard errechnete „Ø Zeit bis Lösung" aus `Math.random()`,
// der Massen-Import zeigte jedem Mandanten dieselbe erfundene Historie, das
// Terminal würfelte Findings-Zahl und Risiko-Stufe für die Domain des
// Nutzers, `getSeal()` gab einen erfundenen SHA-256 als Siegel zurück, und
// `/upgrade` baute eine Bezahl-URL zusammen, die nirgendwo hinführte.
//
// Keine dieser Stellen entstand aus Bosheit. Sie entstehen beim schnellen
// Ausfüllen einer leeren Ansicht, wenn die echte Anbindung gerade nicht zur
// Hand ist — und sehen danach aus wie fertige Funktionen.
//
// ## Warum eine Ratsche und keine Reparatur
//
// Der Bestand ist zum grössten Teil legitim: Jitter beim Retry, Sampling,
// Partikel in den 3D-Szenen, lokale Kennungen für UI-Zustand. Diese Stellen
// zu ändern wäre Unfug. Also dasselbe Vorgehen wie bei `check:plan-name-gates`
// und `check:limits`: der Bestand wird benannt, eingeordnet und datiert,
// **neue** Fundstellen werden blockiert.
//
// Ein Eintrag in der Grundlinie ist eine bewusste Entscheidung, kein
// Freibrief. `art: "BEFUND"` heisst ausdrücklich: das gehört behoben, es ist
// nur noch nicht behoben.
//
// ## Was gezählt wird
//
// `Math.random(` ausserhalb von Kommentaren, in `src/**`. Kommentare werden
// entfernt, weil die Begründung eines behobenen Falls sonst als neuer Fall
// zählen würde — die Historie steht bei den Fixes im Kommentar.
//
// Eine gesunkene Zahl bricht den Lauf **nicht**: Fixes sollen nicht daran
// scheitern, dass die Grundlinie noch nicht nachgezogen ist. Gemeldet wird
// sie trotzdem, mit dem Hinweis auf `--update`.
//
// Aufruf:
//   node scripts/check-fabricated-results.mjs            prüfen
//   node scripts/check-fabricated-results.mjs --json     maschinenlesbar
//   node scripts/check-fabricated-results.mjs --update   Grundlinie nachziehen

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;
const BASELINE = join(ROOT, 'scripts/fabricated-results-baseline.json');

/** Verzeichnisse, in denen eine erfundene Zahl eine Oberfläche erreicht. */
const SCAN_DIRS = ['src'];

const PATTERN = /Math\.random\s*\(/g;

/**
 * Kommentare entfernen, Strings aber nicht zerreissen.
 *
 * Blockkommentare fallen ganz weg. Bei Zeilenkommentaren wird `://` ausgespart,
 * sonst würde `https://…` in einem String-Literal die Zeile abschneiden.
 */
export function stripComments(source) {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlocks
    .split('\n')
    .map((line) => {
      for (let i = 0; i < line.length - 1; i++) {
        if (line[i] === '/' && line[i + 1] === '/' && line[i - 1] !== ':') {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join('\n');
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Fundstellen in einem Quelltext zaehlen — Kommentare zaehlen nicht mit. */
export function countIn(source) {
  return (stripComments(source).match(PATTERN) ?? []).length;
}

export function findOccurrences() {
  const found = new Map();
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const rel = relative(ROOT, file);
      const anzahl = countIn(readFileSync(file, 'utf8'));
      if (anzahl > 0) found.set(rel, anzahl);
    }
  }
  return found;
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'));
  } catch {
    return { bestand: [] };
  }
}

export function compare() {
  const found = findOccurrences();
  const baseline = loadBaseline();
  const known = new Map(baseline.bestand.map((b) => [b.datei, b]));

  const neu = [];
  const gewachsen = [];
  const gesunken = [];

  for (const [datei, anzahl] of found) {
    const eintrag = known.get(datei);
    if (!eintrag) neu.push({ datei, anzahl });
    else if (anzahl > eintrag.fundstellen) gewachsen.push({ datei, anzahl, vorher: eintrag.fundstellen });
    else if (anzahl < eintrag.fundstellen) gesunken.push({ datei, anzahl, vorher: eintrag.fundstellen });
  }

  const verschwunden = baseline.bestand
    .filter((b) => !found.has(b.datei))
    .map((b) => ({ datei: b.datei, vorher: b.fundstellen }));

  return { found, baseline, neu, gewachsen, gesunken, verschwunden };
}

function update(found, baseline) {
  const known = new Map(baseline.bestand.map((b) => [b.datei, b]));
  const heute = new Date().toISOString().slice(0, 10);
  const bestand = [...found.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([datei, fundstellen]) => {
      const alt = known.get(datei);
      return {
        datei,
        fundstellen,
        art: alt?.art ?? 'UNGEPRUEFT',
        grund: alt?.grund ?? 'Noch nicht eingeordnet — bitte Fundstelle ansehen und begründen.',
        seit: alt?.seit ?? heute,
      };
    });
  writeFileSync(BASELINE, `${JSON.stringify({ ...baseline, bestand }, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const result = compare();

  if (args.includes('--update')) {
    update(result.found, result.baseline);
    console.log(`✓ Grundlinie nachgezogen: ${result.found.size} Datei(en).`);
    process.exit(0);
  }

  if (args.includes('--json')) {
    console.log(JSON.stringify({
      neu: result.neu, gewachsen: result.gewachsen,
      gesunken: result.gesunken, verschwunden: result.verschwunden,
    }, null, 2));
    process.exit(result.neu.length + result.gewachsen.length > 0 ? 1 : 0);
  }

  for (const { datei, vorher, anzahl } of result.gesunken) {
    console.log(`· ${datei}: ${vorher} → ${anzahl} Fundstellen. Grundlinie nachziehen mit --update.`);
  }
  for (const { datei, vorher } of result.verschwunden) {
    console.log(`· ${datei}: alle ${vorher} Fundstellen weg. Eintrag kann raus (--update).`);
  }

  if (result.neu.length === 0 && result.gewachsen.length === 0) {
    console.log(`✓ Keine neuen erfundenen Werte. Bestand: ${result.found.size} Datei(en).`);
    process.exit(0);
  }

  console.error('\n✗ Neue `Math.random()`-Fundstellen in einer Oberfläche:\n');
  for (const { datei, anzahl } of result.neu) {
    console.error(`    ${datei} (${anzahl})`);
  }
  for (const { datei, vorher, anzahl } of result.gewachsen) {
    console.error(`    ${datei} (${vorher} → ${anzahl})`);
  }
  console.error(`
    Zufall gehört an wenige Stellen: Jitter, Sampling, Dekoration, lokale
    Kennungen. Er gehört NICHT in eine Zahl, die der Nutzer als Messung liest —
    Findings, Kennzahlen, Hashes, Preise, Kennungen mit Beweiskraft.

    Ist die Fundstelle legitim: nach scripts/fabricated-results-baseline.json
    eintragen, mit Art und Begründung (node scripts/check-fabricated-results.mjs --update
    legt den Eintrag an, die Begründung schreibst du selbst).
  `);
  process.exit(1);
}
