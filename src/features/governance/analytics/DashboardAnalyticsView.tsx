import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Download } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
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

export function DashboardAnalyticsView() {
  const { activeTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<DbGovernanceKpiSnapshot[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    },
    workspaceIds: [],
    assetTypes: [],
    severityLevels: [],
  });
  const [exportOpen, setExportOpen] = useState(false);

  // Fetch data on mount and when filters change
  useEffect(() => {
    if (!activeTenant?.id) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const start = performance.now();
        const data = await fetchKpiRange(
          activeTenant.id,
          filters.dateRange.start,
          filters.dateRange.end
        );
        const duration = Math.round(performance.now() - start);

        setSnapshots(data);
      } catch (err) {
        console.error('Failed to fetch analytics data:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load analytics data. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTenant?.id, filters.dateRange]);

  // Get latest metrics for KPI cards
  const latestMetrics = useMemo(() => {
    if (snapshots.length === 0) return null;
    return snapshotToMetrics(snapshots[0]);
  }, [snapshots]);

  // Get previous period for trend calculation
  const previousPeriodMetrics = useMemo(() => {
    if (snapshots.length < 2) return null;
    return snapshotToMetrics(snapshots[snapshots.length - 1]);
  }, [snapshots]);

  if (!activeTenant?.id) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-titanium-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No workspace selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-obsidian-900/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-titanium-900">
        <div>
          <h1 className="text-xl font-semibold text-titanium-50">Analytics</h1>
          <p className="text-sm text-titanium-400 mt-1">Real-time KPI metrics &amp; compliance reporting</p>
        </div>
        <button
          onClick={() => setExportOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-obsidian-800 border border-titanium-700 rounded text-titanium-50 text-sm font-medium hover:bg-obsidian-700 hover:border-titanium-600 transition-all"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-900/20 border border-red-700 rounded text-red-200 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error loading analytics</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Filter Panel */}
          <FilterPanel filters={filters} onFiltersChange={setFilters} />

          {/* Loading state */}
          {loading && !snapshots.length && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center text-titanium-400">
                <div className="inline-block animate-spin mb-4">
                  <div className="w-8 h-8 border-2 border-titanium-700 border-t-titanium-400 rounded-full" />
                </div>
                <p className="text-sm">Loading analytics data...</p>
              </div>
            </div>
          )}

          {/* KPI Cards */}
          {!loading && latestMetrics && (
            <KPIMetricsGrid metrics={latestMetrics} previousMetrics={previousPeriodMetrics} />
          )}

          {/* Charts */}
          {!loading && snapshots.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <KPICharts snapshots={snapshots} groupBy="risk_level" />
              <KPICharts snapshots={snapshots} groupBy="asset_type" />
            </div>
          )}

          {/* Data Table */}
          {!loading && snapshots.length > 0 && (
            <AnalyticsTable snapshots={snapshots} />
          )}

          {/* Empty state */}
          {!loading && snapshots.length === 0 && !error && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center text-titanium-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No data available</p>
                <p className="text-sm mt-1 opacity-75">
                  KPI snapshots are generated daily and will appear here
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}
