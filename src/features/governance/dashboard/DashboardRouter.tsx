import { usePerformanceMonitor } from '../../../lib/performance';
import { ComplianceStatusDashboard } from './ComplianceStatusDashboard';

/**
 * Primary /app experience.
 *
 * Default surface is the live Compliance-Status (Score, Residualrisiko,
 * Evidence-Gesundheit, offene Maßnahmen, Audit-Readiness). Governance AI
 * bleibt in der Sidebar und unter /app/assistant.
 */
export function DashboardRouter() {
  usePerformanceMonitor('DashboardRouter', { threshold: 500 });
  return <ComplianceStatusDashboard />;
}
