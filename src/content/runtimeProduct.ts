import { CTA } from './runtimeVocab';

/**
 * RealSync Runtime — Product Surface inside the RealSync Dynamics AI ecosystem.
 *
 * Jobs:
 *   `/`         Company (Governance OS, Scan, Self-Service)
 *   `/runtime`  Product (problem → loop → value → architecture-review SKUs)
 *   `/governance-runtime`  Operational demo of the live Governance OS
 *   `/pricing`  Self-service only (Free / Monitoring / Governance)
 *
 * Isolation (test/landing/runtime-product.test.ts):
 * - SKUs never on `/pricing`
 * - Contact CTA is `CTA.enterprise` only
 * - Demo telemetry lives on `/governance-runtime`, not in the product hero
 * - No safety-critical or certification claims
 */

export const RUNTIME_PRODUCT_NAME = 'RealSync Runtime';
export const RUNTIME_COMPANY_NAME = 'RealSync Dynamics AI';

export const RUNTIME_PRODUCT = {
  name: RUNTIME_PRODUCT_NAME,
  company: RUNTIME_COMPANY_NAME,
  productOf: 'Ein Produkt von RealSync Dynamics AI',
  eyebrow: 'PRODUKT · REALSYNC RUNTIME',
  problem: 'Policies liegen in Dokumenten. Risiko im Quartalsbericht. Nachweis nach dem Vorfall.',
  headline: 'Eine Runtime. Steuerung, während das System läuft.',
  subheadline:
    'RealSync Runtime ist die Control Plane für KI, Software und industrielle Systeme: beobachten, entscheiden, nachweisen. Kein Meldesystem. Keine Checkliste.',
  exploreCta: CTA.exploreRuntime,
  exploreHref: '#loop',
  enterpriseHref: '/contact-sales?intent=runtime&source=runtime-product',
  trust: ['KI', 'Agenten', 'Software', 'Industrie'] as const,
  demoLabel: 'Demo-Vorschau · simulierte Ereignisse · keine Kundendaten',
  surfacesEyebrow: 'Operative Surfaces · Demo',
  surfacesLead:
    'Die laufende Governance-OS-Vorschau liegt auf einer eigenen Seite — getrennt von diesem Produkt.',
  notSafetyCritical:
    'Die Runtime ersetzt keine sicherheitszertifizierte Anlagensteuerung und stellt keine Zertifizierung, Rechtsberatung oder Audit-Garantie dar.',
} as const;

export const RUNTIME_BENEFITS = [
  {
    id: 'loop',
    title: 'Ein Loop',
    copy: 'Dieselbe Schleife über KI, Software und Industrie — Systeme werden angebunden, nicht ersetzt.',
  },
  {
    id: 'policy',
    title: 'Policy als Control',
    copy: 'Regeln werden ausgeführt und versioniert, nicht als PDF abgeheftet.',
  },
  {
    id: 'risk',
    title: 'Risiko als Zustand',
    copy: 'Score und Trend mit jedem Ereignis. Kein Quartalsbericht als Quelle der Wahrheit.',
  },
  {
    id: 'evidence',
    title: 'Nachweis als Kette',
    copy: 'Jede Entscheidung gehasht und verkettet — nicht als Export hinterher.',
  },
] as const;

export const RUNTIME_CONTROL_LOOP = [
  { id: 'observe', label: 'Beobachten', copy: 'Ereignisse aus jedem angebundenen System aufnehmen.' },
  { id: 'understand', label: 'Verstehen', copy: 'Operativen Kontext aus korrelierten Signalen aufbauen.' },
  { id: 'assess', label: 'Bewerten', copy: 'Policy-Treffer und lebendes Risiko auswerten.' },
  { id: 'decide', label: 'Entscheiden', copy: 'Ein autorisiertes Ergebnis wählen.' },
  { id: 'authorize', label: 'Freigabe', copy: 'Akteur, Scope und menschliche Gates bestätigen.' },
  { id: 'act', label: 'Handeln', copy: 'Die begrenzte Aktion ausführen.' },
  { id: 'verify', label: 'Prüfen', copy: 'Bestätigen, dass sich die Welt wie vorgesehen bewegt hat.' },
  { id: 'evidence', label: 'Nachweis', copy: 'Kette versiegeln. Datensatz hashen.' },
  { id: 'learn', label: 'Lernen', copy: 'Ergebnisse zurück in die Beobachtung speisen.' },
] as const;

export const RUNTIME_DOMAINS = [
  {
    id: 'ai',
    eyebrow: 'Digitale Kognition',
    title: 'KI & Agenten',
    statement: 'Modelle, Agenten, KI-Anwendungen und autonome Workflows steuern.',
    capabilities: ['KI-Governance', 'Agent-Governance', 'Modellaufsicht', 'Policy-Durchsetzung', 'Nachweis'],
  },
  {
    id: 'software',
    eyebrow: 'Delivery-Systeme',
    title: 'Software',
    statement: 'Software-Lebenszyklusereignisse von der Entwicklung bis zum Deployment steuern.',
    capabilities: ['CI/CD-Governance', 'API-Governance', 'Deployment-Controls', 'Sicherheits-Policies', 'Auditierbarkeit'],
  },
  {
    id: 'industrial',
    eyebrow: 'Physische Operationen',
    title: 'Industrie',
    statement:
      'Physische Operationen an gesteuerte Intelligenz anbinden — ohne Anspruch auf sicherheitszertifizierte Anlagensteuerung.',
    capabilities: ['Industrietelemetrie', 'Anomalieerkennung', 'Predictive Quality', 'Edge-Governance', 'Operator-Intelligenz'],
  },
] as const;

/**
 * Architecture-review SKUs. Non-binding Orientierungspreise.
 * Must never land on the self-service `/pricing` page.
 */
export const RUNTIME_SKUS = [
  {
    id: 'core',
    name: 'Runtime Core',
    price: 'ab 4.900 €',
    period: '/ Monat',
    note: 'Richtpreis zur Orientierung. Kein Listenpreis, kein Checkout. Architektur-Review.',
    pitch: 'Die Steuerungsplane: Event, Policy, Risk, Decision, Control, Nachweis.',
    features: [
      'Eine Control Plane für angebundene Systeme',
      'Policy- und Risk-Engine',
      'Nachweis-Graph (hash-verkettet)',
      'Operator-Copilot, evidenzgestützt',
      'API, SDK, Webhooks',
      'Tenant-Isolation und RBAC',
    ],
    intent: 'runtime-core',
    featured: false,
  },
  {
    id: 'domain',
    name: 'Runtime + Domain Pack',
    price: 'ab 6.800 €',
    period: '/ Monat',
    note: 'Richtpreis zur Orientierung. Core plus ein Domain Pack nach Architektur-Review.',
    pitch: 'Dieselbe Runtime, erweitert um KI, Software oder Industrie.',
    features: [
      'Alles aus Runtime Core',
      'Ein Domain Pack Ihrer Wahl',
      'Domänenspezifische Policies',
      'Konnektoren der gewählten Domäne',
      'Dashboard-Oberfläche',
      'Architektur-Review inklusive Onboarding',
    ],
    intent: 'runtime-domain',
    featured: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Auf Anfrage',
    period: '',
    note: 'Auf Anfrage nach Architektur-Review. Vertrag, Isolation, Edge.',
    pitch: 'Mehrere Packs, Edge vor Ort, Human Gates, vertragliche Governance.',
    features: [
      'Mehrere Domain Packs',
      'Edge Runtime vor Ort',
      'Harte Mandantentrennung',
      'Human-Approval-Pfade',
      'Nachweis-Export für Audit',
      'Benannte Ansprechpartner',
    ],
    intent: 'runtime-enterprise',
    featured: false,
  },
] as const;

/** Shown only on `/runtime` packs — never on the homepage band. */
export const RUNTIME_SKU_DISCLAIMER =
  'Richtpreise zur Orientierung für das Architektur-Review, nicht bindend. Kein Listenpreis, kein Self-Service-Checkout. ' +
  'Diese Beträge stehen nicht unter Preise. Das Governance OS bleibt Free / Monitoring / Governance.';

/** Homepage band — no euro amounts, no self-service mix. */
export const RUNTIME_BAND_NOTE =
  'Enterprise-Produkt im Ökosystem. Richtpreise nach Architektur-Review — nicht im Self-Service.';

export const RUNTIME_ENGINES = [
  { id: 'event', name: 'Event Engine', copy: 'Normierter Ingest über KI-, Software- und Industriequellen.' },
  { id: 'policy', name: 'Policy Engine', copy: 'Versionierte, maschinenlesbare Controls.' },
  { id: 'risk', name: 'Risk Engine', copy: 'Lebendes, mehrdimensionales Scoring.' },
  { id: 'decision', name: 'Decision Engine', copy: 'Gesteuerte Entscheidung, optional mit Human Gate.' },
  { id: 'control', name: 'Control Engine', copy: 'Nur autorisierte Aktuierung. Keine ungebundene Automation.' },
  { id: 'evidence', name: 'Evidence Engine', copy: 'Hash-verketteter Nachweis jeder Handlung.' },
] as const;

export const RUNTIME_SURFACES = [
  {
    to: '/governance-runtime',
    label: 'governance-runtime',
    title: 'Operative Vorschau.',
    blurb: 'Dashboard des Governance OS: Events, Policies, Assets. Demo-Daten, keine Kundentelemetrie.',
    tone: 'amber' as const,
  },
  {
    to: '/monitoring',
    label: 'monitoring',
    title: 'Ereignis-Feed.',
    blurb: 'Drift, Klassifikation, Evidence-Anchors — in der Demo gestreamt.',
    tone: 'cyan' as const,
  },
  {
    to: '/agents',
    label: 'agents',
    title: 'Compliance-Agenten.',
    blurb: 'Agenten zu Drift, Risiko, Evidence und Policy — Demo-Surface.',
    tone: 'violet' as const,
  },
  {
    to: '/evidence',
    label: 'evidence',
    title: 'Audit-Kette.',
    blurb: 'Gehashte Befunde und Aktionen. Reportable — keine Rechtsgarantie.',
    tone: 'emerald' as const,
  },
] as const;
