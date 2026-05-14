import { describe, expect, it } from 'vitest';
import { sanitizeMetadata } from '../../../src/core/marketing-analytics/sanitizeMetadata';

describe('sanitizeMetadata', () => {
  it('removes IPv4 and IPv6 values', () => {
    const out = sanitizeMetadata({
      client_ip: '203.0.113.45',
      v6: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      ok: 'value',
    });
    expect(out.client_ip).toBeUndefined();
    expect(out.v6).toBeUndefined();
    expect(out.ok).toBe('value');
  });

  it('removes email-shaped strings', () => {
    const out = sanitizeMetadata({ contact: 'foo@bar.de', label: 'pro_plan' });
    expect(out.contact).toBeUndefined();
    expect(out.label).toBe('pro_plan');
  });

  it('drops raw user-agent strings', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0';
    const out = sanitizeMetadata({ ua, browser: 'chrome' });
    expect(out.ua).toBeUndefined();
    expect(out.browser).toBe('chrome');
  });

  it('strips forbidden keys regardless of value', () => {
    const out = sanitizeMetadata({
      email: 'safe-string',
      password: 'whatever',
      token: 'abc',
      plan: 'pro',
    });
    expect(out.email).toBeUndefined();
    expect(out.password).toBeUndefined();
    expect(out.token).toBeUndefined();
    expect(out.plan).toBe('pro');
  });

  it('truncates long strings to 200 chars', () => {
    const out = sanitizeMetadata({ blob: 'x'.repeat(500) });
    expect((out.blob as string).length).toBe(200);
  });

  it('caps total payload to 4096 bytes by dropping trailing keys', () => {
    const big: Record<string, unknown> = {};
    for (let i = 0; i < 100; i++) big[`k${i}`] = 'y'.repeat(150);
    const out = sanitizeMetadata(big);
    const size = new TextEncoder().encode(JSON.stringify(out)).length;
    expect(size).toBeLessThanOrEqual(4096);
  });

  it('returns empty object for null/undefined', () => {
    expect(sanitizeMetadata(null)).toEqual({});
    expect(sanitizeMetadata(undefined)).toEqual({});
  });
});
