/**
 * NIS2 Incident-Notification Fristen und Kanäle.
 */
import { describe, expect, it } from 'vitest';
import {
  computeNis2Deadlines,
  isNis2NotificationChannel,
  NIS2_NOTIFICATION_CHANNELS,
} from '../../src/core/governance/nis2-incident';

describe('computeNis2Deadlines', () => {
  it('setzt Early Warning +24h, Notification +72h, Final Report +1 Monat', () => {
    const detected = new Date('2026-09-24T12:00:00.000Z');
    const d = computeNis2Deadlines(detected);
    expect(d.early_warning_due.toISOString()).toBe('2026-09-25T12:00:00.000Z');
    expect(d.notification_due.toISOString()).toBe('2026-09-27T12:00:00.000Z');
    expect(d.final_report_due.toISOString()).toBe('2026-10-24T12:00:00.000Z');
  });

  it('akzeptiert ISO-Strings und bewahrt Offset-Semantik in UTC', () => {
    const d = computeNis2Deadlines('2026-01-31T23:30:00.000Z');
    expect(d.early_warning_due.toISOString()).toBe('2026-02-01T23:30:00.000Z');
    expect(d.notification_due.toISOString()).toBe('2026-02-03T23:30:00.000Z');
    // +1 calendar month from Jan 31 → Feb 28 (JS setUTCMonth overflow rules)
    expect(d.final_report_due.toISOString()).toBe('2026-02-28T23:30:00.000Z');
  });
});

describe('NIS2 notification channels', () => {
  it('erlaubt nur bsi_portal, mip, customer', () => {
    expect([...NIS2_NOTIFICATION_CHANNELS]).toEqual(['bsi_portal', 'mip', 'customer']);
    expect(isNis2NotificationChannel('bsi_portal')).toBe(true);
    expect(isNis2NotificationChannel('mip')).toBe(true);
    expect(isNis2NotificationChannel('customer')).toBe(true);
    expect(isNis2NotificationChannel('email')).toBe(false);
  });
});
