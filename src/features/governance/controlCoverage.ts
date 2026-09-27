import { computeCoverage, type Coverage, type MappingStatus, type PackControlRef } from '../../lib/policy-packs/coverage';
import type { PolicyPack } from '../policy-packs/policyPacksApi';

export interface FrameworkCoverage {
  framework: string;
  controls: PackControlRef[];
  coverage: Coverage;
}

export interface ControlCoverageSummary {
  activePackCount: number;
  controls: PackControlRef[];
  mappings: MappingStatus[];
  coverage: Coverage | null;
  frameworks: FrameworkCoverage[];
}

/**
 * Tenant-level Control-Coverage für aktive Policy Packs.
 *
 * Wahrheitsregeln:
 * - Nur Controls aktiver Packs sind im Scope.
 * - Doppelte Controls über mehrere Packs werden dedupliziert.
 * - Doppelte Mapping-Zustände über mehrere Assets werden konservativ
 *   zu genau einem Tenant-Status pro Control zusammengeführt.
 * - Ein Control ohne Mapping ist not_started.
 * - not_applicable zählt nicht in den Prozent-Nenner.
 * - Kein aktiver Scope => coverage=null, nicht 0%.
 */
export function buildControlCoverage(
  catalog: PolicyPack[],
  activePackIds: Set<string>,
  rawMappings: MappingStatus[],
): ControlCoverageSummary {
  const activePacks = catalog.filter((pack) => activePackIds.has(pack.id));

  const controlsByKey = new Map<string, PackControlRef>();
  for (const pack of activePacks) {
    for (const control of pack.controls) {
      controlsByKey.set(key(control), control);
    }
  }
  const controls = [...controlsByKey.values()];

  const statusesByKey = new Map<string, MappingStatus['status'][]>();
  for (const mapping of rawMappings) {
    const k = key(mapping);
    if (!controlsByKey.has(k)) continue;
    const list = statusesByKey.get(k) ?? [];
    list.push(mapping.status);
    statusesByKey.set(k, list);
  }

  const mappings: MappingStatus[] = controls.flatMap((control) => {
    const statuses = statusesByKey.get(key(control));
    if (!statuses || statuses.length === 0) return [];
    return [{
      framework: control.framework,
      control_code: control.control_code,
      status: conservativeStatus(statuses),
    }];
  });

  const frameworks = [...new Set(controls.map((control) => control.framework))]
    .sort()
    .map((framework) => {
      const frameworkControls = controls.filter((control) => control.framework === framework);
      const frameworkMappings = mappings.filter((mapping) => mapping.framework === framework);
      return {
        framework,
        controls: frameworkControls,
        coverage: computeCoverage(frameworkControls, frameworkMappings),
      };
    });

  return {
    activePackCount: activePacks.length,
    controls,
    mappings,
    coverage: controls.length > 0 ? computeCoverage(controls, mappings) : null,
    frameworks,
  };
}

function key(value: { framework: string; control_code: string }): string {
  return value.framework + '::' + value.control_code;
}

/**
 * Mehrere Asset-Mappings dürfen einen Control-Status nicht optimistischer machen.
 * N/A wird ignoriert, sobald derselbe Control auf mindestens einem Asset anwendbar ist.
 */
export function conservativeStatus(
  statuses: MappingStatus['status'][],
): MappingStatus['status'] {
  const applicable = statuses.filter((status) => status !== 'not_applicable');
  if (applicable.length === 0) return 'not_applicable';
  if (applicable.includes('gap')) return 'gap';
  if (applicable.includes('not_started')) return 'not_started';
  if (applicable.includes('in_progress')) return 'in_progress';
  return 'implemented';
}
