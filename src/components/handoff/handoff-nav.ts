import type { HandoffKey } from '../../i18n/handoff';

/**
 * Navigation der Governance-OS-Oberflächen (Handoff v2).
 *
 * Reihenfolge und Beschriftung wie im Prototyp. Die App-Ziele liegen hinter
 * `AppGate` — ohne Sitzung führt der Klick über `/welcome?next=…` zur
 * Anmeldung und danach auf die gewählte Seite.
 *
 * „Klassifizierung" zeigt bis zur Detailroute `/app/ai-systems/:id`
 * (Phase 2) auf das Inventar, von dem aus klassifiziert wird.
 */
export interface HandoffNavItem {
  key: HandoffKey;
  to: string;
  /** Schlüssel-Screens (Übersicht, Preise) stehen in `#F2F5FA`, der Rest in `#8A95AC`. */
  prominent?: boolean;
}

export const HANDOFF_NAV: readonly HandoffNavItem[] = [
  { key: 'navLogin', to: '/login' },
  { key: 'navOverview', to: '/app/dashboard', prominent: true },
  { key: 'navSystems', to: '/app/ai-systems' },
  { key: 'navClassify', to: '/app/ai-systems' },
  { key: 'navEnforce', to: '/app/policy-packs' },
  { key: 'navEvidence', to: '/app/evidence' },
  { key: 'navReports', to: '/app/reports' },
  { key: 'navPricing', to: '/pricing', prominent: true },
] as const;
