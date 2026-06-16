import { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { DbGovernanceKpiSnapshot } from './types';

interface KPIChartsProps {
  snapshots: DbGovernanceKpiSnapshot[];
  groupBy: 'asset_type' | 'risk_level' | 'event_source';
}

const COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#06b6d4',
};

const RISK_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#2563eb',
  info: '#0891b2',
};

export function KPICharts({ snapshots, groupBy }: KPIChartsProps) {
  const chartData = useMemo(() => {
    return snapshots
      .slice()
      .reverse()
      .map((s) => ({
        date: s.captured_date,
        assets: s.asset_count,
        events: s.event_count,
        incidents: s.incident_count,
        critical: s.critical_incident_count,
        high: s.high_incident_count,
        medium: s.medium_incident_count,
        low: s.medium_incident_count, // Placeholder for low
        policies: s.policy_count,
        coverage: s.assets_with_evidence_percent,
      }));
  }, [snapshots]);

  const riskDistribution = useMemo(() => {
    if (snapshots.length === 0) return [];
    const latest = snapshots[0];
    return [
      { name: 'Critical', value: latest.critical_incident_count, color: COLORS.critical },
      { name: 'High', value: latest.high_incident_count, color: COLORS.high },
      { name: 'Medium', value: latest.medium_incident_count, color: COLORS.medium },
      { name: 'Low', value: latest.incident_count - latest.critical_incident_count - latest.high_incident_count - latest.medium_incident_count, color: COLORS.low },
    ].filter((item) => item.value > 0);
  }, [snapshots]);

  const isRiskChart = groupBy === 'risk_level';
  const isAssetChart = groupBy === 'asset_type';

  if (isRiskChart && riskDistribution.length === 0) {
    return (
      <div className="bg-obsidian-800 border border-titanium-800 rounded p-6 flex items-center justify-center h-80">
        <div className="text-center text-titanium-500">
          <p className="text-sm">No risk data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-obsidian-800 border border-titanium-800 rounded p-6">
      <h3 className="text-sm font-semibold text-titanium-200 mb-4">
        {isRiskChart ? 'Risk Distribution' : 'Event Trends'}
      </h3>

      {isRiskChart ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={riskDistribution}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {riskDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#111827',
                border: '1px solid #4b5563',
                borderRadius: '6px',
              }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Line
              type="monotone"
              dataKey="incidents"
              stroke={COLORS.critical}
              strokeWidth={2}
              dot={false}
              name="Incidents"
            />
            <Line
              type="monotone"
              dataKey="events"
              stroke={COLORS.info}
              strokeWidth={2}
              dot={false}
              name="Events"
            />
            <Line
              type="monotone"
              dataKey="coverage"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="Coverage %"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
