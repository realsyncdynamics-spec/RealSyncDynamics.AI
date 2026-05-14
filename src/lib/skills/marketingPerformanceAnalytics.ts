// Marketing-Performance Skill — pure Math + Priorisierung. Benchmarks im
// Aufruf-Context sind nur Orientierung.

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
