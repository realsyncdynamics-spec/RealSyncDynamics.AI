/**
 * useFlowNav — zentraler Handler, um verstreute onClick-Logik zu ersetzen.
 *
 * Statt individueller Navigations-Callbacks navigiert jeder Button über seine
 * Flow-ID:
 *
 *   const flow = useFlowNav();
 *   <button onClick={() => flow.go('landing.startScan')}>Scan starten</button>
 *
 * Beispiele (siehe flowRoutes.ts):
 *   'landing.startScan'        → '/flow/start-scan'
 *   'landing.login'            → '/flow/login'
 *   'pricing.checkoutStarter'  → '/flow/checkout/starter'
 *   'scan.finished'            → '/flow/report'
 *   'checkout.success'         → '/flow/checkout-success'
 */
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { flowPath, getFlowStepById } from './flowRoutes';

export interface FlowNav {
  /** Navigiert zur Flow-Seite einer Flow-ID. */
  go: (flowId: string) => void;
  /** Navigiert direkt zu einem Pfad (interne Flow-Route oder App-Route). */
  goTo: (to: string) => void;
  /** Liefert den Ziel-Pfad zu einer Flow-ID (für `to`-Props von <Link>). */
  pathOf: (flowId: string) => string;
}

export function useFlowNav(): FlowNav {
  const navigate = useNavigate();

  const go = useCallback(
    (flowId: string) => {
      const step = getFlowStepById(flowId);
      if (!step) {
        // Unbekannte ID → nicht crashen, sondern auf Startseite lenken.
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn(`[flow] Unbekannte Flow-ID: "${flowId}"`);
        }
        navigate('/');
        return;
      }
      navigate(flowPath(flowId));
    },
    [navigate],
  );

  const goTo = useCallback((to: string) => navigate(to), [navigate]);

  const pathOf = useCallback((flowId: string) => flowPath(flowId), []);

  return useMemo<FlowNav>(() => ({ go, goTo, pathOf }), [go, goTo, pathOf]);
}
