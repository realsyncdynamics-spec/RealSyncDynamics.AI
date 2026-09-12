/**
 * Bootstrap „Nächste Schritte“ from real workspace facts — no fake KPIs.
 *
 * When there is no domain / no scan / no activation, the Command Center
 * must show actionable CTAs instead of „Keine dringenden Pflichten.“
 */

export type ActivationBootstrapStatus =
  | 'none'
  | 'draft'
  | 'scope_set'
  | 'org_saved'
  | 'activated';

export interface WorkspaceBootstrapInput {
  /** Registered websites for the active tenant. `null` = still loading / unknown. */
  websiteCount: number | null;
  /** Known scan_runs for the tenant. `null` = still loading / unknown. */
  scanCount: number | null;
  /** Activation record status; `null` = unknown; `'none'` = no row. */
  activationStatus: ActivationBootstrapStatus | null;
}

export interface BootstrapStep {
  id: string;
  title: string;
  detail: string;
  href: string;
  level: 'high' | 'medium' | 'low';
}

/**
 * Deterministic next steps from workspace state.
 * Unknown (`null`) counts are skipped so we never invent urgency.
 */
export function computeWorkspaceBootstrapSteps(
  input: WorkspaceBootstrapInput,
): BootstrapStep[] {
  const steps: BootstrapStep[] = [];

  if (input.websiteCount === 0) {
    steps.push({
      id: 'add-domain',
      title: 'Domain hinterlegen',
      detail: 'Ohne Domain bleiben Score und Zähler leer — Website unter Websites verbinden.',
      href: '/app/websites',
      level: 'high',
    });
  }

  if (input.websiteCount === 0) {
    steps.push({
      id: 'start-audit',
      title: 'Audit starten',
      detail: 'Öffentlicher Website-Scan mit Domain-Feld — Ergebnisse können dem Workspace zugeordnet werden.',
      href: '/audit?source=dashboard',
      level: 'high',
    });
  } else if (input.websiteCount !== null && input.scanCount === 0) {
    steps.push({
      id: 'start-audit',
      title: 'Audit starten',
      detail: 'Domain ist hinterlegt — ersten Governance-Scan aus Websites auslösen.',
      href: '/app/websites',
      level: 'high',
    });
  }

  if (
    input.activationStatus === 'none' ||
    input.activationStatus === 'draft'
  ) {
    steps.push({
      id: 'activation',
      title: 'Activation starten',
      detail: 'Organisation und Governance-Scope festlegen — Beta unter /app/activation.',
      href: '/app/activation',
      level: 'medium',
    });
  }

  return steps;
}
