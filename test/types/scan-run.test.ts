/**
 * Pure-type contract tests for src/types/governance/scan-run.
 *
 * Pins the TS-side surface so a silent rename or status drop is caught.
 * DB lifecycle CHECK is covered by the migration apply in CI.
 */
import { describe, it, expect } from 'vitest';
import {
  TERMINAL_SCAN_RUN_STATUSES,
  SCAN_RUN_NEXT_STATUS,
  type NewScanRun,
  type ScanRun,
  type ScanRunStatus,
} from '../../src/types/governance/scan-run';

describe('ScanRun type contract', () => {
  it('TERMINAL_SCAN_RUN_STATUSES covers completed/failed/cancelled', () => {
    expect(TERMINAL_SCAN_RUN_STATUSES).toEqual(['completed', 'failed', 'cancelled']);
  });

  it('SCAN_RUN_NEXT_STATUS terminal states are dead-ends', () => {
    expect(SCAN_RUN_NEXT_STATUS.completed).toEqual([]);
    expect(SCAN_RUN_NEXT_STATUS.failed).toEqual([]);
    expect(SCAN_RUN_NEXT_STATUS.cancelled).toEqual([]);
  });

  it('SCAN_RUN_NEXT_STATUS queued can go to running or cancelled', () => {
    expect(SCAN_RUN_NEXT_STATUS.queued).toEqual(
      expect.arrayContaining(['running', 'cancelled']),
    );
    expect(SCAN_RUN_NEXT_STATUS.queued).not.toContain('completed');
    // Cancelled-from-queued is allowed (cleanup of orphan rows);
    // completed-from-queued is not — must run first.
  });

  it('SCAN_RUN_NEXT_STATUS running can reach all terminal states', () => {
    const r = SCAN_RUN_NEXT_STATUS.running;
    expect(r).toEqual(expect.arrayContaining(['completed', 'failed', 'cancelled']));
  });

  it('NewScanRun allows the minimal happy-path shape', () => {
    const n: NewScanRun = {
      tenant_id: 't',
      detector:  'gdpr-audit',
    };
    expect(n.tenant_id).toBe('t');
  });

  it('ScanRun includes the denormalized roll-up fields', () => {
    const r: ScanRun = {
      id:             's-1',
      tenant_id:      't-1',
      website_id:     'w-1',
      detector:       'gdpr-audit',
      status:         'completed',
      started_at:     '2026-05-25T13:00:00Z',
      completed_at:   '2026-05-25T13:00:30Z',
      duration_ms:    30000,
      finding_count:  5,
      severity_max:   'high',
      error_code:     null,
      error_message:  null,
      raw_payload:    null,
      correlation_id: 'corr-1',
      created_at:     '2026-05-25T13:00:00Z',
      updated_at:     '2026-05-25T13:00:30Z',
    };
    expect(r.finding_count).toBe(5);
    expect(r.severity_max).toBe('high');
  });
});

describe('Status exhaustiveness', () => {
  it('all five statuses representable in TS', () => {
    const all: ScanRunStatus[] = ['queued', 'running', 'completed', 'failed', 'cancelled'];
    expect(all.length).toBe(5);
  });
});
