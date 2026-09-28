import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASELINE_FILE = join(__dirname, 'terminology-baseline.json');

/**
 * Terminologie-Ratsche (PLAN_100 #21).
 *
 * Verbindliche Begriffe laut AGENTS.md:
 *   - „Prüfpfad"          statt „Audit Trail"
 *   - „Herkunftsnachweis" statt „Provenance"
 *
 * Der Bestand weicht noch breit ab (Stand 2026-09-28: ~85 Dateien). Ein harter
 * Gate hieße ein repo-weiter Copy-Sweep in einem PR — das schließt CLAUDE.md
 * aus. Deshalb eine Ratsche, nach dem Muster von `check:context`:
 *
 *   - Neue Abweichungen sind verboten: keine Datei darf mehr Treffer haben als
 *     in `terminology-baseline.json` eingefroren (neue Dateien: 0).
 *   - Weniger Treffer als die Baseline sind ebenfalls rot — mit der Aufforderung,
 *     die Baseline zu senken. So wird jeder Fortschritt festgeschrieben und die
 *     Baseline kann nur sinken, nie wachsen.
 *
 * Baseline neu schreiben (nur nach einem Copy-Sweep, nie um Drift zu erlauben):
 *   UPDATE_TERMINOLOGY_BASELINE=1 npx vitest run test/config/terminology-ratchet.test.ts
 *
 * Bewusst NICHT gezählt:
 *   - Kommentare: sie dürfen die Altbegriffe benennen (z. B. Migrationshinweise).
 *   - Slugs/IDs `audit-trail` (kleines t nach Bindestrich): Routen, keine Copy.
 *   - Code-Bezeichner `ProvenanceClaim`, `provenance`, … (PascalCase-Suffix bzw.
 *     kleingeschrieben): C2PA-/Provenance-Typen und Keys sind Technik, keine Copy.
 *   - `src/i18n/`: enthält englische Copy, dort sind „Audit trail"/„Provenance"
 *     die korrekten Begriffe.
 */

const SEARCH_DIRS = ['src'];
const EXTENSIONS = new Set(['.ts', '.tsx']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage']);
const SKIP_PATH_PREFIXES = ['src/i18n/'];

const TERMS: Record<string, { pattern: RegExp; preferred: string }> = {
  'audit-trail': { pattern: /\b[Aa]udit(?: [Tt]rail|-Trail)\b/g, preferred: 'Prüfpfad' },
  provenance: { pattern: /\bProvenance\b/g, preferred: 'Herkunftsnachweis' },
};

type Counts = Record<string, Record<string, number>>;

/** Kommentare entfernen, Zeilenumbrüche erhalten. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/^(\s*)\/\/.*$/gm, '$1');
}

function collectFiles(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectFiles(full, acc);
    } else if (EXTENSIONS.has(extname(full))) {
      acc.push(full);
    }
  }
  return acc;
}

function countTerms(files: string[]): Counts {
  const counts: Counts = Object.fromEntries(Object.keys(TERMS).map((t) => [t, {}]));
  for (const file of files) {
    const rel = relative(ROOT, file).split('\\').join('/');
    if (SKIP_PATH_PREFIXES.some((p) => rel.startsWith(p))) continue;
    const source = stripComments(readFileSync(file, 'utf8'));
    for (const [term, { pattern }] of Object.entries(TERMS)) {
      const hits = source.match(new RegExp(pattern.source, pattern.flags))?.length ?? 0;
      if (hits > 0) counts[term][rel] = hits;
    }
  }
  // Stabile Reihenfolge, damit die Baseline diff-freundlich bleibt.
  for (const term of Object.keys(counts)) {
    counts[term] = Object.fromEntries(Object.entries(counts[term]).sort(([a], [b]) => a.localeCompare(b)));
  }
  return counts;
}

describe('Terminologie-Ratsche: Prüfpfad / Herkunftsnachweis', () => {
  const files = SEARCH_DIRS.flatMap((dir) => collectFiles(join(ROOT, dir)));
  const current = countTerms(files);

  if (process.env.UPDATE_TERMINOLOGY_BASELINE === '1') {
    writeFileSync(BASELINE_FILE, JSON.stringify(current, null, 2) + '\n', 'utf8');
  }

  const baseline: Counts = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));

  it('findet überhaupt Dateien zum Prüfen', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('erkennt die Altbegriffe in Copy, aber nicht in Slugs, Bezeichnern und Kommentaren', () => {
    const probe = stripComments(
      [
        "const a = 'Lückenloser Audit-Trail';",
        "const b = 'Audit Trail und Provenance';",
        "const slug = '/features/audit-trail';",
        'type X = ProvenanceClaim;',
        "const key = 'provenance';",
        '// Audit-Trail heißt jetzt Prüfpfad (Provenance -> Herkunftsnachweis)',
      ].join('\n'),
    );
    const at = TERMS['audit-trail'].pattern;
    const pv = TERMS.provenance.pattern;
    expect(probe.match(new RegExp(at.source, at.flags))?.length).toBe(2);
    expect(probe.match(new RegExp(pv.source, pv.flags))?.length).toBe(1);
  });

  for (const [term, { preferred }] of Object.entries(TERMS)) {
    it(`keine neuen „${term}"-Abweichungen (bevorzugt: „${preferred}")`, () => {
      const allowed = baseline[term] ?? {};
      const violations = Object.entries(current[term])
        .filter(([file, n]) => n > (allowed[file] ?? 0))
        .map(([file, n]) => `${file}: ${n} (Baseline ${allowed[file] ?? 0})`);
      expect(
        violations,
        `Neue Abweichungen — bitte „${preferred}" verwenden:\n${violations.join('\n')}`,
      ).toEqual([]);
    });

    it(`Baseline für „${term}" ist aktuell (Ratsche darf nur sinken)`, () => {
      const allowed = baseline[term] ?? {};
      const stale = Object.entries(allowed)
        .filter(([file, n]) => (current[term][file] ?? 0) < n)
        .map(([file, n]) => `${file}: jetzt ${current[term][file] ?? 0}, Baseline ${n}`);
      expect(
        stale,
        `Fortschritt! Baseline senken mit UPDATE_TERMINOLOGY_BASELINE=1:\n${stale.join('\n')}`,
      ).toEqual([]);
    });
  }
});
