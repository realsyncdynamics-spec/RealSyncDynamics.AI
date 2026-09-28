/**
 * Landing v2 — redaktionelle Inhalte (Design-Handoff „Landing v2“).
 *
 * Preise kommen NICHT von hier, sondern aus `shared/pricing.ts` (SSoT).
 * Firmendaten aus `src/config/company.ts`. Diese Datei hält nur Text,
 * damit Tests und JSON-LD (FAQPage) dieselbe Quelle nutzen.
 */

export const LV2_BRAND = 'RealSyncDynamics.AI';

export const LV2_H1_SILVER = 'AI Compliance Operations OS';
export const LV2_H1_GOLD = 'for Europe';

/** Betriebsschleife — sechs Stufen wie auf der Live-Seite (Entscheidung Dominik, 28.09.2026). */
export const LV2_PIPELINE = ['Discover', 'Assess', 'Govern', 'Execute', 'Verify', 'Prove'] as const;

export const LV2_STACK = [
  'EU-Hosted Runtime',
  'Supabase Frankfurt',
  'Evidence Vault / Hash-Chain',
  'Ollama local',
  'Multi-Tenant RLS',
  'n8n',
  'Stripe',
] as const;

export const LV2_HERO_NOTE =
  'Kostenlos · Governance Score in 90 Sekunden · keine Kreditkarte erforderlich';

export const LV2_FRAMEWORKS = ['EU AI Act', 'DSGVO', 'ISO/IEC 42001', 'NIS2', 'Hosting Frankfurt'] as const;

export interface Lv2TimelineEntry {
  date: string;
  iso: string;
  title: string;
  text: string;
  current?: boolean;
}

/**
 * Fristen der Verordnung (EU) 2024/1689 (Art. 113). Der „Digital Omnibus“
 * kann Fristen für Hochrisiko-Systeme verschieben — der Hinweis unter dem
 * Zeitstrahl bleibt deshalb Teil des Vertrags dieser Sektion.
 */
export const LV2_AI_ACT_TIMELINE: Lv2TimelineEntry[] = [
  {
    date: '01.08.2024',
    iso: '2024-08-01',
    title: 'Inkrafttreten',
    text: 'Verordnung (EU) 2024/1689 im Amtsblatt veröffentlicht.',
  },
  {
    date: '02.02.2025',
    iso: '2025-02-02',
    title: 'Verbote & AI Literacy',
    text: 'Unzulässige Praktiken untersagt, KI-Kompetenzpflicht gilt.',
  },
  {
    date: '02.08.2025',
    iso: '2025-08-02',
    title: 'General-Purpose AI',
    text: 'Pflichten für GPAI-Anbieter, Governance-Struktur, Sanktionen.',
  },
  {
    date: '02.08.2026',
    iso: '2026-08-02',
    title: 'Allgemeine Anwendung',
    text: 'Transparenzpflichten und Hochrisiko-Systeme nach Anhang III.',
    current: true,
  },
];

export const LV2_TIMELINE_NOTE =
  'Stand: Verordnung (EU) 2024/1689, Art. 113. Fristverschiebungen für Hochrisiko-Systeme (Digital Omnibus) sind im Gesetzgebungsverfahren — die Plattform bildet den jeweils geltenden Stand ab.';

export interface Lv2LifecycleStep {
  index: string;
  name: string;
  title: string;
  text: string;
}

export const LV2_LIFECYCLE: Lv2LifecycleStep[] = [
  {
    index: '01',
    name: 'Discover',
    title: 'KI-Inventar in Echtzeit',
    text: 'Erfasst Modelle, Agenten und Schatten-KI über APIs, Workflows und SaaS-Integrationen – mit Owner, Zweck und Datenflüssen.',
  },
  {
    index: '02',
    name: 'Classify',
    title: 'Risikoklassen nach EU AI Act',
    text: 'Ordnet jedes System begründet ein – verboten, hochriskant, transparenzpflichtig oder minimal – inklusive Rollenprüfung Anbieter/Betreiber.',
  },
  {
    index: '03',
    name: 'Enforce',
    title: 'Policies zur Laufzeit',
    text: 'Setzt Kontrollen direkt im Request-Pfad durch: PII-Filter, Human-in-the-Loop, Modell-Freigaben und Nutzungsgrenzen je Mandant.',
  },
  {
    index: '04',
    name: 'Prove',
    title: 'Prüffähige Evidenz',
    text: 'Jede Entscheidung wird verkettet und archiviert – exportierbar als technische Dokumentation für Auditoren und Behörden.',
  },
];

export const LV2_EVIDENCE_ARTICLES = [
  { label: 'Technische Dokumentation', ref: 'Anhang IV' },
  { label: 'Automatische Protokollierung', ref: 'Art. 12' },
  { label: 'Menschliche Aufsicht', ref: 'Art. 14' },
  { label: 'Verzeichnis von Verarbeitungstätigkeiten', ref: 'Art. 30 DSGVO' },
] as const;

/** Illustrative Kette — Demo-Werte, keine Live-Daten (Beispiel-Kennzeichnung im UI). */
export const LV2_CHAIN_DEMO = [
  { block: '#48213', time: '14:02:11 UTC', title: 'Modell-Freigabe · credit-scoring-v3', hash: 'a3f9…c41e', prev: '7b20…9d05' },
  { block: '#48214', time: '14:02:13 UTC', title: 'Policy PII-Filter angewendet', hash: 'e81c…02ab', prev: 'a3f9…c41e' },
  { block: '#48215', time: '14:05:47 UTC', title: 'Human Review · bestätigt', hash: '5d6e…f713', prev: 'e81c…02ab' },
  { block: '#48216', time: '14:06:02 UTC', title: 'Evidence versiegelt', hash: '0c9a…b8d2', prev: '5d6e…f713', sealed: true },
] as const;

export interface Lv2EuCard {
  icon: 'server' | 'database' | 'layers' | 'cpu' | 'workflow' | 'creditcard';
  title: string;
  text: string;
}

export const LV2_EU_NATIVE: Lv2EuCard[] = [
  { icon: 'server', title: 'EU-Hosted Runtime', text: 'Policy-Engine und API-Gateway in deutschen Rechenzentren.' },
  { icon: 'database', title: 'Supabase Frankfurt', text: 'Postgres in eu-central-1, verschlüsselt at rest und in transit.' },
  { icon: 'layers', title: 'Multi-Tenant RLS', text: 'Mandantentrennung auf Datenbankebene per Row-Level Security.' },
  { icon: 'cpu', title: 'Ollama local', text: 'Klassifizierung mit lokal betriebenen Open-Weight-Modellen.' },
  { icon: 'workflow', title: 'n8n Workflows', text: 'Self-hosted Automatisierung für Freigaben und Eskalationen.' },
  { icon: 'creditcard', title: 'Stripe Billing', text: 'Abrechnung in Euro, Zahlung per Karte oder SEPA-Lastschrift.' },
];

export interface Lv2Faq {
  q: string;
  a: string;
}

export const LV2_FAQ: Lv2Faq[] = [
  {
    q: 'Wo werden unsere Daten verarbeitet?',
    a: 'Ausschließlich in der EU – Runtime und Datenbank laufen in Frankfurt am Main. Modelle können lokal über Ollama betrieben werden.',
  },
  {
    q: 'Welche Regelwerke deckt die Plattform ab?',
    a: 'EU AI Act, DSGVO und ISO/IEC 42001. Controls lassen sich zusätzlich auf NIS2 und interne Richtlinien mappen.',
  },
  {
    q: 'Was umfasst das Free Audit?',
    a: 'Eine Bestandsaufnahme Ihrer KI-Systeme, eine vorläufige Risikoklassifizierung nach EU AI Act und einen priorisierten Maßnahmenplan – ohne Account und ohne Kreditkarte.',
  },
  {
    q: 'Kann ich monatlich kündigen?',
    a: 'Ja. Starter, Growth und Agency sind monatlich kündbar. Die Jahresabrechnung ist in Vorbereitung.',
  },
];

/** FAQPage-JSON-LD aus derselben Quelle wie das UI. */
export function lv2FaqJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: LV2_FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
