/**
 * Resource monitoring — tracks API/Edge Function calls, database queries, and external requests.
 *
 * Monitors:
 *   - fetch() calls (automatic via PerformanceObserver)
 *   - Slow resources (>3s)
 *   - Failed resources (4xx, 5xx)
 *   - Resource size (reports large payloads)
 *
 * Reports to Sentry for analysis.
 */

import * as Sentry from '@sentry/react';

export interface ResourceMetric {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | string;
  duration: number;
  status?: number;
  size?: number;
  cached?: boolean;
  error?: string;
}

const slowThresholdMs = 3000;
const largeSizeBytes = 512 * 1024; // 512 KB

/**
 * Initialize resource monitoring via PerformanceObserver.
 * Automatically tracks fetch/XHR resource performance.
 */
export function initResourceMonitoring(): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  try {
    const resourceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const metric = parseResourceEntry(entry);
        if (metric) {
          if (metric.duration > slowThresholdMs || (metric.status && metric.status >= 400)) {
            reportResource(metric);
          }
          // Track very large payloads regardless of duration
          if (metric.size && metric.size > largeSizeBytes) {
            Sentry.captureMessage(`Large resource downloaded: ${metric.url}`, {
              level: 'info',
              contexts: {
                performance: {
                  url: metric.url,
                  size_bytes: metric.size,
                  size_mb: (metric.size / 1024 / 1024).toFixed(2),
                },
              },
              tags: {
                'resource.large': 'true',
              },
            });
          }
        }
      }
    });
    resourceObserver.observe({ entryTypes: ['resource'] });
  } catch (e) {
    // PerformanceObserver not supported
  }
}

function parseResourceEntry(entry: PerformanceEntry): ResourceMetric | null {
  if (entry.entryType !== 'resource') return null;

  const resource = entry as PerformanceResourceTiming;
  const url = new URL(resource.name, window.location.href).toString();

  // Skip monitoring of non-API resources (stylesheets, fonts, etc)
  // unless they're slow/failed
  const isApiLike = url.includes('/functions/') || url.includes('/api/') || url.includes('.json');

  return {
    url,
    duration: resource.duration,
    size: resource.transferSize,
    cached: resource.transferSize === 0 && resource.decodedBodySize > 0,
  };
}

/**
 * Manually report a resource metric to Sentry.
 */
export function reportResource(metric: ResourceMetric): void {
  const level = metric.status && metric.status >= 500 ? 'error' : metric.status && metric.status >= 400 ? 'warning' : 'info';
  const durationLevel = metric.duration > slowThresholdMs ? 'warning' : 'info';
  const finalLevel = level === 'error' || durationLevel === 'warning' ? level : durationLevel;

  Sentry.captureMessage(`Resource: ${metric.url}`, {
    level: finalLevel,
    contexts: {
      performance: {
        url: metric.url,
        method: metric.method,
        duration_ms: Math.round(metric.duration),
        status: metric.status,
        size_bytes: metric.size,
        cached: metric.cached,
      },
    },
    tags: {
      'resource.slow': metric.duration > slowThresholdMs ? 'true' : 'false',
      'resource.error': metric.status && metric.status >= 400 ? 'true' : 'false',
      'resource.cached': metric.cached ? 'true' : 'false',
    },
  });
}

/**
 * Create a fetch wrapper that tracks performance.
 *
 * Usage:
 *   const result = await trackedFetch('/api/data');
 */
export async function trackedFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const startTime = performance.now();
  const method = options?.method || 'GET';

  try {
    const response = await fetch(url, options);
    const duration = performance.now() - startTime;

    // Report slow or failed requests
    if (duration > slowThresholdMs || response.status >= 400) {
      reportResource({
        url,
        method: method as any,
        duration,
        status: response.status,
      });
    }

    return response;
  } catch (error) {
    const duration = performance.now() - startTime;
    Sentry.captureException(error, {
      contexts: {
        performance: {
          url,
          method,
          duration_ms: Math.round(duration),
          error: String(error),
        },
      },
      tags: {
        'resource.error': 'true',
      },
    });
    throw error;
  }
}

/**
 * Get current resource metrics from PerformanceObserver.
 */
export function getResourceMetrics(): ResourceMetric[] {
  if (typeof performance === 'undefined') return [];

  return (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
    .filter((r) => r.name.includes('/functions/') || r.name.includes('/api/'))
    .map((r) => ({
      url: r.name,
      duration: r.duration,
      status: r.responseStatus || undefined,
      size: r.transferSize,
      cached: r.transferSize === 0 && r.decodedBodySize > 0,
    }));
}

/**
 * Get slowest resources.
 */
export function getSlowestResources(limit = 10): ResourceMetric[] {
  return getResourceMetrics()
    .sort((a, b) => b.duration - a.duration)
    .slice(0, limit);
}

/**
 * Get failed resources.
 */
export function getFailedResources(): ResourceMetric[] {
  return getResourceMetrics().filter((m) => m.status && m.status >= 400);
}
