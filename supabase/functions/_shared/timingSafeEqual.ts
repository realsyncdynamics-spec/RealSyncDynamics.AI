// timingSafeEqual — konstantzeitiger String-Vergleich für Secrets.
//
// Bewusst eine eigene Datei ohne Deno-Imports: `_shared/auth.ts` importiert
// `jsr:@supabase/supabase-js@2`, und dieser Specifier ist ausserhalb von Deno
// nicht auflösbar. `tsconfig.json` schliesst `supabase/functions` zwar aus —
// aber ein Import aus `test/` zieht die Datei trotzdem in das TS-Programm, und
// der Typecheck bricht dann an `jsr:`.
//
// Deshalb die Hausregel, an der sich auch report.ts, findings.ts, hash.ts,
// gateway.ts und redact.ts halten: was ein Test importiert, bleibt Deno-frei.
// So lässt sich die Funktion gegen denselben Code prüfen, der in Produktion
// läuft, statt gegen eine Kopie.

/**
 * Vergleicht zwei Strings in konstanter Zeit. Verhindert, dass die
 * Antwortzeit verrät, wie viel eines Tokens korrekt erraten wurde.
 *
 * Nicht für Passwort-Hashing gedacht — nur für den Vergleich von Secrets
 * gleicher Länge (Service-Role-Key, Vault-Token).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
