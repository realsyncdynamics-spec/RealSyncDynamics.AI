/**
 * Policy Packs — Auto-Empfehlung (Phase 2).
 *
 * Pure, deterministisch, KEINE Side-Effects. Bewertet den globalen Pack-Katalog
 * gegen ein Tenant-Profil und liefert eine gerankte Empfehlung mit
 * menschenlesbaren Begründungen. Signale stammen ausschließlich aus RLS-sicher
 * lesbaren Tenant-Daten:
 *   - activeFrameworks: Frameworks, die über asset_control_mappings bereits
 *     in-scope sind
 *   - hasHighRiskAI: Hochrisiko-/verbotene KI-Systeme aus ai_act_risk_inventory
 *   - industry: Branche des Tenants (optional; heute meist null)
 *
 * Bewusst getrennt von coverage.ts: „Was soll ich aktivieren?" (recommend)
 * vs. „Wie gut decke ich einen aktivierten Pack ab?" (coverage).
 */

import { frameworkLabel } from './coverage';

export type RecommendationTier = 'essential' | 'recommended' | 'optional';

/** Reduzierte Pack-Sicht für die Empfehlung — nur Metadaten, keine Controls nötig. */
export interface PackForRecommend {
  id: string;
  name: string;
  /** 'all' | 'ai' | 'fintech' | 'automotive' | 'critical-infrastructure' | … */
  industry: string;
  frameworks: string[];
}

export interface RecommendationSignals {
  /** Frameworks, die im Tenant bereits genutzt werden (aus asset_control_mappings). */
  activeFrameworks?: string[];
  /** Hochrisiko-/verbotene KI-Systeme vorhanden (ai_act_risk_inventory). */
  hasHighRiskAI?: boolean;
  /** Anzahl Hochrisiko-KI-Systeme (nur für den Begründungstext). */
  highRiskCount?: number;
  /** Branche des Tenants, falls bekannt (sonst null/undefined). */
  industry?: string | null;
}

export interface PackRecommendation {
  packId: string;
  name: string;
  /** 0–100, für Ranking + UI-Balken. */
  score: number;
  tier: RecommendationTier;
  /** Deutsche, menschenlesbare Begründungen (stärkste zuerst). */
  reasons: string[];
}

// ── Gewichte (deterministisch, dokumentiert) ─────────────────────────────────
const W_HIGH_RISK_AI = 45;   // erkanntes Hochrisiko-KI-System → AI-Act-Pack Pflicht
const W_INDUSTRY = 40;       // Pack-Branche == Tenant-Branche
const W_GDPR_BASELINE = 25;  // Pack enthält DSGVO → gilt für jede EU-Organisation
const W_FOUNDATION = 20;     // 'all'-Branchen-Pack → generelles Fundament
const W_FRAMEWORK_IN_USE = 12; // je Framework, das bereits in-scope ist

const INDUSTRY_LABEL: Record<string, string> = {
  ai: 'KI/AI',
  fintech: 'FinTech/Finanzsektor',
  automotive: 'Automotive',
  'critical-infrastructure': 'Kritische Infrastruktur',
  health: 'Gesundheitswesen',
  ecommerce: 'E-Commerce',
};

function industryLabel(id: string): string {
  return INDUSTRY_LABEL[id] ?? id;
}

function tierForScore(score: number): RecommendationTier {
  if (score >= 70) return 'essential';
  if (score >= 40) return 'recommended';
  return 'optional';
}

/**
 * Bewertet und rankt Packs. Bereits aktivierte Packs (opts.excludePackIds)
 * werden herausgefiltert. Ergebnis ist absteigend nach Score sortiert; bei
 * Gleichstand deterministisch nach packId.
 */
export function recommendPacks(
  packs: PackForRecommend[],
  signals: RecommendationSignals,
  opts: { excludePackIds?: string[] } = {},
): PackRecommendation[] {
  const exclude = new Set(opts.excludePackIds ?? []);
  const activeFw = new Set(signals.activeFrameworks ?? []);
  const industry = signals.industry ?? null;

  const recs: PackRecommendation[] = [];

  for (const pack of packs) {
    if (exclude.has(pack.id)) continue;

    let score = 0;
    const reasons: string[] = [];

    // Hochrisiko-KI → AI-Act-Packs sind Pflicht.
    if (signals.hasHighRiskAI && pack.frameworks.includes('EU_AI_ACT')) {
      score += W_HIGH_RISK_AI;
      const n = signals.highRiskCount ?? 0;
      reasons.push(
        n > 0
          ? `${n} Hochrisiko-KI-System${n === 1 ? '' : 'e'} erkannt — EU-AI-Act-Pflichten (Art. 9–15) gelten`
          : 'Hochrisiko-KI erkannt — EU-AI-Act-Pflichten (Art. 9–15) gelten',
      );
    }

    // Branchen-Treffer.
    if (industry && pack.industry !== 'all' && pack.industry === industry) {
      score += W_INDUSTRY;
      reasons.push(`Passt zu Ihrer Branche: ${industryLabel(pack.industry)}`);
    }

    // DSGVO-Baseline: gilt für jede Organisation in der EU.
    if (pack.frameworks.includes('GDPR')) {
      score += W_GDPR_BASELINE;
      reasons.push('DSGVO gilt für jede Organisation in der EU');
    }

    // Generelles Fundament (branchenübergreifende Packs).
    if (pack.industry === 'all') {
      score += W_FOUNDATION;
      reasons.push('Branchenübergreifendes Compliance-Fundament');
    }

    // Frameworks, die bereits in Nutzung sind.
    const overlap = pack.frameworks.filter((fw) => activeFw.has(fw));
    if (overlap.length > 0) {
      score += W_FRAMEWORK_IN_USE * overlap.length;
      reasons.push(
        `Bereits in Nutzung: ${overlap.map(frameworkLabel).join(', ')}`,
      );
    }

    if (score <= 0) continue; // kein Signal → keine Empfehlung

    score = Math.min(100, score);
    recs.push({ packId: pack.id, name: pack.name, score, tier: tierForScore(score), reasons });
  }

  recs.sort((a, b) => (b.score - a.score) || a.packId.localeCompare(b.packId));
  return recs;
}

/** Nur die tatsächlich empfohlenen Packs (essential/recommended) für die UI-Sektion. */
export function topRecommendations(
  packs: PackForRecommend[],
  signals: RecommendationSignals,
  opts: { excludePackIds?: string[]; limit?: number } = {},
): PackRecommendation[] {
  const all = recommendPacks(packs, signals, { excludePackIds: opts.excludePackIds });
  const strong = all.filter((r) => r.tier !== 'optional');
  return typeof opts.limit === 'number' ? strong.slice(0, opts.limit) : strong;
}

export const RECOMMENDATION_TIER_LABEL: Record<RecommendationTier, string> = {
  essential: 'Essenziell',
  recommended: 'Empfohlen',
  optional: 'Optional',
};

/** Baut die Signale aus den bereits im Frontend geladenen Tenant-Daten. */
export function deriveActiveFrameworks(mappings: Array<{ framework: string }>): string[] {
  return Array.from(new Set(mappings.map((m) => m.framework)));
}
