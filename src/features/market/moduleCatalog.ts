/**
 * Der Marketplace-Katalog: Modul + tatsächlicher Zustand beim Mandanten.
 *
 * ## Warum die Zustandsermittlung eine eigene, getestete Funktion ist
 *
 * Ein Marketplace, der „aktiv" anzeigt, wo nichts aktiv ist, ist schlimmer
 * als gar keiner: Er lässt den Kunden glauben, er sei versorgt. Die
 * Zuordnung Modul → Zustand hängt deshalb nicht in einer Komponente,
 * sondern hier — als reine Funktion, die `test/market/module-catalog.test.ts`
 * prüft.
 *
 * ## Die Quelle des Zustands
 *
 * Ein `BookableModule` schaltet über `unlocks` Fähigkeiten (`ModuleId`) frei.
 * Ob der Mandant sie hat, entscheidet allein `hasModule()` gegen seinen Plan
 * — nie ein Vergleich von Plan-Namen (`CLAUDE.md` §6). Ein Modul gilt als
 * aktiv, wenn **alle** seine Fähigkeiten im Plan liegen; teilweise
 * freigeschaltet ist nicht aktiv, sondern verfügbar.
 *
 * ## Was hier bewusst fehlt
 *
 * Ein Kaufweg je Modul. Der modulare Checkout (Phase 5 in
 * `docs/product/modular-product-experience.md`) verlangt ein eigenes
 * Stripe-Price-Objekt je Modul; die gibt es noch nicht, und
 * `stripe-checkout` nimmt ausschliesslich einen `plan_key` entgegen. Statt
 * einen Knopf zu bauen, der ins Leere greift, nennt der Katalog den Plan,
 * über den das Modul heute erreichbar ist. Das ist die Regel aus
 * `CLAUDE.md` §14: kein Element vortäuschen, das nichts tut.
 */
import {
  BOOKABLE_MODULES,
  PLAN_ORDER,
  hasModule,
  planByKey,
  type BookableModule,
  type PlanId,
} from '@/shared/pricing';

/**
 * Zustände eines Dienstes im Marketplace.
 *
 * Bewusst weniger als die sechs aus dem Auftrag (`available`, `preview`,
 * `active`, `inactive`, `pending`, `cancelled`): Ein Zustand, den niemand
 * erzeugen kann, ist kein Zustand, sondern eine Behauptung. `pending` und
 * `cancelled` entstehen erst mit dem modularen Checkout, `preview` erst mit
 * Testzugängen je Modul. Sie kommen dazu, wenn es sie gibt.
 */
export type ServiceStatus = 'active' | 'available';

export interface CatalogEntry {
  module: BookableModule;
  status: ServiceStatus;
  /**
   * Günstigster Plan, der alle Fähigkeiten dieses Moduls enthält.
   * `null`, wenn kein Plan das leistet — dann führt der Weg über den
   * Vertrieb, nicht über einen Checkout.
   */
  unlockedByPlan: PlanId | null;
}

/** Ist jede Fähigkeit dieses Moduls im Plan enthalten? */
export function isModuleActive(planId: PlanId | string | null | undefined, module: BookableModule): boolean {
  // Ein Modul ohne `unlocks` schaltet nichts frei — es kann folglich auch
  // nicht als aktiv gelten. Sonst erschiene es bei jedem Kunden als
  // vorhanden, nur weil die leere Menge jede Bedingung erfüllt.
  if (module.unlocks.length === 0) return false;
  return module.unlocks.every((capability) => hasModule(planId, capability));
}

/**
 * Günstigster Plan, der das Modul vollständig abdeckt.
 *
 * Läuft `PLAN_ORDER` von unten nach oben und nimmt den ersten Treffer.
 * Pläne, die nicht gekauft werden können (`inquiry`, `free`), bleiben als
 * Ergebnis zulässig — die Oberfläche entscheidet dann, ob sie zum Checkout
 * oder zum Vertrieb führt.
 */
export function cheapestPlanFor(module: BookableModule): PlanId | null {
  for (const planId of PLAN_ORDER) {
    if (isModuleActive(planId, module)) return planId;
  }
  return null;
}

/** Katalog für einen Mandanten: alle Module mit ihrem tatsächlichen Zustand. */
export function buildCatalog(planId: PlanId | string | null | undefined): CatalogEntry[] {
  return BOOKABLE_MODULES.map((module) => ({
    module,
    status: isModuleActive(planId, module) ? 'active' : 'available',
    unlockedByPlan: cheapestPlanFor(module),
  }));
}

/** Anzeigename eines Plans. `null` bleibt `null` — nicht raten. */
export function planLabel(planId: PlanId | null): string | null {
  if (planId === null) return null;
  return planByKey(planId)?.name ?? null;
}
