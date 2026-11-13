import { WIDGET_CATALOG } from './catalog';
import { isWidgetFeatureEnabled } from './flags';
import type { EntitlementKey } from '../../../../shared/pricing';
import type { EntitlementValueMap, WidgetDefinition } from './types';

/** 0 oder fehlend = aus; jede andere Zahl (1, Kontingent, -1) = an. */
export function entitlementIsOn(values: EntitlementValueMap, key: WidgetDefinition['requiredEntitlements'][number]): boolean {
  const value = values[key];
  return typeof value === 'number' && value !== 0;
}

/** Wandelt die Tenant-EntitlementSet.byKey-Struktur in die Registry-Map. */
export function entitlementsToValueMap(
  entitlements: { byKey: Readonly<Record<string, { value: number }>> } | null | undefined,
): EntitlementValueMap {
  if (!entitlements) return {};
  const out: Partial<Record<EntitlementKey, number>> = {};
  for (const [key, entry] of Object.entries(entitlements.byKey)) {
    if (entry && typeof entry.value === 'number') {
      out[key as EntitlementKey] = entry.value;
    }
  }
  return out;
}

/**
 * Wählt das automatische Default-Layout.
 *
 * Regeln:
 * - nur `status === 'available'`
 * - nur `defaultOn === true`, außer die ID steht in `preferredVisibleIds`
 *   (dann darf ein available, nicht-default Widget zusätzlich erscheinen)
 * - alle requiredEntitlements müssen an sein
 * - Feature-Flag aus = nie, auch nicht über preferredVisibleIds
 * - Reihenfolge = Katalogreihenfolge
 * - proposed nie, auch wenn in preferredVisibleIds genannt
 */
export function selectWidgetsForEntitlements(
  values: EntitlementValueMap,
  preferredVisibleIds?: readonly string[],
): WidgetDefinition[] {
  const preferred = new Set(preferredVisibleIds ?? []);
  return WIDGET_CATALOG.filter((widget) => {
    if (widget.status !== 'available') return false;
    if (widget.featureFlag && !isWidgetFeatureEnabled(widget.featureFlag)) return false;
    const requiredOk = widget.requiredEntitlements.every((key) => entitlementIsOn(values, key));
    if (!requiredOk) return false;
    if (widget.defaultOn) return true;
    return preferred.has(widget.id);
  });
}
