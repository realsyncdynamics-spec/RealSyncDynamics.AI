import React from 'react';
import { RISK_SEVERITY, SEMANTIC_COLORS } from '../../config/design-tokens';

export interface KpiItem {
  id: string;
  label: string;
  value: string | number;
  hint?: string;
  severity?: keyof typeof RISK_SEVERITY;
  icon?: React.ReactNode;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value: number;
  };
  onClick?: () => void;
}

interface KpiGridProps {
  items: KpiItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export const KpiGrid: React.FC<KpiGridProps> = ({
  items,
  columns = 4,
  className = '',
}) => {
  const colsClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[columns];

  const getSeverityColor = (severity?: string) => {
    if (!severity) return '';
    const colors: Record<string, string> = {
      critical: 'border-red-600 bg-red-950/20',
      high: 'border-orange-500 bg-orange-950/20',
      medium: 'border-amber-500 bg-amber-950/20',
      low: 'border-teal-500 bg-teal-950/20',
      passed: 'border-emerald-500 bg-emerald-950/20',
    };
    return colors[severity] || '';
  };

  const getSeverityBadgeColor = (severity?: string) => {
    if (!severity) return 'text-titanium/70 bg-titanium/10';
    const colors: Record<string, string> = {
      critical: 'text-red-400 bg-red-950/30',
      high: 'text-orange-400 bg-orange-950/30',
      medium: 'text-amber-400 bg-amber-950/30',
      low: 'text-teal-400 bg-teal-950/30',
      passed: 'text-emerald-400 bg-emerald-950/30',
    };
    return colors[severity] || '';
  };

  return (
    <div className={`grid gap-4 ${colsClass} ${className}`}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={item.onClick}
          className={`group relative overflow-hidden rounded-none border border-titanium/10 bg-obsidian-900 p-6 transition-all duration-200 hover:border-titanium/20 hover:bg-obsidian-800 ${
            item.onClick ? 'cursor-pointer' : ''
          } ${item.severity ? getSeverityColor(item.severity) : ''}`}
        >
          {/* Background gradient accent */}
          <div className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="absolute inset-0 bg-gradient-to-br from-titanium/5 to-transparent" />
          </div>

          <div className="relative z-10 flex flex-col gap-3">
            {/* Header: Icon + Label */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                {item.icon && (
                  <span className="flex items-center justify-center text-lg text-titanium/70 group-hover:text-titanium/90">
                    {item.icon}
                  </span>
                )}
                <span className="text-xs font-semibold uppercase tracking-wide text-titanium/60">
                  {item.label}
                </span>
              </div>

              {/* Severity Badge */}
              {item.severity && (
                <span
                  className={`rounded-sm px-2 py-1 text-xs font-mono font-semibold whitespace-nowrap ${getSeverityBadgeColor(
                    item.severity
                  )}`}
                >
                  {item.severity}
                </span>
              )}
            </div>

            {/* Value */}
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold text-white font-display">
                {item.value}
              </div>
              {item.trend && (
                <span
                  className={`text-xs font-mono ${
                    item.trend.direction === 'up'
                      ? 'text-red-400'
                      : item.trend.direction === 'down'
                      ? 'text-emerald-400'
                      : 'text-titanium/50'
                  }`}
                >
                  {item.trend.direction === 'up' ? '↑' : item.trend.direction === 'down' ? '↓' : '→'}{' '}
                  {item.trend.value}%
                </span>
              )}
            </div>

            {/* Hint */}
            {item.hint && (
              <span className="text-xs text-titanium/50 font-mono">{item.hint}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};
