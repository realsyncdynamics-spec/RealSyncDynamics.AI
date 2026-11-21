// Ist-Zustand für auto_map: vorhandene asset_control_mappings über den
// bereits geladenen Katalog (framework_controls) auf framework/control_code
// auflösen.
//
// Rein (keine Deno-/jsr-Importe), aus Vitest testbar. Nachschlagen per Map
// nach id statt linearer Suche je Mapping; gleicher Katalog, gleiche
// Mappings, gleiche Reihenfolge. Unbekannte control_id fällt heraus, fehlende
// source gilt wie bisher als 'manual'.

import type { CurrentMapping } from '../_shared/autoMap.ts';

export interface CatalogControl {
  id: string;
  framework: string;
  control_code: string;
}

export interface ExistingMappingRow {
  control_id: string;
  status: string;
  source: string | null;
}

export function resolveCurrentMappings(
  existing: readonly ExistingMappingRow[],
  catalog: readonly CatalogControl[],
): CurrentMapping[] {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const out: CurrentMapping[] = [];
  for (const m of existing) {
    const c = byId.get(m.control_id);
    if (!c) continue;
    out.push({
      framework: c.framework,
      control_code: c.control_code,
      status: m.status as CurrentMapping['status'],
      source: (m.source as CurrentMapping['source']) ?? 'manual',
    });
  }
  return out;
}
