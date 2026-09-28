/**
 * Navigations-Schlösser aus den wirksamen Entitlements des Mandanten
 * (`tenant_entitlements` über `useTenant().hasFeature`) — dieselbe Quelle
 * und dieselbe Randfall-Logik wie `RouteEntitlementGate`.
 *
 * ## Warum
 *
 * Bis P0 (25.09.2026) entschied die Seitenleiste über `plan.modules`
 * (`canAccessModule`), die Routensperre über Entitlement-Keys. Folgen beim
 * Free-Mandanten: „KI-Systeme“ trug ein Schloss, obwohl der Server
 * `governance.ai_register` gewährt; „Enforcement“ trug keines, obwohl die
 * Route `policy.packs` verlangt und den Sperrbildschirm zeigt.
 *
 * ## Regeln
 *
 * 1. Benötigte Keys = explizite Keys des Nav-Punkts (`SHELL_NAV`,
 *    `MODULE_NAV_ENTITLEMENTS`, Gate `kind:'entitlement'`) ∪ Keys des
 *    Routen-Registers (`requirementForPath`). Damit gilt: Schloss in der
 *    Navigation ⇔ Routensperre würde blockieren (für Register-Routen).
 * 2. Entitlements laden noch / nicht ladbar ⇒ kein Schloss (wie das
 *    Route-Gate: ein falsches „gesperrt“ kostet mehr als ein falsches „offen“,
 *    die Durchsetzung bleibt serverseitig).
 * 3. Nur wenn ein Punkt weder Keys noch Register-Eintrag hat und ein
 *    Legacy-Gate (`module`/`permission`/`limit`) trägt, entscheidet weiter
 *    der Plan (heute: Kodee, Herkunftsnachweis, Team, Audit Center — nicht
 *    Teil von P0).
 */
import type { EntitlementKey, PlanId } from '@/shared/pricing';
import { cheapestPlanForKeys, requirementForPath } from '../../core/access/featureAccess';
import type { GovernanceModule } from './governanceBrowserTypes';
import { canAccessModule, minimumPlanForModule } from './governanceModules';

/**
 * Entitlement-Keys für Module ohne Register-Eintrag, deren Legacy-Gate
 * (`plan.modules`) nachweislich vom Server abweicht. `ai-systems`: Modul-Gate
 * `eu_ai_act` (ab Starter), Server gewährt `governance.ai_register` in Free.
 */
export const MODULE_NAV_ENTITLEMENTS: Readonly<Record<string, readonly EntitlementKey[]>> = {
  'ai-systems': ['governance.ai_register'],
};

export interface NavEntitlements {
  /** `useTenant().loading` */
  loading: boolean;
  /** `useTenant().entitlements !== null` */
  available: boolean;
  hasFeature: (key: string) => boolean;
}

export interface NavLock {
  locked: boolean;
  /** Fehlende Keys (leer, wenn offen oder Legacy-Plan-Gate). */
  missing: EntitlementKey[];
  /** Günstigster wählbarer Plan für die fehlenden Keys; `null` = kein Plan gewährt sie. */
  minPlan: PlanId | null;
  source: 'entitlement' | 'plan' | 'none';
}

export interface NavTarget {
  route: string;
  /** Explizite Keys des Nav-Punkts. */
  keys?: readonly EntitlementKey[];
  /** Modul aus GOVERNANCE_MODULES (für Gate `entitlement` und Legacy-Fallback). */
  module?: GovernanceModule;
}

/** Alle Keys, die ein Nav-Punkt braucht (explizit ∪ Modul ∪ Routen-Register). */
export function navRequiredKeys(target: NavTarget): EntitlementKey[] {
  const keys = new Set<EntitlementKey>(target.keys ?? []);
  if (target.module) {
    for (const key of MODULE_NAV_ENTITLEMENTS[target.module.id] ?? []) keys.add(key);
    if (target.module.gate.kind === 'entitlement') keys.add(target.module.gate.key);
  }
  for (const key of requirementForPath(target.route)?.allOf ?? []) keys.add(key);
  return [...keys];
}

const OPEN: NavLock = { locked: false, missing: [], minPlan: null, source: 'none' };

export function decideNavLock(target: NavTarget, ent: NavEntitlements, plan: string | null | undefined): NavLock {
  const keys = navRequiredKeys(target);
  if (keys.length > 0) {
    if (ent.loading || !ent.available) return { ...OPEN, source: 'entitlement' };
    const missing = keys.filter((key) => !ent.hasFeature(key));
    if (missing.length === 0) return { ...OPEN, source: 'entitlement' };
    return { locked: true, missing, minPlan: cheapestPlanForKeys(missing), source: 'entitlement' };
  }
  const module = target.module;
  if (!module || module.gate.kind === 'all') return OPEN;
  // Legacy-Fallback (siehe Regel 3).
  if (canAccessModule(module, plan)) return { ...OPEN, source: 'plan' };
  return { locked: true, missing: [], minPlan: minimumPlanForModule(module), source: 'plan' };
}
