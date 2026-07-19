/**
 * Analytics Dashboard
 * KPI metrics for route efficiency, SLA compliance, costs, and environmental impact
 */

import React, { useMemo } from 'react';
import { LogisticsRoute, LogisticsDecision } from '../../../types/logistics';

interface AnalyticsDashboardProps {
  routes: LogisticsRoute[];
  decisions: LogisticsDecision[];
}

interface KPI {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  target?: string;
  status: 'good' | 'warning' | 'critical';
}

export function AnalyticsDashboard({
  routes,
  decisions
}: AnalyticsDashboardProps) {
  const metrics = useMemo((): KPI[] => {
    if (routes.length === 0) {
      return [];
    }

    // SLA Compliance Rate
    const slaCompliantRoutes = routes.filter(r => r.sla_compliant === true).length;
    const slaRate = (slaCompliantRoutes / routes.length) * 100;

    // Average Route Efficiency
    const avgDistance = routes.reduce((sum, r) => sum + r.total_distance_km, 0) / routes.length;
    const avgStops = routes.reduce((sum, r) => sum + (r.stops?.length || 0), 0) / routes.length;
    const avgEfficiency = avgStops / avgDistance;

    // Total Cost
    const totalCost = routes.reduce((sum, r) => sum + (r.estimated_cost || 0), 0);
    const avgCostPerRoute = totalCost / routes.length;

    // Environmental Impact
    const totalCO2 = routes.reduce((sum, r) => sum + (r.estimated_co2_grams || 0), 0);
    const avgCO2PerKm = totalCO2 / routes.reduce((sum, r) => sum + r.total_distance_km, 0);

    // Vehicle Utilization
    const totalCapacityUsed = routes.reduce((sum, r) => sum + (r.utilized_weight_kg || 0), 0);
    const totalCapacity = routes.reduce((sum, r) => sum + r.max_weight_kg, 0);
    const utilizationRate = (totalCapacityUsed / totalCapacity) * 100;

    // Decision Confidence
    const avgConfidence = decisions.length > 0
      ? (decisions.reduce((sum, d) => sum + (d.confidence_score || 0.75), 0) / decisions.length) * 100
      : 0;

    return [
      {
        label: 'SLA Compliance',
        value: slaRate.toFixed(1),
        unit: '%',
        target: '95%',
        status: slaRate >= 95 ? 'good' : slaRate >= 85 ? 'warning' : 'critical'
      },
      {
        label: 'Avg Stops/km',
        value: avgEfficiency.toFixed(2),
        target: '0.05',
        status: avgEfficiency >= 0.05 ? 'good' : 'warning'
      },
      {
        label: 'Cost/Route',
        value: avgCostPerRoute.toFixed(2),
        unit: '$',
        trend: 'down',
        status: 'good'
      },
      {
        label: 'CO2/km',
        value: avgCO2PerKm.toFixed(0),
        unit: 'g',
        trend: 'down',
        status: avgCO2PerKm <= 300 ? 'good' : avgCO2PerKm <= 400 ? 'warning' : 'critical'
      },
      {
        label: 'Vehicle Utilization',
        value: utilizationRate.toFixed(1),
        unit: '%',
        target: '80%',
        status: utilizationRate >= 80 ? 'good' : utilizationRate >= 60 ? 'warning' : 'critical'
      },
      {
        label: 'Decision Confidence',
        value: avgConfidence.toFixed(0),
        unit: '%',
        status: avgConfidence >= 80 ? 'good' : avgConfidence >= 60 ? 'warning' : 'critical'
      }
    ];
  }, [routes, decisions]);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'good':
        return 'bg-emerald-500 bg-opacity-10 border-emerald-500 text-emerald-400';
      case 'warning':
        return 'bg-amber-500 bg-opacity-10 border-amber-500 text-amber-400';
      case 'critical':
        return 'bg-red-500 bg-opacity-10 border-red-500 text-red-400';
      default:
        return 'bg-obsidian-800 border-titanium-800 text-titanium-400';
    }
  };

  const getTrendIcon = (trend?: string): string => {
    switch (trend) {
      case 'up':
        return '↗';
      case 'down':
        return '↘';
      default:
        return '→';
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-titanium-800 px-4 py-3 bg-obsidian-950">
        <h3 className="text-lg font-bold">Performance Metrics</h3>
        <p className="text-xs text-titanium-400 mt-1">Real-time KPIs ({routes.length} active routes)</p>
      </div>

      {/* Metrics Grid */}
      {metrics.length > 0 ? (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((metric, idx) => (
              <div
                key={idx}
                className={`p-3 rounded border transition-colors ${getStatusColor(metric.status)}`}
              >
                <div className="text-xs font-semibold text-titanium-300 uppercase tracking-wider">
                  {metric.label}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <div className="text-2xl font-bold">
                    {metric.value}
                  </div>
                  {metric.unit && (
                    <div className="text-sm text-titanium-400">{metric.unit}</div>
                  )}
                  {metric.trend && (
                    <div className="ml-auto text-lg">{getTrendIcon(metric.trend)}</div>
                  )}
                </div>
                {metric.target && (
                  <div className="text-xs text-titanium-400 mt-1">
                    Target: {metric.target}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-titanium-400 text-sm">No data available</p>
          </div>
        </div>
      )}

      {/* Footer Stats */}
      <div className="border-t border-titanium-800 bg-obsidian-950 px-4 py-2 text-xs text-titanium-400 space-y-1">
        <div>
          <span className="font-semibold">Total Routes:</span> {routes.length}
        </div>
        <div>
          <span className="font-semibold">Total Distance:</span> {routes.reduce((sum, r) => sum + r.total_distance_km, 0).toFixed(0)} km
        </div>
        <div>
          <span className="font-semibold">Total Orders:</span> {routes.reduce((sum, r) => sum + (r.stops?.length || 0), 0)}
        </div>
      </div>
    </div>
  );
}
