import React from 'react';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'passed';

const RISK_STYLES: Record<RiskLevel, string> = {
  critical: 'text-risk-critical border-risk-critical/40 bg-risk-critical-soft',
  high: 'text-risk-high border-risk-high/40 bg-risk-high-soft',
  medium: 'text-risk-medium border-risk-medium/40 bg-risk-medium-soft',
  low: 'text-risk-low border-risk-low/40 bg-risk-low-soft',
  passed: 'text-risk-passed border-risk-passed/40 bg-risk-passed-soft',
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  critical: 'Kritisch',
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
  passed: 'Bestanden',
};

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export function Badge({ children, className = '', icon }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border border-titanium-700 bg-titanium-900/60 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-titanium-300 ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  level: RiskLevel;
  label?: string;
  className?: string;
}

export function StatusBadge({ level, label, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider ${RISK_STYLES[level]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? RISK_LABELS[level]}
    </span>
  );
}
