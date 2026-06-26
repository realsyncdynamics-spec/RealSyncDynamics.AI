import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSupabaseAuth } from '../supabase/SupabaseAuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useSupabaseAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian-950 text-titanium-400">
        Lade …
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/demo-login" replace />;
  }

  return <>{children}</>;
}
