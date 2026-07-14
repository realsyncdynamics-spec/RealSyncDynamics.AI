import React, { useState } from 'react';
import {
  TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';
import { useComplianceTrends } from '../../../core/analytics/useComplianceTrends';
import { useAuditTrail } from '../../../core/audit/useAuditTrail';

type PeriodType = '7d' | '30d' | '90d';

export function ComplianceTrendsDashboard() {
  const [period, setPeriod] = useState<PeriodType>('30d');
  const trends = useComplianceTrends(period);
  const auditTrail = useAuditTrail({ limit: 10, offset: 0 });

  if (!trends) {
    return (
      <div className="min-h-screen bg-obsidian-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-titanium-400">Loading compliance analytics...</p>
        </div>
      </div>
    );
  }

  const TrendIcon = trends.trend === 'improving' ? TrendingUp : TrendingDown;
  const trendColor = trends.trend === 'improving' ? 'emerald' : trends.trend === 'declining' ? 'rose' : 'titanium';

  return (
    <div className="min-h-screen bg-obsidian-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-titanium-50 mb-2">
            Compliance Analytics
          </h1>
          <p className="text-titanium-400">
            Track your compliance score trends and review audit activity.
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-none font-medium transition-colors ${
                period === p
                  ? 'bg-ai-cyan-500 text-obsidian-950'
                  : 'border border-titanium-700 text-titanium-300 hover:border-titanium-600'
              }`}
            >
              {p === '7d' ? 'Last 7 Days' : p === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
            </button>
          ))}
        </div>

        {/* Trend Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-obsidian-900 border border-titanium-800 p-4 rounded-none">
            <p className="text-xs text-titanium-500 font-mono mb-2">COMPLIANCE SCORE</p>
            <p className="text-3xl font-bold text-titanium-50">{trends.averageScore}%</p>
            <p className="text-xs text-titanium-400 mt-2">Average over period</p>
          </div>

          <div className="bg-obsidian-900 border border-titanium-800 p-4 rounded-none">
            <p className="text-xs text-titanium-500 font-mono mb-2">TREND</p>
            <div className="flex items-center gap-2 mb-2">
              <TrendIcon className={`w-5 h-5 text-${trendColor}-400`} />
              <span className={`text-lg font-semibold text-${trendColor}-300`}>
                {trends.trend === 'improving' ? 'Improving' : trends.trend === 'declining' ? 'Declining' : 'Stable'}
              </span>
            </div>
            <p className={`text-xs text-${trendColor}-300`}>
              {trends.changePercent > 0 ? '+' : ''}{trends.changePercent}% change
            </p>
          </div>

          <div className="bg-obsidian-900 border border-titanium-800 p-4 rounded-none">
            <p className="text-xs text-titanium-500 font-mono mb-2">LATEST SCORE</p>
            <p className="text-3xl font-bold text-titanium-50">
              {trends.dataPoints[trends.dataPoints.length - 1]?.complianceScore || 0}%
            </p>
            <p className="text-xs text-titanium-400 mt-2">Most recent</p>
          </div>

          <div className="bg-obsidian-900 border border-titanium-800 p-4 rounded-none">
            <p className="text-xs text-titanium-500 font-mono mb-2">AUDIT EVENTS</p>
            <p className="text-3xl font-bold text-titanium-50">{auditTrail.total}</p>
            <p className="text-xs text-titanium-400 mt-2">Total activities</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-obsidian-900 border border-titanium-800 p-6 rounded-none">
          <h2 className="text-lg font-semibold text-titanium-50 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Audit Trail
          </h2>

          {auditTrail.loading ? (
            <p className="text-titanium-400">Loading audit trail...</p>
          ) : auditTrail.error ? (
            <p className="text-rose-400">{auditTrail.error}</p>
          ) : auditTrail.entries.length === 0 ? (
            <p className="text-titanium-400">No audit entries yet.</p>
          ) : (
            <div className="space-y-3">
              {auditTrail.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-3 bg-obsidian-950 border border-titanium-800 rounded-none hover:border-titanium-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-none flex items-center justify-center shrink-0 bg-titanium-900">
                    {entry.status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm text-titanium-50 truncate">
                        {entry.action}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-none ${
                        entry.status === 'success'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {entry.status}
                      </span>
                    </div>
                    <p className="text-xs text-titanium-400 mb-1">
                      {entry.actor} ({entry.actorEmail})
                    </p>
                    <p className="text-xs text-titanium-500 font-mono">
                      {entry.resourceType}: {entry.resourceName}
                    </p>
                  </div>

                  <div className="text-xs text-titanium-500 shrink-0 text-right flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {entry.timestamp.toLocaleDateString('de-DE', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Score Distribution */}
        {trends.dataPoints.length > 1 && (
          <div className="bg-obsidian-900 border border-titanium-800 p-6 rounded-none">
            <h2 className="text-lg font-semibold text-titanium-50 mb-4">
              Score Timeline
            </h2>

            <div className="space-y-2">
              {trends.dataPoints.slice(-7).map((point, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs text-titanium-500 font-mono w-16 shrink-0">
                    {point.date.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex-1 bg-titanium-900 h-8 rounded-none flex items-center overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${point.complianceScore}%` }}
                    >
                      <span className="text-xs font-bold text-white">
                        {point.complianceScore}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
