import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '../supabase/SupabaseAuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Auth guard for nested app routes. Unauthenticated users go to the
 * canonical /welcome gate with ?next= resume (not the demo password page).
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useSupabaseAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian-950 text-titanium-400">
        Lade …
      </div>
    );
  }

  if (!isAuthenticated) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/welcome?next=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children}</>;
}
