import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricsCardProps {
  label: string;
  value: number | string;
  unit?: string;
  trend?: number;
  color?: 'blue' | 'green' | 'red' | 'yellow';
  icon?: React.ReactNode;
}

export function MetricsCard({
  label,
  value,
  unit = '',
  trend,
  color = 'blue',
  icon,
}: MetricsCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
  };

  const trendClasses = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    red: 'text-red-700',
    yellow: 'text-yellow-700',
  };

  const isTrendingUp = (trend ?? 0) >= 0;

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-6 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-slate-900 font-mono">
          {typeof value === 'number' ? value.toFixed(2) : value}
        </span>
        {unit && <span className="text-sm text-slate-600">{unit}</span>}
      </div>

      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-sm ${trendClasses[color]}`}>
          {isTrendingUp ? (
            <TrendingUp size={14} />
          ) : (
            <TrendingDown size={14} />
          )}
          <span>{Math.abs(trend).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}
