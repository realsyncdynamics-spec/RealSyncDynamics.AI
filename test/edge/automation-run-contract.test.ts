import { describe, expect, it } from 'vitest';
import { isTerminalRun, parseAuditRunResult } from '../../src/features/automations/automationRunContract';

const valid = {
  audit_id: 'audit-1', domain: 'example.de', score: 78, severity: 'medium', coverage: 'limited',
  issues: [{ id: 'issue-1', severity: 'medium', title: 'Hinweis', detail: 'Prüfung' }],
};

describe('Phase 3 — asynchronous automation result contract', () => {
  it('treats queued/running as pending, not as completed', () => {
    expect(isTerminalRun('queued')).toBe(false);
    expect(isTerminalRun('running')).toBe(false);
    for (const status of ['success', 'error', 'timeout', 'cancelled']) expect(isTerminalRun(status)).toBe(true);
  });
  it('accepts a valid persisted audit result', () => {
    expect(parseAuditRunResult(valid)).toMatchObject(valid);
  });
  it('does not fabricate a result from the trigger acknowledgment', () => {
    expect(parseAuditRunResult({ ok: true, run_id: 'run-1', n8n_execution_id: 'n8n-1' })).toBeNull();
  });
  it('rejects incomplete, malformed and non-finite results', () => {
    for (const result of [null, undefined, {}, { ...valid, issues: null },
      { ...valid, score: NaN }, { ...valid, score: 120 },
      { ...valid, issues: [{ ...valid.issues[0], severity: 'unsafe' }] }]) {
      expect(parseAuditRunResult(result)).toBeNull();
    }
  });
});
