// agentActions.ts — Registry aller Agent-Aktionen
// Agent darf NUR Aktionen aus dieser Liste ausführen.
// Destructive / kostenpflichtige Aktionen brauchen confirm: true.

export type AgentActionType =
  | 'navigate'
  | 'scroll'
  | 'explain'
  | 'search'
  | 'open_module'
  | 'prepare_form';

export interface AgentAction {
  id: string;
  type: AgentActionType;
  label: string;
  description: string;
  confirm: boolean;
  payload?: Record<string, unknown>;
}

export interface NavigateAction extends AgentAction {
  type: 'navigate';
  payload: { route: string };
}

export interface ScrollAction extends AgentAction {
  type: 'scroll';
  payload: { direction: 'top' | 'bottom' | 'up' | 'down' };
}

// Alle erlaubten Navigations-Aktionen
export const NAVIGATE_ACTIONS: NavigateAction[] = [
  { id: 'nav_dashboard',    type: 'navigate', label: 'Dashboard öffnen',        description: 'Zum Governance OS Dashboard navigieren', confirm: false, payload: { route: '/app' } },
  { id: 'nav_websites',     type: 'navigate', label: 'Websites öffnen',         description: 'Zur Website-Governance navigieren',       confirm: false, payload: { route: '/app/websites' } },
  { id: 'nav_gdpr',         type: 'navigate', label: 'DSGVO öffnen',            description: 'Zum DSGVO-Bereich navigieren',            confirm: false, payload: { route: '/app/gdpr' } },
  { id: 'nav_ai_act',       type: 'navigate', label: 'KI-Systeme öffnen',       description: 'Zum EU AI Act / KI-Registry navigieren',  confirm: false, payload: { route: '/app/ai-act' } },
  { id: 'nav_evidence',     type: 'navigate', label: 'Evidence öffnen',         description: 'Zum Evidence Vault navigieren',           confirm: false, payload: { route: '/app/evidence' } },
  { id: 'nav_monitoring',   type: 'navigate', label: 'Monitoring öffnen',       description: 'Zum Runtime Monitoring navigieren',       confirm: false, payload: { route: '/app/monitoring' } },
  { id: 'nav_automations',  type: 'navigate', label: 'Automation Skills öffnen',description: 'Zu Automation Skills navigieren',         confirm: false, payload: { route: '/app/automations' } },
  { id: 'nav_office',       type: 'navigate', label: 'Office öffnen',           description: 'Zum Office-Bereich navigieren',           confirm: false, payload: { route: '/app/office' } },
  { id: 'nav_team',         type: 'navigate', label: 'Team öffnen',             description: 'Zur Team-Verwaltung navigieren',          confirm: false, payload: { route: '/app/team' } },
  { id: 'nav_settings',     type: 'navigate', label: 'Einstellungen öffnen',    description: 'Zu den Einstellungen navigieren',         confirm: false, payload: { route: '/app/settings' } },
  { id: 'nav_risks',        type: 'navigate', label: 'Risiken öffnen',          description: 'Zum Risk Center navigieren',              confirm: false, payload: { route: '/app/risks' } },
  { id: 'nav_audit',        type: 'navigate', label: 'Audit Export öffnen',     description: 'Zum Audit Export navigieren',             confirm: false, payload: { route: '/app/audit' } },
  { id: 'nav_documents',    type: 'navigate', label: 'Dokumente öffnen',        description: 'Zum Dokumentengenerator navigieren',      confirm: false, payload: { route: '/app/documents' } },
  { id: 'nav_reports',      type: 'navigate', label: 'Reports öffnen',          description: 'Zu Compliance Reports navigieren',        confirm: false, payload: { route: '/app/reports' } },
];

export const SCROLL_ACTIONS: ScrollAction[] = [
  { id: 'scroll_top',    type: 'scroll', label: 'Nach oben scrollen',  description: 'Zum Seitenanfang scrollen',  confirm: false, payload: { direction: 'top' } },
  { id: 'scroll_bottom', type: 'scroll', label: 'Nach unten scrollen', description: 'Zum Seitenende scrollen',    confirm: false, payload: { direction: 'bottom' } },
  { id: 'scroll_up',     type: 'scroll', label: 'Hochscrollen',        description: 'Seite nach oben scrollen',  confirm: false, payload: { direction: 'up' } },
  { id: 'scroll_down',   type: 'scroll', label: 'Herunterscrollen',    description: 'Seite nach unten scrollen', confirm: false, payload: { direction: 'down' } },
];

export const ALL_AGENT_ACTIONS: AgentAction[] = [
  ...NAVIGATE_ACTIONS,
  ...SCROLL_ACTIONS,
  { id: 'explain_page',   type: 'explain',      label: 'Aktuelle Seite erklären', description: 'Erklärt das aktive Modul',      confirm: false },
  { id: 'search_website', type: 'search',       label: 'Website suchen',          description: 'Sucht eine Domain im System',   confirm: false },
  { id: 'prepare_audit',  type: 'prepare_form', label: 'Audit vorbereiten',       description: 'Bereitet einen Audit-Scan vor', confirm: false },
];

// Nicht erlaubt (für Dokumentation / Validierung):
export const FORBIDDEN_ACTIONS = [
  'delete', 'buy', 'checkout', 'external_browser', 'dom_manipulation',
] as const;
