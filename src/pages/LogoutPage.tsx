import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_TEXT,
} from '../components/landing/landing-theme';

/**
 * Check-out — real sign-out, then return to public `/`.
 * Route: /logout (alias /signout).
 */
export function LogoutPage() {
  const { logout, isAuthenticated, isLoading } = useSupabaseAuth();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (isLoading) return;
      try {
        if (isAuthenticated) {
          await logout();
        }
        if (!cancelled) {
          setDone(true);
          navigate('/', { replace: true });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Abmeldung fehlgeschlagen');
          setDone(true);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, logout, navigate]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6"
      style={{ backgroundColor: LANDING_BG, color: LANDING_TEXT }}
    >
      <p
        className="text-[10px] tracking-[.2em]"
        style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
      >
        CHECK-OUT
      </p>
      <h1 className="mt-3 text-xl font-medium">
        {error ? 'Abmeldung fehlgeschlagen' : done ? 'Abgemeldet' : 'Abmelden…'}
      </h1>
      <p className="mt-2 max-w-sm text-center text-sm" style={{ color: LANDING_MUTED }}>
        {error ?? 'Session wird beendet. Weiterleitung zur Startseite.'}
      </p>
      {error && (
        <Link
          to="/"
          className="mt-6 rounded-full px-5 py-2.5 text-[11px] font-semibold"
          style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
        >
          Zur Startseite
        </Link>
      )}
    </div>
  );
}
