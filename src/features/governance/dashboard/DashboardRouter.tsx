import { useEntitlements } from '../../../core/billing/useEntitlements';
import { usePerformanceMonitor } from '../../../lib/performance';
import { GovernanceAiWorkspace } from './GovernanceAiWorkspace';

/**
 * Primary /app experience.
 *
 * Governance AI is now the central interaction surface for every tier.
 * Existing governance dashboards remain available through the workspace
 * navigation and their existing routes; this change only changes the
 * default entry experience.
 */
export function DashboardRouter() {
  usePerformanceMonitor('DashboardRouter', { threshold: 500 });
  const { loading } = useEntitlements();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa] text-slate-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-cyan-600 mx-auto mb-4" />
          <p className="text-sm">Governance AI wird geladen …</p>
        </div>
      </div>
    );
  }

  return <GovernanceAiWorkspace />;
}
