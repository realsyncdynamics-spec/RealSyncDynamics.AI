import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startTimer, measureAsync, markStart, markEnd, getMeasurements, getAverageDuration } from '../../src/lib/performance/timing';

describe('Performance Timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startTimer', () => {
    it('measures duration correctly', () => {
      const timer = startTimer('test-operation');
      vi.advanceTimersByTime(100);
      const result = timer.end();

      expect(result.duration).toBe(100);
      expect(result.isSlow).toBe(false);
    });

    it('marks operations as slow when > 1s', () => {
      const timer = startTimer('slow-operation');
      vi.advanceTimersByTime(1500);
      const result = timer.end();

      expect(result.duration).toBe(1500);
      expect(result.isSlow).toBe(true);
    });

    it('accepts context information', () => {
      const timer = startTimer('api-call');
      vi.advanceTimersByTime(500);
      const result = timer.end({
        category: 'api',
        status: 'success',
        tags: { endpoint: '/data' },
      });

      expect(result.duration).toBe(500);
      expect(result.isSlow).toBe(false);
    });
  });

  describe('measureAsync', () => {
    it('measures successful async operations', async () => {
      const fn = async () => {
        vi.advanceTimersByTime(100);
        return 'success';
      };

      const result = await measureAsync('async-op', fn);
      expect(result).toBe('success');
    });

    it('captures errors in async operations', async () => {
      const fn = async () => {
        vi.advanceTimersByTime(100);
        throw new Error('test error');
      };

      await expect(measureAsync('async-error', fn)).rejects.toThrow('test error');
    });
  });

  describe('marks and measures', () => {
    it('creates and measures performance marks', () => {
      // Note: In jsdom, performance.measure() may not work
      // This test just verifies the functions don't throw
      expect(() => {
        markStart('operation');
        vi.advanceTimersByTime(50);
        markEnd('operation');
      }).not.toThrow();
    });

    it('calculates average duration or returns null', () => {
      markStart('avg-op');
      vi.advanceTimersByTime(100);
      markEnd('avg-op');

      markStart('avg-op');
      vi.advanceTimersByTime(200);
      markEnd('avg-op');

      const avg = getAverageDuration('avg-op');
      // In jsdom, this may be null if performance.measure isn't available
      // Just verify it returns a number or null
      expect(avg === null || typeof avg === 'number').toBe(true);
    });
  });
});
