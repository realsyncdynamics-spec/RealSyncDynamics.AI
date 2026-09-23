import { usePerformanceMonitor } from '../../../lib/performance';
import { CommandCenterDashboard } from './CommandCenterDashboard';
import './command-center-density.css';

/**
 * Primary /app experience.
 * Default surface is the live Compliance Command Center
 * (Mandant · Lage · Jetzt · Ausführen). Agent OS theater is on /app/agents.
 */
export function DashboardRouter() {
  usePerformanceMonitor('DashboardRouter', { threshold: 500 });
  return <CommandCenterDashboard />;
}
