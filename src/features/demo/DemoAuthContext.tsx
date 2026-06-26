import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface DemoUser {
  id: string;
  email: string;
  name: string;
}

interface DemoAuthContextType {
  user: DemoUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
}

const DemoAuthContext = createContext<DemoAuthContextType | null>(null);

const DEMO_AUTH_KEY = 'demo_auth_user';
const DEMO_CREDENTIALS = {
  email: 'test@example.com',
  password: 'password123',
};

export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DEMO_AUTH_KEY);
      if (stored) {
        const userData = JSON.parse(stored);
        setUser(userData);
      }
    } catch (e) {
      console.error('Failed to load auth state', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Mock auth validation
    if (email === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) {
      const userData: DemoUser = {
        id: 'user_demo_001',
        email: email,
        name: 'Demo User',
      };
      setUser(userData);
      try {
        localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(userData));
      } catch (e) {
        console.error('Failed to save auth state', e);
      }
      return;
    }
    throw new Error('Invalid credentials');
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    try {
      localStorage.removeItem(DEMO_AUTH_KEY);
    } catch (e) {
      console.error('Failed to clear auth state', e);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    // Mock registration - just logs in
    const userData: DemoUser = {
      id: `user_${Date.now()}`,
      email: email,
      name: name,
    };
    setUser(userData);
    try {
      localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(userData));
    } catch (e) {
      console.error('Failed to save auth state', e);
    }
  }, []);

  return (
    <DemoAuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        login,
        logout,
        register,
      }}
    >
      {children}
    </DemoAuthContext.Provider>
  );
}

export function useDemoAuth() {
  const context = useContext(DemoAuthContext);
  if (!context) {
    throw new Error('useDemoAuth must be used within DemoAuthProvider');
  }
  return context;
}
