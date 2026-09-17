import { usePerformanceMonitor } from '../../../lib/performance';
import { ComplianceStatusDashboard } from './ComplianceStatusDashboard';
import '../../../styles/dashboard-tokens.css';
import './command-center-density.css';

/**
 * Primary /app experience.
 * Default surface is the live Compliance Command Center.
 * KPI-Typo folgt der Landing-Preview; Zahlen kommen aus RLS, nicht aus Demo-Kacheln.
 * Geometry tokens: src/styles/dashboard-tokens.css — density file only binds them.
 */
export function DashboardRouter() {
  usePerformanceMonitor('DashboardRouter', { threshold: 500 });
  return <ComplianceStatusDashboard />;
}
