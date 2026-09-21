import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSupabaseAuth } from '../supabase/SupabaseAuthContext';
import {
  resolveCustomerDestination,
  journeyModeFromEnv,
} from '../../core/journey/resolveCustomerDestination';

/**
 * AppGate — Auth-Guard fuer die authentifizierte App-Flaeche (/app/*).
 *
 * Wer nicht eingeloggt ist, wird auf /welcome umgeleitet — mit
 * ?next=<Zielpfad>, damit Welcome.tsx nach erfolgreichem Login exakt
 * dorthin zurueckspringt (das ?next=-Handling existiert in Welcome.tsx).
 *
 * Waehrend die Session initial aufgeloest wird (isLoading), rendern wir
 * einen ruhigen Ladezustand — statt kurz die Login-Weiterleitung zu blitzen
 * und einen bereits authentifizierten Nutzer faelschlich auszusperren.
 *
 * Die Entscheidung selbst faellt seit diesem Schnitt NICHT mehr hier,
 * sondern in `resolveCustomerDestination` — der einen Stelle, an der
 * bestimmt wird, wohin ein Kunde gehoert. AppGate bringt den Zustand mit
 * und fuehrt das Ergebnis aus.
 *
 * ⚠️ Der frueher hier stehende Kommentar versprach "Onboarding-First-Routing
 * (Checkout → Onboarding → Dashboard)". Das traf nicht zu: geprueft wurde
 * ausschliesslich `isAuthenticated`. Der Satz ist entfernt, weil er eine
 * Zusage beschrieb, die der Code nicht einloest.
 *
 * Der Resolver laeuft hier im Vorgabemodus `off` und wertet damit genau
 * die Auth-Sprosse aus — das Verhalten ist unveraendert. Die uebrigen
 * Sprossen (kein Tenant, Onboarding offen, Checkout offen) sind im
 * Resolver implementiert und geprueft, aber AppGate bringt die dafuer
 * noetigen Daten bewusst noch nicht mit: Tenant, Abo und
 * Onboarding-Fortschritt zu laden waere eine zusaetzliche Abfrage bei
 * jedem Aufruf von /app/*, und eine Weiterleitung nach /app/onboarding
 * waere eine Funktionsaenderung an Bestehendem (CLAUDE.md §10.3,
 * fragepflichtig). Beides gehoert in einen eigenen Schnitt.
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

  const destination = resolveCustomerDestination(
    {
      authenticated: isAuthenticated,
      intendedPath: `${location.pathname}${location.search}`,
    },
    journeyModeFromEnv(import.meta.env?.VITE_JOURNEY_RESOLVER),
  );

  if (destination.kind === 'redirect') {
    return <Navigate to={destination.to} replace />;
  }

  return <>{children}</>;
}

export default AppGate;
