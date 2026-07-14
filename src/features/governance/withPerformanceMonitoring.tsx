/**
 * Higher-order component that adds performance monitoring to any view component.
 *
 * Wraps a component to automatically track:
 * - Render time (warns if > threshold)
 * - Re-render frequency (warns if > max)
 * - Component lifecycle timing
 *
 * Usage:
 *   const MonitoredView = withPerformanceMonitoring(MyView, 'MyView', { threshold: 500 });
 */

import React, { ComponentType } from 'react';
import { usePerformanceMonitor, useRenderCount } from '../../lib/performance';

export interface PerformanceMonitoringOptions {
  /**
   * Component render time threshold in ms (default: 500).
   */
  threshold?: number;
  /**
   * Maximum allowed re-renders before warning (default: 10).
   */
  maxRenders?: number;
}

/**
 * Wrap a component with performance monitoring.
 */
export function withPerformanceMonitoring<P extends object>(
  Component: ComponentType<P>,
  displayName: string,
  options: PerformanceMonitoringOptions = {}
) {
  const { threshold = 500, maxRenders = 10 } = options;

  const WrappedComponent = (props: P) => {
    usePerformanceMonitor(displayName, { threshold });
    useRenderCount(displayName, maxRenders);
    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withPerformanceMonitoring(${displayName})`;
  return WrappedComponent;
}

/**
 * Create a monitored version of a component.
 *
 * Usage:
 *   export const GovernanceDashboardView = createMonitoredComponent(
 *     _GovernanceDashboardView,
 *     'GovernanceDashboardView',
 *     { threshold: 1000, maxRenders: 5 }
 *   );
 */
export function createMonitoredComponent<P extends object>(
  Component: ComponentType<P>,
  displayName: string,
  options?: PerformanceMonitoringOptions
) {
  return withPerformanceMonitoring(Component, displayName, options);
}
