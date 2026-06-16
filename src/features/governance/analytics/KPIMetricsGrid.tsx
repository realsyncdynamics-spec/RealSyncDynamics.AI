import { TrendingUp, TrendingDown, Minus, AlertTriangle, Shield, Clock } from 'lucide-react';
import type { KpiMetrics } from './types';
import { calculateTrend } from './analyticsApi';

interface KPIMetricsGridProps {
  metrics: KpiMetrics;
  previousMetrics?: KpiMetrics | null;
}

interface MetricCard {
  icon: React.ReactNode;
  label: string;
  value: number;
  format?: 'number' | 'percent' | 'duration';
  tooltip?: string;
  current?: number;
  previous?: number;
}

function TrendIndicator({
  current,
  previous,
}: {
  current: number;
  previous?: number;
}) {
  if (!previous) {
    return <div className="text-sm text-titanium-500">—</div>;
  }

  const { change, percent, direction } = calculateTrend(current, previous);
  const isPositive = direction === 'up';
  const color = isPositive ? 'text-green-400' : direction === 'down' ? 'text-red-400' : 'text-titanium-500';

  return (
    <div className={`flex items-center gap-1 text-sm ${color}`}>
      {direction === 'up' && <TrendingUp className="w-4 h-4" />}
      {direction === 'down' && <TrendingDown className="w-4 h-4" />}
      {direction === 'flat' && <Minus className="w-4 h-4" />}
      <span>
        {isPositive ? '+' : ''}
        {percent}%
      </span>
    </div>
  );
}

function Card({ label, icon, value, format, tooltip, current, previous }: MetricCard & { icon: React.ReactNode }) {
  let displayValue = value.toString();
  if (format === 'percent') {
    displayValue = `${value}%`;
  } else if (format === 'number') {
    displayValue = value.toLocaleString();
  }

  return (
    <div className="group bg-obsidian-800 border border-titanium-800 rounded p-5 hover:border-titanium-700 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-titanium-500 group-hover:text-titanium-400 transition-colors">
            {icon}
          </div>
          <label className="text-sm font-medium text-titanium-300">{label}</label>
        </div>
        {tooltip && (
          <div className="text-titanium-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <span title={tooltip} className="cursor-help">?</span>
          </div>
        )}
      </div>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-semibold text-titanium-50">{displayValue}</div>
        <TrendIndicator current={current ?? value} previous={previous} />
      </div>
    </div>
  );
}

export function KPIMetricsGrid({ metrics, previousMetrics }: KPIMetricsGridProps) {
  const cards: Array<MetricCard & { icon: React.ReactNode }> = [
    {
      icon: <Shield className="w-5 h-5" />,
      label: 'Total Assets',
      value: metrics.assetCount,
      format: 'number',
      tooltip: 'All governed assets across workspaces',
      current: metrics.assetCount,
      previous: previousMetrics?.assetCount,
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      label: 'Open Incidents',
      value: metrics.incidentCount,
      format: 'number',
      tooltip: 'High, Medium, Low, Info severity incidents',
      current: metrics.incidentCount,
      previous: previousMetrics?.incidentCount,
    },
    {
      icon: <Clock className="w-5 h-5" />,
      label: 'Critical Issues',
      value: metrics.criticalIncidents,
      format: 'number',
      tooltip: 'Incidents requiring immediate attention',
      current: metrics.criticalIncidents,
      previous: previousMetrics?.criticalIncidents,
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      label: 'Asset Coverage',
      value: metrics.assetEvidencePercent,
      format: 'percent',
      tooltip: 'Percentage of assets with evidence/documentation',
      current: metrics.assetEvidencePercent,
      previous: previousMetrics?.assetEvidencePercent,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} {...card} />
      ))}
    </div>
  );
}
