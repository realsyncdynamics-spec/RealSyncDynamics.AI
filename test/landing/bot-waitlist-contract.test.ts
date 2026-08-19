/**
 * Der Wertebereich der Wartelisten-Interessen steht an drei Stellen.
 *
 * ## Der Fehler, den dieser Test verhindert
 *
 * Das Formular bot „Bot-Laufzeit" an und sendete `use_case: 'bots'`. Die Edge
 * Function führte `bots` nicht in ihrer Allowlist und schrieb nach der Regel
 * „unbekannt → `other`" jede solche Anmeldung als „Etwas anderes" weg. Die
 * Datenbank hätte den Wert ebenfalls abgelehnt.
 *
 * Kein Aufruf schlug fehl, keine Fehlermeldung erschien — es verschwand nur
 * still die Information, welches Modul jemand wollte. Und zwar ausgerechnet
 * bei dem Modul, das als einziges noch nicht ausliefert und dessen Nachfrage
 * über die Reihenfolge entscheiden soll.
 *
 * ## Warum drei Ebenen geprüft werden
 *
 * Formular, Function und Datenbank führen denselben Wertebereich getrennt
 * voneinander. Zwei davon gleichzuhalten genügt nicht: Stimmt das Formular mit
 * der Function überein, aber nicht mit dem CHECK-Constraint, schlägt das
 * Insert fehl; stimmt es mit der Datenbank, aber nicht mit der Function, wird
 * still umgeschrieben. Nur alle drei zusammen ergeben einen Vertrag.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const salesLead = readFileSync(resolve(root, 'supabase/functions/sales-lead/index.ts'), 'utf8');
const migration = readFileSync(
  resolve(root, 'supabase/migrations/20260819000100_waitlist_bots_interest.sql'),
  'utf8'
);
const waitlistForm = readFileSync(
  resolve(root, 'src/components/landing/WaitlistForm.tsx'),
  'utf8'
);

/** Werte aus einem Array-Literal `['a', 'b', …]` ziehen. */
function valuesOf(source: string, pattern: RegExp): string[] {
  const match = source.match(pattern);
  if (!match) return [];
  return [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
}

describe('Wartelisten-Interessen: Formular, Function und Datenbank führen einen Wertebereich', () => {
  const formValues = [...waitlistForm.matchAll(/value:\s*'([a-z_]+)'/g)].map((m) => m[1]).sort();
  const functionValues = valuesOf(salesLead, /WAITLIST_INTERESTS\s*=\s*\[([^\]]*)\]/s);
  const migrationValues = [...(migration.match(/interest IN \(([^)]*)\)/s)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)]
    .map((m) => m[1])
    .sort();

  it('liest aus allen drei Quellen tatsächlich Werte', () => {
    // Ohne diese Zusicherung wäre ein kaputtes Muster ein grüner Test:
    // drei leere Listen sind trivialerweise gleich.
    expect(formValues.length).toBeGreaterThan(3);
    expect(functionValues.length).toBeGreaterThan(3);
    expect(migrationValues.length).toBeGreaterThan(3);
  });

  it('führt in allen drei Ebenen denselben Wertebereich', () => {
    expect(functionValues).toEqual(formValues);
    expect(migrationValues).toEqual(formValues);
  });

  it('kennt `bots` — der Wert, an dem es aufgefallen ist', () => {
    for (const [name, values] of [
      ['Formular', formValues],
      ['sales-lead', functionValues],
      ['Migration', migrationValues],
    ] as const) {
      expect(values, `${name} führt 'bots' nicht`).toContain('bots');
    }
  });

  it('schreibt Unbekanntes weiterhin auf `other` um', () => {
    // Die Rückfallregel bleibt richtig — sie war nie das Problem. Falsch war
    // nur, dass ein bekannter Wert nicht in der Liste stand.
    expect(salesLead).toContain("WAITLIST_INTERESTS.includes(interestRaw) ? interestRaw : 'other'");
    expect(functionValues).toContain('other');
  });
});
