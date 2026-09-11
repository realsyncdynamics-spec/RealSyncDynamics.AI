import React from 'react';

interface ScoreGaugeProps {
  score: number; // 0-100
  label?: string;
  size?: number;
  className?: string;
  /** health: höher = besser. risk: höher = mehr Residualrisiko. */
  tone?: 'health' | 'risk';
}

function colorForScore(score: number, tone: 'health' | 'risk'): string {
  if (tone === 'risk') {
    if (score >= 70) return 'var(--color-risk-critical)';
    if (score >= 50) return 'var(--color-risk-high)';
    if (score >= 30) return 'var(--color-risk-medium)';
    if (score >= 15) return 'var(--color-risk-low)';
    return 'var(--color-risk-passed)';
  }
  if (score >= 85) return 'var(--color-risk-passed)';
  if (score >= 65) return 'var(--color-risk-low)';
  if (score >= 40) return 'var(--color-risk-medium)';
  return 'var(--color-risk-critical)';
}

export function ScoreGauge({ score, label, size = 96, className = '', tone = 'health' }: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const color = colorForScore(clamped, tone);

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-titanium-800)"
            strokeWidth={6}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dashoffset 600ms ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-bold tabular text-titanium-50">{Math.round(clamped)}</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-500">/ 100</span>
        </div>
      </div>
      {label && (
        <span className="text-center font-mono text-[10px] font-semibold uppercase tracking-wider text-titanium-400">
          {label}
        </span>
      )}
    </div>
  );
}
