/**
 * Policy Packs — Abdeckungs-/Gap-Analyse.
 *
 * Pure, deterministisch, KEINE Side-Effects. Vergleicht die Controls eines
 * Policy-Packs mit dem Umsetzungsstatus (asset_control_mappings) eines Tenants
 * und liefert Abdeckung + Lücken. Für die Marketplace-/Pack-Ansicht.
 */

export type ControlStatus = 'not_started' | 'in_progress' | 'implemented' | 'gap' | 'not_applicable';

export interface PackControlRef {
  framework: string;
  control_code: string;
}

export interface MappingStatus {
  framework: string;
  control_code: string;
  status: ControlStatus;
}

export interface Coverage {
  total: number;
  implemented: number;
  inProgress: number;
  gap: number;
  notApplicable: number;
  notStarted: number;
  /** 0–100, Anteil implementiert (na aus dem Nenner herausgerechnet). */
  percent: number;
}

const FRAMEWORK_LABEL: Record<string, string> = {
  GDPR: 'DSGVO',
  TDDDG: 'TDDDG',
  EU_AI_ACT: 'EU AI Act',
  ISO_27001: 'ISO 27001',
  SOC_2: 'SOC 2',
  NIS2: 'NIS2',
  DORA: 'DORA',
  TISAX: 'TISAX',
  CUSTOM: 'Individuell',
};

export function frameworkLabel(fw: string): string {
  return FRAMEWORK_LABEL[fw] ?? fw;
}

function key(c: { framework: string; control_code: string }): string {
  return `${c.framework}::${c.control_code}`;
}

/**
 * Berechnet die Abdeckung der Pack-Controls anhand der Tenant-Mappings.
 * Controls ohne Mapping zählen als 'not_started'. 'not_applicable' wird aus
 * dem Prozent-Nenner herausgenommen (nicht anwendbar ≠ Lücke).
 */
export function computeCoverage(controls: PackControlRef[], mappings: MappingStatus[]): Coverage {
  const byKey = new Map<string, ControlStatus>();
  for (const m of mappings) byKey.set(key(m), m.status);

  const cov: Coverage = { total: controls.length, implemented: 0, inProgress: 0, gap: 0, notApplicable: 0, notStarted: 0, percent: 0 };

  // Eindeutige Controls (Pack könnte ein Control doppelt referenzieren).
  const seen = new Set<string>();
  for (const c of controls) {
    const k = key(c);
    if (seen.has(k)) { cov.total--; continue; }
    seen.add(k);
    const st = byKey.get(k) ?? 'not_started';
    switch (st) {
      case 'implemented': cov.implemented++; break;
      case 'in_progress': cov.inProgress++; break;
      case 'gap': cov.gap++; break;
      case 'not_applicable': cov.notApplicable++; break;
      default: cov.notStarted++; break;
    }
  }

  const denom = cov.total - cov.notApplicable;
  cov.percent = denom > 0 ? Math.round((cov.implemented / denom) * 100) : 0;
  return cov;
}

/** Grobe Ampel für die UI. */
export function coverageBand(percent: number): 'high' | 'medium' | 'low' {
  if (percent >= 80) return 'high';
  if (percent >= 40) return 'medium';
  return 'low';
}
