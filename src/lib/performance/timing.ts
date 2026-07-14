/**
 * Performance timing utilities — measure and report operation durations.
 *
 * Usage:
 *   const timer = startTimer('data-load');
 *   // ... do work ...
 *   timer.end({ category: 'api', status: 'success' });
 *
 * Reports slow operations (>1s) to Sentry automatically.
 */

import * as Sentry from '@sentry/react';

export interface TimingContext {
  category?: 'render' | 'api' | 'database' | 'component' | 'route' | 'other';
  status?: 'success' | 'error' | 'timeout';
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}

const slowThresholdMs = 1000; // Report as slow if > 1s

/**
 * Create a timer for measuring operation duration.
 * Call end() to record the measurement.
 */
export function startTimer(name: string) {
  const startMs = performance.now();

  return {
    end(context: TimingContext = {}) {
      const durationMs = performance.now() - startMs;
      const isSlow = durationMs > slowThresholdMs;

      // Report slow operations to Sentry
      if (isSlow) {
        Sentry.captureMessage(`Slow operation: ${name}`, {
          level: 'warning',
          contexts: {
            performance: {
              operation: name,
              duration_ms: Math.round(durationMs),
              category: context.category,
              status: context.status,
            },
          },
          tags: {
            'perf.slow': 'true',
            'perf.category': context.category || 'other',
            'perf.status': context.status || 'unknown',
            ...context.tags,
          },
          extra: context.extra,
        });
      }

      return {
        duration: durationMs,
        isSlow,
        report: () => {
          // Manual report regardless of threshold
          Sentry.captureMessage(`Operation: ${name}`, {
            level: 'info',
            contexts: {
              performance: {
                operation: name,
                duration_ms: Math.round(durationMs),
                category: context.category,
                status: context.status,
              },
            },
            tags: {
              'perf.category': context.category || 'other',
              'perf.status': context.status || 'unknown',
              ...context.tags,
            },
            extra: context.extra,
          });
        },
      };
    },
  };
}

/**
 * Measure a React component render time and report to Sentry.
 * Returns the measurement result.
 *
 * Usage:
 *   const renderTime = measureRender(() => <MyComponent />);
 */
export function measureRender(componentName: string, renderFn: () => React.ReactElement) {
  const start = performance.now();
  const element = renderFn();
  const duration = performance.now() - start;

  if (duration > 50) {
    // Slow render (>50ms for a single render)
    Sentry.captureMessage(`Slow component render: ${componentName}`, {
      level: 'debug',
      contexts: {
        performance: {
          component: componentName,
          render_time_ms: Math.round(duration),
        },
      },
    });
  }

  return { element, duration };
}

/**
 * Measure an async operation (e.g., API call) with timeout handling.
 *
 * Usage:
 *   const result = await measureAsync('fetch-data', async () => {
 *     return fetch('/api/data').then(r => r.json());
 *   });
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  context: TimingContext = {}
): Promise<T> {
  const timer = startTimer(name);
  try {
    const result = await fn();
    timer.end({ ...context, status: 'success' });
    return result;
  } catch (error) {
    timer.end({ ...context, status: 'error', extra: { error: String(error) } });
    throw error;
  }
}

/**
 * Mark a performance entry (for use with performance.measure()).
 *
 * Usage:
 *   markStart('route-change');
 *   // ... navigate ...
 *   markEnd('route-change');
 */
export function markStart(name: string) {
  if (typeof performance !== 'undefined') {
    performance.mark(`${name}-start`);
  }
}

export function markEnd(name: string) {
  if (typeof performance !== 'undefined') {
    try {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    } catch (e) {
      // Mark doesn't exist or measure failed
    }
  }
}

/**
 * Get all measurements matching a pattern.
 */
export function getMeasurements(pattern?: string): PerformanceMeasure[] {
  if (typeof performance === 'undefined') return [];
  return performance
    .getEntriesByType('measure')
    .filter((entry) => !pattern || entry.name.includes(pattern)) as PerformanceMeasure[];
}

/**
 * Get average duration of a measurement across all instances.
 */
export function getAverageDuration(name: string): number | null {
  const measures = getMeasurements(name);
  if (measures.length === 0) return null;
  const total = measures.reduce((sum, m) => sum + m.duration, 0);
  return total / measures.length;
}
