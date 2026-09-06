import { useSupabaseAuth, useSupabaseAuthOptional } from '../features/supabase/SupabaseAuthContext';

export function useAuth() {
  const auth = useSupabaseAuth();
  return {
    user: auth.user ? { id: auth.user.id, email: auth.user.email } : null,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
  };
}

/**
 * Anmeldezustand für Bausteine, die auch ohne Auth-Provider gerendert werden
 * (öffentliche Kopfzeile, Prerender, isolierte Tests). Ohne Provider lautet
 * die Antwort „nicht angemeldet, nichts lädt" — das ist genau der Zustand,
 * den eine öffentliche Seite ohnehin annimmt.
 */
export function useOptionalAuth() {
  const auth = useSupabaseAuthOptional();
  return {
    user: auth?.user ? { id: auth.user.id, email: auth.user.email } : null,
    isLoading: auth?.isLoading ?? false,
    isAuthenticated: auth?.isAuthenticated ?? false,
  };
}
