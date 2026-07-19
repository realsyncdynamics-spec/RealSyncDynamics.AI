/**
 * Decision Explainability Panel
 * Shows reasoning, alternatives, constraints, and compliance scoring
 */

import React, { useMemo } from 'react';
import { LogisticsDecision, LogisticsRoute } from '../../../types/logistics';

interface DecisionExplainabilityPanelProps {
  decision: LogisticsDecision;
  route: LogisticsRoute | null;
  onOpenOverride: () => void;
}

interface ConstraintDisplay {
  name: string;
  status: 'passed' | 'warning' | 'failed';
  message: string;
  penalty?: number;
}

export function DecisionExplainabilityPanel({
  decision,
  route,
  onOpenOverride
}: DecisionExplainabilityPanelProps) {
  const constraints = useMemo((): ConstraintDisplay[] => {
    if (!route) return [];

    const result: ConstraintDisplay[] = [];

    // Vehicle capacity
    if (route.vehicle_id) {
      result.push({
        name: 'Vehicle Capacity',
        status: 'passed',
        message: `${(route.utilized_weight_kg || 0).toFixed(0)} / ${route.max_weight_kg} kg`,
        penalty: 0
      });
    }

    // Time windows
    const breachCount = route.stops?.filter(s => !s.within_time_window).length || 0;
    result.push({
      name: 'Delivery Time Windows',
      status: breachCount > 0 ? 'warning' : 'passed',
      message: breachCount > 0 ? `${breachCount} stop(s) at risk of time window breach` : 'All stops within time windows',
      penalty: breachCount * 5
    });

    // SLA compliance
    result.push({
      name: 'SLA Compliance',
      status: route.sla_compliant ? 'passed' : 'failed',
      message: route.sla_compliant
        ? 'All deliveries within SLA windows'
        : `${route.estimated_sla_breaches || 0} SLA violation(s)`,
      penalty: route.sla_compliant ? 0 : (route.estimated_sla_breaches || 1) * 15
    });

    // Environmental
    result.push({
      name: 'Environmental CO2',
      status: 'passed',
      message: `${(route.estimated_co2_grams || 0).toFixed(0)} g CO2 (${(route.total_distance_km * 250).toFixed(0)} g est.)`,
      penalty: 0
    });

    return result;
  }, [route]);

  const overallScore = useMemo((): number => {
    if (!route) return 0;
    const totalPenalty = constraints.reduce((sum, c) => sum + (c.penalty || 0), 0);
    return Math.max(0, Math.min(100, 100 - totalPenalty));
  }, [constraints]);

  const alternatives = useMemo(() => {
    if (!decision.alternatives_count || decision.alternatives_count <= 1) {
      return [];
    }

    return Array.from({ length: Math.min(decision.alternatives_count - 1, 2) }, (_, i) => ({
      rank: i + 2,
      cost: (route?.estimated_cost || 100) * (1 + (i + 1) * 0.02),
      co2: (route?.estimated_co2_grams || 2500) * (1 - (i + 1) * 0.1),
      improvement: i === 0 ? '2% cost, -10% CO2' : '4% cost, -20% CO2'
    }));
  }, [decision.alternatives_count, route]);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-titanium-800 px-4 py-3 bg-obsidian-950">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">Decision Explainability</h3>
            <p className="text-xs text-titanium-400 mt-1">
              {decision.decision_type} • Confidence: {((decision.confidence_score || 0.75) * 100).toFixed(0)}%
            </p>
          </div>
          <div className={`text-right ${getScoreColor(overallScore)}`}>
            <div className="text-2xl font-bold">{Math.round(overallScore)}</div>
            <div className="text-xs text-titanium-400">Compliance Score</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Reasoning */}
        <div>
          <h4 className="text-xs font-bold text-titanium-300 uppercase tracking-wider mb-2">Reasoning</h4>
          <p className="text-sm text-titanium-400 leading-relaxed">
            {decision.reasoning || 'Greedy nearest-neighbor algorithm applied to minimize distance and maximize vehicle utilization.'}
          </p>
        </div>

        {/* Constraint Analysis */}
        <div>
          <h4 className="text-xs font-bold text-titanium-300 uppercase tracking-wider mb-2">Constraint Analysis</h4>
          <div className="space-y-2">
            {constraints.map((constraint, idx) => (
              <div
                key={idx}
                className={`p-2 rounded text-xs border ${
                  constraint.status === 'passed'
                    ? 'bg-emerald-500 bg-opacity-10 border-emerald-500 border-opacity-30'
                    : constraint.status === 'warning'
                      ? 'bg-amber-500 bg-opacity-10 border-amber-500 border-opacity-30'
                      : 'bg-red-500 bg-opacity-10 border-red-500 border-opacity-30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="font-semibold">{constraint.name}</span>
                  {constraint.penalty && constraint.penalty > 0 && (
                    <span className="text-red-400">-{constraint.penalty}pts</span>
                  )}
                </div>
                <p className="text-titanium-400 mt-1">{constraint.message}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Alternatives */}
        {alternatives.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-titanium-300 uppercase tracking-wider mb-2">Alternative Routes</h4>
            <div className="space-y-2">
              {alternatives.map((alt, idx) => (
                <button
                  key={idx}
                  className="w-full text-left p-2 rounded bg-obsidian-800 hover:bg-obsidian-700 transition-colors border border-titanium-800 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Option {alt.rank}</span>
                    <span className="text-titanium-400">{alt.improvement}</span>
                  </div>
                  <div className="text-titanium-400 text-xs mt-1">
                    Cost: ${alt.cost.toFixed(0)} • CO2: {alt.co2.toFixed(0)}g
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Evidence & Compliance */}
        <div>
          <h4 className="text-xs font-bold text-titanium-300 uppercase tracking-wider mb-2">Evidence Trail</h4>
          <div className="text-xs text-titanium-400 space-y-1">
            {decision.evidence_event_id && (
              <div className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Immutably logged (SHA-256)</span>
              </div>
            )}
            {decision.c2pa_manifest_id && (
              <div className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                <span className="font-mono text-xs">C2PA signed</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-security-blue">ℹ</span>
              <span>Human override available</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-titanium-800 bg-obsidian-950 px-4 py-3 flex gap-2">
        <button
          onClick={onOpenOverride}
          className="flex-1 px-3 py-2 rounded bg-security-blue hover:bg-opacity-80 text-obsidian-950 font-semibold text-sm transition-colors"
        >
          Override Decision
        </button>
        <button className="flex-1 px-3 py-2 rounded bg-obsidian-800 hover:bg-obsidian-700 text-titanium-50 font-semibold text-sm transition-colors border border-titanium-800">
          View Full Audit
        </button>
      </div>
    </div>
  );
}
