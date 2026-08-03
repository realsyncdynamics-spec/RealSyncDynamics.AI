import type { ModuleId, PermissionKey, PlanId, PlanLimits } from '@/shared/pricing';

export type ModuleStatus = 'live' | 'beta' | 'roadmap';

/** Plan-Bezeichner des Workspace — identisch mit der Pricing-SSoT. */
export type Plan = PlanId;

/**
 * Zugriffsregel eines Navigations-Moduls. Immer eine Ableitung aus der
 * Pricing-SSoT — niemals eine eigene Plan-Liste.
 */
export type ModuleGate =
  /** Für jeden Plan sichtbar (Konto-, Übersichts- und Free-Audit-Flächen). */
  | { kind: 'all' }
  /** Das Modul muss im Plan freigeschaltet sein. */
  | { kind: 'module'; module: ModuleId }
  /** Die Berechtigung muss im Plan gesetzt sein. */
  | { kind: 'permission'; permission: PermissionKey }
  /** Das numerische Limit muss mindestens `min` betragen (-1 = unbegrenzt zählt immer). */
  | { kind: 'limit'; limit: keyof PlanLimits; min: number };

export interface GovernanceModule {
  id: string;
  label: string;
  icon: string;
  route: string;
  status: ModuleStatus;
  /**
   * Zugriffsregel. Die konkrete Plan-Liste wird über `plansForModule()`
   * aus der SSoT berechnet und nicht hier gepflegt.
   */
  gate: ModuleGate;
  description: string;
}
