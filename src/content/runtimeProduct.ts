import { CTA } from './runtimeVocab';

/**
 * RealSync Runtime — Product Surface inside the RealSync Dynamics AI ecosystem.
 *
 * The Root-SPA remains the company (Governance OS, Scan, Stripe self-service).
 * This module is the sellable Control-Runtime product: one control loop,
 * three domain packs, Richtpreise after architecture review.
 *
 * Isolation rules (enforced by test/landing/runtime-product.test.ts):
 * - SKUs live only here and on `/runtime`. Never on `/pricing`.
 * - Contact CTA is `CTA.enterprise` only. No Demo-/Pilot-/Angebot-language.
 * - Demo telemetry on `/runtime` stays labeled as demo.
 * - No safety-critical or certification claims.
 */

export const RUNTIME_PRODUCT_NAME = 'RealSync Runtime';
export const RUNTIME_COMPANY_NAME = 'RealSync Dynamics AI';

export const RUNTIME_PRODUCT = {
  name: RUNTIME_PRODUCT_NAME,
  company: RUNTIME_COMPANY_NAME,
  productOf: 'Ein Produkt von RealSync Dynamics AI',
  eyebrow: 'PRODUKT · REALSYNC RUNTIME',
  headline: 'Eine Runtime. Steuern Sie jedes intelligente System.',
  subheadline:
    'RealSync Runtime verbindet KI, Software, Agenten und industrielle Systeme zu einer gesteuerten Control Plane — beobachtet Ereignisse, setzt Policies durch, bewertet Risiko und erzeugt nachprüfbare Nachweise.',
  exploreCta: CTA.exploreRuntime,
  exploreHref: '#loop',
  enterpriseHref: '/contact-sales?intent=runtime&source=runtime-product',
  trust: ['KI', 'Agenten', 'Software', 'Industrie'] as const,
  demoLabel: 'Demo-Runtime · simulierte Ereignisse · keine Kundendaten',
  notSafetyCritical:
    'Die Runtime ersetzt keine sicherheitszertifizierte Anlagensteuerung und stellt keine Zertifizierung, Rechtsberatung oder Audit-Garantie dar.',
} as const;

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
 * Architecture-review SKUs. Non-binding Richtpreise.
 * Must never land on the self-service `/pricing` page (Free / 49 € / 199 €).
 */
export const RUNTIME_SKUS = [
  {
    id: 'core',
    name: 'Runtime Core',
    price: 'ab 4.900 €',
    period: '/ Monat',
    note: 'Richtpreis. Verbindliches Angebot nach Architektur-Review.',
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
    note: 'Core plus ein Domain Pack. Weitere Packs als Erweiterung.',
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
    note: 'Für Konzerne mit OT, mehreren Mandanten und Edge.',
    pitch: 'Edge, Isolation, Human Gates und vertragliche Governance.',
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

export const RUNTIME_SKU_DISCLAIMER =
  'Richtpreise, nicht bindend. Verbindliches Angebot nach Architektur-Review. ' +
  'Kein Self-Service-Checkout — getrennt von den Governance-OS-Tarifen Free, Monitoring (49 €) und Governance (199 €).';

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
    to: '/monitoring',
    label: 'monitoring',
    title: 'Ereignis-Feed.',
    blurb:
      'Drift-Ereignisse, KI-Klassifikationen, Evidence-Anchors — in der Demo gestreamt, in der Pilot-Phase persistiert.',
    tone: 'cyan' as const,
  },
  {
    to: '/governance-runtime',
    label: 'governance',
    title: 'Kontrollen & Policies.',
    blurb:
      'Dokumentierte Kontrollen ordnen KI-Systeme den Policies zu. Status, Scope, Verantwortliche — eine Übersicht.',
    tone: 'amber' as const,
  },
  {
    to: '/agents',
    label: 'agents',
    title: 'Autonome Compliance-Agenten.',
    blurb: 'Agenten überwachen Drift, KI-Risiko, Evidence und Policies — ohne manuelles Triage-Backlog.',
    tone: 'violet' as const,
  },
  {
    to: '/evidence',
    label: 'evidence',
    title: 'Audit-Kette.',
    blurb:
      'Jeder Befund kanonisch gehasht (SHA-256), jede Agent-Aktion verankert. Reportable und nachverfolgbar — keine pauschale Rechtsgarantie.',
    tone: 'emerald' as const,
  },
] as const;
