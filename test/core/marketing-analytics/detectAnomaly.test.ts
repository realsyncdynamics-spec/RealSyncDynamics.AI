import { describe, expect, it } from 'vitest';
import { detectAnomaly } from '../../../src/core/marketing-analytics/detectAnomaly';

describe('detectAnomaly', () => {
  it('returns isAnomaly=false for a stable series with no spike', () => {
    const r = detectAnomaly([100, 102, 98, 101, 99, 103, 100]);
    expect(r.isAnomaly).toBe(false);
    expect(r.value).toBe(100);
  });

  it('detects a large positive spike', () => {
    const r = detectAnomaly([100, 102, 98, 101, 99, 103, 400]);
    expect(r.isAnomaly).toBe(true);
    expect(r.zScore).toBeGreaterThan(2.5);
  });

  it('detects a large negative drop', () => {
    const r = detectAnomaly([100, 98, 102, 101, 99, 103, 5]);
    expect(r.isAnomaly).toBe(true);
    expect(r.zScore).toBeLessThan(-2.5);
  });

  it('returns false for too-short history', () => {
    const r = detectAnomaly([1, 2, 3]);
    expect(r.isAnomaly).toBe(false);
  });

  it('treats deviation from constant series as anomaly', () => {
    const r = detectAnomaly([10, 10, 10, 10, 10, 10, 11]);
    expect(r.isAnomaly).toBe(true);
    expect(r.stdDev).toBe(0);
  });
});
