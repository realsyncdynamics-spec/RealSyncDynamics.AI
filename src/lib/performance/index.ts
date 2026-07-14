/**
 * Performance monitoring utilities — measure, track, and report on app performance.
 *
 * Exports:
 *   - Web Vitals tracking (LCP, INP, CLS, TTFB, FCP, DCL)
 *   - Timing utilities (startTimer, measureAsync, etc.)
 *   - Resource monitoring (API/Edge Function call tracking)
 *   - React hooks for component performance
 *
 * Initialize on app startup:
 *   import { initPerformanceMonitoring } from './lib/performance';
 *   initPerformanceMonitoring();
 */

export * from './webVitals';
export * from './timing';
export * from './resourceMonitoring';
export * from './usePerformanceMonitor';

/**
 * Initialize all performance monitoring systems.
 * Call once on app startup in main.tsx.
 */
export function initPerformanceMonitoring(): void {
  if (typeof window === 'undefined') return;

  // Import inside function to avoid circular dependencies
  const { initWebVitals } = require('./webVitals');
  const { initResourceMonitoring } = require('./resourceMonitoring');

  initWebVitals();
  initResourceMonitoring();
}
