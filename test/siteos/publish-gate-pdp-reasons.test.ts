// Die Begründungen des PDP müssen als Text in den Prüfpfad, nicht als Objekt.
//
// ## Der Befund, den diese Datei festnagelt
//
// `consultPolicyEngine` reichte `result.reasons` unverändert durch:
//
//     reasons: Array.isArray(result.reasons) ? result.reasons : []
//
// Der PDP liefert dort `DecisionReason`-**Objekte** (`_shared/pdp/core.ts`,
// Feld `text_de`), während `PolicyEngineState.reasons` in
// `packages/siteos-core/src/publish/gate.ts` als `string[]` deklariert ist
// und im Typkommentar ausdrücklich „seine deutschen Begründungen" heisst.
//
// Über `policyTrail()` landen genau diese Werte in `policy_reasons` (JSONB).
// Der Kommentar an dieser Funktion benennt die Tragweite selbst: sie ist
// „die einzige Stelle, an der der Zustand des PEP zu einer dauerhaften
// Aussage wird. Wer sie ändert, ändert, was später belegbar ist."
//
// Es stürzt nichts ab, und das macht es teuer: Der Eintrag im Prüfpfad
// entsteht, er ist nur unlesbar. Ein Nachweis, den niemand lesen kann, ist
// als Nachweis wertlos.
//
// Zwei andere PEPs bilden an derselben Grenze bereits richtig ab —
// `_shared/pdp/m365event.ts` und `_shared/pdp/botmessage.ts`, beide mit
// `result.reasons.map((r) => r.text_de)`. Hier fehlte es als einziger Stelle.
//
// ## Warum am Quelltext
//
// Dieselbe Bauart und derselbe Grund wie in
// `publish-gate-backend-source.test.ts`: Die Edge Function braucht Deno und
// eine Datenbank. Dazu kommt hier ein zweiter Grund, der schwerer wiegt —
// `tsconfig.json` schliesst `supabase/functions` aus, und Supabase deployt
// per esbuild ohne Typprüfung. Es gibt also keinen Typprüfer im regulären
// Lauf, der `DecisionReason[]` gegen `string[]` beanstanden würde. Was ohne
// Deno und Datenbank prüfbar bleibt, ist die Zuordnung im Code selbst.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const handlerSource = readFileSync(
  resolve(__dirname, '../../supabase/functions/siteos/handlers/publish-gate.ts'),
  'utf8',
);

const m365Source = readFileSync(
  resolve(__dirname, '../../supabase/functions/_shared/pdp/m365event.ts'),
  'utf8',
);

const botMessageSource = readFileSync(
  resolve(__dirname, '../../supabase/functions/_shared/pdp/botmessage.ts'),
  'utf8',
);

const gateTypeSource = readFileSync(
  resolve(__dirname, '../../packages/siteos-core/src/publish/gate.ts'),
  'utf8',
);

describe('Publish Gate — PDP-Begründungen im Prüfpfad', () => {
  it('zieht text_de heraus, statt das DecisionReason-Objekt durchzureichen', () => {
    expect(handlerSource).toMatch(/result\.reasons[\s\S]{0,200}text_de/);
  });

  it('sperrt die alte Fassung aus — Gegenprobe', () => {
    // Genau die Zeile, die den Befund erzeugt hat. Sie sieht harmlos aus und
    // ist es nicht: Sie erfüllt den Typ nicht und bricht trotzdem nichts.
    expect(handlerSource).not.toMatch(
      /reasons:\s*Array\.isArray\(result\.reasons\)\s*\?\s*result\.reasons\s*:\s*\[\]/,
    );
  });

  it('behandelt die Grenze wie die beiden anderen PEPs', () => {
    // Wenn ein späterer Umbau `text_de` an einer dieser Stellen entfernt,
    // soll das hier auffallen und nicht still auseinanderlaufen: Drei
    // Kanäle, dieselbe Grenze, dieselbe Zuordnung.
    expect(m365Source).toContain('text_de');
    expect(botMessageSource).toContain('text_de');
  });

  it('hält fest, dass der Zieltyp string[] ist', () => {
    // Die Begründung für die Zuordnung steht im Typ. Ändert jemand ihn auf
    // ein Objekt, ist dieser Test die Stelle, an der die Entscheidung
    // sichtbar wird — statt dass die Zuordnung stillschweigend falsch wird.
    expect(gateTypeSource).toMatch(/engine:\s*'consulted'[\s\S]{0,160}reasons:\s*string\[\]/);
  });
});
