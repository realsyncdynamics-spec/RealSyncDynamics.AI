import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSupabaseAuth } from '../supabase/SupabaseAuthContext';
import { getSupabase } from '../../lib/supabase';

/**
 * Guard für Operator-Oberflächen (Lead-PII). Die eigentliche Sperre bleibt
 * die Datenbank (`is_platform_operator()` in den Admin-RPCs und Policies).
 * Dieser Guard verhindert nur das Rendern der Oberfläche.
 *
 * Ohne Sitzung → /welcome?next=…
 * Angemeldet, aber kein Operator → /app/dashboard
 * (gleiches Muster wie SuperAdminRoute, Prüfung über RPC statt Profilspalte).
 */
export async function checkPlatformOperator(): Promise<boolean> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('is_platform_operator');
  if (error) return false;
  return Boolean(data);
}

interface CheckState {
  userId: string | null;
  allowed: boolean | null;
}

export function OperatorRoute({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useSupabaseAuth();
  const location = useLocation();
  const [state, setState] = useState<CheckState>({ userId: null, allowed: null });

  const userId = user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setState({ userId: null, allowed: null });
      return;
    }
    void checkPlatformOperator()
      .catch(() => false)
      .then((allowed) => {
        if (!cancelled) setState({ userId, allowed });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (isLoading) {
    return (
      <div
        data-testid="operator-route-loading"
        className="min-h-screen flex items-center justify-center bg-obsidian-950 text-titanium-400"
      >
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Sitzung wird geprüft" />
      </div>
    );
  }

  if (!isAuthenticated || !userId) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/welcome?next=${encodeURIComponent(next)}`} replace />;
  }

  if (state.userId !== userId || state.allowed === null) {
    return (
      <div
        data-testid="operator-route-loading"
        className="min-h-screen flex items-center justify-center bg-obsidian-950 text-titanium-400"
      >
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Berechtigung wird geprüft" />
      </div>
    );
  }

  if (!state.allowed) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
}

export default OperatorRoute;
