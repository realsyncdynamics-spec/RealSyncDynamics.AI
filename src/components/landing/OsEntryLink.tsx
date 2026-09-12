/**
 * Auth-aware entry into an authenticated OS surface.
 * Logged-in users go straight to `to`; others land on `/welcome?next=…`.
 * Safe outside SupabaseAuthProvider (defaults to public → welcome).
 */
import { Link } from 'react-router-dom';
import { useContext, type CSSProperties, type ReactNode } from 'react';
import { SupabaseAuthContext } from '../../features/supabase/SupabaseAuthContext';

export function osEntryPath(target: string, isAuthenticated: boolean): string {
  if (isAuthenticated) return target;
  return `/welcome?next=${encodeURIComponent(target)}`;
}

function useOptionalAuth(): { isAuthenticated: boolean; isLoading: boolean } {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) return { isAuthenticated: false, isLoading: false };
  return { isAuthenticated: ctx.isAuthenticated, isLoading: ctx.isLoading };
}

export function OsEntryLink({
  to,
  children,
  className,
  style,
  onClick,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  const { isAuthenticated, isLoading } = useOptionalAuth();
  const href = isLoading ? to : osEntryPath(to, isAuthenticated);
  return (
    <Link to={href} className={className} style={style} onClick={onClick}>
      {children}
    </Link>
  );
}

export { useOptionalAuth };
