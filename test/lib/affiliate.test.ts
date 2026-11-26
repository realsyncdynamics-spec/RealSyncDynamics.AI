import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureAffiliateRef,
  clearAffiliateRef,
  getAffiliateRef,
} from '../../src/lib/affiliate';

const STORAGE_KEY = 'rsd-affiliate-ref';
const DAY_MS = 24 * 60 * 60 * 1000;
const TTL_MS = 90 * DAY_MS;
const NOW = new Date('2026-11-26T10:00:00.000Z');

function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`);
}

function stored(): { code: string; captured_at: string; expires_at: string } | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
  setSearch('');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
  setSearch('');
});

describe('captureAffiliateRef', () => {
  it('speichert einen gültigen ?ref-Code mit Zeitstempeln und 90 Tagen TTL', () => {
    setSearch('?ref=partner_01');
    captureAffiliateRef();

    expect(stored()).toEqual({
      code: 'partner_01',
      captured_at: NOW.toISOString(),
      expires_at: new Date(NOW.getTime() + TTL_MS).toISOString(),
    });
    expect(getAffiliateRef()).toBe('partner_01');
  });

  it('akzeptiert ?via als Rückfall', () => {
    setSearch('?via=via-code');
    captureAffiliateRef();
    expect(getAffiliateRef()).toBe('via-code');
  });

  it('bevorzugt ?ref vor ?via', () => {
    setSearch('?via=via-code&ref=ref-code');
    captureAffiliateRef();
    expect(getAffiliateRef()).toBe('ref-code');
  });

  it('speichert nichts ohne Parameter', () => {
    setSearch('?utm_source=newsletter');
    captureAffiliateRef();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it.each([
    ['zu kurz', 'ab'],
    ['zu lang', 'a'.repeat(33)],
    ['Leerzeichen', 'bad code'],
    ['Sonderzeichen', 'x<script>'],
    ['Punkt', 'a.b.c'],
    ['leer', ''],
  ])('verwirft ungültige Codes (%s)', (_label, code) => {
    setSearch(`?ref=${encodeURIComponent(code)}`);
    captureAffiliateRef();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('akzeptiert die Grenzlängen 3 und 32', () => {
    setSearch('?ref=abc');
    captureAffiliateRef();
    expect(getAffiliateRef()).toBe('abc');

    const max = 'A'.repeat(32);
    setSearch(`?ref=${max}`);
    captureAffiliateRef();
    expect(getAffiliateRef()).toBe(max);
  });

  it('überschreibt einen gespeicherten Code mit einem neuen gültigen (Last Click)', () => {
    setSearch('?ref=first');
    captureAffiliateRef();
    setSearch('?ref=second');
    captureAffiliateRef();
    expect(getAffiliateRef()).toBe('second');
  });

  it('lässt einen gespeicherten Code bei ungültigem neuem Code unverändert', () => {
    setSearch('?ref=first');
    captureAffiliateRef();
    setSearch('?ref=!!');
    captureAffiliateRef();
    expect(getAffiliateRef()).toBe('first');
  });

  it('wirft nicht, wenn localStorage nicht verfügbar ist', () => {
    setSearch('?ref=partner');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => captureAffiliateRef()).not.toThrow();
  });
});

describe('getAffiliateRef', () => {
  it('liefert null, wenn nichts gespeichert ist', () => {
    expect(getAffiliateRef()).toBeNull();
  });

  it('liefert den Code kurz vor Ablauf noch', () => {
    setSearch('?ref=partner');
    captureAffiliateRef();
    vi.setSystemTime(NOW.getTime() + TTL_MS - 1);
    expect(getAffiliateRef()).toBe('partner');
  });

  it('liefert den Code genau zum Ablaufzeitpunkt noch (Vergleich ist strikt <)', () => {
    setSearch('?ref=partner');
    captureAffiliateRef();
    vi.setSystemTime(NOW.getTime() + TTL_MS);
    expect(getAffiliateRef()).toBe('partner');
  });

  it('liefert null nach Ablauf und entfernt den Eintrag', () => {
    setSearch('?ref=partner');
    captureAffiliateRef();
    vi.setSystemTime(NOW.getTime() + TTL_MS + 1);
    expect(getAffiliateRef()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('liefert null bei beschädigtem JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{kein json');
    expect(getAffiliateRef()).toBeNull();
  });

  it('liefert null, wenn localStorage beim Lesen wirft', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(getAffiliateRef()).toBeNull();
  });
});

describe('clearAffiliateRef', () => {
  it('entfernt den gespeicherten Code', () => {
    setSearch('?ref=partner');
    captureAffiliateRef();
    clearAffiliateRef();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(getAffiliateRef()).toBeNull();
  });

  it('wirft nicht, wenn localStorage nicht verfügbar ist', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => clearAffiliateRef()).not.toThrow();
  });
});
