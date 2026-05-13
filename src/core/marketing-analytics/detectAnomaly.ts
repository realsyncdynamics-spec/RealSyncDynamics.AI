// detectAnomaly — einfache Z-Score-basierte Outlier-Erkennung fuer
// Funnel-Metriken (taegliche Conversions, CTR, Checkout-Drop-off, etc.).
//
// Bewusst minimal: der jeweils LETZTE Wert in `values` wird gegen den
// Durchschnitt + Standardabweichung der vorherigen Werte gepruft. Damit
// koennen wir z. B. "Conversions heute 4σ unter Schnitt" erkennen, ohne
// ML-Stack.

import type { AnomalyResult } from './types';

const Z_THRESHOLD = 2.5;
const MIN_HISTORY = 5;

export function detectAnomaly(values: readonly number[]): AnomalyResult {
  if (!Array.isArray(values) || values.length < MIN_HISTORY + 1) {
    return { isAnomaly: false, value: NaN, mean: NaN, stdDev: NaN, zScore: NaN };
  }

  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length < MIN_HISTORY + 1) {
    return { isAnomaly: false, value: NaN, mean: NaN, stdDev: NaN, zScore: NaN };
  }

  const current = finite[finite.length - 1]!;
  const history = finite.slice(0, -1);

  const mean = history.reduce((acc, v) => acc + v, 0) / history.length;
  const variance =
    history.reduce((acc, v) => acc + (v - mean) ** 2, 0) / history.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    // Konstanter Verlauf: jede Abweichung ist eine Anomalie.
    const isAnomaly = current !== mean;
    return {
      isAnomaly,
      value: current,
      mean,
      stdDev,
      zScore: isAnomaly ? Number.POSITIVE_INFINITY * Math.sign(current - mean) : 0,
    };
  }

  const zScore = (current - mean) / stdDev;
  return {
    isAnomaly: Math.abs(zScore) >= Z_THRESHOLD,
    value: current,
    mean,
    stdDev,
    zScore,
  };
}
