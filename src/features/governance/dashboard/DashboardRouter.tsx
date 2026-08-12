import React from 'react';
import { DashboardView } from '../../dashboard/DashboardView';
import { usePerformanceMonitor } from '../../../lib/performance';

/**
 * Canonical Control Plane entry point.
 *
 * The dashboard is deliberately product-agnostic: Website Builder, Governance AI,
 * SiteOS, Evidence and agent workflows are exposed from one command surface.
 * Tier-specific capabilities remain enforced by the underlying routes/actions.
 */
export function DashboardRouter() {
  usePerformanceMonitor('DashboardRouter', { threshold: 500 });
  return <DashboardView />;
}
