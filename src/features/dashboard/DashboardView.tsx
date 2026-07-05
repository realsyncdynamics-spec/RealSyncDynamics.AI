import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';
import { TrendingUp, AlertTriangle, Lightbulb, Target } from 'lucide-react';
import { ScoreCard } from './components/ScoreCard';
import { RiskSummary } from './components/RiskSummary';
import { InsightsPanel } from './components/InsightsPanel';
import { KPICards } from './components/KPICards';
import { TrendChart } from './components/TrendChart';

interface ComplianceScore {
  score_overall: number;
  score_gdpr?: number;
  score_nis2?: number;
  score_dsa?: number;
  score_ai_act?: number;
  trend_direction: 'improving' | 'stable' | 'declining';
  recorded_at: string;
}

interface RiskMetrics {
  critical_risks_count: number;
  high_risks_count: number;
  medium_risks_count: number;
  low_risks_count: number;
  open_incidents_count: number;
  overdue_remediations: number;
}

interface DashboardInsight {
  id: string;
  insight_type: string;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  recommended_action?: string;
  created_at: string;
}

interface DashboardKPI {
  domains_active: number;
  policies_documented: number;
  vendors_managed: number;
  avg_incident_response_hours?: number;
  audit_coverage_percent?: number;
}

export function DashboardView() {
  const supabase = getSupabase();
  const { activeTenantId: tenantId } = useTenant();
  const [latestScore, setLatestScore] = useState<ComplianceScore | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ComplianceScore[]>([]);
  const [risks, setRisks] = useState<RiskMetrics | null>(null);
  const [insights, setInsights] = useState<DashboardInsight[]>([]);
  const [kpis, setKpis] = useState<DashboardKPI | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);

        // Fetch latest compliance score
        const { data: scoreData } = await supabase
          .from('compliance_score_history')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('recorded_at', { ascending: false })
          .limit(1);

        if (scoreData && scoreData.length > 0) {
          setLatestScore(scoreData[0]);
        }

        // Fetch score history (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: historyData } = await supabase
          .from('compliance_score_history')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('recorded_at', thirtyDaysAgo.toISOString())
          .order('recorded_at', { ascending: true });

        if (historyData) {
          setScoreHistory(historyData);
        }

        // Fetch risk summary
        const { data: riskData } = await supabase
          .from('risk_dashboard_summary')
          .select('*')
          .eq('tenant_id', tenantId)
          .single();

        if (riskData) {
          setRisks(riskData);
        }

        // Fetch insights
        const { data: insightsData } = await supabase
          .from('dashboard_insights')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(5);

        if (insightsData) {
          setInsights(insightsData);
        }

        // Fetch KPIs
        const { data: kpiData } = await supabase
          .from('dashboard_kpis')
          .select('*')
          .eq('tenant_id', tenantId)
          .single();

        if (kpiData) {
          setKpis(kpiData);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, [supabase, tenantId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-50 p-8">
        <div className="animate-pulse space-y-8">
          <div className="h-32 bg-obsidian-800 rounded-lg"></div>
          <div className="grid grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-obsidian-800 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-50 p-8">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">Failed to Load Dashboard</h2>
          <p className="text-titanium-300">{error}</p>
        </div>
      </div>
    );
  }

  const totalRisks = risks ? (
    risks.critical_risks_count + risks.high_risks_count +
    risks.medium_risks_count + risks.low_risks_count
  ) : 0;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
          <Target className="w-10 h-10 text-petrol-700" />
          Compliance Intelligence Dashboard
        </h1>
        <p className="text-titanium-400">Real-time analytics and AI-powered insights</p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Compliance Score */}
        <div className="lg:col-span-2">
          <ScoreCard
            score={latestScore?.score_overall ?? 0}
            trend={latestScore?.trend_direction}
            frameworks={{
              gdpr: latestScore?.score_gdpr,
              nis2: latestScore?.score_nis2,
              dsa: latestScore?.score_dsa,
              aiAct: latestScore?.score_ai_act,
            }}
          />
        </div>

        {/* Risk Summary Card */}
        <div>
          <RiskSummary risks={risks} totalRisks={totalRisks} />
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && <KPICards kpis={kpis} className="mb-8" />}

      {/* Trend Chart */}
      {scoreHistory.length > 0 && (
        <div className="bg-obsidian-800 border border-obsidian-700 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-petrol-700" />
            30-Day Compliance Trend
          </h2>
          <TrendChart data={scoreHistory} />
        </div>
      )}

      {/* AI Insights */}
      {insights.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-amber-400" />
            AI-Generated Insights ({insights.length})
          </h2>
          <InsightsPanel
            insights={insights}
            tenantId={tenantId}
            onInsightUpdated={() => {
              // Refetch insights
            }}
          />
        </div>
      )}

      {/* Empty State */}
      {insights.length === 0 && (
        <div className="bg-obsidian-800 border border-obsidian-700 rounded-lg p-12 text-center">
          <Lightbulb className="w-12 h-12 text-obsidian-600 mx-auto mb-4" />
          <p className="text-titanium-400">No active insights yet. Insights will appear as your system analyzes compliance data.</p>
        </div>
      )}
    </div>
  );
}
