import { useEffect, useState, useCallback } from 'react';
import { useTenant } from '../access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

export interface ComplianceTrendDataPoint {
  date: Date;
  complianceScore: number; // 0-100
  controlsCompliant: number;
  controlsTotal: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
}

export interface ComplianceTrendMetrics {
  period: '7d' | '30d' | '90d';
  dataPoints: ComplianceTrendDataPoint[];
  averageScore: number;
  trend: 'improving' | 'stable' | 'declining';
  changePercent: number;
  loading: boolean;
  error: string | null;
}

/**
 * Hook for fetching and analyzing compliance trend data.
 * Tracks compliance score changes over configurable time period.
 *
 * Returns null if Supabase is not configured or tenant is not selected.
 */
export function useComplianceTrends(period: '7d' | '30d' | '90d' = '30d'): ComplianceTrendMetrics | null {
  const { activeTenantId } = useTenant();
  const [metrics, setMetrics] = useState<ComplianceTrendMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    if (!activeTenantId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const sb = getSupabase();

      // Calculate date range based on period
      const now = new Date();
      const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

      // Fetch compliance snapshots for the period
      const { data: snapshots, error: snapshotError } = await sb
        .from('compliance_snapshots')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', now.toISOString())
        .order('created_at', { ascending: true });

      if (snapshotError) {
        throw snapshotError;
      }

      // Transform snapshots into trend data points
      const dataPoints: ComplianceTrendDataPoint[] = (snapshots || []).map((snapshot) => ({
        date: new Date(snapshot.created_at),
        complianceScore: snapshot.compliance_score || 0,
        controlsCompliant: snapshot.controls_compliant || 0,
        controlsTotal: snapshot.controls_total || 1,
        criticalIssues: snapshot.critical_issues || 0,
        highIssues: snapshot.high_issues || 0,
        mediumIssues: snapshot.medium_issues || 0,
      }));

      // If no data points, create dummy data for current snapshot
      if (dataPoints.length === 0) {
        dataPoints.push({
          date: now,
          complianceScore: 0,
          controlsCompliant: 0,
          controlsTotal: 0,
          criticalIssues: 0,
          highIssues: 0,
          mediumIssues: 0,
        });
      }

      // Calculate metrics
      const averageScore = dataPoints.length
        ? Math.round(
            dataPoints.reduce((sum, dp) => sum + dp.complianceScore, 0) / dataPoints.length
          )
        : 0;

      const firstScore = dataPoints[0]?.complianceScore || 0;
      const lastScore = dataPoints[dataPoints.length - 1]?.complianceScore || 0;
      const changePercent = firstScore > 0 ? Math.round(((lastScore - firstScore) / firstScore) * 100) : 0;

      const trend = changePercent > 2 ? 'improving' : changePercent < -2 ? 'declining' : 'stable';

      setMetrics({
        period,
        dataPoints,
        averageScore,
        trend,
        changePercent,
        loading: false,
        error: null,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch trends';
      setError(errorMsg);
      console.error('Compliance trends fetch error:', err);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, period]);

  useEffect(() => {
    void fetchTrends();
  }, [fetchTrends]);

  return metrics;
}
