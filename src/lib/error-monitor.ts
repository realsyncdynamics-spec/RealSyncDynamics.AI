/**
 * Error Monitoring & Alerting — Track error rates and trigger degradation
 */

interface ErrorMetrics {
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  lastErrorTime: number;
  consecutiveErrors: number;
}

interface ErrorThreshold {
  name: string;
  errorRate: number;        // 0.05 = 5%
  window: number;           // Time window in ms
  action: 'degrade' | 'alert' | 'retry' | 'fallback';
  consecutiveThreshold?: number;
}

export class ErrorMonitor {
  private metrics = new Map<string, ErrorMetrics>();
  private errorHistory = new Map<string, number[]>();
  private thresholds: Map<string, ErrorThreshold>;

  constructor(thresholds: ErrorThreshold[] = []) {
    this.thresholds = new Map(thresholds.map((t) => [t.name, t]));
  }

  recordRequest(operationName: string, success: boolean): ErrorMetrics {
    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, {
        totalRequests: 0,
        totalErrors: 0,
        errorRate: 0,
        lastErrorTime: 0,
        consecutiveErrors: 0,
      });
      this.errorHistory.set(operationName, []);
    }

    const metrics = this.metrics.get(operationName)!;
    metrics.totalRequests++;

    if (!success) {
      metrics.totalErrors++;
      metrics.consecutiveErrors++;
      metrics.lastErrorTime = Date.now();

      const history = this.errorHistory.get(operationName)!;
      history.push(Date.now());

      // Clean old entries (keep last 1 hour)
      const cutoff = Date.now() - 3600000;
      while (history.length > 0 && history[0] < cutoff) {
        history.shift();
      }
    } else {
      metrics.consecutiveErrors = 0;
    }

    metrics.errorRate = metrics.totalRequests > 0 ? metrics.totalErrors / metrics.totalRequests : 0;

    return metrics;
  }

  getMetrics(operationName: string): ErrorMetrics | null {
    return this.metrics.get(operationName) || null;
  }

  checkThreshold(operationName: string): {
    exceeded: boolean;
    threshold?: ErrorThreshold;
    action?: string;
  } {
    const threshold = this.thresholds.get(operationName);
    if (!threshold) return { exceeded: false };

    const metrics = this.metrics.get(operationName);
    if (!metrics) return { exceeded: false };

    // Check error rate
    if (metrics.errorRate > threshold.errorRate) {
      return { exceeded: true, threshold, action: threshold.action };
    }

    // Check consecutive errors
    if (threshold.consecutiveThreshold && metrics.consecutiveErrors >= threshold.consecutiveThreshold) {
      return { exceeded: true, threshold, action: threshold.action };
    }

    return { exceeded: false };
  }

  reset(operationName: string): void {
    this.metrics.delete(operationName);
    this.errorHistory.delete(operationName);
  }

  getAllMetrics(): Record<string, ErrorMetrics> {
    const result: Record<string, ErrorMetrics> = {};
    for (const [key, value] of this.metrics) {
      result[key] = value;
    }
    return result;
  }
}

/**
 * Performance monitoring for operations
 */
export class PerformanceMonitor {
  private durations = new Map<string, number[]>();
  private thresholds: Map<string, number>;

  constructor(thresholds: Record<string, number> = {}) {
    this.thresholds = new Map(Object.entries(thresholds));
  }

  async measure<T>(operationName: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;

      if (!this.durations.has(operationName)) {
        this.durations.set(operationName, []);
      }

      this.durations.get(operationName)!.push(duration);

      const threshold = this.thresholds.get(operationName);
      if (threshold && duration > threshold) {
        console.warn(
          `[PerformanceMonitor] ${operationName} exceeded threshold: ${duration.toFixed(2)}ms > ${threshold}ms`
        );
      }
    }
  }

  getStats(operationName: string) {
    const durations = this.durations.get(operationName) || [];

    if (durations.length === 0) {
      return null;
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);
    const mean = sum / durations.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      count: durations.length,
      mean: mean.toFixed(2),
      min: Math.min(...durations).toFixed(2),
      max: Math.max(...durations).toFixed(2),
      p95: p95?.toFixed(2),
      p99: p99?.toFixed(2),
    };
  }

  getAllStats(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key of this.durations.keys()) {
      result[key] = this.getStats(key);
    }
    return result;
  }
}

/**
 * Global error monitor instance
 */
export const globalErrorMonitor = new ErrorMonitor([
  {
    name: 'website-generation',
    errorRate: 0.05,
    window: 3600000,
    action: 'degrade',
  },
  {
    name: 'cloudflare-deploy',
    errorRate: 0.10,
    window: 600000,
    action: 'alert',
  },
  {
    name: 'domain-propagation',
    errorRate: 0.15,
    window: 1800000,
    action: 'retry',
  },
]);

export const globalPerformanceMonitor = new PerformanceMonitor({
  'website-generation': 15000,
  'cloudflare-deploy': 120000,
  'domain-propagation': 300000,
  'compliance-scan': 30000,
});
