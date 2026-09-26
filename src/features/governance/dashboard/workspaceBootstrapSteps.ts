import { daysSince, formatAgeDe, SCAN_STALE_DAYS, WEBSITE_AUDIT_CTA_LABEL } from './dashboardSignals';

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
  /**
   * created_at des jüngsten scan_runs-Eintrags. Nur scan_runs zählt —
   * Scanner-/Seed-Events in governance_events sind kein Audit-Lauf.
   */
  lastScanRunAt?: string | null;
  now?: number;
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
    // Ehrlich benannt: tenant-audit prüft HTML/Header, kein DNS/DMARC.
    steps.push({
      id: 'start-audit',
      title: WEBSITE_AUDIT_CTA_LABEL,
      detail: 'Domain ist hinterlegt — der Audit prüft HTML und Header der Website (keine DNS-/DMARC-Prüfung).',
      href: '/app/websites',
      level: 'high',
    });
  } else if (input.websiteCount !== null && input.websiteCount > 0 && (input.scanCount ?? 0) > 0) {
    // Nur mit echten scan_runs-Zeilen (derzeit plattformweit leer, bis der
    // tenant-audit-Fix live ist): Hinweis auf erneuten Audit mit Alter.
    const age = daysSince(input.lastScanRunAt ?? null, input.now);
    if (age !== null && age >= SCAN_STALE_DAYS) {
      steps.push({
        id: 'rescan-audit',
        title: `Website-Audit erneut starten (letzter Audit ${formatAgeDe(age)})`,
        detail: `Der letzte Website-Audit ist älter als ${SCAN_STALE_DAYS} Tage — HTML und Header erneut prüfen.`,
        href: '/app/websites',
        level: 'medium',
      });
    }
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
