import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAffiliateRef } from '../../src/lib/affiliate';

// Härtung von getAffiliateRef: Einträge ohne gültiges Ablaufdatum oder mit
// ungültigem Code werden verworfen und entfernt (fail-closed).

const STORAGE_KEY = 'rsd-affiliate-ref';
const NOW = new Date('2026-11-26T10:00:00.000Z');
const FUTURE = new Date(NOW.getTime() + 24 * 60 * 60 * 1000).toISOString();

function put(value: unknown): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});

describe('getAffiliateRef – Härtung', () => {
  it('liefert einen gültigen Eintrag weiterhin', () => {
    put({ code: 'partner_01', expires_at: FUTURE });
    expect(getAffiliateRef()).toBe('partner_01');
  });

  it.each([
    ['fehlt', { code: 'partner' }],
    ['leer', { code: 'partner', expires_at: '' }],
    ['kein Datum', { code: 'partner', expires_at: 'irgendwann' }],
    ['Zahl statt String', { code: 'partner', expires_at: NOW.getTime() + 1000 }],
    ['null', { code: 'partner', expires_at: null }],
  ])('verwirft Einträge ohne gültiges expires_at (%s) und entfernt sie', (_label, value) => {
    put(value);
    expect(getAffiliateRef()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it.each([
    ['fehlt', { expires_at: FUTURE }],
    ['Zahl', { code: 12345, expires_at: FUTURE }],
    ['Objekt', { code: { x: 1 }, expires_at: FUTURE }],
    ['zu kurz', { code: 'ab', expires_at: FUTURE }],
    ['Sonderzeichen', { code: '<script>', expires_at: FUTURE }],
  ])('verwirft Einträge mit ungültigem code (%s) und entfernt sie', (_label, value) => {
    put(value);
    expect(getAffiliateRef()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it.each([
    ['null', null],
    ['Zahl', 42],
    ['String', 'partner'],
    ['Array', ['partner']],
  ])('verwirft JSON, das kein Objekt ist (%s)', (_label, value) => {
    put(value);
    expect(getAffiliateRef()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('wirft nicht, wenn das Entfernen eines ungültigen Eintrags fehlschlägt', () => {
    put({ code: 'partner' });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => getAffiliateRef()).not.toThrow();
    expect(getAffiliateRef()).toBeNull();
  });
});
