// Skill Registry — zentrale Definition aller LLM-Skill-Profile.
//
// Ein Skill ist KEINE autonome Aktion. Er ist ein
//   - Routing-Eintrag (welche Anfragen triggern ihn?)
//   - Prompt-Profil (Use-Cases, Guardrails, Risiko-Klasse)
//   - Container fuer pure Helper-Funktionen unter src/lib/skills/<key>.ts
//
// Keine externen API-Calls hier. Kein Auto-Sending. Kein Legal/Audit-Opinion.

export type SkillKey =
  | 'data-exploration'
  | 'finance-audit-support'
  | 'gdpr-audit'
  | 'legal-compliance'
  | 'legal-contract-review'
  | 'marketing-performance-analytics'
  | 'sales-call-prep'
  | 'sales-draft-outreach';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface SkillDef {
  key: SkillKey;
  label: string;
  description: string;
  triggers: string[];          // lowercase keywords/phrases
  useCases: string[];
  guardrails: string[];
  riskLevel: RiskLevel;
  requiresWebResearch: boolean;
  requiresUserData: boolean;
  /** Vom UI als Badge gerendert: erfordert Mensch-Review vor Versand/Ausgabe. */
  reviewRequired: boolean;
}

// Standard-Guardrails, in mehreren Skills wiederverwendet.
const NO_LEGAL_OPINION =
  'Diese Auswertung ist eine technische Heuristik und stellt keine Rechtsberatung dar. ' +
  'Fuer rechtsverbindliche Bewertungen wenden Sie sich an qualifizierte Fachleute.';
const NO_AUDIT_OPINION =
  'Output ersetzt keine Pruefungs- oder Auditmeinung. Vor Verwendung durch Fachpruefer freigeben.';
const NO_AUTO_SEND =
  'Keine automatische Versendung. Drafts muessen vor Versand durch einen Menschen freigegeben werden.';
const NO_FABRICATED_FACTS =
  'Keine erfundenen Firmen-/Personenangaben. Unbekannte Felder bleiben leer oder werden klar als Hypothese markiert.';
const BENCHMARKS_ORIENTATION =
  'Branchen-Benchmarks dienen nur zur Orientierung und ersetzen keine eigene Datenanalyse.';
const NO_RAW_SENSITIVE_DATA =
  'Keine sensiblen Rohdaten (PII, Finanzdetails, Healthdata) im Output wiederholen. Aggregate und Hashes bevorzugen.';

export const SKILL_REGISTRY: Record<SkillKey, SkillDef> = {
  'data-exploration': {
    key: 'data-exploration',
    label: 'Data Exploration',
    description:
      'Schnelle Profilierung tabellarischer Daten: Spaltentypen, Null-Anteile, ' +
      'Kardinalitaet, Range, einfache Korrelationen.',
    triggers: [
      'explore', 'profile', 'dataset', 'spalten', 'csv', 'tabelle',
      'data profiling', 'datenuebersicht', 'data exploration',
    ],
    useCases: [
      'CSV-Upload erst-explorieren',
      'Spalten klassifizieren (numerisch / kategorisch / datetime / id / text)',
      'Profilierungs-Plan vorschlagen',
    ],
    guardrails: [NO_RAW_SENSITIVE_DATA],
    riskLevel: 'medium',
    requiresWebResearch: false,
    requiresUserData: true,
    reviewRequired: false,
  },

  'finance-audit-support': {
    key: 'finance-audit-support',
    label: 'Finance / Audit Support',
    description:
      'Strukturhilfe fuer interne Pruefungen: Deficiency-Klassifikation, ' +
      'Stichprobengroessen-Vorschlag, Working-Paper-Outlines.',
    triggers: [
      'audit', 'pruefung', 'control', 'kontrolle', 'sox', 'isae',
      'deficiency', 'finding', 'sample size', 'stichprobe',
    ],
    useCases: [
      'Schwere eines Befunds klassifizieren (control deficiency / significant / material)',
      'Stichprobengroesse fuer Kontrollfrequenz vorschlagen',
    ],
    guardrails: [NO_AUDIT_OPINION, NO_RAW_SENSITIVE_DATA],
    riskLevel: 'high',
    requiresWebResearch: false,
    requiresUserData: true,
    reviewRequired: true,
  },

  'gdpr-audit': {
    key: 'gdpr-audit',
    label: 'DSGVO-Audit (Website)',
    description:
      'Technische DSGVO-/TDDDG-Heuristik fuer Websites: Consent-Timing, Tracker, ' +
      'Drittlandtransfers, Pflichtseiten, Security-Header. Keine Rechtsberatung.',
    triggers: [
      'dsgvo audit', 'gdpr audit', 'website scan', 'website audit', 'cookie scan',
      'tracker', 'consent timing', 'consent banner', 'security header',
    ],
    useCases: [
      'Website auf DSGVO-/TDDDG-Risiken pruefen (Consent-Timing, Tracker)',
      'Befund klassifizieren (critical/high/medium/low) inkl. Remediation-Hinweis',
      'Pruefplan fuer ein Website-Audit erzeugen',
    ],
    guardrails: [NO_LEGAL_OPINION],
    riskLevel: 'high',
    requiresWebResearch: true,
    requiresUserData: false,
    reviewRequired: true,
  },

  'legal-compliance': {
    key: 'legal-compliance',
    label: 'Legal Compliance Support',
    description:
      'Checklisten zur Selbstpruefung von DSGVO/AI-Act-Themen: DSAR, ' +
      'AVV-/DPA-Reviews, Sub-Processor-Checks. Keine Rechtsberatung.',
    triggers: [
      'dsgvo', 'gdpr', 'datenschutz', 'dsar', 'avv', 'dpa', 'subprocessor',
      'ai act', 'ki-vo', 'compliance',
    ],
    useCases: [
      'DSAR-Bearbeitungs-Checkliste fuer eine Regulation aufstellen',
      'DPA-Pruefkriterien als Checkliste erzeugen',
    ],
    guardrails: [NO_LEGAL_OPINION, NO_RAW_SENSITIVE_DATA],
    riskLevel: 'high',
    requiresWebResearch: true,
    requiresUserData: false,
    reviewRequired: true,
  },

  'legal-contract-review': {
    key: 'legal-contract-review',
    label: 'Legal Contract Review',
    description:
      'Strukturhilfe fuer Vertrags-Reviews: Klausel-Abweichungsklassifikation, ' +
      'Redline-Reihenfolge. Liefert keine Rechtsmeinung.',
    triggers: [
      'contract', 'vertrag', 'mnda', 'nda', 'dpa', 'msa', 'redline',
      'klausel', 'haftung', 'liability',
    ],
    useCases: [
      'Schweregrad einer Klausel-Abweichung einordnen',
      'Redline-Review-Plan nach Risikoklasse anlegen',
    ],
    guardrails: [NO_LEGAL_OPINION],
    riskLevel: 'high',
    requiresWebResearch: false,
    requiresUserData: true,
    reviewRequired: true,
  },

  'marketing-performance-analytics': {
    key: 'marketing-performance-analytics',
    label: 'Marketing Performance Analytics',
    description:
      'Trichter- und Kanal-Metriken (CR, CTR, ROAS) plus priorisierte ' +
      'Optimierungs-Hypothesen. Benchmarks sind nur Orientierung.',
    triggers: [
      'marketing', 'ctr', 'cvr', 'roas', 'funnel', 'conversion',
      'attribution', 'campaign', 'kampagne',
    ],
    useCases: [
      'Conversion-Rate / CTR / ROAS berechnen',
      'Optimierungs-Vorschlaege nach Impact priorisieren',
    ],
    guardrails: [BENCHMARKS_ORIENTATION],
    riskLevel: 'low',
    requiresWebResearch: false,
    requiresUserData: true,
    reviewRequired: false,
  },

  'sales-call-prep': {
    key: 'sales-call-prep',
    label: 'Sales Call Prep',
    description:
      'Brief und Talking-Points fuer ein Sales-Gespraech. Liefert keine ' +
      'erfundenen Fakten ueber Firmen oder Personen.',
    triggers: [
      'call prep', 'meeting prep', 'sales call', 'gespraechsleitfaden',
      'demo prep', 'discovery call', 'kickoff',
    ],
    useCases: [
      'Discovery-Call-Outline mit offenen Fragen anlegen',
      'Stakeholder-Map als Hypothese (klar markiert) skizzieren',
    ],
    guardrails: [NO_FABRICATED_FACTS],
    riskLevel: 'medium',
    requiresWebResearch: true,
    requiresUserData: true,
    reviewRequired: false,
  },

  'sales-draft-outreach': {
    key: 'sales-draft-outreach',
    label: 'Sales Outreach Drafting',
    description:
      'Erstellt Outreach-Entwuerfe (E-Mail/LinkedIn) als DRAFT. Niemals ' +
      'automatisch versendet, keine erfundenen Fakten.',
    triggers: [
      'outreach', 'cold email', 'kaltakquise', 'sequence', 'follow-up',
      'linkedin message', 'anschreiben',
    ],
    useCases: [
      'Research-Plan fuer ein Target-Account anlegen',
      'Personalisierte Erstkontakt-Draft als Vorschlag erzeugen',
    ],
    guardrails: [NO_FABRICATED_FACTS, NO_AUTO_SEND],
    riskLevel: 'medium',
    requiresWebResearch: true,
    requiresUserData: true,
    reviewRequired: true,
  },
};

export const ALL_SKILLS: SkillDef[] = Object.values(SKILL_REGISTRY);

export function getSkill(key: SkillKey): SkillDef {
  return SKILL_REGISTRY[key];
}

export const STANDARD_GUARDRAILS = {
  NO_LEGAL_OPINION,
  NO_AUDIT_OPINION,
  NO_AUTO_SEND,
  NO_FABRICATED_FACTS,
  BENCHMARKS_ORIENTATION,
  NO_RAW_SENSITIVE_DATA,
};
