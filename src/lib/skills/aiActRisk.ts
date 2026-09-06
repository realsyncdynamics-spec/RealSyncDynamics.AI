// AI-Act-Risk Skill — pure Helper fuer die EU-AI-Act-Risikoeinordnung.
// KEINE Rechtsberatung, keine externen Calls. Klassifikation einer
// Nutzungs-Kategorie in die vier Risikoklassen des EU AI Act und Ableitung
// der Pflichten. Die Pflichten-Matrix wird aus dem kanonischen
// AIActClassifier wiederverwendet (nicht dupliziert, vgl. CLAUDE.md §6).

import { AIActClassifier } from '../../governance/AIActClassifier';
import type { AIActRiskClass, AIActRequirements } from '../../governance/types';

/** Risikoklassen des EU AI Act, absteigend nach Schwere (Produkt-Vokabular). */
export const AI_ACT_TIERS: AIActRiskClass[] = ['prohibited', 'high', 'limited', 'minimal'];

export interface UseCaseClassification {
  category: string;
  tier: AIActRiskClass;
  rationale: string;
  articleRef: string;
  /** true, wenn die Kategorie nicht sicher erkannt wurde → manuell einordnen. */
  needsReview: boolean;
}

export interface AiActObligations {
  tier: AIActRiskClass;
  requirements: AIActRequirements;
  disclaimer: string;
}

const DISCLAIMER =
  'Technische Ersteinordnung, keine Rechtsberatung. Die verbindliche AI-Act-Klassifizierung ' +
  'und Konformitaetsbewertung ist vor Inverkehrbringen durch qualifizierte Fachleute zu pruefen.';

// Kuratierte Kategorie → Risikoklasse. Grundlage: EU AI Act Art. 5 (verbotene
// Praktiken), Annex III (Hochrisiko), Art. 50 (Transparenz/limited).
const USE_CASES: Record<string, { tier: AIActRiskClass; rationale: string; articleRef: string }> = {
  // ── prohibited (Art. 5) ──────────────────────────────────────────────
  social_scoring:            { tier: 'prohibited', rationale: 'Soziale Bewertung natuerlicher Personen durch Behoerden/allgemein.', articleRef: 'Art. 5 (1) c' },
  realtime_biometric_public: { tier: 'prohibited', rationale: 'Echtzeit-Fernidentifizierung biometrischer Daten im oeffentlichen Raum.', articleRef: 'Art. 5 (1) h' },
  subliminal_manipulation:   { tier: 'prohibited', rationale: 'Unterschwellige/manipulative Techniken zur Verhaltensbeeinflussung.', articleRef: 'Art. 5 (1) a' },
  emotion_recognition_work:  { tier: 'prohibited', rationale: 'Emotionserkennung am Arbeitsplatz und in Bildungseinrichtungen.', articleRef: 'Art. 5 (1) f' },
  // ── high (Annex III) ─────────────────────────────────────────────────
  biometric_identification:  { tier: 'high', rationale: 'Biometrische Identifizierung/Kategorisierung.', articleRef: 'Annex III §1' },
  critical_infrastructure:   { tier: 'high', rationale: 'Sicherheitskomponente kritischer Infrastruktur.', articleRef: 'Annex III §2' },
  education_scoring:         { tier: 'high', rationale: 'Zugang zu Bildung / Bewertung von Lernenden.', articleRef: 'Annex III §3' },
  employment_screening:      { tier: 'high', rationale: 'Personalauswahl, Bewerber-Screening, Leistungsbewertung.', articleRef: 'Annex III §4' },
  essential_services:        { tier: 'high', rationale: 'Zugang zu essenziellen Diensten (Kredit, Sozialleistungen).', articleRef: 'Annex III §5' },
  law_enforcement:           { tier: 'high', rationale: 'Einsatz in der Strafverfolgung.', articleRef: 'Annex III §6' },
  migration_border:          { tier: 'high', rationale: 'Migration, Asyl, Grenzkontrolle.', articleRef: 'Annex III §7' },
  justice_democracy:         { tier: 'high', rationale: 'Rechtspflege und demokratische Prozesse.', articleRef: 'Annex III §8' },
  // ── limited (Art. 50 — Transparenz) ──────────────────────────────────
  chatbot:                   { tier: 'limited', rationale: 'Direkte Interaktion mit Menschen → Offenlegungspflicht.', articleRef: 'Art. 50 (1)' },
  content_generation:        { tier: 'limited', rationale: 'KI-generierte Inhalte → Kennzeichnungspflicht (auch C2PA).', articleRef: 'Art. 50 (2)' },
  deepfake:                  { tier: 'limited', rationale: 'Deepfakes → Kennzeichnungspflicht.', articleRef: 'Art. 50 (4)' },
  emotion_recognition:       { tier: 'limited', rationale: 'Emotionserkennung (ausserhalb Arbeit/Bildung) → Informationspflicht.', articleRef: 'Art. 50 (3)' },
  // ── minimal ──────────────────────────────────────────────────────────
  spam_filter:               { tier: 'minimal', rationale: 'Geringes Risiko, allgemeine Sorgfalt.', articleRef: 'Art. 95 (freiwillige Codes)' },
  recommender_basic:         { tier: 'minimal', rationale: 'Einfache Empfehlungen ohne Rechte-/Sicherheitsrelevanz.', articleRef: '—' },
};

/**
 * Ordnet eine Nutzungs-Kategorie einer AI-Act-Risikoklasse zu. Unbekannte
 * Kategorien werden konservativ als `limited` mit `needsReview` markiert —
 * niemals still als `minimal`, weil eine zu niedrige Einstufung der teurere
 * Fehler ist.
 */
export function classifyUseCase(category: string): UseCaseClassification {
  const key = category.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const hit = USE_CASES[key];
  if (!hit) {
    return {
      category: key,
      tier: 'limited',
      rationale: 'Kategorie nicht erkannt — konservativ als transparenzpflichtig eingestuft, manuell pruefen.',
      articleRef: '—',
      needsReview: true,
    };
  }
  return { category: key, tier: hit.tier, rationale: hit.rationale, articleRef: hit.articleRef, needsReview: false };
}

/**
 * Liefert die AI-Act-Pflichten einer Risikoklasse. Wiederverwendung der
 * kanonischen Matrix aus `AIActClassifier.getRequirements` — Single Source
 * of Truth, damit Skill und Governance-Runtime nicht auseinanderlaufen.
 */
export function getAiActObligations(tier: string): AiActObligations {
  const key = tier.trim().toLowerCase();
  if (!(AI_ACT_TIERS as readonly string[]).includes(key)) {
    throw new Error(`tier must be one of ${AI_ACT_TIERS.join('|')}`);
  }
  const t = key as AIActRiskClass;
  return { tier: t, requirements: AIActClassifier.getRequirements(t), disclaimer: DISCLAIMER };
}
