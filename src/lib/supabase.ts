import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let cached: SupabaseClient | null = null;

// ── „Angemeldet bleiben" ─────────────────────────────────────────────────────
// Die Auswahl wird selbst dauerhaft in localStorage gehalten (überlebt das
// Schließen des Tabs), damit der Storage-Adapter beim nächsten Lesen weiß,
// wohin die Session gehört. Default: angemeldet bleiben (true).
const REMEMBER_KEY = 'rsd_auth_remember';

export function setRememberMe(remember: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false');
  } catch {
    /* localStorage nicht verfügbar (z.B. privater Modus) — ignorieren */
  }
}

function rememberMe(): boolean {
  try {
    // Nur explizites "false" deaktiviert dauerhafte Persistenz.
    return localStorage.getItem(REMEMBER_KEY) !== 'false';
  } catch {
    return true;
  }
}

// Hybrid-Storage für Supabase-Auth:
//   „Angemeldet bleiben" an  → localStorage   (Session überlebt Browser-Neustart)
//   „Angemeldet bleiben" aus → sessionStorage (Session endet mit dem Tab)
// Lesen fällt auf den jeweils anderen Store zurück, damit eine bestehende
// Session beim Umschalten nicht „verschwindet".
const hybridStorage = {
  getItem(key: string): string | null {
    try {
      const primary = rememberMe() ? localStorage : sessionStorage;
      const secondary = rememberMe() ? sessionStorage : localStorage;
      return primary.getItem(key) ?? secondary.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      const primary = rememberMe() ? localStorage : sessionStorage;
      const secondary = rememberMe() ? sessionStorage : localStorage;
      primary.setItem(key, value);
      // Stale Kopie im anderen Store entfernen (verhindert „Zombie"-Sessions).
      secondary.removeItem(key);
    } catch {
      /* Storage nicht verfügbar — ignorieren */
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
      // Beim Abmelden (Supabase ruft removeItem für den Auth-Token-Key) auch
      // die „Angemeldet bleiben"-Präferenz zurücksetzen — sonst erbt der
      // nächste Nutzer auf einem geteilten Browser die alte Einstellung.
      localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* ignorieren */
    }
  },
};

export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase nicht konfiguriert: VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in .env.local setzen.',
    );
  }
  if (!cached) {
    cached = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? hybridStorage : undefined,
      },
    });
  }
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}
