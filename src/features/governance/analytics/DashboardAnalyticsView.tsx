import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Download } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../../../lib/hoc';
import {
  fetchKpiRange,
  fetchLatestKpi,
  snapshotToMetrics,
} from './analyticsApi';
import type { FilterState, DbGovernanceKpiSnapshot } from './types';
import { KPIMetricsGrid } from './KPIMetricsGrid';
import { KPICharts } from './KPICharts';
import { FilterPanel } from './FilterPanel';
import { AnalyticsTable } from './AnalyticsTable';
import { ExportModal } from './ExportModal';
import { DATE_RANGE_PRESETS } from './types';

function _DashboardAnalyticsView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const DashboardAnalyticsView = withPerformanceMonitoring(
  _DashboardAnalyticsView,
  'DashboardAnalyticsView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    },
    workspaceIds: [],
    assetTypes: [],
    severityLevels: [],
  });
  const [kpiData, setKpiData] = useState<DbGovernanceKpiSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [groupBy, setGroupBy] = useState<'asset_type' | 'risk_level' | 'event_source'>('risk_level');

  useEffect(() => {
    void loadKpiData();
  }, [activeTenantId, filters]);

  const loadKpiData = async () => {
    if (!activeTenantId) return;
    try {
      setLoading(true);
      const data = await fetchKpiRange(
        activeTenantId,
        filters.dateRange.start,
        filters.dateRange.end,
      );
      setKpiData(data || []);
    } catch (err) {
      console.error('Failed to load KPI data:', err);
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(() => {
    if (kpiData.length === 0) return undefined;
    const latest = kpiData[kpiData.length - 1];
    return snapshotToMetrics(latest);
  }, [kpiData]);

  return (
    <div className="flex flex-col h-screen bg-obsidian-950 text-titanium-100">
      {/* Header */}
      <div className="px-6 py-4 border-b border-titanium-900">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold">Dashboard Analytics</h1>
            <p className="text-[12px] text-titanium-400 mt-1">Governance Performance Metrics & Trend Analysis</p>
          </div>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-3 py-1.5 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>

        {/* Filter Panel */}
        <FilterPanel filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-[12px] text-titanium-400">Metriken werden geladen...</div>
            </div>
          </div>
        ) : metrics ? (
          <div className="space-y-6">
            {/* KPI Metrics Grid */}
            <KPIMetricsGrid metrics={metrics} />

            {/* Charts */}
            <div className="bg-obsidian-900 border border-titanium-900 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-titanium-100">Trends & Verlauf</h2>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as 'asset_type' | 'risk_level' | 'event_source')}
                  className="font-mono text-[10px] px-2 py-1 bg-obsidian-800 border border-titanium-800 text-titanium-300"
                >
                  <option value="risk_level">Risikostufe</option>
                  <option value="asset_type">Asset-Typ</option>
                  <option value="event_source">Ereignisquelle</option>
                </select>
              </div>
              <KPICharts snapshots={kpiData} groupBy={groupBy} />
            </div>

            {/* Analytics Table */}
            <div className="bg-obsidian-900 border border-titanium-900 p-4">
              <h2 className="text-sm font-semibold text-titanium-100 mb-4">Detaillierte Analyse</h2>
              <AnalyticsTable snapshots={kpiData} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
              <div className="text-[12px] text-titanium-400">Keine Daten für die gewählte Zeitspanne</div>
            </div>
          </div>
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        open={showExport}
        onOpenChange={setShowExport}
      />
    </div>
  );
}
