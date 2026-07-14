/**
 * React hook for monitoring component performance.
 *
 * Usage:
 *   function MyComponent() {
 *     usePerformanceMonitor('MyComponent', { threshold: 100 });
 *     return <div>...</div>;
 *   }
 */

import { useEffect, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { markStart, markEnd, getAverageDuration } from './timing';

export interface PerformanceMonitorOptions {
  /**
   * Report slowness threshold in ms (default: 50).
   * Components slower than this will be reported to Sentry.
   */
  threshold?: number;
  /**
   * Additional context to include in Sentry report.
   */
  extra?: Record<string, any>;
}

/**
 * Monitor a component's render time and report slow renders to Sentry.
 */
export function usePerformanceMonitor(
  componentName: string,
  options: PerformanceMonitorOptions = {}
): void {
  const { threshold = 50, extra } = options;
  const renderCountRef = useRef(0);
  const slowRenderCountRef = useRef(0);

  useEffect(() => {
    renderCountRef.current += 1;
    const renderNumber = renderCountRef.current;

    // Measure the render time using the next paint after mount
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.includes(componentName) || entry.duration > threshold) {
          slowRenderCountRef.current += 1;
          Sentry.captureMessage(`Slow component render: ${componentName}#${renderNumber}`, {
            level: 'debug',
            contexts: {
              performance: {
                component: componentName,
                render_number: renderNumber,
                duration_ms: Math.round(entry.duration),
                slow_render_count: slowRenderCountRef.current,
              },
            },
            extra,
            tags: {
              'component.name': componentName,
              'component.slow': 'true',
            },
          });
          observer.disconnect();
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['longest-largest-contentful-paint', 'paint'] });
    } catch (e) {
      // PerformanceObserver not fully supported
      observer.disconnect();
    }

    return () => {
      observer.disconnect();
    };
  }, [componentName, threshold, extra]);
}

/**
 * Monitor the duration of a specific section of code.
 * Returns a cleanup function to call when the section completes.
 *
 * Usage:
 *   const stopMonitoring = usePerformanceSection('data-fetch');
 *   // ... do work ...
 *   stopMonitoring();
 */
export function usePerformanceSection(sectionName: string) {
  const nameRef = useRef(`${sectionName}-${Date.now()}-${Math.random()}`);

  useEffect(() => {
    markStart(nameRef.current);

    return () => {
      markEnd(nameRef.current);
      const avgDuration = getAverageDuration(sectionName);
      if (avgDuration && avgDuration > 1000) {
        Sentry.captureMessage(`Slow section: ${sectionName}`, {
          level: 'warning',
          contexts: {
            performance: {
              section: sectionName,
              avg_duration_ms: Math.round(avgDuration),
            },
          },
          tags: {
            'section.name': sectionName,
            'section.slow': 'true',
          },
        });
      }
    };
  }, [sectionName]);

  return () => {
    markEnd(nameRef.current);
  };
}

/**
 * Monitor memory usage and report to Sentry if available.
 * Requires performance.memory (Chrome only).
 */
export function useMemoryMonitor(componentName: string, threshold = 50 * 1024 * 1024): void {
  useEffect(() => {
    const perfApi = performance as any;
    if (!perfApi.memory) return;

    const initialMemory = perfApi.memory.usedJSHeapSize;

    return () => {
      const finalMemory = perfApi.memory.usedJSHeapSize;
      const deltaMemory = finalMemory - initialMemory;

      if (Math.abs(deltaMemory) > threshold) {
        Sentry.captureMessage(`Memory change in ${componentName}`, {
          level: 'info',
          contexts: {
            performance: {
              component: componentName,
              initial_memory_mb: (initialMemory / 1024 / 1024).toFixed(2),
              final_memory_mb: (finalMemory / 1024 / 1024).toFixed(2),
              delta_mb: (deltaMemory / 1024 / 1024).toFixed(2),
            },
          },
          tags: {
            'memory.large-delta': Math.abs(deltaMemory) > threshold ? 'true' : 'false',
          },
        });
      }
    };
  }, [componentName, threshold]);
}

/**
 * Monitor and report component re-render count.
 * Useful for detecting excessive re-renders due to props/state changes.
 */
export function useRenderCount(componentName: string, maxRenders = 10): void {
  const countRef = useRef(0);

  useEffect(() => {
    countRef.current += 1;

    if (countRef.current > maxRenders) {
      Sentry.captureMessage(`Excessive re-renders: ${componentName}`, {
        level: 'warning',
        contexts: {
          performance: {
            component: componentName,
            render_count: countRef.current,
            max_expected: maxRenders,
          },
        },
        tags: {
          'renders.excessive': 'true',
          'component.name': componentName,
        },
      });
    }
  });
}
