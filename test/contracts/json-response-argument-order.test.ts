/**
 * `jsonResponse()` bekommt den Body zuerst, den Status danach.
 *
 * ## Warum ein Guard und nicht elf Einzeltests
 *
 * Die Signatur lautet `jsonResponse(body, status = 200, headers)`. Wer
 * `jsonResponse(200, payload)` schreibt, übergibt die Zahl als Body und die
 * Nutzlast als Status. `new Response()` wirft daraufhin
 *
 *     RangeError: init["status"] must be in the range of 200 to 599
 *
 * Das ist der teuerste Fehlerfall, den eine Edge Function haben kann: Er
 * tritt in der LETZTEN Zeile des Erfolgspfads auf. Datensatz geschrieben,
 * Deployment ausgelöst, Assessment erzeugt, Erfolg protokolliert — und dann
 * fängt der `catch`-Block den RangeError und antwortet mit 500. Der Aufrufer
 * sieht einen Fehlschlag für etwas, das tatsächlich passiert ist, und ein
 * Retry macht es ein zweites Mal.
 *
 * Gemessen am 2026-09-20 auf `main`: elf Aufrufstellen in neun Functions.
 * Ein Test je Function hätte die zehnte nicht gefunden und die zwölfte nicht
 * verhindert. Deshalb prüft dieser Test den gesamten Function-Baum.
 *
 * Fällt er: Argumente tauschen. `jsonResponse(payload, 200)`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const FUNCTIONS = join(ROOT, 'supabase', 'functions');

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsFiles(full);
    return /\.ts$/.test(entry) ? [full] : [];
  });
}

/** Jede Stelle, an der das erste Argument eine Zahl ist. */
function reversedCalls(): string[] {
  const hits: string[] = [];
  for (const file of tsFiles(FUNCTIONS)) {
    readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
      // `jsonResponse(` gefolgt von einer Zahl — also dem Status an der
      // Stelle, an der der Body stehen muss.
      if (/\bjsonResponse\(\s*\d/.test(line)) {
        hits.push(`${relative(ROOT, file)}:${i + 1} → ${line.trim().slice(0, 80)}`);
      }
    });
  }
  return hits;
}

describe('jsonResponse — Body zuerst, Status danach', () => {
  it('findet die Aufrufe ueberhaupt (sonst prueft der Test nichts)', () => {
    // Ohne diese Zusicherung bliebe der Test auch dann gruen, wenn der
    // Dateibaum nicht mehr stimmt und gar nichts mehr gelesen wird.
    const alle = tsFiles(FUNCTIONS).filter((f) =>
      readFileSync(f, 'utf-8').includes('jsonResponse('),
    );
    expect(alle.length, 'keine Function ruft jsonResponse auf — Pfad pruefen').toBeGreaterThan(20);
  });

  it('keine Function uebergibt den Status als erstes Argument', () => {
    expect(
      reversedCalls(),
      'jsonResponse(status, body) wirft RangeError und wird zu 500 — nachdem die Arbeit getan ist.',
    ).toEqual([]);
  });

  it('die Signatur ist noch die, auf die dieser Guard sich stuetzt', () => {
    // Wuerde jemand die Reihenfolge in `gateway.ts` umdrehen, waere dieser
    // Guard ab sofort genau falsch herum. Deshalb haengt er an der Quelle.
    const gateway = readFileSync(join(FUNCTIONS, '_shared', 'gateway.ts'), 'utf-8');
    expect(gateway).toContain('export function jsonResponse(body: unknown, status = 200');
  });
});
