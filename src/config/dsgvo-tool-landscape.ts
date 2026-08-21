/**
 * DSGVO-Tool-Landschaft — Single Source of Truth für die öffentliche
 * Vergleichsseite `/dsgvo-tool-vergleich`.
 *
 * Warum hier und nicht in der Page: §6 CLAUDE.md — Vergleichsdaten sind
 * Inhalt, keine Darstellung. Sie werden auch von Sales-Material und
 * Landing-Pages gebraucht; doppelte Pflege führt zu widersprüchlichen
 * Preisangaben und damit zu wettbewerbsrechtlichem Risiko (§ 6 UWG:
 * vergleichende Werbung muss objektiv und nachprüfbar sein).
 *
 * Wertungen in `matrix`:
 *   yes      Capability ist im Standard-Angebot vollständig abgebildet.
 *   partial  Teil-Funktion (nur Add-on, nur manuell, ohne Continuous-Aspekt).
 *   no       Nicht Teil des Produkts.
 *
 * Preisangaben sind öffentlich kommunizierte Einstiegspreise (Listenpreise),
 * gerundet und ohne Gewähr. Enterprise-Tarife sind marktüblich "auf Anfrage"
 * und daher als Spanne angegeben. Stand siehe LANDSCAPE_AS_OF.
 */

import { COMPETITOR_PRICING } from './competitor-pricing';

// ─── Stand ───────────────────────────────────────────────────────────────────
// Detail-Matrix und Marktüberblick haben bewusst getrennte Stände: die
// Matrix-Wertungen sind einzeln belegt und werden seltener revidiert als die
// Preisspannen des breiten Überblicks.

/** Stand der 7 detailliert bewerteten Anbieter (Feature-Matrix). */
export const MATRIX_AS_OF_LABEL = 'August 2026';

/** Stand des breiten Marktüberblicks (Preise, Positionierung). */
export const LANDSCAPE_AS_OF_LABEL = 'August 2026';

// ─── Typen ───────────────────────────────────────────────────────────────────

export type Rating = 'yes' | 'partial' | 'no';

/** Sitz des Anbieters — relevant für die Drittlandsbewertung (Schrems II). */
export type Origin = 'EU' | 'US' | 'UK' | 'CA' | 'IL';

/**
 * Rechtsgrundlage der Datenübermittlung. Bewusst drei Stufen statt
 * "EU ja/nein": UK, Kanada und Israel haben Angemessenheitsbeschlüsse der
 * EU-Kommission, sind also NICHT mit den USA gleichzusetzen. Für die USA
 * greift das EU-US Data Privacy Framework bzw. es braucht SCC + TIA.
 */
export type TransferBasis = 'eu-intern' | 'angemessenheitsbeschluss' | 'drittland-garantien';

export type CategoryKey = 'cmp' | 'privacy-management' | 'monitoring' | 'spezialisiert';

/** Die 6 Capabilities der Detail-Matrix. */
export interface CapabilityMatrix {
  cookieConsent: Rating;
  avvGenerator: Rating;
  auditLog: Rating;
  aiAct: Rating;
  dsfaWizard: Rating;
  euHosted: Rating;
}

export interface DsgvoTool {
  name: string;
  vendor: string;
  url: string;
  origin: Origin;
  transfer: TransferBasis;
  category: CategoryKey;
  /** Öffentlich kommunizierter Einstiegspreis, gerundet. */
  pricingFrom: string;
  /** Wofür der Anbieter am Markt steht — sachlich, keine Wertung. */
  strengths: string;
  /** Typische Zielgruppe laut Anbieter-Positionierung. */
  bestFor: string;
  /** Abgedeckte Funktionsbereiche (Chips unter dem Tool-Namen). */
  capabilities: readonly string[];
  /** Nur gesetzt für die 7 detailliert bewerteten Anbieter. */
  matrix?: CapabilityMatrix;
  /** Zusatzhinweis in der Detail-Ansicht. */
  notes?: string;
}

// ─── Kategorien ──────────────────────────────────────────────────────────────

export interface ToolCategory {
  key: CategoryKey;
  label: string;
  focus: string;
}

export const TOOL_CATEGORIES: readonly ToolCategory[] = [
  {
    key: 'cmp',
    label: 'Consent Management Platforms (CMP)',
    focus:
      'Cookie-Banner und Einwilligungen. Fokus auf Website-Tracking, § 25 TDDDG / ePrivacy und Google Consent Mode v2.',
  },
  {
    key: 'privacy-management',
    label: 'Datenschutz-Management-Plattformen',
    focus:
      'Verarbeitungsverzeichnis (Art. 30 DSGVO), DSFA (Art. 35), Betroffenenrechte (Art. 15–22), AV-Verträge und Löschkonzepte.',
  },
  {
    key: 'monitoring',
    label: 'Continuous Monitoring & AI-Governance',
    focus:
      'Laufende technische Überwachung statt Einmal-Audit, plus KI-Klassifikation nach EU AI Act. Junge Kategorie, entstanden 2025/26.',
  },
  {
    key: 'spezialisiert',
    label: 'Spezialisierte Ergänzungen',
    focus:
      'Punktlösungen für DSAR-Automatisierung, Daten-Discovery (DSPM), datenschutzfreundliche Analytics und Multi-Framework-GRC.',
  },
] as const;

// ─── Anbieter ────────────────────────────────────────────────────────────────

export const DSGVO_TOOLS: readonly DsgvoTool[] = [
  // ── Continuous Monitoring & AI-Governance ────────────────────────────────
  {
    name: 'RealSyncDynamics.AI',
    vendor: 'RealSync Dynamics',
    url: 'https://RealSyncDynamicsAI.de',
    origin: 'EU',
    transfer: 'eu-intern',
    category: 'monitoring',
    pricingFrom: '79 €/M (Starter)',
    strengths:
      'Kontinuierlicher Website- und Tracking-Scan, Evidence Vault mit Hash-Chain, AI-Act-Klassifikation, optionaler EU-lokaler Modell-Betrieb.',
    bestFor: 'Teams, die KI einsetzen und laufende Nachweisbarkeit brauchen',
    capabilities: ['Cookie-Consent', 'AVV', 'Audit-Log', 'AI-Act', 'DSFA'],
    matrix: {
      cookieConsent: 'yes', avvGenerator: 'yes', auditLog: 'yes',
      aiAct: 'yes', dsfaWizard: 'yes', euHosted: 'yes',
    },
    notes: 'All-in-One für KI-First-Compliance · BAIT/MaRisk-tauglich · Made in Germany',
  },

  // ── Consent Management Platforms ─────────────────────────────────────────
  {
    name: 'Cookiebot (Cybot)',
    vendor: 'Cybot A/S',
    url: 'https://cookiebot.com',
    origin: 'EU',
    transfer: COMPETITOR_PRICING.Cookiebot.transfer,
    category: 'cmp',
    pricingFrom: COMPETITOR_PRICING.Cookiebot.pricing,
    strengths: 'Einfacher Einstieg, automatischer Cookie-Crawler, TCF 2.2.',
    bestFor: 'KMU und WordPress-Sites',
    capabilities: ['Cookie-Consent'],
    matrix: {
      cookieConsent: 'yes', avvGenerator: 'no', auditLog: 'no',
      aiAct: 'no', dsfaWizard: 'no', euHosted: 'partial',
    },
    notes: 'Dänisch, günstig · Server in EU + US · kein KI-Tooling',
  },
  {
    name: 'Usercentrics',
    vendor: 'Usercentrics GmbH',
    url: 'https://usercentrics.com',
    origin: 'EU',
    transfer: 'eu-intern',
    category: 'cmp',
    pricingFrom: COMPETITOR_PRICING.Usercentrics.pricing,
    strengths: 'Stark bei Apps und Multi-Domain-Setups, TCF 2.2, A/B-Testing des Banners.',
    bestFor: 'Mittelstand mit mehreren Domains und Apps',
    capabilities: ['Cookie-Consent'],
    matrix: {
      cookieConsent: 'yes', avvGenerator: 'no', auditLog: 'no',
      aiAct: 'no', dsfaWizard: 'no', euHosted: 'yes',
    },
    notes: 'Cookie-Banner-Marktführer DACH · keine AVV/AI-Tools',
  },
  {
    name: 'iubenda',
    vendor: 'iubenda s.r.l.',
    url: 'https://iubenda.com',
    origin: 'EU',
    transfer: 'eu-intern',
    category: 'cmp',
    pricingFrom: '~5–30 €/M',
    strengths: 'Banner plus Generator für Datenschutzerklärung und AGB, einfache DSAR-Annahme.',
    bestFor: 'Kleine bis mittlere Websites',
    capabilities: ['Cookie-Consent', 'Policy-Generator', 'DSAR'],
  },
  {
    name: 'Didomi',
    vendor: 'Didomi SAS',
    url: 'https://didomi.io',
    origin: 'EU',
    transfer: 'eu-intern',
    category: 'cmp',
    pricingFrom: 'ab ~200 €/M · Enterprise auf Anfrage',
    strengths: 'Enterprise-Consent mit Preference-Center und Consent-Analytics.',
    bestFor: 'Größere Publisher und Medienhäuser',
    capabilities: ['Cookie-Consent', 'Preference-Center', 'Consent-Analytics'],
  },
  {
    name: 'Osano',
    vendor: 'Osano Inc.',
    url: 'https://osano.com',
    origin: 'US',
    transfer: 'drittland-garantien',
    category: 'cmp',
    pricingFrom: 'ab ~200 €/M · Enterprise auf Anfrage',
    strengths: 'Consent plus Vendor-Risk-Scoring und Datenschutz-Monitoring von Drittanbietern.',
    bestFor: 'Größere Publisher mit vielen Drittanbietern',
    capabilities: ['Cookie-Consent', 'Vendor-Risk', 'DSAR'],
  },
  {
    name: 'Complianz',
    vendor: 'Really Simple Plugins B.V.',
    url: 'https://complianz.io',
    origin: 'EU',
    transfer: 'eu-intern',
    category: 'cmp',
    pricingFrom: 'Free – 45 €/Jahr',
    strengths: 'WordPress-Plugin mit regionalem Consent-Routing, sehr günstig.',
    bestFor: 'WordPress-Shops und kleine Sites',
    capabilities: ['Cookie-Consent'],
  },
  {
    name: 'Borlabs Cookie',
    vendor: 'Borlabs GmbH',
    url: 'https://borlabs.io',
    origin: 'EU',
    transfer: 'eu-intern',
    category: 'cmp',
    pricingFrom: COMPETITOR_PRICING.BorlabsCookie.pricing,
    strengths: 'Etabliertes deutsches WordPress-Plugin mit Content-Blocker.',
    bestFor: 'Deutsche WordPress-Sites',
    capabilities: ['Cookie-Consent'],
    matrix: {
      cookieConsent: 'yes', avvGenerator: 'no', auditLog: 'no',
      aiAct: 'no', dsfaWizard: 'no', euHosted: 'yes',
    },
    notes: 'WordPress-only · günstig, aber nur Cookie-Banner',
  },

  // ── Datenschutz-Management-Plattformen ───────────────────────────────────
  {
    name: 'DataGuard',
    vendor: 'DataGuard GmbH',
    url: 'https://dataguard.de',
    origin: 'EU',
    transfer: 'eu-intern',
    category: 'privacy-management',
    pricingFrom: COMPETITOR_PRICING.DataGuard.pricing,
    strengths: 'Software kombiniert mit deutscher Beratung und externem DSB.',
    bestFor: 'DACH-Mittelstand mit DSB-Pflicht',
    capabilities: ['DSB-as-a-Service', 'AVV', 'DSFA'],
    matrix: {
      cookieConsent: 'partial', avvGenerator: 'yes', auditLog: 'no',
      aiAct: 'no', dsfaWizard: 'yes', euHosted: 'yes',
    },
    notes: 'Externer DSB + Tools · personell-getrieben · keine KI-Compliance',
  },
  {
    name: 'heyData',
    vendor: 'heyData GmbH',
    url: 'https://heydata.eu',
    origin: 'EU',
    transfer: 'eu-intern',
    category: 'privacy-management',
    pricingFrom: 'ab ~200–400 €/M',
    strengths: 'Deutschsprachig, DSB-nah, Schulungen und Vertragsvorlagen inklusive.',
    bestFor: 'KMU mit DSB-Pflicht',
    capabilities: ['DSB-as-a-Service', 'VVT', 'AVV', 'Schulungen'],
  },
  {
    name: 'Proliance',
    vendor: 'Proliance GmbH (datenschutzexperte.de)',
    url: 'https://datenschutzexperte.de',
    origin: 'EU',
    transfer: 'eu-intern',
    category: 'privacy-management',
    pricingFrom: 'ab ~200–400 €/M',
    strengths: 'Externer DSB mit Portal, starke Beratungskomponente im deutschen Markt.',
    bestFor: 'KMU mit DSB-Pflicht',
    capabilities: ['DSB-as-a-Service', 'VVT', 'AVV', 'DSFA'],
  },
  {
    name: 'caralegal',
    vendor: 'caralegal GmbH',
    url: 'https://caralegal.eu',
    origin: 'EU',
    transfer: 'eu-intern',
    category: 'privacy-management',
    pricingFrom: 'ab ~79–300 €/M',
    strengths: 'EU-Hosting, Workflow-orientiertes VVT und DSFA, KI-Unterstützung bei der Pflege.',
    bestFor: 'SMEs und Datenschutzteams',
    capabilities: ['VVT', 'DSFA', 'DSAR', 'AVV'],
  },
  {
    name: 'Dastra',
    vendor: 'Dastra SAS',
    url: 'https://dastra.eu',
    origin: 'EU',
    transfer: 'eu-intern',
    category: 'privacy-management',
    pricingFrom: 'ab ~79–300 €/M',
    strengths: 'Französische Plattform mit EU-Hosting, gutes Preis-Leistungs-Verhältnis beim VVT.',
    bestFor: 'SMEs mit eigenem Datenschutzteam',
    capabilities: ['VVT', 'DSFA', 'DSAR'],
  },
  {
    name: 'Legiscope',
    vendor: 'Legiscope SAS',
    url: 'https://legiscope.com',
    origin: 'EU',
    transfer: 'eu-intern',
    category: 'privacy-management',
    pricingFrom: 'ab ~79–300 €/M',
    strengths: 'EU-Hosting, automatisierte Erfassung von Verarbeitungstätigkeiten.',
    bestFor: 'SMEs mit begrenztem Budget',
    capabilities: ['VVT', 'DSFA', 'DSAR'],
  },
  {
    name: 'OneTrust',
    vendor: 'OneTrust LLC',
    url: 'https://onetrust.com',
    origin: 'US',
    transfer: 'drittland-garantien',
    category: 'privacy-management',
    pricingFrom: COMPETITOR_PRICING.OneTrust.pricing,
    strengths: 'Marktführer mit sehr breitem Modulumfang: Consent, GRC, Drittanbieter-Risiko, AI-Act-Modul.',
    bestFor: 'Konzerne mit eigenem Privacy-Team',
    capabilities: ['Cookie-Consent', 'AVV', 'DSFA'],
    matrix: {
      cookieConsent: 'yes', avvGenerator: 'yes', auditLog: 'partial',
      aiAct: 'partial', dsfaWizard: 'yes', euHosted: 'partial',
    },
    notes: 'Enterprise-Tier komplex · Schrems-II-Risiko · keine integrierten KI-Audit-Logs',
  },
  {
    name: 'TrustArc',
    vendor: 'TrustArc Inc.',
    url: 'https://trustarc.com',
    origin: 'US',
    transfer: 'drittland-garantien',
    category: 'privacy-management',
    pricingFrom: COMPETITOR_PRICING.TrustArc.pricing,
    strengths: 'Etablierte Assessment- und DSFA-Methodik, umfangreiche Zertifizierungsprogramme.',
    bestFor: 'Enterprise mit internationalem Footprint',
    capabilities: ['Cookie-Consent', 'DSFA'],
    matrix: {
      cookieConsent: 'yes', avvGenerator: 'partial', auditLog: 'no',
      aiAct: 'no', dsfaWizard: 'yes', euHosted: 'partial',
    },
    notes: 'Stark in DSFA · schwach in KI-Compliance · US-DPA',
  },
  {
    name: 'Securiti',
    vendor: 'Securiti Inc.',
    url: 'https://securiti.ai',
    origin: 'US',
    transfer: 'drittland-garantien',
    category: 'privacy-management',
    pricingFrom: 'auf Anfrage',
    strengths: 'Verbindet Privacy-Management mit Daten-Discovery und AI-Risk-Management.',
    bestFor: 'Enterprise mit großen Datenbeständen',
    capabilities: ['VVT', 'DSAR', 'DSPM', 'AI-Risk'],
  },

  // ── Spezialisierte Ergänzungen ──────────────────────────────────────────
  {
    name: 'MineOS',
    vendor: 'Mine Inc.',
    url: 'https://saymine.com',
    origin: 'IL',
    transfer: 'angemessenheitsbeschluss',
    category: 'spezialisiert',
    pricingFrom: 'auf Anfrage',
    strengths: 'DSAR-Automatisierung mit automatischer Daten-Discovery über angebundene Systeme.',
    bestFor: 'Unternehmen mit hohem DSAR-Aufkommen',
    capabilities: ['DSAR', 'Daten-Discovery'],
  },
  {
    name: 'DataGrail',
    vendor: 'DataGrail Inc.',
    url: 'https://datagrail.io',
    origin: 'US',
    transfer: 'drittland-garantien',
    category: 'spezialisiert',
    pricingFrom: 'auf Anfrage',
    strengths: 'DSAR-Workflows mit breiter Integrationsbibliothek in SaaS-Systeme.',
    bestFor: 'US-nahe Unternehmen mit vielen SaaS-Tools',
    capabilities: ['DSAR', 'Daten-Discovery'],
  },
  {
    name: 'BigID',
    vendor: 'BigID Inc.',
    url: 'https://bigid.com',
    origin: 'US',
    transfer: 'drittland-garantien',
    category: 'spezialisiert',
    pricingFrom: 'auf Anfrage',
    strengths: 'Daten-Discovery und Klassifikation (DSPM) über große, heterogene Datenbestände.',
    bestFor: 'Enterprise mit Data-Lake-Landschaften',
    capabilities: ['DSPM', 'Daten-Discovery', 'Klassifikation'],
  },
  {
    name: 'Cyera',
    vendor: 'Cyera Ltd.',
    url: 'https://cyera.io',
    origin: 'IL',
    transfer: 'angemessenheitsbeschluss',
    category: 'spezialisiert',
    pricingFrom: 'auf Anfrage',
    strengths: 'Cloud-native Daten-Sicherheitslage (DSPM) mit Fokus auf sensible Daten.',
    bestFor: 'Cloud-lastige Enterprise-Umgebungen',
    capabilities: ['DSPM', 'Daten-Discovery'],
  },
  {
    name: 'Strac',
    vendor: 'Strac Inc.',
    url: 'https://strac.io',
    origin: 'US',
    transfer: 'drittland-garantien',
    category: 'spezialisiert',
    pricingFrom: 'ab ~100 €/M',
    strengths: 'DLP und Redaktion sensibler Daten in SaaS-Kanälen wie Slack oder Zendesk.',
    bestFor: 'Teams mit sensiblen Daten in Support-Tools',
    capabilities: ['DSPM', 'DLP'],
  },
  {
    name: 'Matomo',
    vendor: 'InnoCraft Ltd. / Matomo-Community',
    url: 'https://matomo.org',
    origin: 'EU',
    transfer: 'eu-intern',
    category: 'spezialisiert',
    pricingFrom: 'Self-hosted kostenlos · Cloud ab ~25 €/M',
    strengths: 'Self-hosted oder EU-Cloud, Rohdatenbesitz, cookiefreier Betrieb möglich.',
    bestFor: 'Alle, die Analytics ohne US-Transfer brauchen',
    capabilities: ['Analytics'],
    notes: 'Cloud-Hosting in der EU; Self-Hosting lässt die Daten vollständig im eigenen Haus.',
  },
  {
    name: 'Plausible',
    vendor: 'Plausible Insights OÜ',
    url: 'https://plausible.io',
    origin: 'EU',
    transfer: 'eu-intern',
    category: 'spezialisiert',
    pricingFrom: 'ab ~9 €/M',
    strengths: 'Cookiefreie Analytics, EU-Hosting, sehr leichtgewichtiges Script.',
    bestFor: 'Sites, die ohne Consent-Banner auskommen wollen',
    capabilities: ['Analytics'],
  },
  {
    name: 'Fathom Analytics',
    vendor: 'Conva Ventures Inc.',
    url: 'https://usefathom.com',
    origin: 'CA',
    transfer: 'angemessenheitsbeschluss',
    category: 'spezialisiert',
    pricingFrom: 'ab ~15 €/M',
    strengths: 'Cookiefreie Analytics mit EU-Isolation der Messdaten.',
    bestFor: 'Kleine Sites mit Fokus auf Einfachheit',
    capabilities: ['Analytics'],
  },
  {
    name: 'PostHog',
    vendor: 'PostHog Inc.',
    url: 'https://posthog.com',
    origin: 'US',
    transfer: 'drittland-garantien',
    category: 'spezialisiert',
    pricingFrom: 'Free-Tier · danach nutzungsbasiert',
    strengths: 'Produkt-Analytics mit Session-Replay; EU-Region und Self-Hosting verfügbar.',
    bestFor: 'Produktteams, die mehr als Seitenaufrufe messen',
    capabilities: ['Analytics', 'Session-Replay'],
    notes: 'US-Anbieter, aber EU-Region wählbar — die Wahl der Region entscheidet über die Transfer-Bewertung.',
  },
  {
    name: 'Vanta',
    vendor: 'Vanta Inc.',
    url: 'https://vanta.com',
    origin: 'US',
    transfer: 'drittland-garantien',
    category: 'spezialisiert',
    pricingFrom: 'ab ~600 €/M',
    strengths: 'Multi-Framework-GRC: DSGVO neben ISO 27001, SOC 2 und weiteren Standards.',
    bestFor: 'SaaS-Unternehmen mit Zertifizierungsdruck',
    capabilities: ['GRC', 'ISO 27001', 'SOC 2'],
  },
  {
    name: 'Drata',
    vendor: 'Drata Inc.',
    url: 'https://drata.com',
    origin: 'US',
    transfer: 'drittland-garantien',
    category: 'spezialisiert',
    pricingFrom: 'ab ~600 €/M',
    strengths: 'Automatisierte Kontrollnachweise über viele Frameworks hinweg.',
    bestFor: 'SaaS-Unternehmen mit Zertifizierungsdruck',
    capabilities: ['GRC', 'ISO 27001', 'SOC 2'],
  },
  {
    name: 'Sprinto',
    vendor: 'Sprinto Inc.',
    url: 'https://sprinto.com',
    origin: 'US',
    transfer: 'drittland-garantien',
    category: 'spezialisiert',
    pricingFrom: 'auf Anfrage',
    strengths: 'GRC-Automatisierung mit günstigerem Einstieg als die Marktführer.',
    bestFor: 'Startups vor der ersten Zertifizierung',
    capabilities: ['GRC', 'ISO 27001', 'SOC 2'],
  },
];

// ─── Budget-Orientierung ─────────────────────────────────────────────────────

export interface BudgetGuidance {
  size: string;
  budgetPerYear: string;
  recommendation: string;
}

export const BUDGET_GUIDANCE: readonly BudgetGuidance[] = [
  {
    size: 'Mikro (< 20 Mitarbeitende)',
    budgetPerYear: '500 – 2.000 €',
    recommendation:
      'CMP wie Cookiebot, iubenda oder Complianz, dazu ein günstiges VVT-Tool (Dastra, Legiscope) oder das Verzeichnis manuell führen.',
  },
  {
    size: 'KMU (20 – 250 Mitarbeitende)',
    budgetPerYear: '2.000 – 12.000 €',
    recommendation:
      'Datenschutz-Management-Plattform mit DSB-Anbindung (DataGuard, heyData, caralegal) kombiniert mit einer CMP.',
  },
  {
    size: 'Mittelstand',
    budgetPerYear: '10.000 – 40.000 €',
    recommendation:
      'Einzelne OneTrust-Module oder DataGuard, ergänzt um kontinuierliches Monitoring der eigenen Web-Properties.',
  },
  {
    size: 'Enterprise',
    budgetPerYear: '40.000 – 150.000+ €',
    recommendation:
      'OneTrust oder TrustArc als Plattform, dazu DSPM für die Daten-Discovery und externe Beratung.',
  },
] as const;

// ─── Auswahlkriterien ────────────────────────────────────────────────────────

export interface SelectionCriterion {
  title: string;
  why: string;
}

export const SELECTION_CRITERIA: readonly SelectionCriterion[] = [
  {
    title: 'EU-Hosting und Datenresidenz',
    why: 'Nach Schrems II braucht jede Übermittlung in ein Drittland ohne Angemessenheitsbeschluss zusätzliche Garantien (SCC) und ein Transfer Impact Assessment. EU-Hosting erspart diese Prüfung.',
  },
  {
    title: 'Öffentliche Subprozessoren-Liste und AVV',
    why: 'Art. 28 DSGVO verlangt einen Auftragsverarbeitungsvertrag und Transparenz über Unterauftragnehmer. Fehlt die Liste öffentlich, ist die eigene Dokumentationspflicht kaum erfüllbar.',
  },
  {
    title: 'Automatisierung von VVT und DSAR',
    why: 'Verarbeitungsverzeichnis (Art. 30) und Betroffenenanfragen (Art. 15–22) sind die zeitintensivsten Pflichten. Ohne Automatisierung binden sie den größten Teil des Aufwands.',
  },
  {
    title: 'AI-Act-Modul',
    why: 'Der EU AI Act greift ab 2026 zunehmend. Wer KI einsetzt, braucht Klassifikation nach Annex III und ein Pflichten-Mapping — das leistet kein Cookie-Tool.',
  },
  {
    title: 'Nachweisbarkeit',
    why: 'Aufsichtsbehörden fragen rückblickend: War der Stand zu Datum X konform? Ohne Audit-Logs, unveränderliche Snapshots und Export bleibt die Rechenschaftspflicht aus Art. 5 Abs. 2 unbelegt.',
  },
  {
    title: 'Preis gegen manuelle Arbeit rechnen',
    why: 'Ohne Tooling entstehen je nach Größe und Datenintensität erfahrungsgemäß mehrere hundert Personenstunden pro Jahr. Das ist der eigentliche Vergleichsmaßstab, nicht die Lizenzgebühr.',
  },
] as const;

// ─── Ableitungen ─────────────────────────────────────────────────────────────

/** Die 7 Anbieter mit vollständiger Feature-Matrix, in Reihenfolge der Quelle. */
export const MATRIX_TOOLS: readonly (DsgvoTool & { matrix: CapabilityMatrix })[] =
  DSGVO_TOOLS.filter(
    (t): t is DsgvoTool & { matrix: CapabilityMatrix } => t.matrix !== undefined,
  );

/**
 * Ein Anbieter per Name. Wird fuer Fliesstext gebraucht, der konkrete
 * Preise nennt — so steht die Zahl im Text nie im Widerspruch zur Tabelle.
 */
export function toolByName(name: string): DsgvoTool | undefined {
  return DSGVO_TOOLS.find((t) => t.name === name);
}

/** Anbieter einer Kategorie, Reihenfolge wie in DSGVO_TOOLS. */
export function toolsByCategory(key: CategoryKey): readonly DsgvoTool[] {
  return DSGVO_TOOLS.filter((t) => t.category === key);
}

/** Label für die Transfer-Grundlage — kurz genug für ein Chip. */
export const TRANSFER_LABEL: Record<TransferBasis, string> = {
  'eu-intern': 'EU-intern',
  angemessenheitsbeschluss: 'Angemessenheitsbeschluss',
  'drittland-garantien': 'Drittland · SCC/TIA nötig',
};

/**
 * Preis-Disclaimer. Pflichttext auf jeder Ansicht, die Fremdpreise zeigt —
 * vergleichende Werbung nach § 6 UWG muss nachprüfbar und aktuell sein.
 */
export const PRICING_DISCLAIMER =
  `Preise sind öffentlich kommunizierte Einstiegspreise, gerundet und ohne Gewähr (Stand ${LANDSCAPE_AS_OF_LABEL}). ` +
  'Enterprise-Tarife werden marktüblich individuell verhandelt. Maßgeblich ist immer das Angebot des jeweiligen Anbieters.';
