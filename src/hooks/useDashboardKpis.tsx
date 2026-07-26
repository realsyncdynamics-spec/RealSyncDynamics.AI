import { useMemo } from 'react';
import { Shield, AlertCircle, Database, Zap, FileText, TrendingUp } from 'lucide-react';
import type { KpiItem } from '../components/dashboard/KpiGrid';

/**
 * Hook: Transform Supabase dashboard data into KPI Grid format
 * Maps data fields to KpiItems with proper severity levels & trends
 */

interface DashboardDataInput {
  riskScore?: number;
  evidenceCount?: number;
  criticalRisks?: number;
  openActions?: number;
  aiRecommendations?: number;
  complianceStatus?: 'passed' | 'warning' | 'critical';
}

interface DashboardKpiResult {
  kpis: KpiItem[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Map numeric compliance scores to severity levels
 */
function scoreToSeverity(score: number): 'passed' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'passed';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}

/**
 * Map risk/alert counts to severity
 */
function countToSeverity(count: number, threshold = 5): 'passed' | 'medium' | 'high' | 'critical' {
  if (count === 0) return 'passed';
  if (count <= threshold) return 'medium';
  if (count <= threshold * 2) return 'high';
  return 'critical';
}

/**
 * Transform dashboard data into KPI items
 */
export function useDashboardKpis(
  data: DashboardDataInput | null | undefined,
  isLoading = false,
  error: string | null = null
): DashboardKpiResult {
  const kpis = useMemo(() => {
    if (!data) return [];

    const items: KpiItem[] = [];

    // Compliance Score KPI
    if (data.riskScore !== undefined) {
      items.push({
        id: 'compliance-score',
        label: 'Compliance Score',
        value: `${data.riskScore}`,
        hint: 'Overall Governance Health',
        severity: scoreToSeverity(data.riskScore),
        icon: <Shield size={20} />,
        trend: { direction: 'stable', value: 0 },
      });
    }

    // Evidence Count KPI
    if (data.evidenceCount !== undefined) {
      items.push({
        id: 'evidence-count',
        label: 'Evidence Count',
        value: data.evidenceCount,
        hint: 'Compliance Artifacts Stored',
        severity: 'passed',
        icon: <Database size={20} />,
      });
    }

    // Critical Risks KPI
    if (data.criticalRisks !== undefined) {
      items.push({
        id: 'critical-risks',
        label: 'Critical Risks',
        value: data.criticalRisks,
        hint: 'Requires Immediate Action',
        severity: countToSeverity(data.criticalRisks, 3),
        icon: <AlertCircle size={20} />,
        trend: { direction: data.criticalRisks > 0 ? 'up' : 'down', value: data.criticalRisks },
      });
    }

    // Open Actions KPI
    if (data.openActions !== undefined) {
      items.push({
        id: 'open-actions',
        label: 'Open Actions',
        value: data.openActions,
        hint: 'Pending Completion',
        severity: countToSeverity(data.openActions, 10),
        icon: <TrendingUp size={20} />,
      });
    }

    // AI Recommendations KPI
    if (data.aiRecommendations !== undefined) {
      items.push({
        id: 'ai-recommendations',
        label: 'AI Recommendations',
        value: data.aiRecommendations,
        hint: 'Actionable Insights',
        severity: data.aiRecommendations > 0 ? 'passed' : 'medium',
        icon: <Zap size={20} />,
      });
    }

    return items;
  }, [data]);

  return {
    kpis,
    isLoading,
    error,
  };
}

/**
 * Alternative: Map compliance status string to KPI
 */
export function useComplianceStatusKpi(status?: string): KpiItem | null {
  return useMemo(() => {
    if (!status) return null;

    const statusMap: Record<string, { severity: 'passed' | 'medium' | 'high' | 'critical'; label: string }> = {
      passed: { severity: 'passed', label: 'Compliant' },
      compliant: { severity: 'passed', label: 'Compliant' },
      warning: { severity: 'medium', label: 'Warning' },
      alert: { severity: 'high', label: 'Alert' },
      critical: { severity: 'critical', label: 'Critical' },
    };

    const config = statusMap[status.toLowerCase()] || { severity: 'medium' as const, label: status };

    return {
      id: 'compliance-status',
      label: 'Compliance Status',
      value: config.label,
      hint: 'Current Compliance Level',
      severity: config.severity,
      icon: <FileText size={20} />,
    };
  }, [status]);
}
