// Annex-III-Registry: typed loader + helpers für die EU-AI-Act-Klassifikation.
// Datenquelle: src/rules/annex-iii.json — strukturiert nach den 8 Annex-III-
// Kategorien der Verordnung 2024/1689.
//
// Bewusst keine LLM-Calls — die Registry ist deterministisch und prüfbar.

import registryData from '../../rules/annex-iii.json';

export type Severity = 'limited' | 'high' | 'prohibited';

export type ObligationKey =
  | 'risk_management'
  | 'data_governance'
  | 'technical_documentation'
  | 'logging'
  | 'transparency_to_deployers'
  | 'transparency_disclosure_art50'
  | 'human_oversight'
  | 'accuracy_robustness_cybersecurity'
  | 'conformity_assessment'
  | 'fundamental_rights_impact_assessment'
  | 'transparency_art22_dsgvo'
  | 'betriebsrat_consultation_de'
  | 'bafin_notification_de'
  | 'vait_compliance_de';

export interface AnnexCategory {
  id: string;
  label: string;
  annex_section: string;
  intro: string;
}

export interface AnnexIIIUseCase {
  id: string;
  category: string;
  title: string;
  description: string;
  triggers: string[];
  severity: Severity;
  obligations: ObligationKey[];
  norms: string[];
  prohibited_overlay?: string;
  carve_out?: string;
  examples_de?: string[];
}

export interface AnnexRegistry {
  version: string;
  source: string;
  updated_at: string;
  categories: AnnexCategory[];
  use_cases: AnnexIIIUseCase[];
  obligations_glossary: Record<ObligationKey, string>;
}

export const REGISTRY: AnnexRegistry = registryData as unknown as AnnexRegistry;

export function getCategory(id: string): AnnexCategory | undefined {
  return REGISTRY.categories.find((c) => c.id === id);
}

export function getUseCase(id: string): AnnexIIIUseCase | undefined {
  return REGISTRY.use_cases.find((uc) => uc.id === id);
}

export function getUseCasesByCategory(categoryId: string): AnnexIIIUseCase[] {
  return REGISTRY.use_cases.filter((uc) => uc.category === categoryId);
}

export function getObligationLabel(key: ObligationKey): string {
  return REGISTRY.obligations_glossary[key] ?? key;
}

/**
 * Aggregiert die finalen Pflichten aus N gewählten Use-Cases.
 * Dedupliziert + sortiert in kanonischer Reihenfolge (kritischste zuerst).
 */
export function aggregateObligations(useCaseIds: string[]): ObligationKey[] {
  const set = new Set<ObligationKey>();
  for (const id of useCaseIds) {
    const uc = getUseCase(id);
    if (!uc) continue;
    for (const o of uc.obligations) set.add(o);
  }
  const order: ObligationKey[] = [
    'conformity_assessment',
    'risk_management',
    'fundamental_rights_impact_assessment',
    'human_oversight',
    'data_governance',
    'technical_documentation',
    'logging',
    'accuracy_robustness_cybersecurity',
    'transparency_to_deployers',
    'transparency_disclosure_art50',
    'transparency_art22_dsgvo',
    'betriebsrat_consultation_de',
    'bafin_notification_de',
    'vait_compliance_de',
  ];
  return order.filter((o) => set.has(o));
}

/**
 * Aggregiertes Severity-Level aus N Use-Cases — höchste Severity gewinnt,
 * Prohibited-Overlay als Marker ob mind. ein gewählter UC eine Art.5-Verbots-
 * Variante hat (z.B. Emotion-Recognition am Arbeitsplatz).
 */
export function aggregateSeverity(useCaseIds: string[]): {
  highest: Severity;
  hasProhibitedOverlay: boolean;
} {
  let highest: Severity = 'limited';
  let prohibited = false;
  for (const id of useCaseIds) {
    const uc = getUseCase(id);
    if (!uc) continue;
    if (uc.severity === 'prohibited') highest = 'prohibited';
    else if (uc.severity === 'high' && highest !== 'prohibited') highest = 'high';
    if (uc.prohibited_overlay) prohibited = true;
  }
  return { highest, hasProhibitedOverlay: prohibited };
}
