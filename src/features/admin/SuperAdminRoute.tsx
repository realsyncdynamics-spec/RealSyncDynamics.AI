import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSupabaseAuth } from '../supabase/SupabaseAuthContext';
import { getSupabase } from '../../lib/supabase';

/**
 * Prüft `profiles.is_super_admin` für den angemeldeten Nutzer — dieselbe
 * Abfrage, die die Admin-Views einzeln ausführen. Server-RLS und die
 * Admin-RPCs (`is_platform_operator()`) bleiben die eigentliche Sperre;
 * dieser Guard verhindert das Rendern der Oberfläche für Nicht-Admins (WP11).
 */
export async function checkSuperAdmin(userId: string): Promise<boolean> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('is_super_admin')
    .eq('id', userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.is_super_admin);
}

interface CheckState {
  userId: string | null;
  allowed: boolean | null;
}

export function SuperAdminRoute({ children }: { children: ReactNode }) {
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
    void checkSuperAdmin(userId)
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
        data-testid="super-admin-loading"
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
        data-testid="super-admin-loading"
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

export default SuperAdminRoute;
