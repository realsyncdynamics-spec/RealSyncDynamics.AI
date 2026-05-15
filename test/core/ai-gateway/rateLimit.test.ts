import { describe, it, expect } from 'vitest';
import {
  decideRateLimit,
  clientIp,
  DEFAULT_LIMITS,
  FEATURE_LIMITS,
  type WindowState,
} from '../../../src/core/ai-gateway/rateLimit';

function freshStores() {
  return {
    minute: new Map<string, WindowState>(),
    hour:   new Map<string, WindowState>(),
  };
}

describe('decideRateLimit — per-minute budget', () => {
  it('allows N calls and blocks call N+1 within the same minute', () => {
    const stores = freshStores();
    const limits = { perMinute: 3, perHour: 100 };
    const t0 = 1_000_000;

    for (let i = 0; i < 3; i++) {
      const r = decideRateLimit({
        key: 'k', feature: 'f', now: t0 + i,
        minuteWindows: stores.minute, hourWindows: stores.hour, limits,
      });
      expect(r.ok).toBe(true);
    }

    const blocked = decideRateLimit({
      key: 'k', feature: 'f', now: t0 + 4,
      minuteWindows: stores.minute, hourWindows: stores.hour, limits,
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok !== false) throw new Error('unreachable');
    expect(blocked.scope).toBe('minute');
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it('resets after 60 seconds and accepts a new request', () => {
    const stores = freshStores();
    const limits = { perMinute: 2, perHour: 100 };

    decideRateLimit({ key: 'k', feature: 'f', now: 0,        minuteWindows: stores.minute, hourWindows: stores.hour, limits });
    decideRateLimit({ key: 'k', feature: 'f', now: 1_000,    minuteWindows: stores.minute, hourWindows: stores.hour, limits });
    const blocked = decideRateLimit({ key: 'k', feature: 'f', now: 2_000, minuteWindows: stores.minute, hourWindows: stores.hour, limits });
    expect(blocked.ok).toBe(false);

    const afterReset = decideRateLimit({
      key: 'k', feature: 'f', now: 60_001,
      minuteWindows: stores.minute, hourWindows: stores.hour, limits,
    });
    expect(afterReset.ok).toBe(true);
  });
});

describe('decideRateLimit — per-hour budget', () => {
  it('blocks when hourly budget is exhausted even if minute budget would allow', () => {
    const stores = freshStores();
    const limits = { perMinute: 100, perHour: 5 };

    // Five requests across the hour, perMinute is never close to firing.
    for (let i = 0; i < 5; i++) {
      const r = decideRateLimit({
        key: 'k', feature: 'f', now: i * 60_001,
        minuteWindows: stores.minute, hourWindows: stores.hour, limits,
      });
      expect(r.ok).toBe(true);
    }

    const blocked = decideRateLimit({
      key: 'k', feature: 'f', now: 5 * 60_001,
      minuteWindows: stores.minute, hourWindows: stores.hour, limits,
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok !== false) throw new Error('unreachable');
    expect(blocked.scope).toBe('hour');
  });
});

describe('decideRateLimit — isolation by key', () => {
  it('different keys (different IPs) get independent budgets', () => {
    const stores = freshStores();
    const limits = { perMinute: 1, perHour: 10 };

    const a = decideRateLimit({ key: 'A', feature: 'f', now: 0, minuteWindows: stores.minute, hourWindows: stores.hour, limits });
    expect(a.ok).toBe(true);

    const b = decideRateLimit({ key: 'B', feature: 'f', now: 0, minuteWindows: stores.minute, hourWindows: stores.hour, limits });
    expect(b.ok).toBe(true);

    const aBlocked = decideRateLimit({ key: 'A', feature: 'f', now: 100, minuteWindows: stores.minute, hourWindows: stores.hour, limits });
    expect(aBlocked.ok).toBe(false);
  });
});

describe('decideRateLimit — feature-specific limits', () => {
  it('reads from FEATURE_LIMITS when no override is provided', () => {
    expect(FEATURE_LIMITS.assistant_chip_quick_chat).toBeDefined();
    expect(FEATURE_LIMITS.audit_copilot_remediation_plan?.perMinute).toBe(3);
    expect(FEATURE_LIMITS.ai_act_classify?.perMinute).toBe(4);
    expect(FEATURE_LIMITS.ai_act_classify?.perHour).toBe(30);
  });

  it('falls back to DEFAULT_LIMITS for unknown features', () => {
    const stores = freshStores();
    let lastOk = true;
    for (let i = 0; i < DEFAULT_LIMITS.perMinute; i++) {
      const r = decideRateLimit({
        key: 'k', feature: 'unknown_feature_xyz', now: i,
        minuteWindows: stores.minute, hourWindows: stores.hour,
      });
      lastOk = r.ok;
    }
    expect(lastOk).toBe(true);

    const blocked = decideRateLimit({
      key: 'k', feature: 'unknown_feature_xyz', now: DEFAULT_LIMITS.perMinute,
      minuteWindows: stores.minute, hourWindows: stores.hour,
    });
    expect(blocked.ok).toBe(false);
  });
});

describe('decideRateLimit — hourly cost during a minute-block burst', () => {
  it('counts blocked calls against the hourly budget too (no free retries)', () => {
    const stores = freshStores();
    const limits = { perMinute: 2, perHour: 6 };

    // 2 successful + 4 blocked within the minute = 6 hour-window tokens used.
    for (let i = 0; i < 6; i++) {
      decideRateLimit({
        key: 'k', feature: 'f', now: i * 1_000,
        minuteWindows: stores.minute, hourWindows: stores.hour, limits,
      });
    }

    // After 61s the minute window resets, but the hour window is at 6/6.
    // The next call increments hour to 7, which exceeds perHour.
    const next = decideRateLimit({
      key: 'k', feature: 'f', now: 61_000,
      minuteWindows: stores.minute, hourWindows: stores.hour, limits,
    });
    expect(next.ok).toBe(false);
    if (next.ok !== false) throw new Error('unreachable');
    expect(next.scope).toBe('hour');
  });
});

describe('clientIp', () => {
  it('returns the first hop of X-Forwarded-For', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 10.0.0.2' });
    expect(clientIp(h)).toBe('203.0.113.7');
  });

  it('trims whitespace from the first XFF hop', () => {
    const h = new Headers({ 'x-forwarded-for': '   198.51.100.42  , 10.0.0.1' });
    expect(clientIp(h)).toBe('198.51.100.42');
  });

  it('falls back to CF-Connecting-IP when XFF is missing', () => {
    const h = new Headers({ 'cf-connecting-ip': '198.51.100.99' });
    expect(clientIp(h)).toBe('198.51.100.99');
  });

  it('returns "unknown" when no headers are present', () => {
    expect(clientIp(new Headers())).toBe('unknown');
  });

  it('returns "unknown" when XFF is empty', () => {
    const h = new Headers({ 'x-forwarded-for': '' });
    expect(clientIp(h)).toBe('unknown');
  });
});
