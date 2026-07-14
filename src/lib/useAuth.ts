import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';

export function useAuth() {
  const auth = useSupabaseAuth();
  return {
    user: auth.user ? { id: auth.user.id, email: auth.user.email } : null,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
  };
}
