import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSupabaseAuth } from '../supabase/SupabaseAuthContext';

/**
 * AppGate — Auth-Guard fuer die authentifizierte App-Flaeche (/app/*).
 *
 * Onboarding-First-Routing (Checkout → Onboarding → Dashboard):
 * Wer nicht eingeloggt ist, wird auf /welcome umgeleitet — mit
 * ?next=<Zielpfad>, damit Welcome.tsx nach erfolgreichem Login bzw.
 * abgeschlossenem Onboarding exakt dorthin zurueckspringt
 * (Login-Ruecksprung; das ?next=-Handling existiert bereits in Welcome.tsx).
 *
 * Waehrend die Session initial aufgeloest wird (isLoading), rendern wir
 * einen ruhigen Ladezustand — statt kurz die Login-Weiterleitung zu blitzen
 * und einen bereits authentifizierten Nutzer faelschlich auszusperren.
 */
export function AppGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useSupabaseAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian-950 text-titanium-400">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Sitzung wird geprueft" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/welcome?next=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children}</>;
}

export default AppGate;
