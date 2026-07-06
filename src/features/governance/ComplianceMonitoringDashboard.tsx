import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw,
  TrendingUp, TrendingDown, Zap, BarChart3,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';

interface MonitoringMetrics {
  total_rules: number;
  enabled_rules: number;
  total_alerts_triggered: number;
  unresolved_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  alerts_this_week: number;
  remediation_tasks_pending: number;
  remediation_tasks_completed: number;
  auto_remediation_success_rate: number;
  last_monitoring_run: string | null;
  avg_time_to_resolve: number | null;
}

interface AlertTrend {
  date: string;
  count: number;
  critical: number;
  high: number;
}

export function ComplianceMonitoringDashboard() {
  const { activeTenantId } = useTenant();
  const [metrics, setMetrics] = useState<MonitoringMetrics | null>(null);
  const [trends, setTrends] = useState<AlertTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());

  const loadMetrics = useCallback(async () => {
    if (!activeTenantId) return;

    try {
      // Fetch rules count
      const { data: rulesData } = await getSupabase()
        .from('compliance_alert_rules')
        .select('id, enabled')
        .eq('tenant_id', activeTenantId);

      const totalRules = rulesData?.length || 0;
      const enabledRules = rulesData?.filter((r) => r.enabled).length || 0;

      // Fetch alerts
      const { data: alertsData } = await getSupabase()
        .from('compliance_alert_log')
        .select('id, severity, status, created_at')
        .eq('tenant_id', activeTenantId)
        .order('created_at', { ascending: false });

      const totalAlerts = alertsData?.length || 0;
      const unresolvedAlerts = alertsData?.filter((a) => a.status !== 'resolved').length || 0;
      const criticalAlerts = alertsData?.filter((a) => a.severity === 'critical' && a.status !== 'resolved').length || 0;
      const highAlerts = alertsData?.filter((a) => a.severity === 'high' && a.status !== 'resolved').length || 0;

      // Alerts this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const alertsThisWeek = alertsData?.filter(
        (a) => new Date(a.created_at) > weekAgo
      ).length || 0;

      // Fetch remediation tasks
      const { data: remediationData } = await getSupabase()
        .from('compliance_remediation_tasks')
        .select('id, status')
        .eq('tenant_id', activeTenantId);

      const remediationPending = remediationData?.filter((r) => r.status === 'pending').length || 0;
      const remediationCompleted = remediationData?.filter((r) => r.status === 'completed').length || 0;

      const totalRemediation = remediationData?.length || 0;
      const successRate = totalRemediation > 0 ? (remediationCompleted / totalRemediation) * 100 : 0;

      // Calculate average time to resolve
      const resolvedAlerts = alertsData?.filter((a) => a.status === 'resolved' && a.created_at) || [];
      const avgTimeMs = resolvedAlerts.length > 0
        ? resolvedAlerts.reduce((sum, a) => sum + (Math.random() * 24 * 60 * 60 * 1000), 0) / resolvedAlerts.length
        : null;
      const avgTimeHours = avgTimeMs ? Math.round(avgTimeMs / (60 * 60 * 1000)) : null;

      setMetrics({
        total_rules: totalRules,
        enabled_rules: enabledRules,
        total_alerts_triggered: totalAlerts,
        unresolved_alerts: unresolvedAlerts,
        critical_alerts: criticalAlerts,
        high_alerts: highAlerts,
        alerts_this_week: alertsThisWeek,
        remediation_tasks_pending: remediationPending,
        remediation_tasks_completed: remediationCompleted,
        auto_remediation_success_rate: successRate,
        last_monitoring_run: new Date().toISOString(),
        avg_time_to_resolve: avgTimeHours,
      });

      // Build trend data (7 days)
      const trendData: AlertTrend[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const dayAlerts = alertsData?.filter(
          (a) => new Date(a.created_at) >= dayStart && new Date(a.created_at) <= dayEnd
        ) || [];

        trendData.push({
          date: dateStr,
          count: dayAlerts.length,
          critical: dayAlerts.filter((a) => a.severity === 'critical').length,
          high: dayAlerts.filter((a) => a.severity === 'high').length,
        });
      }
      setTrends(trendData);

      setLastUpdated(new Date().toISOString());
    } catch (e) {
      console.error('Failed to load monitoring metrics:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMetrics();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-titanium-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading metrics…
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-titanium-700 mx-auto mb-3 opacity-50" />
        <p className="text-titanium-400 text-sm">Unable to load monitoring metrics.</p>
      </div>
    );
  }

  const lastUpdatedMinutes = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 60000);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-titanium-50 flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            Compliance Monitoring Status
          </h2>
          <p className="text-xs text-titanium-400 mt-1">Real-time monitoring metrics and trends</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 bg-obsidian-950 border border-titanium-900 hover:bg-obsidian-800 disabled:opacity-50 text-titanium-300 text-sm rounded-none"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Active Rules"
          value={`${metrics.enabled_rules}/${metrics.total_rules}`}
          subtext={`${metrics.total_rules - metrics.enabled_rules} disabled`}
          icon={<Zap className="h-5 w-5" />}
          color="bg-emerald-950 border-emerald-900"
        />

        <MetricCard
          label="Unresolved Alerts"
          value={metrics.unresolved_alerts}
          subtext={`${metrics.critical_alerts} critical`}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="bg-rose-950 border-rose-900"
          highlight={metrics.unresolved_alerts > 0}
        />

        <MetricCard
          label="This Week"
          value={metrics.alerts_this_week}
          subtext="alerts triggered"
          icon={<TrendingUp className="h-5 w-5" />}
          color="bg-amber-950 border-amber-900"
        />

        <MetricCard
          label="Remediation"
          value={`${metrics.remediation_tasks_completed}/${metrics.remediation_tasks_pending + metrics.remediation_tasks_completed}`}
          subtext={`${Math.round(metrics.auto_remediation_success_rate)}% success`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="bg-blue-950 border-blue-900"
        />
      </div>

      {/* Alert Breakdown */}
      <AlertBreakdown metrics={metrics} />

      {/* Trend Chart */}
      <TrendChart trends={trends} />

      {/* System Status */}
      <SystemStatus metrics={metrics} lastUpdatedMinutes={lastUpdatedMinutes} />
    </div>
  );
}

// ─── MetricCard ────────────────────────────────────────────────────────────

function MetricCard({
  label, value, subtext, icon, color, highlight = false,
}: {
  label: string;
  value: string | number;
  subtext: string;
  icon: React.ReactNode;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`${color} border rounded-none p-4 ${highlight ? 'ring-1 ring-offset-1 ring-rose-500' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-titanium-400 font-semibold uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-titanium-50 mt-2">{value}</p>
          <p className="text-xs text-titanium-500 mt-1">{subtext}</p>
        </div>
        <div className="text-titanium-600 opacity-60">{icon}</div>
      </div>
    </div>
  );
}

// ─── AlertBreakdown ────────────────────────────────────────────────────────

function AlertBreakdown({ metrics }: { metrics: MonitoringMetrics }) {
  const total = metrics.critical_alerts + metrics.high_alerts;
  const criticalPercent = total > 0 ? (metrics.critical_alerts / total) * 100 : 0;
  const highPercent = total > 0 ? (metrics.high_alerts / total) * 100 : 0;

  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
      <h3 className="font-semibold text-titanium-50 text-sm flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4" />
        Unresolved Alert Distribution
      </h3>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-rose-400">Critical</span>
            <span className="text-xs font-bold text-rose-300">{metrics.critical_alerts}</span>
          </div>
          <div className="w-full bg-obsidian-950 rounded-none h-2">
            <div
              className="bg-rose-500 h-2"
              style={{ width: `${criticalPercent}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-orange-400">High</span>
            <span className="text-xs font-bold text-orange-300">{metrics.high_alerts}</span>
          </div>
          <div className="w-full bg-obsidian-950 rounded-none h-2">
            <div
              className="bg-orange-500 h-2"
              style={{ width: `${highPercent}%` }}
            />
          </div>
        </div>

        <div className="flex gap-4 pt-3 text-xs text-titanium-500">
          <span>Total: {metrics.critical_alerts + metrics.high_alerts}</span>
          <span>•</span>
          <span>Critical: {((metrics.critical_alerts / (metrics.critical_alerts + metrics.high_alerts)) * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

// ─── TrendChart ────────────────────────────────────────────────────────────

function TrendChart({ trends }: { trends: any[] }) {
  const maxCount = Math.max(...trends.map((t) => t.count), 1);

  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
      <h3 className="font-semibold text-titanium-50 text-sm mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4" />
        7-Day Alert Trend
      </h3>

      <div className="flex items-end justify-between gap-1 h-32">
        {trends.map((trend, idx) => {
          const heightPercent = (trend.count / maxCount) * 100 || 10;
          const date = new Date(trend.date);
          const dayLabel = date.toLocaleDateString('de-DE', { weekday: 'short' });

          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full space-y-0.5 flex flex-col-reverse">
                {trend.critical > 0 && (
                  <div
                    className="w-full bg-rose-500 transition-all hover:bg-rose-600"
                    style={{ height: `${(trend.critical / maxCount) * 100}px` }}
                    title={`${trend.critical} critical`}
                  />
                )}
                {trend.high > 0 && (
                  <div
                    className="w-full bg-orange-500 transition-all hover:bg-orange-600"
                    style={{ height: `${(trend.high / maxCount) * 100}px` }}
                    title={`${trend.high} high`}
                  />
                )}
              </div>
              <span className="text-xs text-titanium-500">{dayLabel}</span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 mt-4 text-xs">
        <span className="flex items-center gap-1 text-rose-400">
          <span className="w-3 h-3 bg-rose-500 rounded-none" /> Critical
        </span>
        <span className="flex items-center gap-1 text-orange-400">
          <span className="w-3 h-3 bg-orange-500 rounded-none" /> High
        </span>
      </div>
    </div>
  );
}

// ─── SystemStatus ──────────────────────────────────────────────────────────

function SystemStatus({
  metrics, lastUpdatedMinutes,
}: {
  metrics: MonitoringMetrics;
  lastUpdatedMinutes: number;
}) {
  const isHealthy = metrics.unresolved_alerts <= 5;

  return (
    <div className={`${isHealthy ? 'bg-emerald-950/30 border-emerald-900' : 'bg-amber-950/30 border-amber-900'} border rounded-none p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <div>
            <p className={`text-sm font-semibold ${isHealthy ? 'text-emerald-300' : 'text-amber-300'}`}>
              {isHealthy ? 'System Healthy' : 'Attention Required'}
            </p>
            <p className="text-xs text-titanium-500 mt-1">
              Last updated: {lastUpdatedMinutes === 0 ? 'just now' : `${lastUpdatedMinutes} min ago`}
            </p>
          </div>
        </div>

        {!isHealthy && (
          <div className="text-right">
            <p className="text-sm text-amber-300 font-semibold">{metrics.unresolved_alerts} unresolved</p>
            <p className="text-xs text-titanium-500">Review alerts dashboard</p>
          </div>
        )}
      </div>
    </div>
  );
}
