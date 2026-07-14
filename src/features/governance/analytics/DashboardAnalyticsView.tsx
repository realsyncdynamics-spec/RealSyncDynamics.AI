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

function _DashboardAnalyticsView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const DashboardAnalyticsView = withPerformanceMonitoring(
  _DashboardAnalyticsView,
  'DashboardAnalyticsView',
  { threshold: 500, maxRenders: 10 }
);
