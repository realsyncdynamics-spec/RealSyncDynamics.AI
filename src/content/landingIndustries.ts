// Landing-Branchen — zentrale Quelle für die Hero-Sektion "FÜR WEN" auf der
// MainLanding UND die Detailseiten unter /branchen/:slug.
//
// REINE KONFIGURATION. Jede Branche hat ihren regulatorischen Schmerzpunkt,
// typische Risiken und drei Wert-Aussagen. Bewusst breit angelegt, damit die
// Startseite möglichst viele Zielgruppen direkt anspricht.

import {
  HeartPulse,
  Landmark,
  ShoppingCart,
  Factory,
  UserCheck,
  Megaphone,
  Cloud,
  Zap,
  GraduationCap,
  Truck,
  Building2,
  Scale,
  type LucideIcon,
} from 'lucide-react';

export interface LandingIndustryValue {
  title: string;
  text: string;
}

export interface LandingIndustry {
  slug: string;
  icon: LucideIcon;
  /** Kartentitel auf der Startseite. */
  title: string;
  /** Ein-Zeiler auf der Karte. */
  text: string;
  /** Mono-Eyebrow auf der Detailseite. */
  eyebrow: string;
  /** H1 der Detailseite. */
  headline: string;
  /** Einleitungsabsatz der Detailseite. */
  intro: string;
  /** Regulatorische Bezugspunkte (Chips). */
  refs: string[];
  /** Typische Compliance-Risiken der Branche. */
  risks: string[];
  /** Wie RealSync hilft — drei Bausteine. */
  value: LandingIndustryValue[];
}

const RUNTIME_VALUE: LandingIndustryValue = {
  title: 'Kontinuierliches Monitoring',
  text: 'Websites, Datenflüsse und KI-Systeme werden rund um die Uhr überwacht — Risiken werden sichtbar, sobald sie entstehen, nicht erst im Jahres-Audit.',
};
const EVIDENCE_VALUE: LandingIndustryValue = {
  title: 'Revisionssicherer Nachweis',
  text: 'Jede Maßnahme landet kryptografisch signiert im Evidence Vault — ein lückenloser Prüfpfad für Audits und Aufsichtsbehörden.',
};

export const LANDING_INDUSTRIES: LandingIndustry[] = [
  {
    slug: 'gesundheitswesen',
    icon: HeartPulse,
    title: 'Gesundheitswesen',
    text: 'Patientendaten, Praxis- & Klinik-Software, KI-Diagnostik — Art. 9 DSGVO und Hochrisiko-KI lückenlos belegt.',
    eyebrow: 'GESUNDHEITSWESEN',
    headline: 'Compliance für Gesundheitsdaten und KI-Diagnostik',
    intro: 'Patientendaten sind besondere Kategorien nach Art. 9 DSGVO, KI-Diagnostik ist Hochrisiko nach EU AI Act. RealSync überwacht Praxis-, Klinik- und MVZ-Systeme kontinuierlich und macht jeden Zugriff und jede KI-Entscheidung revisionssicher nachweisbar.',
    refs: ['Art. 9 DSGVO', 'EU AI Act Annex III', 'MDR', 'DSFA-Pflicht'],
    risks: [
      'Gesundheitsdaten ohne erhöhten Schutz nach Art. 9',
      'KI-Diagnostik ohne Risikoklassifizierung & Dokumentation',
      'Zugriffe auf Patientendaten nicht protokolliert',
      'Fehlende DSFA für risikoreiche Verarbeitungen',
    ],
    value: [
      RUNTIME_VALUE,
      { title: 'KI als Hochrisiko erkannt', text: 'Diagnostik- und Triage-KI wird automatisch nach Annex III klassifiziert — inklusive Transparenz- und Dokumentationspflichten.' },
      EVIDENCE_VALUE,
    ],
  },
  {
    slug: 'banken-versicherungen',
    icon: Landmark,
    title: 'Banken & Versicherungen',
    text: 'BAIT, MaRisk und Scoring-Modelle: KI-Entscheidungen nachvollziehbar, prüfbar und aufsichtskonform.',
    eyebrow: 'BANKEN & VERSICHERUNGEN',
    headline: 'Aufsichtskonforme KI für Finanzdienstleister',
    intro: 'Scoring-, Betrugs- und Kreditentscheidungs-Modelle stehen unter BAIT, VAIT und MaRisk — und gelten nach EU AI Act vielfach als Hochrisiko. RealSync dokumentiert jede KI-Entscheidung nachvollziehbar und hält den Prüfpfad für BaFin & interne Revision bereit.',
    refs: ['BAIT', 'VAIT', 'MaRisk', 'EU AI Act', 'DORA'],
    risks: [
      'Scoring-/Kredit-KI ohne nachvollziehbare Entscheidungslogik',
      'Modelle ohne dokumentierte Risikoklassifizierung',
      'Drittanbieter-/Cloud-Risiken (DORA) nicht überwacht',
      'Lücken zwischen MaRisk-Anforderung und Nachweis',
    ],
    value: [
      RUNTIME_VALUE,
      { title: 'Entscheidungen nachvollziehbar', text: 'Jede KI-gestützte Entscheidung wird mit Kontext geloggt und bewertet — aufsichtskonform und intern prüfbar.' },
      EVIDENCE_VALUE,
    ],
  },
  {
    slug: 'handel-ecommerce',
    icon: ShoppingCart,
    title: 'Handel & E-Commerce',
    text: 'Consent, Tracking und Empfehlungs-KI im Griff — vom Cookie-Banner bis zur Produktempfehlung.',
    eyebrow: 'HANDEL & E-COMMERCE',
    headline: 'Consent, Tracking und Empfehlungs-KI sauber belegt',
    intro: 'Jeder Shop kombiniert Tracking, Consent-Management und zunehmend Empfehlungs- und Pricing-KI. RealSync überwacht Cookie-Banner, Tags und Algorithmen kontinuierlich und verhindert, dass aus einem fehlenden Consent eine Abmahnung wird.',
    refs: ['DSGVO Art. 6', 'TDDDG', 'EU AI Act', 'P2B-Verordnung'],
    risks: [
      'Tracking/Analytics vor Einwilligung (Consent-Verstoß)',
      'Cookie-Banner ohne wirksame Ablehnen-Option',
      'Empfehlungs-/Pricing-KI ohne Transparenz',
      'Drittanbieter-Tags ohne Auftragsverarbeitung',
    ],
    value: [
      RUNTIME_VALUE,
      { title: 'Consent in Echtzeit geprüft', text: 'Tags und Tracker werden gegen den tatsächlichen Consent-Status abgeglichen — Abweichungen lösen sofort einen Alert aus.' },
      EVIDENCE_VALUE,
    ],
  },
  {
    slug: 'hr-recruiting',
    icon: UserCheck,
    title: 'HR & Recruiting',
    text: 'Bewerber- und Personal-KI gilt als Hochrisiko nach EU AI Act — automatisch klassifiziert und dokumentiert.',
    eyebrow: 'HR & RECRUITING',
    headline: 'Bewerber-KI ist Hochrisiko — wir machen sie prüfbar',
    intro: 'KI im Recruiting und in der Personalbewertung ist nach EU AI Act explizit Hochrisiko. RealSync klassifiziert eingesetzte Tools automatisch, dokumentiert Transparenzpflichten und schützt Bewerber- und Beschäftigtendaten über den gesamten Prozess.',
    refs: ['EU AI Act Annex III(4)', 'DSGVO Art. 88', 'BetrVG', 'AGG'],
    risks: [
      'Bewerber-Screening-KI ohne Hochrisiko-Einstufung',
      'Fehlende Transparenz gegenüber Bewerbern',
      'Beschäftigtendaten ohne klare Rechtsgrundlage',
      'Automatisierte Entscheidungen ohne menschliche Kontrolle',
    ],
    value: [
      { title: 'Automatisch als Hochrisiko erkannt', text: 'Recruiting- und Bewertungs-KI wird nach Annex III(4) eingestuft — mit allen Dokumentations- und Aufsichtspflichten.' },
      RUNTIME_VALUE,
      EVIDENCE_VALUE,
    ],
  },
  {
    slug: 'oeffentlicher-sektor',
    icon: Building2,
    title: 'Öffentlicher Sektor',
    text: 'Bürgerdaten, Transparenzpflichten und KRITIS — Souveränität durch EU-Hosting und lokale Modelle.',
    eyebrow: 'ÖFFENTLICHER SEKTOR',
    headline: 'Digitale Souveränität für Behörden und Verwaltung',
    intro: 'Bürgerdaten verlangen höchste Vertraulichkeit, KI im Verwaltungshandeln verlangt Transparenz. RealSync läuft EU-souverän — optional mit lokalen Modellen — und liefert den Nachweis, dass Verwaltung und KI-Einsatz den Anforderungen entsprechen.',
    refs: ['DSGVO', 'EU AI Act', 'OZG', 'KRITIS / NIS-2'],
    risks: [
      'Bürgerdaten in nicht-souveränen Cloud-Diensten',
      'KI im Verwaltungshandeln ohne Transparenznachweis',
      'KRITIS-/NIS-2-Pflichten nur stichprobenhaft geprüft',
      'Fehlende Protokollierung sensibler Zugriffe',
    ],
    value: [
      { title: 'EU-souverän & lokal', text: 'Hosting, Verarbeitung und Modelle innerhalb der EU — optional vollständig lokal (Ollama) für maximale Datenkontrolle.' },
      RUNTIME_VALUE,
      EVIDENCE_VALUE,
    ],
  },
  {
    slug: 'industrie-fertigung',
    icon: Factory,
    title: 'Industrie & Fertigung',
    text: 'IoT-Telemetrie, Predictive Maintenance und Lieferketten — Datenflüsse und KI revisionssicher belegt.',
    eyebrow: 'INDUSTRIE & FERTIGUNG',
    headline: 'Governance für IoT, Predictive Maintenance und Lieferketten',
    intro: 'Vernetzte Anlagen, Predictive-Maintenance-Modelle und digitale Lieferketten erzeugen riesige Datenflüsse — oft mit Personenbezug und KI-Beteiligung. RealSync überwacht diese kontinuierlich und macht Datenflüsse wie KI-Einsatz revisionssicher belegbar.',
    refs: ['DSGVO', 'EU AI Act', 'NIS-2', 'EU Data Act'],
    risks: [
      'IoT-Telemetrie mit Personenbezug ohne Rechtsgrundlage',
      'Predictive-Maintenance-KI ohne Dokumentation',
      'Lieferketten-Datenflüsse ohne Auftragsverarbeitung',
      'OT-/IT-Sicherheitslücken (NIS-2) unbeobachtet',
    ],
    value: [
      RUNTIME_VALUE,
      { title: 'Datenflüsse kartiert', text: 'Wo personenbezogene Daten zwischen Anlagen, Cloud und Partnern fließen, wird transparent — inkl. Bewertung jedes externen Calls.' },
      EVIDENCE_VALUE,
    ],
  },
  {
    slug: 'recht-kanzleien',
    icon: Scale,
    title: 'Recht & DSB-Kanzleien',
    text: 'Compliance als Service für Ihre Mandanten — Multi-Tenant-Dashboard im White-Label-Kanzlei-Modus.',
    eyebrow: 'RECHT & DSB-KANZLEIEN',
    headline: 'Compliance als Service — für alle Ihre Mandanten',
    intro: 'DSB-Kanzleien und Rechtsdienstleister betreuen viele Mandanten mit je eigenen Anforderungen. RealSync bietet ein mandantengetrenntes, White-Label-fähiges Dashboard, mit dem Sie Governance skalierbar als Service anbieten — statt jede Prüfung manuell zu wiederholen.',
    refs: ['DSGVO', 'EU AI Act', 'Art. 28 (AVV)', 'RLS-Mandantentrennung'],
    risks: [
      'Mandanten-Compliance manuell, nicht skalierbar',
      'Keine zentrale Sicht über alle Mandate',
      'Nachweise verstreut statt revisionssicher gebündelt',
      'White-Label-Auftritt fehlt',
    ],
    value: [
      { title: 'Multi-Tenant & White-Label', text: 'RLS-getrennte Mandanten in einem Dashboard, im eigenen Branding — Governance als skalierbares Kanzlei-Produkt.' },
      RUNTIME_VALUE,
      EVIDENCE_VALUE,
    ],
  },
  {
    slug: 'marketing-agenturen',
    icon: Megaphone,
    title: 'Marketing & Agenturen',
    text: 'Tracking, Consent und Kampagnen-KI für viele Kunden — mandantengetrennt und White-Label.',
    eyebrow: 'MARKETING & AGENTUREN',
    headline: 'Tracking & Kampagnen-KI für viele Kunden im Griff',
    intro: 'Agenturen verantworten Tracking, Consent und zunehmend Kampagnen-KI auf fremden Domains. RealSync überwacht alle Kundenauftritte mandantengetrennt, deckt Consent-Lücken auf und liefert den Nachweis — White-Label im eigenen Auftritt.',
    refs: ['DSGVO Art. 28', 'TDDDG', 'EU AI Act', 'Consent-Mode'],
    risks: [
      'Tracking auf Kundenseiten ohne wirksamen Consent',
      'Fehlende Auftragsverarbeitungsverträge',
      'Generative-/Kampagnen-KI ohne Kennzeichnung',
      'Weitergabe an Sub-Dienstleister ohne Nachweis',
    ],
    value: [
      { title: 'Mandantengetrennt & White-Label', text: 'Jeder Kunde in eigener, RLS-geschützter Sicht — im Branding Ihrer Agentur.' },
      RUNTIME_VALUE,
      EVIDENCE_VALUE,
    ],
  },
  {
    slug: 'saas-technologie',
    icon: Cloud,
    title: 'SaaS & Technologie',
    text: 'Eigene KI-Features auditierbar machen — Transparenz- und Dokumentationspflichten erfüllt by Design.',
    eyebrow: 'SAAS & TECHNOLOGIE',
    headline: 'Machen Sie Ihre KI-Features auditierbar',
    intro: 'Wer KI-Features ausliefert, wird nach EU AI Act zum Anbieter mit Transparenz- und Dokumentationspflichten. RealSync integriert sich in Ihre Runtime, klassifiziert Ihre KI-Funktionen und liefert die Nachweise, die Enterprise-Kunden und Aufsicht erwarten.',
    refs: ['EU AI Act', 'DSGVO', 'ISO 42001', 'SOC 2'],
    risks: [
      'KI-Features ohne Anbieter-Dokumentation',
      'Fehlende Transparenzhinweise gegenüber Nutzern',
      'Trainings-/Eingabedaten ohne Governance',
      'Enterprise-Kunden fordern Nachweise, die fehlen',
    ],
    value: [
      { title: 'Compliance by Design', text: 'Transparenz- und Dokumentationspflichten werden Teil Ihrer Runtime — nicht ein nachgelagertes PDF.' },
      RUNTIME_VALUE,
      EVIDENCE_VALUE,
    ],
  },
  {
    slug: 'energie-versorger',
    icon: Zap,
    title: 'Energie & Versorger',
    text: 'Kritische Infrastruktur und KRITIS — kontinuierliches Monitoring statt jährlicher Stichprobe.',
    eyebrow: 'ENERGIE & VERSORGER',
    headline: 'KRITIS-Compliance, kontinuierlich statt stichprobenhaft',
    intro: 'Energie- und Versorgungsunternehmen sind kritische Infrastruktur — mit hohen Pflichten aus NIS-2 und KRITIS und wachsendem KI-Einsatz in Netz- und Lastmanagement. RealSync überwacht durchgehend, statt einmal im Jahr eine Stichprobe zu ziehen.',
    refs: ['KRITIS', 'NIS-2', 'DSGVO', 'EU AI Act'],
    risks: [
      'KRITIS-/NIS-2-Pflichten nur jährlich geprüft',
      'Netz-/Lastmanagement-KI ohne Dokumentation',
      'Kundendaten (Smart Meter) ohne klaren Schutz',
      'Drittanbieter-Risiken in der Lieferkette',
    ],
    value: [
      RUNTIME_VALUE,
      { title: 'Durchgehende Überwachung', text: 'Statt jährlicher Audits läuft die Kontrolle permanent — Abweichungen werden sofort sichtbar.' },
      EVIDENCE_VALUE,
    ],
  },
  {
    slug: 'bildung-forschung',
    icon: GraduationCap,
    title: 'Bildung & Forschung',
    text: 'Lernplattformen, Forschungs- und Minderjährigendaten — sensibel verarbeitet, sauber nachgewiesen.',
    eyebrow: 'BILDUNG & FORSCHUNG',
    headline: 'Schutz für Lern-, Forschungs- und Minderjährigendaten',
    intro: 'Lernplattformen verarbeiten oft Daten Minderjähriger, Forschung sensible Datensätze, und KI hält in Prüfung und Bewertung Einzug. RealSync überwacht diese Verarbeitungen kontinuierlich und sorgt für saubere, nachweisbare Grundlagen.',
    refs: ['DSGVO Art. 8', 'EU AI Act', 'Forschungsklauseln', 'TDDDG'],
    risks: [
      'Daten Minderjähriger ohne wirksame Einwilligung',
      'Lernplattform-Tracking ohne Consent',
      'Bewertungs-/Prüfungs-KI ohne Transparenz',
      'Forschungsdaten ohne klare Zweckbindung',
    ],
    value: [
      RUNTIME_VALUE,
      { title: 'Sensible Daten geschützt', text: 'Besonders schützenswerte Verarbeitungen werden erkannt und mit erhöhten Anforderungen behandelt.' },
      EVIDENCE_VALUE,
    ],
  },
  {
    slug: 'logistik-mobilitaet',
    icon: Truck,
    title: 'Logistik & Mobilität',
    text: 'Telematik, Tracking und Routing-KI — personenbezogene Bewegungsdaten DSGVO-konform behandelt.',
    eyebrow: 'LOGISTIK & MOBILITÄT',
    headline: 'Bewegungsdaten und Routing-KI DSGVO-konform',
    intro: 'Telematik, Fahrer-Tracking und Routing-KI erzeugen personenbezogene Bewegungsdaten mit hohem Schutzbedarf. RealSync überwacht diese Datenflüsse und KI-Systeme kontinuierlich und macht den korrekten Umgang revisionssicher belegbar.',
    refs: ['DSGVO', 'EU AI Act', 'BetrVG', 'EU Data Act'],
    risks: [
      'Fahrer-/Telematik-Tracking ohne Rechtsgrundlage',
      'Bewegungsprofile ohne Zweckbindung',
      'Routing-/Dispositions-KI ohne Dokumentation',
      'Beschäftigtendaten ohne Mitbestimmung',
    ],
    value: [
      RUNTIME_VALUE,
      { title: 'Bewegungsdaten im Blick', text: 'Wo Telematik personenbezogene Daten erzeugt, wird transparent — inkl. Bewertung der Rechtsgrundlage.' },
      EVIDENCE_VALUE,
    ],
  },
];

export function findLandingIndustry(slug: string | undefined): LandingIndustry | null {
  if (!slug) return null;
  return LANDING_INDUSTRIES.find((i) => i.slug === slug) ?? null;
}
