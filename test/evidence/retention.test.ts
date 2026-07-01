import { describe, it, expect } from 'vitest';
import { retainedUntil, isExpired, describeRetention, isRetentionClass } from '../../src/lib/evidence/retention';

const T0 = Date.UTC(2026, 6, 1, 0, 0, 0, 0); // 2026-07-01T00:00:00Z

describe('retainedUntil', () => {
  it('forever → null', () => {
    expect(retainedUntil('forever', T0)).toBeNull();
  });
  it('ephemeral → sofort (== from)', () => {
    expect(retainedUntil('ephemeral', T0)).toBe(new Date(T0).toISOString());
  });
  it('90d → +90 Tage', () => {
    expect(retainedUntil('90d', T0)).toBe(new Date(T0 + 90 * 86400000).toISOString());
  });
  it('1y → +365 Tage', () => {
    expect(retainedUntil('1y', T0)).toBe(new Date(T0 + 365 * 86400000).toISOString());
  });
  it('7y → +7*365 Tage', () => {
    expect(retainedUntil('7y', T0)).toBe(new Date(T0 + 7 * 365 * 86400000).toISOString());
  });
});

describe('isExpired', () => {
  it('legal-hold überschreibt alles (nie abgelaufen)', () => {
    expect(isExpired(new Date(T0 - 86400000).toISOString(), T0, true)).toBe(false);
  });
  it('forever (null) ist nie abgelaufen', () => {
    expect(isExpired(null, T0, false)).toBe(false);
  });
  it('abgelaufen, wenn now > retained_until', () => {
    const until = retainedUntil('7d', T0)!;
    expect(isExpired(until, T0 + 8 * 86400000, false)).toBe(true);
    expect(isExpired(until, T0 + 6 * 86400000, false)).toBe(false);
  });
  it('ephemeral ist ab dem nächsten Moment abgelaufen', () => {
    const until = retainedUntil('ephemeral', T0)!;
    expect(isExpired(until, T0 + 1, false)).toBe(true);
  });
});

describe('describeRetention / isRetentionClass', () => {
  it('beschreibt lesbar', () => {
    expect(describeRetention('7y')).toBe('7 Jahre');
    expect(describeRetention('forever')).toBe('Unbegrenzt');
    expect(describeRetention('ephemeral')).toMatch(/Flüchtig/);
  });
  it('validiert Klassen', () => {
    expect(isRetentionClass('90d')).toBe(true);
    expect(isRetentionClass('99y')).toBe(false);
    expect(isRetentionClass(42)).toBe(false);
  });
});
