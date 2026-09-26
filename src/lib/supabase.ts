import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from './supabaseUrl';
import { SPA_AUTH_OPTIONS, stripSensitiveAuthFromLocation } from './auth-session';

// URL und anon-Key werden zentral über `supabaseUrl.ts` aufgelöst. Beide Werte
// sind öffentlich (sie landen ohnehin im Bundle) und greifen auf die
// Produktions-Projektwerte zurück, falls `VITE_SUPABASE_URL` /
// `VITE_SUPABASE_ANON_KEY` in einem Deploy nicht gesetzt sind. Dadurch
// funktioniert die Anmeldung auch ohne gesetzte Frontend-Env-Variablen.
const url = getSupabaseUrl();
const anonKey = getSupabaseAnonKey();

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!cached) {
    cached = createClient(url, anonKey, {
      // PKCE: kein Implicit-#access_token. detectSessionInUrl liest ?code=
      // zuerst (initialize/getSession); erst danach Query/Hash säubern —
      // sonst ist der Code weg, bevor GoTrue tauscht.
      auth: SPA_AUTH_OPTIONS,
    });
    if (typeof window !== 'undefined') {
      void cached.auth.getSession().finally(() => {
        stripSensitiveAuthFromLocation();
      });
    }
  }
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

// Alias for compatibility with callers that expect createSupabaseClient
export function createSupabaseClient(): SupabaseClient {
  return getSupabase();
}
