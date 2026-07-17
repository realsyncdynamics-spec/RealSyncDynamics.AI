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

import { initWebVitals } from './webVitals';
import { initResourceMonitoring } from './resourceMonitoring';

export function initPerformanceMonitoring(): void {
  if (typeof window === 'undefined') return;
  initWebVitals();
  initResourceMonitoring();
}
