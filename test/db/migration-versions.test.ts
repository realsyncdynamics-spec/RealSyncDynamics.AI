import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase', 'migrations');

/**
 * Zwei Migrationen mit derselben Version sind kein Schönheitsfehler, sondern
 * ein stiller Datenverlust.
 *
 * `supabase db push` führt Buch über Versionen, nicht über Dateien. Trägt eine
 * zweite Datei eine bereits verbuchte Version, gilt sie als erledigt und wird
 * **übersprungen** — ohne Fehler, ohne Warnung. Kein Drift-Guard schlägt an,
 * denn aus seiner Sicht fehlt nichts: Die Version steht ja im Ledger.
 *
 * Das ist dreimal passiert:
 *
 *   2026-08-24  #1131 und #1124 vergaben beide `20260826000000`. Fiel nur auf,
 *               weil der Deploy hart abbrach (`42710`, Trigger existiert).
 *   2026-09-01  Ein offener Zweig trug `20260901000000`, das inzwischen als
 *               `canonical_plan_catalog` verbucht war.
 *   2026-09-02  #1193 vergab `20260903050000` doppelt.
 *               `siteos_workflow_vocabulary` wurde nie angewandt — während
 *               `builder.ts` und `runtime-scan.ts` aus demselben PR bereits in
 *               die fehlenden Spalten schrieben. Gefunden wurde es erst durch
 *               eine Messung von Hand.
 *
 * Beim ersten Mal brach etwas laut. Beim zweiten und dritten Mal nicht — und
 * genau das ist der teure Fall. Diese Prüfung kostet nichts und hätte alle
 * drei gefunden.
 */
describe('Migrations-Versionen', () => {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();

  it('findet überhaupt Migrationen', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('vergibt jede Version genau einmal', () => {
    const nachVersion = new Map<string, string[]>();
    for (const file of files) {
      const version = file.split('_')[0];
      nachVersion.set(version, [...(nachVersion.get(version) ?? []), file]);
    }

    const doppelt = [...nachVersion.entries()]
      .filter(([, dateien]) => dateien.length > 1)
      .map(([version, dateien]) => `${version}: ${dateien.join('  +  ')}`);

    expect(
      doppelt,
      `Doppelt vergebene Migrations-Versionen — die zweite Datei wird beim Deploy\n` +
        `stillschweigend übersprungen. Die jüngere umbenennen, auf eine Version über\n` +
        `dem höchsten verbuchten Stand:\n${doppelt.join('\n')}`,
    ).toEqual([]);
  });

  it('benennt jede Datei nach dem Muster <version>_<beschreibung>.sql', () => {
    // Ein abweichender Name macht die Version unlesbar — und damit auch die
    // Prüfung oben wirkungslos, die sie am Unterstrich abschneidet.
    //
    // `00001_initial_schema.sql` ist die einzige Ausnahme: die allererste
    // Migration, im Ledger genauso als `00001` verbucht. Sie umzubenennen
    // hieße, eine verbuchte Version zu ändern — das darf nicht passieren.
    // Bewusst als exakter Dateiname und nicht als gelockertes Muster, damit
    // die Ausnahme nicht auf künftige kurze Versionen durchschlägt.
    const schief = files
      .filter((f) => f !== '00001_initial_schema.sql')
      .filter((f) => !/^\d{8,14}_[a-z0-9_]+\.sql$/.test(f));
    expect(schief, `Migrationen mit abweichendem Dateinamen:\n${schief.join('\n')}`).toEqual([]);
  });

  it('hält die Ausnahme für die erste Migration eng', () => {
    // Gegenprobe: Die Ausnahme gilt genau einer Datei, nicht jeder kurzen
    // Version. Wer sie später aufweitet, bricht hier.
    const muster = /^\d{8,14}_[a-z0-9_]+\.sql$/;
    expect(muster.test('00001_initial_schema.sql')).toBe(false);
    expect(muster.test('00002_irgendwas.sql')).toBe(false);
    expect(muster.test('20260904000400_agent_profiles_tenant_isolation.sql')).toBe(true);
    expect(files.filter((f) => !muster.test(f))).toEqual(['00001_initial_schema.sql']);
  });
});
