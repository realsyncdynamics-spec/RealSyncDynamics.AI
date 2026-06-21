import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createClient, Session, User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
}

interface SupabaseAuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  session: Session | null;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | null>(null);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from Supabase session
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (currentSession?.user) {
          setSession(currentSession);
          setUser({
            id: currentSession.user.id,
            email: currentSession.user.email || '',
          });
        }
      } catch (e) {
        console.error('Failed to initialize auth', e);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (currentSession?.user) {
        setSession(currentSession);
        setUser({
          id: currentSession.user.id,
          email: currentSession.user.email || '',
        });
      } else {
        setSession(null);
        setUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session?.user) {
        setSession(data.session);
        setUser({
          id: data.session.user.id,
          email: data.session.user.email || '',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.session?.user) {
        setSession(data.session);
        setUser({
          id: data.session.user.id,
          email: data.session.user.email || '',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: user !== null,
        login,
        logout,
        register,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  }
  return context;
}
