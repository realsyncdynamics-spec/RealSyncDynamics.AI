import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Zwei Migrationen dürfen nie dieselbe Version tragen.
 *
 * **Warum das eine eigene Prüfung braucht.** Git merged die Kollision
 * konfliktfrei, weil die Dateinamen sich unterscheiden — `git status` bleibt
 * sauber, die Review sieht nichts. Sichtbar wird der Schaden erst beim Deploy,
 * und dort in zwei Ausprägungen:
 *
 * 1. **Laut**: Ist die Version noch nicht verbucht, führt die CLI beide Dateien
 *    aus. Die zweite trifft auf Objekte, die die erste schon angelegt hat, und
 *    bricht ab (`42710`, `42P07`). So ist der Deploy nach dem Merge von #1124
 *    gescheitert — CLAUDE.md §5.
 * 2. **Still, und darum schlimmer**: Steht die Version bereits im Ledger, wird
 *    die zweite Datei **übersprungen** und der Deploy meldet Erfolg. Die
 *    Supabase-CLI schlüsselt auf die Version, nicht auf den Dateinamen. Die
 *    Tabellen entstehen nie, und niemand erfährt es, bis zur Laufzeit etwas
 *    auf eine fehlende Relation trifft.
 *
 * Fall 2 ist am 2026-08-31 und erneut am 2026-09-01 im MCP-Server-Branch
 * eingetreten, beide Male beim Nachziehen von `main`: `20260901000000`
 * kollidierte mit `canonical_plan_catalog`, danach kollidierten
 * `20260902000000` und `20260902000100` mit `industrial_ot_classification` und
 * der nächsten Fassung von `canonical_plan_catalog`. In allen Fällen war die
 * fremde Version in Produktion schon verbucht.
 *
 * **Die PR-CI eines einzelnen Branches kann das nicht sehen** — beide Seiten
 * sind für sich stimmig, die Kollision entsteht erst im Merge. Genau deshalb
 * gehört die Prüfung hierher, wo sie nach jedem `main`-Merge mitläuft, statt in
 * einen Befehl, an den man sich erinnern muss.
 *
 * **Konventionshinweis**: Sämtliche bisherigen Kollisionen lagen auf
 * `HHMMSS = 000000` oder `000100`. Wer eine neue Migration anlegt, weicht
 * deshalb besser auf eine untypische Tageszeit aus, statt Mitternacht des
 * nächsten Tages zu wählen wie alle anderen.
 */

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'supabase',
  'migrations',
);

/** `20260903120000_mcp_api_keys.sql` → `20260903120000` */
function versionOf(filename: string): string {
  return filename.split('_')[0];
}

/**
 * Zwei Dateien aus der Zeit vor der Konvention.
 *
 * Sie bleiben, wie sie sind: Beide stehen unter **genau diesen Kurzversionen**
 * im Ledger des Live-Projekts (`00001` und `20260510`, geprüft 2026-09-01).
 * Eine Umbenennung erzeugte neue Versionen, die als unangewandt gälten und beim
 * nächsten Deploy erneut liefen — bei `00001_initial_schema.sql` wäre das das
 * Anlegen des gesamten Grundschemas auf einer Datenbank, die es längst hat.
 *
 * Das ist kein Schönheitsfehler, der irgendwann behoben wird, sondern ein
 * Zustand, der so bleiben muss.
 */
const LEGACY_OHNE_ZEITSTEMPEL = new Set([
  '00001_initial_schema.sql',
  '20260510_ai_governance_core.sql',
]);

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
}

describe('Migrationsversionen', () => {
  it('sind eindeutig — keine zwei Dateien teilen sich eine Version', () => {
    const byVersion = new Map<string, string[]>();
    for (const file of migrationFiles()) {
      const version = versionOf(file);
      byVersion.set(version, [...(byVersion.get(version) ?? []), file]);
    }

    const collisions = [...byVersion.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([version, files]) => `  ${version}\n${files.map((f) => `    - ${f}`).join('\n')}`);

    expect(
      collisions,
      collisions.length === 0
        ? ''
        : 'Zwei Migrationen tragen dieselbe Version. Beim Deploy wird eine davon ' +
          'stillschweigend übersprungen, wenn die Version bereits im Ledger steht — ' +
          'der Lauf meldet dann Erfolg, ohne dass die Objekte entstehen.\n' +
          'Die eigene Datei umbenennen (nicht die aus main), auf eine Version über ' +
          'allen vorhandenen:\n' +
          collisions.join('\n'),
    ).toEqual([]);
  });

  it('tragen das Format YYYYMMDDHHMMSS — bis auf zwei belegte Altfälle', () => {
    const malformed = migrationFiles().filter(
      (f) => !/^\d{14}_/.test(f) && !LEGACY_OHNE_ZEITSTEMPEL.has(f),
    );

    expect(
      malformed,
      `Diese Dateien folgen nicht dem Format YYYYMMDDHHMMSS_beschreibung.sql: ${malformed.join(', ')}. ` +
        'Ohne 14-stellige Version ist die Reihenfolge beim Deploy nicht definiert.',
    ).toEqual([]);
  });

  it('führt die Altfall-Liste ohne Karteileichen', () => {
    // Verschwindet eine der beiden Dateien, soll die Ausnahme mit ihr
    // verschwinden — sonst deckt die Liste irgendwann still etwas Neues ab,
    // das denselben Namen trägt.
    const vorhanden = new Set(migrationFiles());
    const verwaist = [...LEGACY_OHNE_ZEITSTEMPEL].filter((f) => !vorhanden.has(f));

    expect(
      verwaist,
      `Diese Ausnahmen zeigen auf Dateien, die es nicht mehr gibt: ${verwaist.join(', ')}. ` +
        'Eintrag aus LEGACY_OHNE_ZEITSTEMPEL entfernen.',
    ).toEqual([]);
  });
});
