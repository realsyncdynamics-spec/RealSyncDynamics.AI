import React, { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useTenant } from '../../core/TenantProvider';
import { MetricsCard } from './MetricsCard';
import { TrendChart } from './TrendChart';
import { ShadowSaasTable } from './ShadowSaasTable';
import { BarChart3, DollarSign, TrendingUp, AlertTriangle, Calendar } from 'lucide-react';

interface DashboardData {
  marketing_metrics: any[];
  shadow_seo_tools: any[];
  security_events: any[];
  customer_summary: any;
}

interface Metrics {
  cac: number;
  ltv: number;
  ltv_cac_ratio: number;
  conversion_rate: number;
  churn_rate: number;
  cmrr: number;
  period_metrics: any;
}

export function SEOMarketingDashboard() {
  const { session } = useAuth();
  const { tenant } = useTenant();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!session || !tenant) return;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch dashboard data
        const dashboardRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seo-dashboard-data`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (!dashboardRes.ok) throw new Error('Failed to fetch dashboard data');
        const dashData = await dashboardRes.json();
        setDashboardData(dashData);

        // Calculate metrics
        const metricsRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-seo-metrics`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tenant_id: tenant.id,
              start_date: dateRange.start,
              end_date: dateRange.end,
            }),
          },
        );

        if (!metricsRes.ok) throw new Error('Failed to calculate metrics');
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      } catch (err) {
        console.error('Error fetching dashboard:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session, tenant, dateRange]);

  if (isLoading) {
    return (
      <div className="bg-obsidian-900 text-titanium-50 min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-12 bg-slate-700 rounded w-64 mb-8 animate-pulse" />
          <div className="grid grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-slate-700 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-obsidian-900 text-titanium-50 min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-900 border border-red-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-2">Fehler beim Laden des Dashboards</h2>
            <p className="text-red-100">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const trendData = (dashboardData?.marketing_metrics || []).map((m: any) => ({
    date: new Date(m.period_start).toLocaleDateString('de-DE', {
      month: 'short',
      day: 'numeric',
    }),
    cac: metrics?.cac || 0,
    ltv: metrics?.ltv || 0,
    cmrr: metrics?.cmrr || 0,
  }));

  const highRiskTools = (dashboardData?.shadow_seo_tools || []).filter(
    (t: any) => t.risk_level === 'high',
  );

  return (
    <div className="bg-obsidian-900 text-titanium-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">SEO & Marketing Dashboard</h1>
          <p className="text-titanium-400">
            CAC, LTV & Shadow SaaS Überwachung — Gewinnbringend & Governance-konform
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-titanium-400">
            <Calendar size={16} />
            <span>Zeitraum:</span>
          </div>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-titanium-50 font-mono text-sm"
          />
          <span className="text-titanium-400">bis</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-titanium-50 font-mono text-sm"
          />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricsCard
            label="Customer Acquisition Cost"
            value={metrics?.cac || 0}
            unit="€"
            color="blue"
            icon={<DollarSign size={20} />}
          />
          <MetricsCard
            label="Lifetime Value"
            value={metrics?.ltv || 0}
            unit="€"
            color="green"
            icon={<TrendingUp size={20} />}
          />
          <MetricsCard
            label="LTV:CAC Ratio"
            value={metrics?.ltv_cac_ratio || 0}
            color="green"
            icon={<BarChart3 size={20} />}
          />
          <MetricsCard
            label="Konversionsrate"
            value={metrics?.conversion_rate || 0}
            unit="%"
            color="yellow"
            icon={<TrendingUp size={20} />}
          />
        </div>

        {/* Summary Metrics */}
        {dashboardData?.customer_summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <p className="text-sm text-titanium-400 mb-2">Aktive Kunden</p>
              <p className="text-3xl font-bold text-green-400 font-mono">
                {dashboardData.customer_summary.active_customers}
              </p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <p className="text-sm text-titanium-400 mb-2">Churn-Rate</p>
              <p className="text-3xl font-bold text-red-400 font-mono">
                {((dashboardData.customer_summary.churned_customers /
                  (dashboardData.customer_summary.active_customers + dashboardData.customer_summary.churned_customers)) * 100 || 0).toFixed(1)}%
              </p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <p className="text-sm text-titanium-400 mb-2">CMRR</p>
              <p className="text-3xl font-bold text-cyan-400 font-mono">
                €{metrics?.cmrr?.toFixed(0) || 0}
              </p>
            </div>
          </div>
        )}

        {/* Trend Chart */}
        <div className="mb-8">
          <TrendChart data={trendData} title="CAC, LTV & CMRR Trends (6 Monate)" />
        </div>

        {/* Shadow SaaS Table */}
        <div className="mb-8">
          <ShadowSaasTable
            tools={dashboardData?.shadow_seo_tools || []}
            isLoading={isLoading}
          />
        </div>

        {/* Risk Alert */}
        {highRiskTools.length > 0 && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-6 flex gap-4">
            <AlertTriangle size={24} className="text-red-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-100 mb-2">
                {highRiskTools.length} Tools mit hohem Risiko erkannt
              </h3>
              <p className="text-red-200 text-sm">
                Diese ungenehmigten SEO-Tools stellen ein Sicherheitsrisiko dar. Bitte überprüfen Sie
                die Details und leiten Sie Governance-Maßnahmen ein.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
