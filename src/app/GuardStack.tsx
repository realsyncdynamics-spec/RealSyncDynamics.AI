/**
 * Führt den Guard-Stapel einer Register-Route aus.
 * Auth-Fehler gehen nach /welcome. Mandant, Rolle und Plan bleiben auf
 * der Seite und zeigen die Sperre, statt die Journey umzubauen.
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTenant } from '../core/access/TenantProvider';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import { evaluateGuard, type RouteGuard } from './guards';

export function GuardStack({ guard, children }: { guard: RouteGuard; children: ReactNode }) {
  const { isAuthenticated, isLoading } = useSupabaseAuth();
  const tenant = useTenant();
  const location = useLocation();

  if (isLoading || tenant.loading) {
    return <p className="app-shell__status">Sitzung wird geprüft …</p>;
  }

  const decision = evaluateGuard(guard, {
    authenticated: isAuthenticated,
    tenantId: tenant.activeTenantId,
    role: tenant.role,
    plan: tenant.plan,
  });

  if (decision.ok) return <>{children}</>;

  if (decision.failure === 'auth') {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/welcome?next=${encodeURIComponent(next)}`} replace />;
  }

  const copy = {
    tenant: 'Kein Mandant ausgewählt.',
    role: 'Die Rolle dieses Mandanten reicht für den Bereich nicht.',
    plan: 'Der Plan dieses Mandanten enthält den Bereich nicht.',
  } as const;

  return (
    <section className="app-shell__denied" role="alert">
      <p>{copy[decision.failure]}</p>
      <p className="app-shell__meta">Sprosse {decision.failure}</p>
    </section>
  );
}
