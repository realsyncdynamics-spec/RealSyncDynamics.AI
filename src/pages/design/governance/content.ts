/**
 * Copy + demo data for the `/design/governance` preview ("The Governance AI").
 *
 * Product vocabulary (layers, node roles) mirrors runtimeVocab / hero-content.
 * Dashboard numbers are labelled DEMO · BEISPIELDATEN on the surface — they are
 * illustrative, not measured. Pricing and roadmap are NOT duplicated here: the
 * page reads them from `shared/pricing.ts` and `product/implementation-status.ts`.
 */

export const HERO_LEDE_LINES = [
  'Runtime governance for regulated AI systems.',
  'Continuous evidence. EU-native by design.',
] as const;

export const STATUS_BAR = {
  runtime: 'RUNTIME OPERATIONAL',
  region: 'EU-CENTRAL',
  hosting: 'HOSTING IN EUROPA',
  frameworks: 'DSGVO · EU AI ACT · ISO 27001',
  sla: 'SLA NACH VEREINBARUNG',
} as const;

export const HERO_KICKER = ['01', 'AI GOVERNANCE · RUNNING IN REAL TIME', 'EU-CENTRAL'] as const;

export const HERO_PROOF_CHIPS = ['EVIDENCE-CHAIN', 'AI-ACT-KLASSIFIKATION', 'PROVENANCE · C2PA'] as const;

export const HERO_KPIS: readonly { value: string; label: string }[] = [
  { value: '6', label: 'POLICY PACKS' },
  { value: 'EU', label: 'DATENRESIDENZ' },
  { value: 'C2PA', label: 'PROVENANCE' },
];

export const TRUST_FRAMEWORKS: readonly { name: string; next?: boolean }[] = [
  { name: 'DSGVO' },
  { name: 'EU AI ACT' },
  { name: 'ISO 27001' },
  { name: 'NIS2' },
  { name: 'TISAX', next: true },
  { name: 'DORA', next: true },
];

export interface RuntimeLayer {
  index: string;
  title: string;
  role: string;
  body: string;
  bullets: readonly string[];
}

export const LAYERS: readonly RuntimeLayer[] = [
  {
    index: '01',
    title: 'DETECT',
    role: 'Scanner · Runtime · Discovery',
    body: 'Headers, Cookies, Tracker, AI-Endpoints, Forms und Third-Parties werden bei jedem Scan in Sekunden inventarisiert.',
    bullets: ['Website-Scan', 'Tracker · Cookies · Header', 'AI-APIs · Third-Parties', 'Forms · Subdomains'],
  },
  {
    index: '02',
    title: 'MONITOR',
    role: 'Continuous Runtime',
    body: 'Sobald die Runtime aktiv ist, läuft sie weiter. Drift, Consent-Änderungen, neue Tracker und geänderte Header werden laufend detektiert.',
    bullets: ['Drift Detection', 'Alerts · Re-Scans', 'Consent Changes', 'Deploy Monitoring'],
  },
  {
    index: '03',
    title: 'GOVERN',
    role: 'AI Act · DSGVO · Policies',
    body: 'Findings werden klassifiziert (DSGVO-Artikel, AI-Act-Klasse), in ein Register überführt und in eine versiegelte Evidence-Chain verankert.',
    bullets: ['AI-Usecase-Registry', 'Risk Classification', 'Controls · Evidence', 'Audit-Trail · Policies'],
  },
  {
    index: '04',
    title: 'AUTOMATE',
    role: 'Agent Layer',
    body: 'Spezialisierte Agenten erklären Befunde, schlagen Fixes vor, draften Updates für §13 und schreiben Evidence in den Audit-Trail.',
    bullets: ['Website-Drift-Agent', 'AI-Risk-Agent', 'Evidence-Agent', 'Policy-Agent'],
  },
];

/** Governance nodes on the relief — illustrative EU runtime topology. */
export interface GovernanceNode {
  city: string;
  role: string;
  lon: number;
  lat: number;
}

export const NODES: readonly GovernanceNode[] = [
  { city: 'BERLIN', role: 'AI Act Registry', lon: 13.4, lat: 52.52 },
  { city: 'BRÜSSEL', role: 'Risk Classification', lon: 4.35, lat: 50.85 },
  { city: 'FRANKFURT', role: 'EU Runtime · eu-central', lon: 8.68, lat: 50.11 },
  { city: 'STOCKHOLM', role: 'Evidence Node', lon: 18.07, lat: 59.33 },
  { city: 'PARIS', role: 'Policy Engine', lon: 2.35, lat: 48.86 },
  { city: 'WIEN', role: 'Conformity Review', lon: 16.37, lat: 48.21 },
];

/** Hub of the golden data flows (Frankfurt, eu-central). */
export const FLOW_HUB: readonly [number, number] = [8.68, 50.11];

/** Flow targets; the first 11 are European cities and seed the city lights. */
export const FLOW_TARGETS: readonly (readonly [number, number])[] = [
  [13.4, 52.52], [4.35, 50.85], [18.07, 59.33], [2.35, 48.86], [16.37, 48.21], [-3.7, 40.42], [12.5, 41.9],
  [24.94, 60.17], [21.01, 52.23], [-6.26, 53.35], [-0.13, 51.5],
  [28.05, -10], [40, 62], [45, 30], [-25, 20], [10, 75],
];

/* ---------- Dashboard preview (DEMO · BEISPIELDATEN) ---------- */

export const DEMO_NAV: readonly { label: string; badge?: string; active?: boolean }[] = [
  { label: 'Übersicht', active: true },
  { label: 'Workspace' },
  { label: 'Module' },
  { label: 'Activation', badge: 'BETA' },
  { label: 'Websites' },
  { label: 'Evidence' },
  { label: 'KI-Systeme', badge: 'BETA' },
  { label: 'Risiken', badge: 'BETA' },
  { label: 'Monitoring', badge: 'BETA' },
  { label: 'Berichte', badge: 'BETA' },
  { label: 'Policy Packs' },
  { label: 'Audit Center' },
  { label: 'Agents' },
  { label: 'Maßnahmen', badge: 'ROADMAP' },
  { label: 'Einstellungen' },
];

export const DEMO_TILES: readonly { value: string; suffix?: string; label: string }[] = [
  { value: '78', suffix: '/100', label: 'GOVERNANCE SCORE' },
  { value: '12', label: 'OFFENE FINDINGS' },
  { value: '1.284', label: 'EVIDENCE-EINTRÄGE' },
  { value: '3', label: 'KI-SYSTEME IM REGISTER' },
];

export const DEMO_FRAMEWORKS: readonly { name: string; pct: number; label: string }[] = [
  { name: 'DSGVO', pct: 82, label: '82 %' },
  { name: 'EU AI ACT', pct: 64, label: '64 %' },
  { name: 'ISO 27001', pct: 55, label: '55 %' },
  { name: 'NIS2', pct: 28, label: '28 %' },
  { name: 'TISAX', pct: 0, label: 'NEXT' },
  { name: 'DORA', pct: 0, label: 'NEXT' },
];

export type DemoSeverity = 'high' | 'mid' | 'low';

export const DEMO_FINDINGS: readonly { sev: DemoSeverity; label: string; text: string; ref: string }[] = [
  { sev: 'high', label: 'HOCH', text: 'Tracker vor Einwilligung geladen', ref: 'Art. 6 · TTDSG §25' },
  { sev: 'high', label: 'HOCH', text: 'KI-Endpoint ohne Transparenzhinweis', ref: 'AI Act Art. 50' },
  { sev: 'mid', label: 'MITTEL', text: 'Auftragsverarbeiter ohne AVV-Nachweis', ref: 'Art. 28' },
  { sev: 'mid', label: 'MITTEL', text: 'Drift: neuer Third-Party-Request', ref: 'Runtime · Deploy' },
  { sev: 'low', label: 'NIEDRIG', text: 'Security-Header unvollständig', ref: 'ISO 27001 A.8' },
];

export const DEMO_INTENT_CHIPS = [
  'AI-Act-Klassifikation prüfen',
  '§13-Update draften',
  'Evidence exportieren',
  'Drift erklären',
] as const;

/* ---------- Enterprise ---------- */

export const ENTERPRISE_CARDS: readonly { title: string; body: string; tag: string }[] = [
  {
    title: 'Identität & Zugriff',
    body: 'Single Sign-On, zentrale Benutzerverwaltung mit Rollen und Rechten, Mandanten-Isolation über RLS.',
    tag: 'SSO · SCIM · RBAC',
  },
  {
    title: 'Alle sechs Policy Packs',
    body: 'DSGVO, EU AI Act, ISO 27001, NIS2, TISAX, DORA — mit eigenen Richtlinien und Kontrollkatalogen.',
    tag: 'POLICY ENGINE · CONTROLS',
  },
  {
    title: 'Evidence & Audit',
    body: 'Evidence Vault Enterprise mit 200 GB Nachweisspeicher, Audit Center Pro mit 200 Berichten pro Monat.',
    tag: '200 GB · 200 REPORTS / MONAT',
  },
  {
    title: 'Betrieb & Support',
    body: 'API Premium mit 250.000 Aufrufen pro Monat, priorisierter Support mit vertraglich vereinbarter Reaktionszeit, White-Label mit Branding.',
    tag: 'API PREMIUM · SLA · WHITE-LABEL',
  },
];

/** Plan ids shown on the pricing band (self-service monthly tiers). */
export const PRICING_PLAN_IDS = ['starter', 'growth', 'agency'] as const;

/** Design themes: Titan (chrome + bronze) and Nacht (black + cyan). */
export type GovernanceTheme = 'titan' | 'night';
export const THEME_STORAGE_KEY = 'rsd-design-governance-theme';
