/**
 * DemoModeProvider — verwaltet Demo-Workspace-Zustand und Read-Only-Enforcement.
 *
 * Wenn `isDemoMode=true`:
 * - PublicWorkspacePreview zeigt DemoAI GmbH-Daten
 * - Alle /app/* Routes werden read-only
 * - Aktionen führen zu Registrierungs-Prompt statt Ausführung
 */
import React, { createContext, useState, useContext } from 'react';
import { DEMO_AI_GMBH, DemoWorkspace } from '../../lib/demo/demoAiGmbhFixture';

interface DemoContextType {
  isDemoMode: boolean;
  demoWorkspace: DemoWorkspace;
  setDemoMode: (enabled: boolean) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setDemoMode] = useState(false);

  return (
    <DemoContext.Provider
      value={{
        isDemoMode,
        demoWorkspace: DEMO_AI_GMBH,
        setDemoMode,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemoMode must be used within DemoModeProvider');
  }
  return context;
}

/**
 * Hook zum Sperren von Aktionen in Demo-Mode.
 * Gibt `null` zurück wenn nicht in Demo-Mode, ansonsten einen Prompt-Handler.
 */
export function useActionBlockerInDemo() {
  const { isDemoMode } = useDemoMode();
  if (!isDemoMode) return null;

  return {
    block: (action: string) => {
      const message = `Diese Aktion („${action}") ist in der Demo-Vorschau gesperrt. `;
      const ctaText = `${message}Registrieren Sie sich kostenlos um die volle Governance OS zu nutzen.`;
      return {
        isBlocked: true,
        message: ctaText,
        href: '/welcome?source=demo-action-blocked',
      };
    },
  };
}
