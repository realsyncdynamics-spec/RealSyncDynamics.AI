import { describe, expect, it } from 'vitest';
import type { BrowserExecutorError } from '../../src/features/governance/browser/browserExecutorClient';
import { consumedApprovalMessage } from '../../src/features/governance/browser/consumedApproval';

// Nur code/details zählen; die Klasse selbst zöge den Supabase-Client mit.
const err = (code: string, details?: unknown) =>
  ({ name: 'BrowserExecutorError', message: 'x', code, status: 500, details }) as BrowserExecutorError;

describe('consumedApprovalMessage', () => {
  it('meldet executed_unrecorded als möglicherweise ausgeführt mit manueller Prüfung', () => {
    const msg = consumedApprovalMessage(err('EVIDENCE_WRITE_FAILED', {
      execution_status: 'executed_unrecorded',
      action_executed: true,
    }));
    expect(msg).toContain('möglicherweise ausgeführt');
    expect(msg).toContain('manuell prüfen');
  });

  it('bereits verwendete und abgelaufene Freigaben verlangen eine neue Freigabe', () => {
    expect(consumedApprovalMessage(err('APPROVAL_ALREADY_USED'))).toContain('neue Freigabe');
    expect(consumedApprovalMessage(err('APPROVAL_EXPIRED'))).toContain('neue Freigabe');
  });

  it('Executor-Fehler nach Reservierung: Freigabe verbraucht, Ausgang unklar', () => {
    const msg = consumedApprovalMessage(err('EXECUTOR_TIMEOUT', { approval_consumed: true }));
    expect(msg).toContain('nicht feststellbar');
  });

  it('andere Fehler fallen auf die allgemeine Meldung zurück', () => {
    expect(consumedApprovalMessage(err('EXECUTOR_UNREACHABLE'))).toBeNull();
    expect(consumedApprovalMessage(err('APPROVAL_MISMATCH'))).toBeNull();
  });
});
