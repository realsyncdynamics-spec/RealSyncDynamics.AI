// Marketing-Performance Skill — pure Math + Priorisierung + Brueckenschicht
// zur Marketing-Analytics-Runtime (src/core/marketing-analytics).
//
// Die Helper hier sind reine Funktionen ohne IO. Sie kapseln die Runtime-
// Agents (Compliance-Drift, Revenue-Attribution, Anomaly) hinter einer
// Skill-Oberflaeche und tragen die Standard-Guardrail durch.

import { ComplianceDriftAgent, type ComplianceDriftReport } from '../../core/marketing-analytics/complianceDriftAgent';
import { RevenueAttributionAgent } from '../../core/marketing-analytics/revenueAttributionAgent';
import { detectAnomaly } from '../../core/marketing-analytics/detectAnomaly';
import { sanitizeMetadata } from '../../core/marketing-analytics/sanitizeMetadata';
import type {
  AnomalyResult,
  AttributionModel,
  AttributionSnapshot,
  MarketingEvent,
} from '../../core/marketing-analytics/types';

export interface OptimizationItem {
  id: string;
  hypothesis: string;
  impactScore: number; // 0..1
  effortScore: number; // 0..1, hoher Wert = mehr Aufwand
  confidence: number;  // 0..1
}

export function calculateConversionRate(numerator: number, denominator: number): number {
  validatePair(numerator, denominator);
  if (denominator === 0) return 0;
  return round((numerator / denominator) * 100, 4);
}

export function calculateCtr(clicks: number, impressions: number): number {
  validatePair(clicks, impressions);
  if (impressions === 0) return 0;
  return round((clicks / impressions) * 100, 4);
}

export function calculateRoas(revenue: number, spend: number): number {
  if (!Number.isFinite(revenue) || !Number.isFinite(spend)) throw new Error('revenue/spend must be finite');
  if (spend < 0 || revenue < 0) throw new Error('values must be non-negative');
  if (spend === 0) return 0;
  return round(revenue / spend, 4);
}

export function prioritizeOptimization(items: readonly OptimizationItem[]): OptimizationItem[] {
  if (!Array.isArray(items)) throw new Error('items must be array');
  return [...items]
    .filter((i) => Number.isFinite(i.impactScore) && Number.isFinite(i.effortScore) && Number.isFinite(i.confidence))
    .map((i) => ({ ...i, _score: ice(i) }))
    .sort((a, b) => (b as { _score: number })._score - (a as { _score: number })._score)
    .map(({ _score: _drop, ...rest }) => rest as OptimizationItem);
}

function ice(i: OptimizationItem): number {
  const impact = clamp(i.impactScore);
  const ease = 1 - clamp(i.effortScore);
  const conf = clamp(i.confidence);
  return round(impact * 0.5 + ease * 0.25 + conf * 0.25, 4);
}

function clamp(v: number): number { return Math.max(0, Math.min(1, v)); }
function round(v: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(v * p) / p;
}
function validatePair(num: number, den: number): void {
  if (!Number.isFinite(num) || !Number.isFinite(den)) throw new Error('values must be finite');
  if (num < 0 || den < 0) throw new Error('values must be non-negative');
}

// ─── Marketing-Runtime-Bindings ────────────────────────────────────────────
//
// Hinweis: Benchmarks und Heuristiken sind nur Orientierung — keine Garantie.

export const MARKETING_SKILL_GUARDRAIL =
  'Branchen-Benchmarks dienen nur zur Orientierung und ersetzen keine eigene Datenanalyse.';

/**
 * Bereinigt ein Marketing-Event fuer die weitere Verarbeitung im Skill-Layer.
 * Wendet sanitizeMetadata an und setzt sichere Defaults — niemals Roh-Events
 * in die Agents geben.
 */
export function prepareMarketingEvent(event: MarketingEvent): MarketingEvent {
  if (!event || typeof event !== 'object') throw new Error('event required');
  return {
    ...event,
    currency: event.currency?.toUpperCase().slice(0, 3) ?? 'EUR',
    occurred_at: event.occurred_at ?? new Date().toISOString(),
    metadata: sanitizeMetadata(event.metadata),
  };
}

/**
 * Pruefung einer Tagesmetrik auf Outlier. Sinnvoll ist eine Historie von
 * mindestens 6 Werten (5 history + aktueller Wert) — sonst `isAnomaly=false`.
 */
export function detectKpiAnomaly(values: readonly number[]): AnomalyResult {
  return detectAnomaly(values);
}

/**
 * Ruft den ComplianceDriftAgent auf einer Liste sanitisierter Events auf.
 * Erweitert das Ergebnis um die Skill-Guardrail (Benchmarks-Orientation).
 */
export function runComplianceDrift(events: MarketingEvent[]): ComplianceDriftReport & {
  skillGuardrails: string[];
} {
  if (!Array.isArray(events)) throw new Error('events must be array');
  const sanitized = events.map(prepareMarketingEvent);
  const agent = new ComplianceDriftAgent();
  return { ...agent.analyze(sanitized), skillGuardrails: [MARKETING_SKILL_GUARDRAIL] };
}

/**
 * Ruft den RevenueAttributionAgent auf. Validiert das Modell defensiv.
 */
export function runRevenueAttribution(
  events: MarketingEvent[],
  model: AttributionModel,
  window_start: string,
  window_end: string,
): AttributionSnapshot {
  if (!Array.isArray(events)) throw new Error('events must be array');
  const allowed: AttributionModel[] = ['last_touch', 'first_touch', 'linear'];
  if (!allowed.includes(model)) throw new Error(`unknown attribution model: ${model}`);
  const sanitized = events.map(prepareMarketingEvent);
  const agent = new RevenueAttributionAgent();
  return agent.attribute(sanitized, model, window_start, window_end);
}

export interface MarketingAnalyticsReport {
  attribution: AttributionSnapshot;
  compliance: ComplianceDriftReport;
  topOptimizations: OptimizationItem[];
  skillGuardrails: string[];
}

/**
 * High-Level-Report: laeuft Attribution + Compliance-Drift in einem Schritt,
 * priorisiert die Optimierungs-Hypothesen und haengt die Skill-Guardrail an.
 *
 * Stellt KEINE Rechtsberatung dar; das Compliance-Disclaimer kommt aus dem
 * Agent-Output.
 */
export function buildMarketingAnalyticsReport(
  events: MarketingEvent[],
  model: AttributionModel,
  window_start: string,
  window_end: string,
  optimizations: readonly OptimizationItem[] = [],
): MarketingAnalyticsReport {
  const attribution = runRevenueAttribution(events, model, window_start, window_end);
  const compliance = runComplianceDrift(events);
  const topOptimizations = prioritizeOptimization(optimizations).slice(0, 5);
  return {
    attribution,
    compliance,
    topOptimizations,
    skillGuardrails: [MARKETING_SKILL_GUARDRAIL],
  };
}
