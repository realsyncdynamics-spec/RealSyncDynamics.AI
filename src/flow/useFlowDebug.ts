/**
 * useFlowDebug — Development hook zum Debuggen der Flow-Navigation.
 *
 * In Entwicklung (`import.meta.env.DEV`):
 * - Zeigt den aktuellen Flow-State in der Console
 * - Validiert die aktuelle Seite
 * - Warnt vor ungültigen Actions
 *
 * Deaktiviert sich automatisch in Production.
 */

import { useEffect } from 'react';
import { useFlow } from './FlowContext';
import {
  validateFlowStepActions,
  validateRouting,
  generateRoutingReport,
} from './RoutingValidator';
import type { FlowStep } from './flowRoutes';

interface FlowDebugInfo {
  stepId: string;
  state: ReturnType<typeof useFlow>['state'];
  validationErrors: string[];
}

export function useFlowDebug(step: FlowStep): FlowDebugInfo | null {
  const { state } = useFlow();

  useEffect(() => {
    // Nur in Development-Modus aktiv
    if (!import.meta.env.DEV) return;

    const validation = validateFlowStepActions(step.id);

    // Beim App-Start: vollständige Validierung
    if (step.id === 'landing.startScan') {
      const report = generateRoutingReport();
      console.group('%c🛣️ FLOW ROUTING INFRASTRUCTURE', 'color: #0F766E; font-weight: bold');
      console.log(report);
      console.groupEnd();
    }

    // Auf jeder Seite: diese Seite validieren
    if (!validation.valid) {
      console.warn(`⚠️ Invalid actions on step ${step.id}:`, validation.invalidActions);
    }

    // State loggen
    console.debug(`📍 FlowStep: ${step.id}`, {
      title: step.title,
      stage: step.stage,
      state,
      hasStateEffect: !!step.stateEffect,
    });
  }, [step.id, step.title, step.stage, state]);

  return {
    stepId: step.id,
    state,
    validationErrors: validateFlowStepActions(step.id).invalidActions,
  };
}

/**
 * Development-Utility: Gibt den Routing-Report in der Console aus.
 * Aufruf in Browser DevTools: window.__debugFlow?.printReport()
 */
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).__debugFlow = {
    printReport: () => {
      const report = generateRoutingReport();
      console.log(report);
    },
    validateAll: () => {
      const result = validateRouting();
      return {
        valid: result.isValid,
        errors: result.errors,
        warnings: result.warnings,
        stats: result.stats,
      };
    },
  };
}
