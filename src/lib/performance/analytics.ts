/**
 * Performance analytics — collect and analyze performance metrics.
 *
 * Provides utilities for:
 *   - Collecting metrics over time
 *   - Computing statistics (mean, median, p95, p99)
 *   - Generating performance summaries
 *   - Exporting for analysis
 */

export interface PerformanceStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  stdDev: number;
}

/**
 * Compute statistics for a set of measurements.
 */
export function computeStats(measurements: number[]): PerformanceStats {
  if (measurements.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p95: 0,
      p99: 0,
      stdDev: 0,
    };
  }

  const sorted = [...measurements].sort((a, b) => a - b);
  const count = sorted.length;
  const min = sorted[0];
  const max = sorted[count - 1];
  const mean = sorted.reduce((a, b) => a + b) / count;
  const median = sorted[Math.floor(count / 2)];
  const p95 = sorted[Math.floor(count * 0.95)];
  const p99 = sorted[Math.floor(count * 0.99)];

  const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  return {
    count,
    min,
    max,
    mean,
    median,
    p95,
    p99,
    stdDev,
  };
}

/**
 * Collect and track multiple measurements over time.
 */
export class MetricsCollector {
  private measurements: Map<string, number[]> = new Map();

  record(name: string, value: number): void {
    const list = this.measurements.get(name) || [];
    list.push(value);
    this.measurements.set(name, list);
  }

  getStats(name: string): PerformanceStats | null {
    const measurements = this.measurements.get(name);
    if (!measurements) return null;
    return computeStats(measurements);
  }

  getAllStats(): Record<string, PerformanceStats> {
    const result: Record<string, PerformanceStats> = {};
    for (const [name, measurements] of this.measurements.entries()) {
      result[name] = computeStats(measurements);
    }
    return result;
  }

  getRaw(name: string): number[] {
    return this.measurements.get(name) || [];
  }

  clear(name?: string): void {
    if (name) {
      this.measurements.delete(name);
    } else {
      this.measurements.clear();
    }
  }

  export(): Record<string, number[]> {
    return Object.fromEntries(this.measurements);
  }

  import(data: Record<string, number[]>): void {
    for (const [name, measurements] of Object.entries(data)) {
      this.measurements.set(name, measurements);
    }
  }

  generateReport(): string {
    const stats = this.getAllStats();
    const lines = ['Performance Metrics Report', '==========================', ''];

    for (const [name, stat] of Object.entries(stats)) {
      lines.push(`${name}:`);
      lines.push(
        `  Count: ${stat.count}, Min: ${stat.min.toFixed(2)}ms, Max: ${stat.max.toFixed(2)}ms`
      );
      lines.push(
        `  Mean: ${stat.mean.toFixed(2)}ms, Median: ${stat.median.toFixed(2)}ms, StdDev: ${stat.stdDev.toFixed(2)}ms`
      );
      lines.push(
        `  P95: ${stat.p95.toFixed(2)}ms, P99: ${stat.p99.toFixed(2)}ms`
      );
      lines.push('');
    }

    return lines.join('\n');
  }
}

/**
 * Global metrics collector instance.
 */
const globalCollector = new MetricsCollector();

export function getMetricsCollector(): MetricsCollector {
  return globalCollector;
}

/**
 * Record a measurement to the global collector.
 */
export function recordMetric(name: string, value: number): void {
  globalCollector.record(name, value);
}

/**
 * Get statistics for a metric from the global collector.
 */
export function getMetricStats(name: string): PerformanceStats | null {
  return globalCollector.getStats(name);
}

/**
 * Generate a performance report from all collected metrics.
 */
export function generatePerformanceReport(): string {
  return globalCollector.generateReport();
}

/**
 * Export metrics as JSON for external analysis.
 */
export function exportMetricsAsJson(): string {
  return JSON.stringify(globalCollector.export(), null, 2);
}
