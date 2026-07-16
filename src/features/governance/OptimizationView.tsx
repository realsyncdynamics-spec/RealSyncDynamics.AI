import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';
import { Zap, CheckCircle, AlertCircle, Loader, TrendingUp, DollarSign } from 'lucide-react';

interface OptimizationRecommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  impact_score: number;
  implementation_effort: number;
  estimated_savings_monthly?: number;
  status: string;
  created_at: string;
}

interface OptimizationExecution {
  id: string;
  recommendation_id: string;
  status: string;
  changes_applied: Record<string, unknown>;
  completed_at?: string;
}

export function OptimizationView() {
  const supabase = getSupabase();
  const { activeTenantId: tenantId } = useTenant();

  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [executions, setExecutions] = useState<OptimizationExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [executing, setExecuting] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tenantId) {
      loadOptimizations();
    }
  }, [tenantId]);

  const loadOptimizations = async () => {
    try {
      setLoading(true);
      const [recsResult, execsResult] = await Promise.all([
        supabase
          .from('optimization_recommendations')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }),
        supabase
          .from('optimization_executions')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (recsResult.data) setRecommendations(recsResult.data);
      if (execsResult.data) setExecutions(execsResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load optimizations');
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    try {
      setAnalyzing(true);
      setError(null);

      const response = await fetch('/api/optimize-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) throw new Error('Analysis failed');
      await loadOptimizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis error');
    } finally {
      setAnalyzing(false);
    }
  };

  const executeRecommendation = async (recommendationId: string) => {
    try {
      setExecuting((prev) => ({ ...prev, [recommendationId]: true }));

      const response = await fetch('/api/optimize-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendationId,
          tenantId,
          userId: (await supabase.auth.getUser()).data.user?.id,
        }),
      });

      if (!response.ok) throw new Error('Execution failed');
      await loadOptimizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution error');
    } finally {
      setExecuting((prev) => ({ ...prev, [recommendationId]: false }));
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'policy_tightening':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'risk_mitigation':
        return <Zap className="w-5 h-5 text-red-500" />;
      case 'audit_optimization':
        return <TrendingUp className="w-5 h-5 text-blue-500" />;
      case 'vendor_management':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'framework_alignment':
        return <Zap className="w-5 h-5 text-purple-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getEffortLabel = (effort: number) => {
    const labels = ['', 'Minimal', 'Low', 'Medium', 'High', 'Very High'];
    return labels[effort] || 'Unknown';
  };

  const totalPotentialSavings = recommendations.reduce((sum, rec) => {
    return sum + (rec.estimated_savings_monthly || 0);
  }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="border-b border-obsidian-200 pb-6">
        <h1 className="text-3xl font-bold text-obsidian-900 mb-2">
          Compliance Optimization Engine
        </h1>
        <p className="text-obsidian-600">
          AI-powered recommendations to optimize your compliance posture
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-obsidian-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-obsidian-600 font-medium">Pending Recommendations</h3>
            <AlertCircle className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-obsidian-900">
            {recommendations.filter((r) => r.status === 'pending').length}
          </p>
        </div>

        <div className="bg-white border border-obsidian-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-obsidian-600 font-medium">Implemented</h3>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-obsidian-900">
            {recommendations.filter((r) => r.status === 'implemented').length}
          </p>
        </div>

        <div className="bg-white border border-obsidian-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-obsidian-600 font-medium">Estimated Monthly Savings</h3>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-obsidian-900">
            €{totalPotentialSavings.toLocaleString('de-DE')}
          </p>
        </div>
      </div>

      {/* Analysis Button */}
      <div className="flex gap-4">
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {analyzing ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Run Analysis
            </>
          )}
        </button>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-obsidian-900">Recommendations</h2>

        {recommendations.length === 0 ? (
          <div className="text-center py-12 bg-white border border-obsidian-200 rounded-lg">
            <p className="text-obsidian-600">
              No recommendations yet. Run an analysis to identify optimization opportunities.
            </p>
          </div>
        ) : (
          recommendations.map((rec) => (
            <div
              key={rec.id}
              className="bg-white border border-obsidian-200 rounded-lg p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  {getCategoryIcon(rec.category)}
                  <div>
                    <h3 className="text-lg font-bold text-obsidian-900">{rec.title}</h3>
                    <p className="text-obsidian-600 mt-1">{rec.description}</p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    rec.status === 'pending'
                      ? 'bg-orange-100 text-orange-700'
                      : rec.status === 'approved'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                  }`}
                >
                  {rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                <div>
                  <span className="text-obsidian-600">Impact Score</span>
                  <p className="font-bold text-obsidian-900">{rec.impact_score}/100</p>
                </div>
                <div>
                  <span className="text-obsidian-600">Implementation</span>
                  <p className="font-bold text-obsidian-900">{getEffortLabel(rec.implementation_effort)}</p>
                </div>
                <div>
                  <span className="text-obsidian-600">Monthly Savings</span>
                  <p className="font-bold text-obsidian-900">
                    €{(rec.estimated_savings_monthly || 0).toLocaleString('de-DE')}
                  </p>
                </div>
                <div>
                  <span className="text-obsidian-600">Category</span>
                  <p className="font-bold text-obsidian-900 capitalize">
                    {rec.category.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>

              {rec.status === 'pending' && (
                <button
                  onClick={() => executeRecommendation(rec.id)}
                  disabled={executing[rec.id]}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {executing[rec.id] ? 'Executing...' : 'Execute Optimization'}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Recent Executions */}
      {executions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-obsidian-900">Recent Executions</h2>
          <div className="space-y-2">
            {executions.map((exec) => (
              <div
                key={exec.id}
                className="bg-white border border-obsidian-200 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  {exec.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : exec.status === 'in_progress' ? (
                    <Loader className="w-5 h-5 animate-spin text-blue-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium text-obsidian-900 capitalize">{exec.status}</p>
                    <p className="text-sm text-obsidian-600">{exec.completed_at ? new Date(exec.completed_at).toLocaleDateString('de-DE') : 'In progress'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
