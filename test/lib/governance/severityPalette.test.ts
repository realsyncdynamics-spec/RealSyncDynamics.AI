/**
 * Severity-palette contract tests.
 *
 * Locks the visual mapping after the tonality retune:
 *   CRITICAL → rot · HIGH → orange · MEDIUM → amber · LOW → neutral · INFO → blau
 *
 * Wenn diese Wahrnehmung kippt (z. B. weil jemand "medium" wieder auf
 * "sky" zurücksetzt und dadurch INFO + MEDIUM gleichaussehen), schlägt
 * dieser Test fest, was geändert wurde.
 */
import { describe, it, expect } from 'vitest';
import {
  SEVERITY_PALETTE,
  severityPillClass,
  severityLabel,
} from '../../../src/lib/governance/severityPalette';
import type { FindingSeverity } from '../../../src/types/governance/finding';

describe('SEVERITY_PALETTE', () => {
  const all: FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

  it('covers all five severities', () => {
    for (const s of all) {
      expect(SEVERITY_PALETTE[s]).toBeDefined();
      expect(SEVERITY_PALETTE[s].pill).toMatch(/border-/);
      expect(SEVERITY_PALETTE[s].pill).toMatch(/bg-/);
      expect(SEVERITY_PALETTE[s].pill).toMatch(/text-/);
    }
  });

  it('uses rose only for critical (single-alarm rule)', () => {
    expect(SEVERITY_PALETTE.critical.pill).toMatch(/rose/);
    for (const s of ['high', 'medium', 'low', 'info'] as const) {
      expect(SEVERITY_PALETTE[s].pill).not.toMatch(/rose/);
    }
  });

  it('uses orange for high (between red and amber)', () => {
    expect(SEVERITY_PALETTE.high.pill).toMatch(/orange/);
  });

  it('uses amber for medium', () => {
    expect(SEVERITY_PALETTE.medium.pill).toMatch(/amber/);
  });

  it('uses neutral titanium for low (no aggressive color)', () => {
    expect(SEVERITY_PALETTE.low.pill).toMatch(/titanium/);
  });

  it('uses sky for info (informational, not alarming)', () => {
    expect(SEVERITY_PALETTE.info.pill).toMatch(/sky/);
  });

  it('all labels are lowercase German', () => {
    expect(severityLabel('critical')).toBe('kritisch');
    expect(severityLabel('high')).toBe('hoch');
    expect(severityLabel('medium')).toBe('mittel');
    expect(severityLabel('low')).toBe('niedrig');
    expect(severityLabel('info')).toBe('hinweis');
  });

  it('severityPillClass returns the full pill string', () => {
    for (const s of all) {
      expect(severityPillClass(s)).toBe(SEVERITY_PALETTE[s].pill);
    }
  });

  it('higher severities have visually stronger colors (heuristic check)', () => {
    // Crude but useful: critical/high must NOT use the titanium neutral
    // palette — those are reserved for low.
    expect(SEVERITY_PALETTE.critical.pill).not.toMatch(/titanium/);
    expect(SEVERITY_PALETTE.high.pill).not.toMatch(/titanium/);
  });
});
