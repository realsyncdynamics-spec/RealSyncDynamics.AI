/**
 * Enterprise Scheduler — Berechnung des nächsten Ausführungszeitpunkts.
 *
 * Pure, deterministisch, KEINE Side-Effects (kein Date.now — `from` wird
 * übergeben). Alle Zeiten in UTC. Deckt die Roadmap-Frequenzen ab:
 * täglich / wöchentlich / monatlich, jeweils zu einer festen Uhrzeit.
 * Dieselbe Logik läuft im Frontend (Vorschau „nächster Lauf") und in der
 * Dispatch-Funktion (fälligkeits-Berechnung) — Determinismus ist Vertrag.
 */

export type Frequency = 'daily' | 'weekly' | 'monthly';

export interface ScheduleSpec {
  frequency: Frequency;
  /** Stunde UTC 0–23. */
  hour: number;
  /** Minute 0–59. */
  minute: number;
  /** Wochentag 0–6 (So=0) — nur für 'weekly'. */
  weekday?: number;
  /** Tag im Monat 1–28 — nur für 'monthly' (auf 28 begrenzt, monatslängen-sicher). */
  dayOfMonth?: number;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validateSchedule(s: ScheduleSpec): ValidationResult {
  if (!['daily', 'weekly', 'monthly'].includes(s.frequency)) return { ok: false, error: 'ungültige Frequenz' };
  if (!Number.isInteger(s.hour) || s.hour < 0 || s.hour > 23) return { ok: false, error: 'Stunde muss 0–23 sein' };
  if (!Number.isInteger(s.minute) || s.minute < 0 || s.minute > 59) return { ok: false, error: 'Minute muss 0–59 sein' };
  if (s.frequency === 'weekly' && (!Number.isInteger(s.weekday) || (s.weekday as number) < 0 || (s.weekday as number) > 6)) {
    return { ok: false, error: 'Wochentag muss 0–6 sein' };
  }
  if (s.frequency === 'monthly' && (!Number.isInteger(s.dayOfMonth) || (s.dayOfMonth as number) < 1 || (s.dayOfMonth as number) > 28)) {
    return { ok: false, error: 'Tag im Monat muss 1–28 sein' };
  }
  return { ok: true };
}

/**
 * Nächster Ausführungszeitpunkt STRIKT nach `from` (ms seit Epoch oder Date).
 * Rückgabe: ISO-8601-UTC-String.
 */
export function computeNextRun(spec: ScheduleSpec, from: number | Date): string {
  const fromMs = typeof from === 'number' ? from : from.getTime();
  const base = new Date(fromMs);

  if (spec.frequency === 'daily') {
    let next = utc(base, spec.hour, spec.minute);
    if (next <= fromMs) next = addDaysUtc(next, 1);
    return new Date(next).toISOString();
  }

  if (spec.frequency === 'weekly') {
    const targetDow = spec.weekday ?? 0;
    let next = utc(base, spec.hour, spec.minute);
    const curDow = new Date(next).getUTCDay();
    let delta = (targetDow - curDow + 7) % 7;
    next = addDaysUtc(next, delta);
    if (next <= fromMs) next = addDaysUtc(next, 7);
    return new Date(next).toISOString();
  }

  // monthly
  const dom = spec.dayOfMonth ?? 1;
  let y = base.getUTCFullYear();
  let m = base.getUTCMonth();
  let next = Date.UTC(y, m, dom, spec.hour, spec.minute, 0, 0);
  if (next <= fromMs) {
    m += 1;
    if (m > 11) { m = 0; y += 1; }
    next = Date.UTC(y, m, dom, spec.hour, spec.minute, 0, 0);
  }
  return new Date(next).toISOString();
}

// ── intern ──────────────────────────────────────────────────────────────────
function utc(d: Date, hour: number, minute: number): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute, 0, 0);
}
function addDaysUtc(ms: number, days: number): number {
  return ms + days * 86400000;
}

/** Menschlich lesbare Beschreibung (für UI). */
export function describeSchedule(s: ScheduleSpec): string {
  const t = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')} UTC`;
  if (s.frequency === 'daily') return `Täglich um ${t}`;
  if (s.frequency === 'weekly') {
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    return `Wöchentlich, ${days[s.weekday ?? 0]} um ${t}`;
  }
  return `Monatlich am ${s.dayOfMonth ?? 1}. um ${t}`;
}
