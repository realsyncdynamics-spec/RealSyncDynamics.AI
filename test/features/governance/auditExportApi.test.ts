/**
 * auditExportApi — pure-logic tests for the helpers used by AuditExportView.
 * The Edge-Function wrapper (exportAnalytics) is a network pass-through.
 */
import { describe, expect, it } from 'vitest';
import {
  isoDaysAgo,
  defaultRange,
  buildExportFilename,
} from '@/src/features/governance/audit/auditExportApi';

describe('auditExportApi / isoDaysAgo', () => {
  it('returns an ISO yyyy-mm-dd string', () => {
    expect(isoDaysAgo(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('subtracts the requested number of days', () => {
    const from = new Date('2026-06-18T12:00:00Z');
    expect(isoDaysAgo(7, from)).toBe('2026-06-11');
  });
});

describe('auditExportApi / defaultRange', () => {
  it('spans a 90-day window ending today', () => {
    const r = defaultRange();
    expect(r.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const days = (new Date(r.end).getTime() - new Date(r.start).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(90);
  });
});

describe('auditExportApi / buildExportFilename', () => {
  it('builds a sanitised filename with range and extension', () => {
    expect(buildExportFilename('DSGVO 360° Audit Q2', 'pdf', { start: '2026-04-01', end: '2026-06-30' })).toBe(
      'dsgvo-360-audit-q2_2026-04-01_2026-06-30.pdf',
    );
  });

  it('uses the csv extension for csv exports', () => {
    expect(buildExportFilename('Evidence', 'csv', { start: '2026-01-01', end: '2026-01-31' })).toBe(
      'evidence_2026-01-01_2026-01-31.csv',
    );
  });
});
