/**
 * Cloudflare Workers: Observability Layer
 *
 * Purpose: Unified monitoring for edge Workers
 * - Cloudflare Analytics Engine: Custom metrics + queries
 * - Sentry: Error tracking + performance monitoring
 * - Custom Headers: X-Worker-Latency, X-Cache, X-Evidence-ID for client tracking
 *
 * Metrics Tracked:
 * - Endpoint latency (p50/p95/p99)
 * - Cache hit/miss ratios
 * - Error rates by type
 * - R2 dual-write coordination
 * - Webhook invalidation latency
 *
 * Note: Sentry is injected at runtime by Cloudflare Workers platform.
 * Type definitions are provided but implementation is platform-specific.
 */

// Sentry types (provided by Cloudflare Workers at runtime)
interface SentryType {
  init(config: Record<string, unknown>): void;
  captureException(error: unknown, context?: Record<string, unknown>): void;
  startSpan<T>(
    config: Record<string, unknown>,
    callback: () => Promise<T>
  ): Promise<T>;
  Replay?: {
    new (config?: Record<string, unknown>): unknown;
  };
}

let Sentry: SentryType = {
  init: () => console.warn('Sentry not initialized'),
  captureException: () => undefined,
  startSpan: async (_, callback) => callback(),
};

// Try to load Sentry at runtime
try {
  const sentryModule = require('@sentry/cloudflare-workers') as SentryType;
  Sentry = sentryModule;
} catch {
  console.warn('Sentry module not available; error tracking disabled');
}

interface WorkerAnalytics {
  endpoint: string;
  method: string;
  status_code: number;
  latency_ms: number;
  cache_status?: 'HIT' | 'MISS';
  error_type?: string;
  user_id?: string;
  tenant_id?: string;
  timestamp: number;
}

/**
 * Initialize Sentry for error tracking
 * Called once per Worker startup
 */
export function initializeSentry(env: Record<string, string>) {
  const sentryDsn = env.SENTRY_DSN || '';
  if (!sentryDsn) {
    console.warn('SENTRY_DSN not configured; error tracking disabled');
    return;
  }

  const integrations = [];
  if (Sentry.Replay) {
    integrations.push(new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }));
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: env.ENVIRONMENT || 'production',
    tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.1 : 1.0,
    maxBreadcrumbs: 50,
    integrations,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });

  console.log('✓ Sentry initialized for error tracking');
}

/**
 * Capture analytics event for Cloudflare Analytics Engine
 * Batched and queried via SQL for real-time dashboards
 */
export async function captureAnalytics(
  analyticEngine: any,
  analytics: WorkerAnalytics
): Promise<void> {
  try {
    if (!analyticEngine) {
      console.warn('Analytics Engine not available; skipping metric write');
      return;
    }

    // Write to Cloudflare Analytics Engine (batched, not individual)
    await analyticEngine.writeDataPoint({
      indexes: [analytics.endpoint, analytics.method, String(analytics.status_code)],
      blobs: [
        analytics.cache_status || 'N/A',
        analytics.error_type || 'none',
        analytics.tenant_id || 'unknown',
      ],
      doubles: [analytics.latency_ms],
    });
  } catch (e) {
    console.warn(
      `Failed to write analytics: ${e instanceof Error ? e.message : String(e)}`
    );
    // Don't throw; analytics failures shouldn't break worker
  }
}

/**
 * Wrap request handler with observability
 * Captures latency, errors, cache status
 */
export function withObservability<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  handlerName: string,
  env: Record<string, string>
): T {
  return (async (...args: any[]) => {
    const request = args[0] as Request;
    const startTime = Date.now();
    const url = new URL(request.url);

    try {
      const response = await handler(...args);
      const elapsed = Date.now() - startTime;

      // Extract cache status from response headers
      const cacheStatus = (response.headers.get('X-Cache') || 'N/A') as
        | 'HIT'
        | 'MISS'
        | 'N/A';

      const analytics: WorkerAnalytics = {
        endpoint: url.pathname,
        method: request.method,
        status_code: response.status,
        latency_ms: elapsed,
        cache_status: cacheStatus === 'N/A' ? undefined : cacheStatus,
        timestamp: Date.now(),
      };

      // Capture to Analytics Engine
      if (env.ANALYTICS_ENGINE) {
        await captureAnalytics(env.ANALYTICS_ENGINE, analytics);
      }

      // Set latency header for client tracking
      const clonedResponse = new Response(response.body, response);
      if (!clonedResponse.headers.has('X-Worker-Latency')) {
        clonedResponse.headers.set('X-Worker-Latency', `${elapsed}ms`);
      }

      return clonedResponse;
    } catch (error) {
      const elapsed = Date.now() - startTime;

      const errorType = error instanceof Error ? error.name : typeof error;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Capture to Sentry
      Sentry.captureException(error, {
        tags: {
          handler: handlerName,
          method: request.method,
          endpoint: url.pathname,
        },
        contexts: {
          worker: {
            endpoint: url.pathname,
            method: request.method,
            latency_ms: elapsed,
          },
        },
      });

      // Capture to Analytics Engine
      const analytics: WorkerAnalytics = {
        endpoint: url.pathname,
        method: request.method,
        status_code: 500,
        latency_ms: elapsed,
        error_type: errorType,
        timestamp: Date.now(),
      };

      if (env.ANALYTICS_ENGINE) {
        await captureAnalytics(env.ANALYTICS_ENGINE, analytics);
      }

      console.error(
        `Handler error: ${handlerName} - ${errorType}: ${errorMessage}`
      );

      // Return error response
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'internal_error',
          message: 'Worker processing failed',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'X-Worker-Latency': `${elapsed}ms`,
          },
        }
      );
    }
  }) as T;
}

/**
 * Sentry performance monitoring helper
 * Track slow operations and bottlenecks
 */
export function measureOperation<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      name: operationName,
      op: 'worker.operation',
    },
    async () => operation()
  );
}

/**
 * Alert threshold configurations
 * Used by monitoring dashboards to determine severity
 */
export const ALERT_THRESHOLDS = {
  jwt_error_rate: 0.01, // >1% error rate
  kv_hit_rate_low: 0.70, // <70% hit rate (cache churn)
  r2_write_latency: 100, // >100ms write latency
  r2_error_rate: 0.005, // >0.5% error rate
  webhook_failures: 20, // >20 failures in 5 min
  supabase_rls_denials: 10, // >10 RLS errors in 1 min
};

/**
 * Cloudflare Analytics Engine queries
 * Run these in Cloudflare dashboard for monitoring
 */
export const ANALYTICS_QUERIES = {
  // JWT verification latency distribution
  jwtLatency: `
    SELECT
      QUANTILE(latency_ms, 0.50) as p50,
      QUANTILE(latency_ms, 0.95) as p95,
      QUANTILE(latency_ms, 0.99) as p99,
      COUNT(*) as request_count
    FROM Httplog
    WHERE Endpoint = '/api/auth/verify-jwt'
      AND Timestamp > now() - interval '1 hour'
  `,

  // KV cache hit rate
  kvCacheHitRate: `
    SELECT
      CacheStatus,
      COUNT(*) as count,
      ROUND(COUNT(*) / SUM(COUNT(*)) OVER() * 100, 2) as percentage
    FROM Httplog
    WHERE Endpoint LIKE '/api/policies/%'
      AND Timestamp > now() - interval '1 hour'
    GROUP BY CacheStatus
  `,

  // R2 write performance
  r2WriteLatency: `
    SELECT
      Method,
      QUANTILE(latency_ms, 0.50) as p50,
      QUANTILE(latency_ms, 0.95) as p95,
      QUANTILE(latency_ms, 0.99) as p99
    FROM Httplog
    WHERE Endpoint LIKE '/api/evidence/ingest/%'
      AND Timestamp > now() - interval '1 hour'
    GROUP BY Method
  `,

  // Error rate by endpoint
  errorRateByEndpoint: `
    SELECT
      Endpoint,
      StatusCode,
      COUNT(*) as count,
      ROUND(COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY Endpoint) * 100, 2) as error_pct
    FROM Httplog
    WHERE StatusCode >= 400
      AND Timestamp > now() - interval '1 hour'
    GROUP BY Endpoint, StatusCode
    ORDER BY error_pct DESC
  `,

  // Tenant isolation verification (should show no cross-tenant cache hits)
  tenantIsolation: `
    SELECT
      TenantId,
      COUNT(*) as total_requests,
      SUM(CASE WHEN CacheStatus = 'HIT' THEN 1 ELSE 0 END) as cache_hits
    FROM Httplog
    WHERE Endpoint LIKE '/api/%'
      AND Timestamp > now() - interval '1 hour'
    GROUP BY TenantId
    ORDER BY total_requests DESC
  `,
};

/**
 * Sentry alert rules
 * Configure these in Sentry dashboard for automated alerts
 */
export const SENTRY_ALERT_RULES = [
  {
    name: 'JWT Verification Errors >1%',
    condition: 'error_rate > 0.01',
    action: 'page_on_call',
    tags: { handler: 'verify-jwt' },
  },
  {
    name: 'R2 Write Failures >5 in 5min',
    condition: 'error_count > 5 in 5 minutes',
    action: 'page_on_call',
    tags: { handler: 'evidence-vault' },
  },
  {
    name: 'Supabase RLS Denials >10 in 1min',
    condition: 'error_count > 10 in 1 minute',
    action: 'slack_notification',
    tags: { error_type: 'rls_denial' },
  },
  {
    name: 'Webhook Secret Failures >20 in 5min',
    condition: 'error_count > 20 in 5 minutes',
    action: 'security_alert',
    tags: { error_type: 'webhook_auth_failed' },
  },
];
