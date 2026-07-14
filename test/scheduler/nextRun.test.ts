import { describe, it, expect } from 'vitest';
import { computeNextRun, validateSchedule, describeSchedule } from '../../src/lib/scheduler/nextRun';

// Fester Referenzzeitpunkt: Mi, 2026-07-01 12:00:00 UTC (Wochentag 3).
const NOW = Date.UTC(2026, 6, 1, 12, 0, 0, 0);

describe('computeNextRun — daily', () => {
  it('wählt heute, wenn die Uhrzeit noch bevorsteht', () => {
    expect(computeNextRun({ frequency: 'daily', hour: 14, minute: 30 }, NOW)).toBe('2026-07-01T14:30:00.000Z');
  });
  it('wählt morgen, wenn die Uhrzeit schon vorbei ist', () => {
    expect(computeNextRun({ frequency: 'daily', hour: 9, minute: 0 }, NOW)).toBe('2026-07-02T09:00:00.000Z');
  });
  it('rollt bei exakt gleicher Zeit auf den nächsten Tag (strikt nach from)', () => {
    expect(computeNextRun({ frequency: 'daily', hour: 12, minute: 0 }, NOW)).toBe('2026-07-02T12:00:00.000Z');
  });
});

describe('computeNextRun — weekly', () => {
  it('nächster Montag (1) nach einem Mittwoch', () => {
    expect(computeNextRun({ frequency: 'weekly', hour: 8, minute: 0, weekday: 1 }, NOW)).toBe('2026-07-06T08:00:00.000Z');
  });
  it('gleicher Wochentag, Uhrzeit noch offen → heute', () => {
    expect(computeNextRun({ frequency: 'weekly', hour: 18, minute: 0, weekday: 3 }, NOW)).toBe('2026-07-01T18:00:00.000Z');
  });
  it('gleicher Wochentag, Uhrzeit vorbei → in 7 Tagen', () => {
    expect(computeNextRun({ frequency: 'weekly', hour: 6, minute: 0, weekday: 3 }, NOW)).toBe('2026-07-08T06:00:00.000Z');
  });
});

describe('computeNextRun — monthly', () => {
  it('späterer Tag im selben Monat', () => {
    expect(computeNextRun({ frequency: 'monthly', hour: 3, minute: 0, dayOfMonth: 15 }, NOW)).toBe('2026-07-15T03:00:00.000Z');
  });
  it('bereits vorbei → nächster Monat', () => {
    expect(computeNextRun({ frequency: 'monthly', hour: 3, minute: 0, dayOfMonth: 1 }, NOW)).toBe('2026-08-01T03:00:00.000Z');
  });
  it('Jahreswechsel (Dezember → Januar)', () => {
    const dec = Date.UTC(2026, 11, 20, 12, 0, 0, 0);
    expect(computeNextRun({ frequency: 'monthly', hour: 0, minute: 0, dayOfMonth: 5 }, dec)).toBe('2027-01-05T00:00:00.000Z');
  });
});

describe('validateSchedule', () => {
  it('akzeptiert gültige Specs', () => {
    expect(validateSchedule({ frequency: 'daily', hour: 0, minute: 0 }).ok).toBe(true);
    expect(validateSchedule({ frequency: 'weekly', hour: 23, minute: 59, weekday: 6 }).ok).toBe(true);
    expect(validateSchedule({ frequency: 'monthly', hour: 12, minute: 30, dayOfMonth: 28 }).ok).toBe(true);
  });
  it('lehnt ungültige Werte ab', () => {
    expect(validateSchedule({ frequency: 'daily', hour: 24, minute: 0 }).ok).toBe(false);
    expect(validateSchedule({ frequency: 'weekly', hour: 1, minute: 0, weekday: 7 }).ok).toBe(false);
    expect(validateSchedule({ frequency: 'monthly', hour: 1, minute: 0, dayOfMonth: 31 }).ok).toBe(false);
  });
});

describe('describeSchedule', () => {
  it('formatiert lesbar', () => {
    expect(describeSchedule({ frequency: 'daily', hour: 9, minute: 5 })).toBe('Täglich um 09:05 UTC');
    expect(describeSchedule({ frequency: 'weekly', hour: 8, minute: 0, weekday: 1 })).toBe('Wöchentlich, Montag um 08:00 UTC');
    expect(describeSchedule({ frequency: 'monthly', hour: 3, minute: 0, dayOfMonth: 15 })).toBe('Monatlich am 15. um 03:00 UTC');
  });
});
