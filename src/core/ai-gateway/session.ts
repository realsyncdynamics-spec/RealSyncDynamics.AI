/**
 * @file session.ts
 * @description Sitzungstoken fuer Aufrufe an die Edge Function `ai-gateway`.
 *
 * Warum es diese Datei gibt: Bis zum 2026-09-08 sendete **jeder** Aufruf des
 * KI-Pfades den oeffentlichen Anon-Key als Bearer-Token. Der Gateway lief
 * damit zwar (der Anon-Key ist ein gueltiges Projekt-JWT, `verify_jwt` ist
 * erfuellt), sah aber niemanden: kein Nutzer, kein Mandant, keine Zurechnung.
 *
 * Die Folgen waren nicht theoretisch:
 *   - `limit.ai_calls_monthly`, `limit.ai_tokens_monthly` und
 *     `limit.llm_queries_monthly` stehen in `shared/pricing.ts`, waren am
 *     Gateway aber nicht durchsetzbar — es gab kein Subjekt, gegen das man
 *     haette pruefen koennen.
 *   - Durchgesetzt wurde ersatzweise nach IP. 50 Arbeitsplaetze hinter einer
 *     NAT-Adresse teilten sich einen Eimer, derselbe Kunde auf 50 Adressen
 *     bekam das Fuenfzigfache.
 *   - Ein Guthabenmodell (Token-Oekonomie) war damit nicht baubar.
 *
 * Diese Datei liefert das fehlende Stueck: das Token des angemeldeten
 * Nutzers, sofern es eines gibt.
 *
 * **Sie wirft nie.** Ein fehlgeschlagener Token-Abruf darf keinen KI-Aufruf
 * verhindern — der anonyme Pfad (Free Scan auf `/audit`) muss weiterlaufen,
 * und ein angemeldeter Nutzer soll bei einem Sitzungsfehler eine Antwort
 * bekommen statt einer Fehlermeldung. `null` heisst schlicht: anonym, also
 * genau das Verhalten von vor dieser Aenderung.
 */
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

/**
 * Das Zugriffstoken der laufenden Sitzung, oder `null` wenn niemand
 * angemeldet ist bzw. die Sitzung nicht ermittelbar war.
 */
export async function currentAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    // Bewusst still: siehe Dateikopf — anonym ist ein gueltiger Zustand,
    // kein Fehlerfall.
    return null;
  }
}
