/**
 * React Example: Using RealSyncDynamics SDK in React
 *
 * This example demonstrates how to use the RealSyncDynamics SDK in a React application.
 *
 * Installation:
 * npm install @realsyncdynamics/sdk
 *
 * Usage:
 * <ComplianceDashboard tenantId="your-tenant-id" />
 */

import { useState, useEffect } from 'react';
import { RealSyncDynamicsSDK } from '@realsyncdynamics/sdk';

interface ComplianceDashboardProps {
  tenantId: string;
  apiKey?: string;
  baseURL?: string;
}

export function ComplianceDashboard({
  tenantId,
  apiKey = import.meta.env.VITE_REALSYNCDYNAMICS_API_KEY,
  baseURL = 'https://api.realsyncdynamicsai.de',
}: ComplianceDashboardProps) {
  const [sdk, setSdk] = useState<RealSyncDynamicsSDK | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [risks, setRisks] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);

  // Initialize SDK
  useEffect(() => {
    if (!apiKey) {
      setError('API key not configured');
      setLoading(false);
      return;
    }

    const sdkInstance = new RealSyncDynamicsSDK({
      apiKey,
      baseURL,
      timeout: 30000,
    });

    setSdk(sdkInstance);
  }, [apiKey, baseURL]);

  // Fetch data
  useEffect(() => {
    if (!sdk) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel
        const [dashboard, riskMetrics, dashboardInsights] = await Promise.all([
          sdk.getDashboardSummary(tenantId),
          sdk.getRiskMetrics(tenantId),
          sdk.getInsights(tenantId, { limit: 5 }),
        ]);

        setDashboardData(dashboard);
        setRisks(riskMetrics);
        setInsights(dashboardInsights);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch data'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sdk, tenantId]);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-2 text-gray-600">Loading compliance data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold">Error loading data</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6">Compliance Dashboard</h1>

      {/* Compliance Score Section */}
      {dashboardData?.compliance_score && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Overall Compliance Score</h2>
          <div className="flex items-center gap-4">
            <div className="text-5xl font-bold text-blue-600">
              {dashboardData.compliance_score.score_overall}
              <span className="text-2xl text-gray-500">/100</span>
            </div>
            <div className="flex-1">
              <p className="text-gray-600">
                Trend: <span className="font-semibold">
                  {dashboardData.compliance_score.trend_direction}
                </span>
              </p>
              <p className="text-gray-600 text-sm mt-1">
                Last updated: {dashboardData.compliance_score.updated_at}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Risk Metrics */}
      {risks && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Risk Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <RiskCard
              label="Critical"
              value={risks.critical_risks_count}
              color="red"
            />
            <RiskCard label="High" value={risks.high_risks_count} color="orange" />
            <RiskCard
              label="Medium"
              value={risks.medium_risks_count}
              color="yellow"
            />
            <RiskCard label="Low" value={risks.low_risks_count} color="green" />
            <RiskCard
              label="Open Incidents"
              value={risks.open_incidents_count}
              color="purple"
            />
          </div>
        </div>
      )}

      {/* Insights Section */}
      {insights.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Recent Insights</h2>
          <div className="space-y-3">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <button
        onClick={() => {
          setLoading(true);
          // Trigger refetch by updating key dependency
          window.location.reload();
        }}
        className="mt-6 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
      >
        Refresh Data
      </button>
    </div>
  );
}

// Risk Card Component
function RiskCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const bgColor = {
    red: 'bg-red-50',
    orange: 'bg-orange-50',
    yellow: 'bg-yellow-50',
    green: 'bg-green-50',
    purple: 'bg-purple-50',
  }[color];

  const textColor = {
    red: 'text-red-600',
    orange: 'text-orange-600',
    yellow: 'text-yellow-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
  }[color];

  return (
    <div className={`${bgColor} p-4 rounded border-l-4 border-${color}-500`}>
      <p className="text-gray-600 text-sm">{label}</p>
      <p className={`${textColor} text-3xl font-bold`}>{value}</p>
    </div>
  );
}

// Insight Card Component
function InsightCard({
  insight,
}: {
  insight: {
    id: string;
    title: string;
    description: string;
    severity: string;
    recommended_action: string;
  };
}) {
  const severityColor = {
    critical: 'red',
    high: 'orange',
    medium: 'yellow',
    low: 'green',
  }[insight.severity] || 'gray';

  const borderColor = {
    red: 'border-red-200',
    orange: 'border-orange-200',
    yellow: 'border-yellow-200',
    green: 'border-green-200',
    gray: 'border-gray-200',
  }[severityColor];

  const badgeColor = {
    red: 'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    green: 'bg-green-100 text-green-700',
    gray: 'bg-gray-100 text-gray-700',
  }[severityColor];

  return (
    <div className={`p-4 border-l-4 border-${severityColor}-300 bg-gray-50 rounded`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{insight.title}</h3>
          <p className="text-gray-600 text-sm mt-1">{insight.description}</p>
          <p className="text-gray-700 text-sm mt-2 font-medium">
            Action: {insight.recommended_action}
          </p>
        </div>
        <span className={`${badgeColor} px-3 py-1 rounded text-sm whitespace-nowrap`}>
          {insight.severity.charAt(0).toUpperCase() +
            insight.severity.slice(1)}
        </span>
      </div>
    </div>
  );
}

// Hook: useRealSyncDynamics
export function useRealSyncDynamics(apiKey: string, baseURL?: string) {
  const [sdk, setSdk] = useState<RealSyncDynamicsSDK | null>(null);

  useEffect(() => {
    const sdkInstance = new RealSyncDynamicsSDK({
      apiKey,
      baseURL,
      timeout: 30000,
    });
    setSdk(sdkInstance);
  }, [apiKey, baseURL]);

  return sdk;
}

// Export all components
export default ComplianceDashboard;
