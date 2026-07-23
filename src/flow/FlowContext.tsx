/**
 * FlowContext — hält den Flow-Zustand und persistiert ihn in LocalStorage,
 * damit der Nutzer nach einem Reload den Kontext nicht verliert.
 *
 * Gespeichert werden u. a.: gewähltes Paket, gestarteter/abgeschlossener Scan,
 * Login-Absicht, Checkout-Status und der zuletzt besuchte Flow-Schritt.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { FlowStateEffect } from './flowRoutes';

export interface FlowState {
  scanDomain: string | null;
  scanStarted: boolean;
  scanCompleted: boolean;
  loginIntent: boolean;
  selectedPlan: string | null;
  checkoutStatus: 'idle' | 'started' | 'success' | 'cancelled';
  lastStepId: string | null;
  /** Liste bereits besuchter Flow-IDs (für einfache Verlaufsanzeige). */
  visited: string[];
  /** Timestamp when flow state was created (for 24h TTL). */
  createdAt?: number;
}

const STORAGE_KEY = 'rsd.flow.state.v1';
const FLOW_STATE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const DEFAULT_STATE: FlowState = {
  scanDomain: null,
  scanStarted: false,
  scanCompleted: false,
  loginIntent: false,
  selectedPlan: null,
  checkoutStatus: 'idle',
  lastStepId: null,
  visited: [],
};

function readStored(): FlowState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<FlowState>;

    // Check if flow state has expired (24h TTL)
    if (parsed.createdAt && Date.now() - parsed.createdAt > FLOW_STATE_TTL_MS) {
      // State has expired, return fresh default
      window.localStorage.removeItem(STORAGE_KEY);
      return DEFAULT_STATE;
    }

    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
}

interface FlowContextValue {
  state: FlowState;
  /** Wendet einen Teil-Zustand an (z. B. den `stateEffect` einer Flow-Seite). */
  applyEffect: (effect: FlowStateEffect | undefined) => void;
  /** Merkt den zuletzt besuchten Schritt und ergänzt den Verlauf. */
  markStep: (stepId: string) => void;
  /** Setzt den gesamten Flow-Zustand zurück. */
  reset: () => void;
}

const FlowContext = createContext<FlowContextValue | undefined>(undefined);

export function FlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlowState>(() => {
    const stored = readStored();
    // Set createdAt on first load if not set
    if (!stored.createdAt || stored === DEFAULT_STATE) {
      return { ...stored, createdAt: Date.now() };
    }
    return stored;
  });

  // Persistieren bei jeder Änderung.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stateWithTimestamp = {
        ...state,
        createdAt: state.createdAt || Date.now(),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithTimestamp));
    } catch {
      /* LocalStorage nicht verfügbar (Privatmodus) — Zustand bleibt in-memory. */
    }
  }, [state]);

  const applyEffect = useCallback((effect: FlowStateEffect | undefined) => {
    if (!effect) return;
    setState((prev) => {
      const next = { ...prev, ...effect };
      // Kein unnötiges Re-Render, wenn sich nichts ändert.
      const changed = (Object.keys(effect) as (keyof FlowStateEffect)[]).some(
        (k) => prev[k as keyof FlowState] !== effect[k],
      );
      return changed ? next : prev;
    });
  }, []);

  const markStep = useCallback((stepId: string) => {
    setState((prev) => {
      if (prev.lastStepId === stepId && prev.visited.includes(stepId)) return prev;
      const visited = prev.visited.includes(stepId)
        ? prev.visited
        : [...prev.visited, stepId];
      return { ...prev, lastStepId: stepId, visited };
    });
  }, []);

  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE, createdAt: Date.now() });
  }, []);

  const value = useMemo<FlowContextValue>(
    () => ({ state, applyEffect, markStep, reset }),
    [state, applyEffect, markStep, reset],
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

/**
 * Zugriff auf den Flow-Zustand. Fällt auf einen In-Memory-Default zurück, wenn
 * kein Provider vorhanden ist, damit einzelne Flow-Seiten auch isoliert (z. B.
 * in Tests) gerendert werden können.
 */
export function useFlow(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (ctx) return ctx;
  return {
    state: DEFAULT_STATE,
    applyEffect: () => {},
    markStep: () => {},
    reset: () => {},
  };
}
