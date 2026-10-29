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

// Öffentliche Seiten (/pricing, /audit) nutzen dieselbe Hierarchie wie die
// Startseite: Governance OS → Runtime → Scan → Docs → Preise. Die App-Ziele
// (Übersicht, KI-Systeme, Evidence …) gehören in die App-Shell, nicht in die
// Marketing-Navigation.
export const HANDOFF_NAV: readonly HandoffNavItem[] = [
  { key: 'navGovOs', to: '/', prominent: true },
  { key: 'navRuntime', to: '/governance-runtime' },
  { key: 'navScan', to: '/audit' },
  { key: 'navDocs', to: '/docs/governance' },
  { key: 'navPricing', to: '/pricing', prominent: true },
  { key: 'navLogin', to: '/login' },
] as const;
