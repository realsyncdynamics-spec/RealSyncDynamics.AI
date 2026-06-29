import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from './supabaseUrl';

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
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}
