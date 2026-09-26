/**
 * NIS2 Incident-/Melde-Fristen (Art. 23 NIS2 / § 32 BSIG-Familie).
 *
 * Pure Helfer für Dashboard-Binding. Kein BSI-Portal-Send, keine Edge-Transmission.
 * Fristen: Early Warning +24h, Notification +72h, Final Report +1 Kalendermonat.
 */

export type Nis2NotificationChannel = 'bsi_portal' | 'mip' | 'customer';

export const NIS2_NOTIFICATION_CHANNELS: readonly Nis2NotificationChannel[] = [
  'bsi_portal',
  'mip',
  'customer',
] as const;

export interface Nis2Deadlines {
  early_warning_due: Date;
  notification_due: Date;
  final_report_due: Date;
}

export interface Nis2IncidentNotification {
  id: string;
  tenant_id: string;
  detected_at: string;
  early_warning_due: string;
  notification_due: string;
  final_report_due: string;
  channel: Nis2NotificationChannel;
  customer_notified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function asDate(detectedAt: Date | string): Date {
  if (detectedAt instanceof Date) return new Date(detectedAt.getTime());
  const d = new Date(detectedAt);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`computeNis2Deadlines: invalid detectedAt ${String(detectedAt)}`);
  }
  return d;
}

/**
 * Berechnet die drei NIS2-Meldefristen aus dem Erkennungszeitpunkt.
 * +24h / +72h absolut; Final Report = Kalendermonat (+1 month), analog SQL
 * `detected_at + interval '1 month'` im BEFORE-Trigger.
 */
/** +1 calendar month, clamped like PostgreSQL `timestamptz + interval '1 month'`. */
function addOneCalendarMonthUtc(detected: Date): Date {
  const out = new Date(detected.getTime());
  const day = out.getUTCDate();
  out.setUTCMonth(out.getUTCMonth() + 1);
  // JS overflows Jan 31 → Mar 3; PG clamps to last day of February.
  if (out.getUTCDate() !== day) {
    out.setUTCDate(0);
  }
  return out;
}

export function computeNis2Deadlines(detectedAt: Date | string): Nis2Deadlines {
  const detected = asDate(detectedAt);
  const early_warning_due = new Date(detected.getTime() + 24 * 60 * 60 * 1000);
  const notification_due = new Date(detected.getTime() + 72 * 60 * 60 * 1000);
  const final_report_due = addOneCalendarMonthUtc(detected);
  return { early_warning_due, notification_due, final_report_due };
}

export function isNis2NotificationChannel(value: string): value is Nis2NotificationChannel {
  return (NIS2_NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}
