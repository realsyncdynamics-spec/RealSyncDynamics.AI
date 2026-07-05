import { Lightbulb, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useState } from 'react';

interface Insight {
  id: string;
  insight_type: string;
  title: string;
  description?: string;
  severity: 'info' | 'warning' | 'critical';
  recommended_action?: string;
  created_at: string;
}

interface InsightsPanelProps {
  insights: Insight[];
  tenantId: string;
  onInsightUpdated?: () => void;
}

export function InsightsPanel({ insights, tenantId, onInsightUpdated }: InsightsPanelProps) {
  const supabase = useSupabaseClient();
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());

  const dismissInsight = async (insightId: string) => {
    try {
      await supabase
        .from('dashboard_insights')
        .update({ status: 'dismissed' })
        .eq('id', insightId)
        .eq('tenant_id', tenantId);

      setDismissedInsights((prev) => new Set([...prev, insightId]));
      onInsightUpdated?.();
    } catch (error) {
      console.error('Failed to dismiss insight:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-900/20 border-red-700';
      case 'warning':
        return 'bg-orange-900/20 border-orange-700';
      case 'info':
      default:
        return 'bg-blue-900/20 border-blue-700';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-orange-400" />;
      case 'info':
      default:
        return <Lightbulb className="w-5 h-5 text-blue-400" />;
    }
  };

  const visibleInsights = insights.filter((i) => !dismissedInsights.has(i.id));

  return (
    <div className="space-y-3">
      {visibleInsights.map((insight) => (
        <div
          key={insight.id}
          className={`${getSeverityColor(insight.severity)} border rounded-lg p-4 transition-opacity duration-200`}
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-0.5">{getSeverityIcon(insight.severity)}</div>

            <div className="flex-1">
              <h4 className="font-semibold text-titanium-100 mb-1">{insight.title}</h4>

              {insight.description && (
                <p className="text-sm text-titanium-400 mb-3">{insight.description}</p>
              )}

              {insight.recommended_action && (
                <div className="flex items-start gap-2 bg-obsidian-900/50 rounded px-3 py-2 border border-obsidian-700 mb-3">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-titanium-300">
                    <span className="font-semibold">Recommended: </span>
                    {insight.recommended_action}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-titanium-500">
                  {new Date(insight.created_at).toLocaleDateString()}
                </span>

                <button
                  onClick={() => dismissInsight(insight.id)}
                  className="text-xs text-titanium-400 hover:text-titanium-200 transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {visibleInsights.length === 0 && insights.length > 0 && (
        <div className="bg-obsidian-800 border border-obsidian-700 rounded-lg p-6 text-center">
          <p className="text-titanium-400 text-sm">All insights have been dismissed</p>
        </div>
      )}
    </div>
  );
}
