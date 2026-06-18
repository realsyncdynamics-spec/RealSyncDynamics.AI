// Runtime Vocabulary — single source of truth for the public-facing product
// narrative. The platform is one product (RealSync Runtime) organised in
// four layers (Detect / Monitor / Govern / Automate). Marketing copy that
// names sub-products, services, agencies or bundles is forbidden; this
// module exists so the next refactor pass can grep the codebase for
// drift mechanically.

export const PRODUCT_NAME = 'RealSync Runtime';
export const BRAND_NAME = 'RealSyncDynamics.AI';

/** The four product layers the visitor must internalise within 5 seconds. */
export const LAYERS = [
  {
    id: 'detect',
    short: '01',
    title: 'Detect',
    role: 'Scanner · Runtime · Discovery',
    blurb:
      'Headers, Cookies, Trackers, AI-Endpoints, Forms und Third-Parties werden bei jedem Scan in Sekunden inventarisiert.',
    bullets: ['Website-Scan', 'Tracker · Cookies · Header', 'AI-APIs · Third-Parties', 'Forms · Subdomains'],
  },
  {
    id: 'monitor',
    short: '02',
    title: 'Monitor',
    role: 'Continuous Runtime',
    blurb:
      'Sobald die Runtime aktiv ist, läuft sie weiter. Drift, Consent-Änderungen, neue Tracker, geänderte Header werden in Echtzeit detektiert.',
    bullets: ['Drift Detection', 'Alerts · Re-Scans', 'Consent Changes', 'Deploy Monitoring'],
  },
  {
    id: 'govern',
    short: '03',
    title: 'Govern',
    role: 'AI Act · DSGVO · Policies',
    blurb:
      'Findings werden klassifiziert (DSGVO-Artikel, AI-Act-Klasse), in ein Register überführt und in eine versiegelte Evidence-Chain anchored.',
    bullets: ['AI-Usecase-Registry', 'Risk Classification', 'Controls · Evidence', 'Audit-Trail · Policies'],
  },
  {
    id: 'automate',
    short: '04',
    title: 'Automate',
    role: 'Agent Layer',
    blurb:
      'Spezialisierte Agenten erklären Befunde, schlagen Fixes vor, drafteten Updates für §13 und schreiben Evidence in den Audit-Trail.',
    bullets: ['Website-Drift-Agent', 'AI-Risk-Agent', 'Evidence-Agent', 'Policy-Agent'],
  },
] as const;

export type LayerId = (typeof LAYERS)[number]['id'];

/**
 * Canonical Self-Service CTA copy (Deutsch). Die EINZIGEN Strings, die auf
 * öffentlichen CTAs erlaubt sind. RealSyncDynamics.AI ist ein vollständig
 * automatisiertes Self-Service-SaaS — jede CTA muss eine Aktion sein, die
 * der Nutzer ohne Mensch ausführen kann. Einzige Ausnahme: Enterprise
 * (`enterprise` → SSO / On-Prem / Behördenvertrag / Custom-DPA / PO).
 *
 *   Kostenlos starten     → Free Audit / Onboarding
 *   Audit starten         → Scan auslösen
 *   Website hinzufügen    → Domain im Dashboard ergänzen
 *   Monitoring aktivieren → Continuous-Runtime einschalten
 *   Dashboard öffnen      → in die App
 *   Evidence exportieren  → Audit-Bundle/Report-Export
 *   Report herunterladen  → PDF/JSON-Report
 *   Jetzt upgraden        → Tarifwechsel (self-serve)
 *   Tarif starten         → Tarif self-serve kaufen (inkl. Agency)
 *   Enterprise anfragen   → EINZIGE kontaktbasierte CTA
 */
export const CTA = {
  startFree:          'Kostenlos starten',
  startAudit:         'Audit starten',
  addWebsite:         'Website hinzufügen',
  activateMonitoring: 'Monitoring aktivieren',
  openDashboard:      'Dashboard öffnen',
  exportEvidence:     'Evidence exportieren',
  downloadReport:     'Report herunterladen',
  upgrade:            'Jetzt upgraden',
  startPlan:          'Tarif starten',
  enterprise:         'Enterprise anfragen',
  foundingAccess:     'Founding Access sichern',
  startFreeAudit:     'Kostenlosen Audit starten',
  viewAutomationSkills: 'Automation Skills ansehen',
  applyForBeta:       'Für Beta bewerben',
  // Governance-OS-Positionierung — Self-Serve, kein Demo-/Sales-Zwang.
  startTrial:         '14 Tage gratis starten',
  startGovernanceAudit: 'Governance Audit starten',
} as const;

export type CtaLabel = (typeof CTA)[keyof typeof CTA];

/**
 * CI-ENFORCED: Mehrwort-CTA-Phrasen, die im öffentlichen Frontend
 * (src/pages, src/components) NICHT vorkommen dürfen. Bewusst präzise
 * (Mehrwort), damit legitime Inhalte — „Pilotkunden", der Pflicht-
 * Disclaimer „ersetzt keine Rechtsberatung", die Positionierung „Tools
 * statt Beratung" — NICHT fälschlich gebrochen werden.
 *
 * Der Grep-Gate in `.github/workflows/cta-enforcement.yml` prüft genau
 * diese Liste. Build schlägt fehl, wenn eine Phrase auftaucht.
 */
export const CI_FORBIDDEN_CTA = [
  'Pilot anfragen',
  'Pilot starten',
  'Demo anfragen',
  'Demo buchen',
  'Gespräch buchen',
  'Call buchen',
  'Migration-Call',
  'Strategie-Call',
  'Beratung-Call',
  'Sales-Call',
  'Partner-Gespräch',
  'Erstgespräch',
  'Beratung anfragen',
  'Beratungstermin',
  'Vertrieb kontaktieren',
  'Sales kontaktieren',
] as const;

/**
 * Dokumentations-Liste (NICHT hart CI-enforced): Vokabular, das in
 * Marketing-Copy vermieden werden soll. Bare-Word-Begriffe wie „Beratung"
 * / „Pilot" stehen hier nur als Leitlinie — sie haben legitime Kontexte
 * (Disclaimer, Positionierung „Tools statt Beratung", „Pilotkunden") und
 * werden deshalb NICHT vom CI-Gate geprüft.
 */
export const FORBIDDEN_TERMS = [
  'Managed-Hosting',
  'Managed Service',
  'Managed-Service',
  'Done-for-you',
  '30 minute call',
  '30-Minuten-Call',
  'Book a call',
  'Implementation Package',
  'Request quote',
  'Tarif anfragen',
  ...CI_FORBIDDEN_CTA,
  'Kontaktieren Sie uns',
  'Projekt anfragen',
  'Website-Service',
  'Agency Service',
  'Agentur',
  'Rebuild',
  'Consulting',
] as const;
