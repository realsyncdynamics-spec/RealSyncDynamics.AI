import { usePerformanceMonitor } from '../../../lib/performance';
import { ComplianceStatusDashboard } from './ComplianceStatusDashboard';
import '../../../styles/dashboard-tokens.css';

/**
 * Primary /app experience.
 * Default surface is the live Compliance Command Center.
 * KPI-Typo folgt der Landing-Preview; Zahlen kommen aus RLS, nicht aus Demo-Kacheln.
 * Geometry tokens + bindings: src/styles/dashboard-tokens.css.
 */
export function DashboardRouter() {
  usePerformanceMonitor('DashboardRouter', { threshold: 500 });
  return <ComplianceStatusDashboard />;
}
