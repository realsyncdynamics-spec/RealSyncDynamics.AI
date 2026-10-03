import { postEdgeFunction } from '../../lib/edgeFunction';

/**
 * Startet die kartenlose 14-Tage-Testphase für Growth — als Upgrade aus dem
 * kostenlosen Konto heraus, nicht mehr automatisch bei der Registrierung
 * (E-F6, `.claude/os-funnel/PLAN.md`).
 *
 * Die Edge Function `create-trial-subscription` prüft die Mitgliedschaft
 * selbst und legt keine Testphase über ein laufendes Abo. Ein zweiter Aufruf
 * liefert denselben Zustand (`alreadyExisted`), keinen Fehler.
 */
export interface StartGrowthTrialResult {
  success?: boolean;
  alreadyExisted?: boolean;
  trialEnd?: string | null;
}

export function startGrowthTrial(tenantId: string | null): Promise<StartGrowthTrialResult> {
  const tenant = tenantId ? { tenantId } : {};
  return postEdgeFunction<StartGrowthTrialResult>('create-trial-subscription', { planKey: 'growth', ...tenant });
}
