import React, { createContext, useContext, useState, useEffect } from 'react';

export type GovernanceEnvironment = 'production' | 'staging' | 'development' | 'testing';

const STORAGE_KEY = 'rsd_governance_environment';

interface Ctx {
  environment: GovernanceEnvironment;
  setEnvironment: (env: GovernanceEnvironment) => void;
}

const EnvironmentCtx = createContext<Ctx>({ environment: 'production', setEnvironment: () => {} });

export function EnvironmentProvider({ children }: { children: React.ReactNode }) {
  const [environment, setEnvState] = useState<GovernanceEnvironment>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as GovernanceEnvironment | null;
      if (stored && ['production','staging','development','testing'].includes(stored)) return stored;
    } catch { /* ignore */ }
    return 'production';
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, environment); } catch { /* ignore */ }
  }, [environment]);

  return (
    <EnvironmentCtx.Provider value={{ environment, setEnvironment: setEnvState }}>
      {children}
    </EnvironmentCtx.Provider>
  );
}

export const useEnvironment = () => useContext(EnvironmentCtx);

export const ENV_LABEL: Record<GovernanceEnvironment, string> = {
  production: 'production',
  staging:    'staging',
  development:'dev',
  testing:    'test',
};

export const ENV_CLS: Record<GovernanceEnvironment, string> = {
  production:  'border-emerald-500/60 bg-emerald-500/10 text-emerald-200',
  staging:     'border-amber-500/60 bg-amber-500/10 text-amber-200',
  development: 'border-sky-500/60 bg-sky-500/10 text-sky-200',
  testing:     'border-titanium-700 bg-titanium-800/30 text-titanium-300',
};
