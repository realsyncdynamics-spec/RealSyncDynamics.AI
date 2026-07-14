/**
 * DemoTourContext — verwaltet den Zustand des Demo-Tour-Flows.
 *
 * Verfolgt:
 * - Tour-Schritt (start, signup, checkout, dashboard)
 * - Demo-Benutzer-Daten (E-Mail, Unternehmen)
 * - Demo-Mode-Aktivierung durchgehend
 */
import React, { createContext, useContext, useState } from 'react';

export interface DemoTourState {
  step: 'start' | 'signup' | 'checkout' | 'dashboard';
  demoEmail: string;
  demoCompany: string;
  demoUserName: string;
}

interface DemoTourContextType {
  tourState: DemoTourState;
  setTourStep: (step: DemoTourState['step']) => void;
  setDemoUserData: (email: string, company: string, userName: string) => void;
  resetTour: () => void;
}

const DemoTourContext = createContext<DemoTourContextType | undefined>(undefined);

const initialState: DemoTourState = {
  step: 'start',
  demoEmail: '',
  demoCompany: '',
  demoUserName: '',
};

export function DemoTourProvider({ children }: { children: React.ReactNode }) {
  const [tourState, setTourState] = useState<DemoTourState>(initialState);

  const setTourStep = (step: DemoTourState['step']) => {
    setTourState((prev) => ({ ...prev, step }));
  };

  const setDemoUserData = (email: string, company: string, userName: string) => {
    setTourState((prev) => ({
      ...prev,
      demoEmail: email,
      demoCompany: company,
      demoUserName: userName,
    }));
  };

  const resetTour = () => {
    setTourState(initialState);
  };

  return (
    <DemoTourContext.Provider
      value={{
        tourState,
        setTourStep,
        setDemoUserData,
        resetTour,
      }}
    >
      {children}
    </DemoTourContext.Provider>
  );
}

export function useDemoTour() {
  const context = useContext(DemoTourContext);
  if (!context) {
    throw new Error('useDemoTour must be used within DemoTourProvider');
  }
  return context;
}
