/**
 * Workspace-Freigaben (API): Fehler bleiben unterscheidbar (nicht eingerichtet ≠
 * Rechte-/Fundfehler), nur Zeilen des aktiven Mandanten, nur gültige Antworten.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  decideWorkspaceApproval,
  isWorkspaceApprovalExpired,
  listWorkspaceApprovals,
  type WorkspaceApproval,
} from '../../../src/features/governance/workspaceApprovalsApi';

const FUTURE = new Date(Date.now() + 3_600_000).toISOString();
const PAST = new Date(Date.now() - 3_600_000).toISOString();

function approval(overrides: Partial<WorkspaceApproval> = {}): WorkspaceApproval {
  return {
    id: 'a1',
    tenant_id: 't1',
    agent_id: 'RSD-02',
    action_type: 'send_email',
    target_resource: 'thread-42',
    payload_hash: 'b'.repeat(64),
    status: 'PENDING',
    requested_at: '2026-11-22T09:00:00Z',
    expires_at: FUTURE,
    decided_by: null,
    decided_at: null,
    execution_id: null,
    executed_at: null,
    ...overrides,
  };
}

function httpError(status: number, body?: unknown) {
  return {
    message: 'Edge Function returned a non-2xx status code',
    context: { status, json: async () => { if (body === undefined) throw new Error('no json'); return body; } },
  };
}

describe('workspaceApprovalsApi', () => {
  it('sendet op/list mit Mandant und Status an workspace-approvals', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true, approvals: [approval()] }, error: null });
    const r = await listWorkspaceApprovals('t1', 'PENDING', invoke);
    expect(invoke).toHaveBeenCalledWith({ op: 'list', tenant_id: 't1', status: 'PENDING' });
    expect(r).toEqual({ ok: true, approvals: [approval()] });
  });

  it('filtert Zeilen anderer Mandanten heraus', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { ok: true, approvals: [approval(), approval({ id: 'a2', tenant_id: 't2' })] },
      error: null,
    });
    const r = await listWorkspaceApprovals('t1', 'PENDING', invoke);
    expect(r.ok && r.approvals.map((a) => a.id)).toEqual(['a1']);
  });

  it('404 ohne Fehlercode heißt „nicht eingerichtet“', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: httpError(404) });
    expect(await listWorkspaceApprovals('t1', 'PENDING', invoke)).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('404 mit APPROVAL_NOT_FOUND ist ein Rechte-/Fundfehler, kein „nicht eingerichtet“', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: httpError(404, { ok: false, error: { code: 'APPROVAL_NOT_FOUND', message: 'x' } }),
    });
    const r = await decideWorkspaceApproval('a1', true, invoke);
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === 'error') {
      expect(r.error.code).toBe('APPROVAL_NOT_FOUND');
      expect(r.error.message).toMatch(/Owner und Admins/);
    } else {
      throw new Error('erwartet: Fehler mit Code');
    }
  });

  it('übergibt approve/reject und akzeptiert nur APPROVED/REJECTED', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true, status: 'REJECTED' }, error: null });
    expect(await decideWorkspaceApproval('a1', false, invoke)).toEqual({ ok: true, status: 'REJECTED' });
    expect(invoke).toHaveBeenCalledWith({ op: 'reject', approval_id: 'a1' });
    invoke.mockResolvedValueOnce({ data: { ok: true, status: 'EXECUTED' }, error: null });
    expect((await decideWorkspaceApproval('a1', true, invoke)).ok).toBe(false);
  });

  it('erkennt abgelaufene Fristen', () => {
    expect(isWorkspaceApprovalExpired({ expires_at: PAST })).toBe(true);
    expect(isWorkspaceApprovalExpired({ expires_at: FUTURE })).toBe(false);
  });
});

