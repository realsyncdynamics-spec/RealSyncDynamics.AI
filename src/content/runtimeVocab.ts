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

/** 4 plans only — no historic Starter/Growth/Agency/Enterprise mix. */
export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'One scan',
    headline: '€0',
    bullets: ['1× Free Audit', 'Score + Top-3 Findings', 'Keine Karte nötig'],
    cta: { label: 'Run scan', to: '/audit?source=pricing-free', kind: 'primary' as const },
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    tagline: 'Continuous runtime',
    headline: '€49',
    bullets: ['1 Domain · 24/7 Drift', 'Email + Slack Alerts', 'Weekly Re-Scan', 'Evidence-Chain'],
    cta: { label: 'Enable monitoring', to: '/audit?plan=monitoring', kind: 'primary' as const },
  },
  {
    id: 'governance',
    name: 'Governance',
    tagline: 'AI Act layer',
    headline: '€199',
    bullets: ['AI-Usecase-Registry', 'AI-Act-Klassifikation', 'Policies · DPIA-Templates', 'Audit-Trail · §13 Drafts'],
    cta: { label: 'Enable governance', to: '/audit?plan=governance', kind: 'primary' as const },
  },
  {
    id: 'scale',
    name: 'Scale',
    tagline: 'Multi-domain',
    headline: 'Custom',
    bullets: ['Unlimited Domains', 'Agent-Customisation', 'SSO · SCIM', 'Dedicated Runtime'],
    cta: { label: 'Talk to runtime', to: '/contact-sales?intent=scale', kind: 'secondary' as const },
  },
] as const;

/**
 * Canonical CTA copy. The ONLY 5 strings allowed on public CTAs after the
 * Product Clarity Cleanup. New copy MUST be one of these — anything else
 * is a regression.
 *
 *   Scan starten          → kick off a free audit
 *   Runtime öffnen        → enterprise / contact-driven entry
 *   Monitoring aktivieren → Starter tier
 *   Governance aktivieren → Growth / Agency tier
 *   Evidence ansehen      → secondary nav into evidence vault / audit trail
 */
export const CTA = {
  runScan:            'Scan starten',
  openRuntime:        'Runtime öffnen',
  activateMonitoring: 'Monitoring aktivieren',
  activateGovernance: 'Governance aktivieren',
  viewEvidence:       'Evidence ansehen',
} as const;

export type CtaLabel = (typeof CTA)[keyof typeof CTA];

/**
 * Vocabulary that must NOT appear in any public-facing copy. Enforce by
 * grep before merging. Order matters for `replace_all` runs — longer
 * substrings first.
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
  'Beratung anfragen',
  'Beratungstermin',
  'Kontaktieren Sie uns',
  'Projekt anfragen',
  'Website-Service',
  'Agency Service',
  'Agentur',
  'Rebuild',
  'Consulting',
  'Beratung',
  'Projekt',
  'Übergabe',
] as const;
