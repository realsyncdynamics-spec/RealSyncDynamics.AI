// Keine Migrations-Version darf zweimal vergeben sein.
//
// ## Warum es diese Prüfung gibt
//
// Der Fehler ist mehrfach aufgetreten, und er sieht jedes Mal harmlos aus:
//
//   2026-08-24  #1131 und #1124 vergaben beide `20260826000000`
//               (`whatsapp_channel` bzw. `restore_client_function_grants`).
//               Der Deploy brach hart ab — die CLI führte `whatsapp_channel`
//               ein zweites Mal aus, `42710` („Trigger existiert bereits").
//   2026-09-01  Ein offener Zweig trug eine inzwischen verbuchte Version.
//   2026-09-02  #1193 vergab `20260903050000` doppelt.
//
// Die PR-CI kann das nicht sehen: Beide Zweige laufen gegen eine
// `main`-Basis **ohne** die jeweils andere Datei. Erst der Merge bringt die
// Kollision zusammen, und dann steht sie auf `main`.
//
// ## Was daran teuer ist
//
// Beim ersten Mal brach etwas laut — das ist der gnädige Fall. Gefährlicher
// ist die stille Variante: Eine Version, die im Ledger bereits verbucht ist,
// wird von `supabase db push` **stillschweigend übersprungen**. Die Migration
// liegt im Repo, sieht angewandt aus, und ihr Inhalt hat die Produktion nie
// erreicht. Genau so fehlten am 2026-09-02 Spalten, in die der Code bereits
// schrieb.
//
// Und solange Migrations-Drift offen ist, bricht `db push` vollständig ab —
// dann erreicht **keine** Migration mehr die Produktion, auch keine
// unbeteiligte.
//
// ## Grenzen dieser Prüfung — bewusst benannt
//
// Sie ist offline und deterministisch und findet die Kollision **innerhalb
// des Repos**. Sie kann nicht sehen, ob eine Version im Ledger der
// Produktion bereits verbucht ist; dafür gibt es keine Datenbank im
// Testlauf. Das Altern einer Nummer gegenüber dem Ledger bleibt deshalb
// Handarbeit — vor jedem Merge gegen `supabase_migrations.schema_migrations`
// prüfen.

import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');

/**
 * Zwei Dateien stammen aus der Zeit vor dem Namensschema und werden
 * namentlich ausgenommen — nicht per Muster.
 *
 * Eine Muster-Ausnahme („alles unter 14 Stellen") würde jede künftige
 * Schlamperei mit durchlassen. Die Liste nennt deshalb exakte Dateinamen:
 * Wer eine dritte Datei hinzufügt, muss sie hier eintragen und damit
 * bewusst entscheiden.
 */
const LEGACY_FILENAMES = new Set([
  '00001_initial_schema.sql',
  '20260510_ai_governance_core.sql',
]);

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
}

/** Die Version ist der Ziffernblock vor dem ersten Unterstrich. */
function versionOf(filename: string): string {
  return filename.split('_')[0];
}

describe('Migrations-Versionen', () => {
  it('vergibt keine Version zweimal', () => {
    const seen = new Map<string, string[]>();
    for (const file of migrationFiles()) {
      const version = versionOf(file);
      seen.set(version, [...(seen.get(version) ?? []), file]);
    }

    const duplicates = [...seen.entries()].filter(([, files]) => files.length > 1);

    // Die Fehlermeldung nennt die Dateien, nicht nur die Zahl: Wer das hier
    // rot sieht, soll nicht erst suchen müssen.
    expect(
      duplicates.map(([version, files]) => `${version}: ${files.join(', ')}`),
    ).toEqual([]);
  });

  it('hält das Namensschema YYYYMMDDHHMMSS_beschreibung.sql ein', () => {
    const offenders = migrationFiles()
      .filter((f) => !LEGACY_FILENAMES.has(f))
      .filter((f) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(f));

    expect(offenders).toEqual([]);
  });

  it('führt die Alt-Ausnahmen namentlich, und sie existieren noch', () => {
    // Eine Ausnahmeliste, die auf nicht mehr vorhandene Dateien zeigt, ist
    // toter Ballast und verdeckt beim nächsten Lesen, was wirklich gilt.
    const present = new Set(migrationFiles());
    for (const legacy of LEGACY_FILENAMES) {
      expect(present.has(legacy), `Ausnahme ${legacy} existiert nicht mehr`).toBe(true);
    }
  });

  it('erkennt eine künstliche Dublette — Gegenprobe', () => {
    // Ohne diese Probe wäre nicht belegt, dass die Prüfung oben überhaupt
    // etwas findet. Sie läuft auf einer erfundenen Liste, nicht auf dem
    // Dateisystem — der Repo-Zustand bleibt unberührt.
    const kuenstlich = [
      '20260826000000_whatsapp_channel.sql',
      '20260826000000_restore_client_function_grants.sql',
      '20260827000000_etwas_anderes.sql',
    ];

    const seen = new Map<string, string[]>();
    for (const file of kuenstlich) {
      const version = versionOf(file);
      seen.set(version, [...(seen.get(version) ?? []), file]);
    }
    const duplicates = [...seen.entries()].filter(([, files]) => files.length > 1);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0][0]).toBe('20260826000000');
    expect(duplicates[0][1]).toHaveLength(2);
  });
});
