import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TrendChartProps {
  data: Array<{
    date: string;
    cac?: number;
    ltv?: number;
    cmrr?: number;
  }>;
  title: string;
  height?: number;
}

export function TrendChart({ data, title, height = 400 }: TrendChartProps) {
  const hasCac = data.some((d) => d.cac !== undefined);
  const hasLtv = data.some((d) => d.ltv !== undefined);
  const hasCmrr = data.some((d) => d.cmrr !== undefined);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-6">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            stroke="#64748b"
            style={{ fontSize: '12px' }}
          />
          <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: '#f1f5f9',
            }}
            formatter={(value: any) => [
              `€${typeof value === 'number' ? value.toFixed(2) : value}`,
              '',
            ]}
          />
          <Legend />
          {hasCac && (
            <Line
              type="monotone"
              dataKey="cac"
              stroke="#0052FF"
              name="CAC"
              isAnimationActive={false}
              strokeWidth={2}
            />
          )}
          {hasLtv && (
            <Line
              type="monotone"
              dataKey="ltv"
              stroke="#10b981"
              name="LTV"
              isAnimationActive={false}
              strokeWidth={2}
            />
          )}
          {hasCmrr && (
            <Line
              type="monotone"
              dataKey="cmrr"
              stroke="#f59e0b"
              name="CMRR"
              isAnimationActive={false}
              strokeWidth={2}
              yAxisId="right"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
