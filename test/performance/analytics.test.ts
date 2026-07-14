import { describe, it, expect } from 'vitest';
import { computeStats, MetricsCollector, recordMetric, getMetricStats, generatePerformanceReport } from '../../src/lib/performance/analytics';

describe('Performance Analytics', () => {
  describe('computeStats', () => {
    it('computes statistics for measurements', () => {
      const measurements = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const stats = computeStats(measurements);

      expect(stats.count).toBe(10);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(100);
      expect(stats.mean).toBe(55);
      // For 10 elements (even length), median is the element at index floor(10/2) = 5
      expect(stats.median).toBe(60);
    });

    it('handles empty measurements', () => {
      const stats = computeStats([]);

      expect(stats.count).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.mean).toBe(0);
    });

    it('calculates percentiles correctly', () => {
      const measurements = Array.from({ length: 100 }, (_, i) => i + 1);
      const stats = computeStats(measurements);

      expect(stats.p95).toBeGreaterThan(90);
      expect(stats.p99).toBeGreaterThan(95);
    });

    it('calculates standard deviation', () => {
      const measurements = [10, 20, 30, 40, 50];
      const stats = computeStats(measurements);

      expect(stats.stdDev).toBeGreaterThan(0);
    });
  });

  describe('MetricsCollector', () => {
    it('records and retrieves measurements', () => {
      const collector = new MetricsCollector();

      collector.record('response-time', 100);
      collector.record('response-time', 150);
      collector.record('response-time', 120);

      const stats = collector.getStats('response-time');
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(3);
      expect(stats!.min).toBe(100);
      expect(stats!.max).toBe(150);
    });

    it('returns null for non-existent metrics', () => {
      const collector = new MetricsCollector();
      const stats = collector.getStats('non-existent');

      expect(stats).toBeNull();
    });

    it('clears individual metrics', () => {
      const collector = new MetricsCollector();
      collector.record('metric1', 100);
      collector.record('metric2', 200);

      collector.clear('metric1');

      expect(collector.getStats('metric1')).toBeNull();
      expect(collector.getStats('metric2')).toBeDefined();
    });

    it('clears all metrics', () => {
      const collector = new MetricsCollector();
      collector.record('metric1', 100);
      collector.record('metric2', 200);

      collector.clear();

      expect(collector.getStats('metric1')).toBeNull();
      expect(collector.getStats('metric2')).toBeNull();
    });

    it('exports and imports data', () => {
      const collector1 = new MetricsCollector();
      collector1.record('metric', 100);
      collector1.record('metric', 200);

      const exported = collector1.export();
      const collector2 = new MetricsCollector();
      collector2.import(exported);

      const stats = collector2.getStats('metric');
      expect(stats!.count).toBe(2);
      expect(stats!.min).toBe(100);
    });

    it('generates readable reports', () => {
      const collector = new MetricsCollector();
      collector.record('api-call', 100);
      collector.record('api-call', 200);
      collector.record('render-time', 50);

      const report = collector.generateReport();

      expect(report).toContain('api-call');
      expect(report).toContain('render-time');
      expect(report).toContain('Mean:');
      expect(report).toContain('P95:');
    });

    it('gets all stats at once', () => {
      const collector = new MetricsCollector();
      collector.record('metric1', 100);
      collector.record('metric2', 200);

      const allStats = collector.getAllStats();

      expect(Object.keys(allStats).length).toBe(2);
      expect(allStats.metric1).toBeDefined();
      expect(allStats.metric2).toBeDefined();
    });
  });

  describe('Global collector functions', () => {
    it('records metrics globally', () => {
      recordMetric('global-metric', 100);
      const stats = getMetricStats('global-metric');

      expect(stats).toBeDefined();
      expect(stats!.count).toBeGreaterThan(0);
    });

    it('generates performance report', () => {
      recordMetric('test-metric', 100);
      const report = generatePerformanceReport();

      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });
  });
});
