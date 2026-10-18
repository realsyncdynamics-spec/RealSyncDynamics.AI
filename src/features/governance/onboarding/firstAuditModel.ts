/**
 * Erstes Audit in wenigen Minuten — reines Entscheidungsmodell für
 * /app/onboarding (Anlegen → Klassifizieren → Dokumentieren → Auditieren).
 *
 * Bewusst ohne React und ohne I/O, damit jede Aussage testbar ist:
 *
 *   - suggestClassification: Ersteinordnung aus Name + Beschreibung über
 *     kuratierte Stichworte → `classifyUseCase` (EU AI Act Art. 5, Annex III,
 *     Art. 50). Kein Treffer ⇒ konservativ „begrenzt“ mit Prüfhinweis, nie
 *     still „minimal“.
 *   - runFirstAudit: Prüfpunkte aus echten Feldern des gespeicherten Systems
 *     plus Register-Ampel (assessRegistryEntry). Der Score ist der Anteil
 *     erfüllter Prüfpunkte — keine erfundene Zahl.
 */
import { classifyUseCase } from '../../../lib/skills/aiActRisk';
import type { AiActClass } from '../types';
import { OBLIGATIONS, tierOf, type Obligation } from '../handoff/enforcementModel';
import {
  assessRegistryEntry,
  REGISTRY_REASON_LABEL,
  STALE_EVIDENCE_DAYS,
  type EvidenceStats,
  type RegistryLight,
  type RegistryReason,
} from '../ai-registry/registryModel';
import type { DbGovernanceAsset } from '../governanceApi';

export type SuggestedTier = Exclude<AiActClass, 'unknown'>;

export interface UseCaseExample {
  label: string;
  name: string;
  description: string;
}

/** Beispiele aus Schritt 1 — ein Klick füllt Name und Beschreibung vor. */
export const USE_CASE_EXAMPLES: readonly UseCaseExample[] = [
  {
    label: 'ChatGPT im Kundensupport',
    name: 'Kundensupport mit ChatGPT',
    description: 'Beantwortet Kundenanfragen per E-Mail und Chat mit Unterstützung von ChatGPT.',
  },
  {
    label: 'Interner KI-Assistent',
    name: 'Interner KI-Assistent',
    description: 'Hilft Mitarbeitenden beim Erstellen und Zusammenfassen von Texten.',
  },
  {
    label: 'Bewerber-Screening',
    name: 'Bewerber-Screening',
    description: 'Sortiert eingehende Bewerbungen vor und bewertet Lebensläufe.',
  },
  {
    label: 'Website-Chatbot',
    name: 'Website-Chatbot',
    description: 'Beantwortet Kundenanfragen auf unserer Website.',
  },
  {
    label: 'WhatsApp-Service-Bot',
    name: 'WhatsApp-Service-Bot',
    description: 'Beantwortet Serviceanfragen von Kunden automatisch über WhatsApp.',
  },
];

/**
 * Stichwort → Nutzungskategorie aus `classifyUseCase`. Reihenfolge = Vorrang:
 * Verbote vor Hochrisiko vor Transparenz vor minimal, damit „Chatbot für
 * Bewerber-Screening“ als Hochrisiko gilt und nicht als Chatbot.
 */
const RULES: ReadonlyArray<{ category: string; pattern: RegExp }> = [
  { category: 'social_scoring', pattern: /social[\s-]?scoring|sozialpunkte|bürger(innen)?[\s-]?bewert/ },
  { category: 'subliminal_manipulation', pattern: /unterschwellig|manipulativ/ },
  {
    category: 'emotion_recognition_work',
    pattern: /emotion\w*.{0,40}(mitarbeit|arbeitsplatz|beschäftigt|schule|schüler|unterricht)|(mitarbeit|arbeitsplatz|beschäftigt|schule|schüler|unterricht)\w*.{0,40}emotion/,
  },
  { category: 'biometric_identification', pattern: /biometr|gesichtserkenn|fingerabdruck|iris[\s-]?scan/ },
  { category: 'critical_infrastructure', pattern: /kritische[nr]? infrastruktur|stromnetz|wasserversorg|energieversorg/ },
  {
    category: 'employment_screening',
    pattern: /bewerb|recruit|personalauswahl|lebensl[aä]uf|kandidat|leistungsbewert|mitarbeiterbewert/,
  },
  { category: 'education_scoring', pattern: /prüfungen? bewert|klausur|notenvergabe|zulassung zum studium/ },
  { category: 'essential_services', pattern: /kreditwürdig|bonität|kreditvergabe|sozialleistung|versicherungsprämie/ },
  { category: 'deepfake', pattern: /deepfake|stimmklon|voice[\s-]?clon/ },
  { category: 'emotion_recognition', pattern: /emotionserkenn|stimmungserkenn/ },
  {
    category: 'chatbot',
    pattern: /chat|bot\b|assistent|kundenanfrage|kundenservice|kundensupport|support|serviceanfrage|whatsapp|telefon|voice/,
  },
  { category: 'content_generation', pattern: /texte?|generier|zusammenfass|übersetz|bilder|inhalte|content|marketing/ },
  { category: 'spam_filter', pattern: /spam/ },
];

export interface ClassificationSuggestion {
  tier: SuggestedTier;
  /** Erkannte Nutzungskategorie oder `null`, wenn kein Stichwort passte. */
  category: string | null;
  rationale: string;
  articleRef: string;
  /** Unsicher erkannt → vor dem Speichern bewusst prüfen. */
  needsReview: boolean;
}

export function inferUseCaseCategory(text: string): string | null {
  const t = text.toLowerCase();
  return RULES.find((r) => r.pattern.test(t))?.category ?? null;
}

export function suggestClassification(name: string, description: string): ClassificationSuggestion {
  const category = inferUseCaseCategory(`${name} ${description}`);
  const result = classifyUseCase(category ?? '');
  return {
    tier: result.tier,
    category,
    rationale: result.rationale,
    articleRef: result.articleRef,
    needsReview: result.needsReview,
  };
}

export const TIER_LABEL: Readonly<Record<SuggestedTier, string>> = {
  prohibited: 'Unannehmbares Risiko',
  high: 'Hohes Risiko',
  limited: 'Begrenztes Risiko',
  minimal: 'Minimales Risiko',
};

/** Ein Satz für die Ergebnis-Karte: was die Einstufung für den Betrieb heißt. */
export const TIER_SUMMARY: Readonly<Record<SuggestedTier, string>> = {
  prohibited: 'Die beschriebene Nutzung fällt unter die verbotenen Praktiken (Art. 5). Der Einsatz muss eingestellt werden.',
  high: 'Das System betrifft Rechte oder Chancen von Menschen und unterliegt umfangreichen Pflichten (Art. 9–15, 26).',
  limited: 'Das System interagiert mit Nutzern oder erzeugt Inhalte und unterliegt Transparenzpflichten.',
  minimal: 'Das System birgt geringes Risiko. Es gelten allgemeine Sorgfaltspflichten wie KI-Kompetenz der Beschäftigten.',
};

export function obligationsFor(tier: SuggestedTier): readonly Obligation[] {
  const id = tierOf(tier);
  return id ? OBLIGATIONS[id] : [];
}

// ─── Erstes Audit ─────────────────────────────────────────────────────────

export type AuditAsset = Pick<
  DbGovernanceAsset,
  | 'name'
  | 'intended_purpose'
  | 'owner_email'
  | 'ai_act_class'
  | 'ai_system_type'
  | 'deployment_model'
  | 'data_residency'
>;

export interface AuditCheck {
  id: 'purpose' | 'owner' | 'class' | 'type' | 'deployment' | 'residency' | 'evidence';
  label: string;
  passed: boolean;
}

export interface FirstAuditResult {
  /** 0–100: Anteil erfüllter Prüfpunkte. `null`, solange Nachweise unbekannt sind. */
  score: number | null;
  checks: AuditCheck[];
  /** Alle Dokumentations-Prüfpunkte erfüllt (ohne Nachweis-Punkt). */
  documentationComplete: boolean;
  openRisks: string[];
  missing: string[];
  light: RegistryLight;
}

const hasText = (v: string | null | undefined) => typeof v === 'string' && v.trim().length > 0;

/**
 * Inhaltliche Risiken unabhängig von fehlenden Angaben. Die Register-Ampel
 * nennt bei fehlenden Angaben nur diese — für ein frisch angelegtes System
 * hieße das „keine offenen Risiken“, obwohl z. B. kein Nachweis existiert.
 */
function openRiskReasons(asset: AuditAsset, evidence: EvidenceStats | null, now: Date): RegistryReason[] {
  const out: RegistryReason[] = [];
  const noEvidence = evidence !== null && evidence.count === 0;
  if (asset.ai_act_class === 'prohibited') out.push('prohibited_practice');
  if (asset.ai_act_class === 'high') out.push(noEvidence ? 'high_risk_without_evidence' : 'high_risk_obligations');
  if (asset.data_residency === 'third_country') out.push('third_country_transfer');
  if (noEvidence && asset.ai_act_class !== 'high') out.push('no_evidence');
  if (evidence?.latestAt && evidence.count > 0) {
    const ageDays = (now.getTime() - new Date(evidence.latestAt).getTime()) / 86_400_000;
    if (!(ageDays <= STALE_EVIDENCE_DAYS)) out.push('evidence_stale');
  }
  return out;
}

/**
 * Prüft ein gespeichertes KI-System auf Vollständigkeit, Compliance und
 * Dokumentationsstatus. `evidence === null` heißt: Nachweise nicht ladbar —
 * dann gibt es keinen Score (statt eines geschönten).
 */
export function runFirstAudit(asset: AuditAsset, evidence: EvidenceStats | null, now: Date = new Date()): FirstAuditResult {
  const residencyKnown = hasText(asset.data_residency) && asset.data_residency !== 'unknown';
  const checks: AuditCheck[] = [
    { id: 'purpose', label: 'Systembeschreibung und Zweck', passed: hasText(asset.name) && hasText(asset.intended_purpose) },
    { id: 'owner', label: 'Verantwortliche Person', passed: hasText(asset.owner_email) },
    { id: 'class', label: 'Risikoklasse nach EU AI Act', passed: !!asset.ai_act_class && asset.ai_act_class !== 'unknown' },
    { id: 'type', label: 'Systemtyp', passed: hasText(asset.ai_system_type) },
    { id: 'deployment', label: 'Betriebsmodell', passed: hasText(asset.deployment_model) },
    { id: 'residency', label: 'Datenstandort', passed: residencyKnown },
    { id: 'evidence', label: 'Mindestens ein Nachweis', passed: (evidence?.count ?? 0) > 0 },
  ];

  const assessment = assessRegistryEntry(asset, evidence, now);
  const openRisks = openRiskReasons(asset, evidence, now).map((r) => REGISTRY_REASON_LABEL[r].de);
  const missing = checks
    .filter((c) => !c.passed && c.id !== 'evidence')
    .map((c) => c.label);

  const passed = checks.filter((c) => c.passed).length;
  return {
    score: evidence === null ? null : Math.round((passed / checks.length) * 100),
    checks,
    documentationComplete: missing.length === 0,
    openRisks,
    missing,
    light: assessment.light,
  };
}
