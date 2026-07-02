/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Score-Gauge (0–100) für die Ergebnis-Übersicht.
 * Reines SVG, kein Chart-Lib — hält das Bundle klein und passt zum
 * Hard-Edge-Look (der Ring ist die einzige Rundung, bewusst als
 * Daten-Visualisierung, kein UI-Radius).
 */

interface ScoreGaugeProps {
  score: number;
  size?: number;
}

/** Farbwahl folgt dem System: Petrol (gut) → Brass (mittel) → Rot (kritisch). */
function scoreColor(score: number): string {
  if (score >= 80) return '#0F766E'; // petrol
  if (score >= 50) return '#b78a3d'; // brass-500
  return '#dc2626'; // red-600
}

export function ScoreGauge({ score, size = 176 }: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;
  const color = scoreColor(clamped);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`Score ${clamped} von 100`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-obsidian-700, #101013)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="butt"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-bold text-titanium-50 tabular-nums">{clamped}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-titanium-400">/ 100</span>
      </div>
    </div>
  );
}
