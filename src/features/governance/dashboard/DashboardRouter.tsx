import { usePerformanceMonitor } from '../../../lib/performance';
import { ComplianceStatusDashboard } from './ComplianceStatusDashboard';
import './command-center-density.css';

/**
 * Primary /app experience.
 * Default surface is the live Compliance Command Center.
 * KPI-Typo folgt der Landing-Preview; Zahlen kommen aus RLS, nicht aus Demo-Kacheln.
 */
export function DashboardRouter() {
  usePerformanceMonitor('DashboardRouter', { threshold: 500 });
  return <ComplianceStatusDashboard />;
}
