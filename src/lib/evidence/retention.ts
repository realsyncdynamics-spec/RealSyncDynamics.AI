/**
 * Evidence Vault Advanced — Retention-Logik (Aufbewahrungsrichtlinien).
 *
 * Pure, deterministisch, KEINE Side-Effects (kein Date.now — `from`/`now`
 * werden übergeben). Bildet die vorhandenen Retention-Klassen ab
 * (runtime_events / subject_ref_mappings) und berechnet daraus den
 * Aufbewahrungs-Endzeitpunkt bzw. ob ein Snapshot löschbar ist. Ein aktiver
 * Legal-Hold überschreibt jede Retention (nie löschbar, solange gehalten).
 */

export type RetentionClass = 'forever' | '7y' | '3y' | '1y' | '90d' | '30d' | '7d' | 'ephemeral';

export const RETENTION_CLASSES: RetentionClass[] = ['forever', '7y', '3y', '1y', '90d', '30d', '7d', 'ephemeral'];

const DAY_MS = 86400000;
// Kalenderjahr = 365 Tage (deterministische Näherung, spec-konform zu den
// bestehenden Retention-Klassen; keine Schaltjahr-Sonderfälle).
const DURATION_DAYS: Record<Exclude<RetentionClass, 'forever' | 'ephemeral'>, number> = {
  '7y': 7 * 365,
  '3y': 3 * 365,
  '1y': 365,
  '90d': 90,
  '30d': 30,
  '7d': 7,
};

/**
 * Aufbewahrung-bis als ISO-8601-UTC-String, oder null bei 'forever'.
 * 'ephemeral' → sofort abgelaufen (retained_until == from).
 */
export function retainedUntil(cls: RetentionClass, fromMs: number): string | null {
  if (cls === 'forever') return null;
  if (cls === 'ephemeral') return new Date(fromMs).toISOString();
  return new Date(fromMs + DURATION_DAYS[cls] * DAY_MS).toISOString();
}

/**
 * Ist ein Snapshot löschbar (Retention abgelaufen)? Legal-Hold hat Vorrang.
 * - legalHold aktiv → immer false (nie löschbar).
 * - retainedUntil null ('forever') → immer false.
 * - sonst: now > retained_until.
 */
export function isExpired(retainedUntilIso: string | null, nowMs: number, legalHold: boolean): boolean {
  if (legalHold) return false;
  if (retainedUntilIso === null) return false;
  return nowMs > Date.parse(retainedUntilIso);
}

/** Menschlich lesbare Beschreibung (für UI). */
export function describeRetention(cls: RetentionClass): string {
  switch (cls) {
    case 'forever': return 'Unbegrenzt';
    case '7y': return '7 Jahre';
    case '3y': return '3 Jahre';
    case '1y': return '1 Jahr';
    case '90d': return '90 Tage';
    case '30d': return '30 Tage';
    case '7d': return '7 Tage';
    case 'ephemeral': return 'Flüchtig (keine Aufbewahrung)';
  }
}

export function isRetentionClass(v: unknown): v is RetentionClass {
  return typeof v === 'string' && (RETENTION_CLASSES as string[]).includes(v);
}
