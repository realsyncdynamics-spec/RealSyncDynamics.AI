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
 * Ein `BookableModule` schaltet über `unlocks` Entitlement-Keys frei. Ob der
 * Plan sie trägt, entscheidet `planGrants()` — nie ein Vergleich von
 * Plan-Namen (`CLAUDE.md` §6). Ein Modul gilt als aktiv, wenn **alle** seine
 * Keys im Plan liegen; teilweise freigeschaltet ist nicht aktiv, sondern
 * verfügbar.
 *
 * Bis AP1 stand hier `hasModule()` gegen `plan.modules`. Das war eine zweite
 * Definition dessen, was ein Plan enthält, und sie wich von der Datenbank ab —
 * die Oberfläche zeigte also etwas anderes an, als der Server zuließ. Seither
 * gilt der Entitlement-Key.
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
  isPlanSelectable,
  planByKey,
  planGrants,
  type BookableModule,
  type EntitlementKey,
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

/**
 * Trägt der Plan jeden Entitlement-Key dieses Moduls?
 *
 * `planId` ist hier der `planKey` (`free_audit`, `starter`, …) — dieselbe
 * Kennung wie in `products.default_for_plan_key`.
 */
export function isModuleActive(planId: PlanId | string | null | undefined, module: BookableModule): boolean {
  // Ein Modul ohne `unlocks` schaltet nichts frei — es kann folglich auch
  // nicht als aktiv gelten. Sonst erschiene es bei jedem Kunden als
  // vorhanden, nur weil die leere Menge jede Bedingung erfüllt.
  if (module.unlocks.length === 0) return false;
  return module.unlocks.every((key) => planGrants(planId, key));
}

/**
 * Günstigster Plan, der das Modul vollständig abdeckt.
 *
 * Läuft `PLAN_ORDER` von unten nach oben und nimmt den ersten Treffer.
 * Pläne, die nicht gekauft werden können (`inquiry`, `free`), bleiben als
 * Ergebnis zulässig — die Oberfläche entscheidet dann, ob sie zum Checkout
 * oder zum Vertrieb führt.
 *
 * **Stillgelegte Pläne werden übersprungen.** Seit AP2 sind Agency und
 * Partner nicht mehr wählbar. Ein Vorschlag „verfügbar ab Agency" wäre
 * damit ein Weg, den niemand mehr gehen kann — genau das Element, das
 * `CLAUDE.md` §14 verbietet. Für die Frage, ob ein *bestehender* Kunde das
 * Modul hat, ist weiterhin `isModuleActive()` zuständig; die kennt Agency
 * und Partner unverändert.
 */
export function cheapestPlanFor(module: BookableModule): PlanId | null {
  // Ein Modul ohne `unlocks` schaltet nichts frei — siehe isModuleActive().
  if (module.unlocks.length === 0) return null;
  return cheapestPlanForKeys(module.unlocks);
}

/**
 * Dieselbe Regel für eine beliebige Menge von Entitlement-Keys.
 *
 * Der Modul-Hub (`/app/modules`) beantwortet für einzelne Capabilities
 * dieselbe Frage — „ab welchem Plan gibt es das?" — ohne ein
 * `BookableModule` in der Hand zu haben. Die Antwort darf dort nicht ein
 * zweites Mal hergeleitet werden: Der Marketplace ist die kommerzielle
 * Wahrheit, der Hub liest sie hier ab. Damit gilt die Regel „stillgelegte
 * Pläne überspringen" für beide Flächen automatisch.
 */
export function cheapestPlanForKeys(keys: readonly EntitlementKey[]): PlanId | null {
  if (keys.length === 0) return null;
  for (const planId of PLAN_ORDER) {
    if (!isPlanSelectable(planId)) continue;
    if (keys.every((key) => planGrants(planId, key))) return planId;
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
