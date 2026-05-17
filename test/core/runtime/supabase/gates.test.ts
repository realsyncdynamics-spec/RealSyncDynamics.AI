import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseApprovalGateService } from '../../../../src/core/runtime/supabase';

interface GateRowFixture {
  id: string;
  execution_id: string;
  reason: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  requested_action: string;
  status: 'pending' | 'granted' | 'denied' | 'expired';
  created_at: string;
  decided_at: string | null;
}

const sampleRow: GateRowFixture = {
  id: 'gate-1',
  execution_id: 'exec-1',
  reason: 'Skill "shopify.consent_inject" requested',
  risk_level: 'medium',
  requested_action: 'shopify.consent_inject',
  status: 'pending',
  created_at: '2026-05-14T00:00:00.000Z',
  decided_at: null,
};

// -------- Mock helpers ------------------------------------------------------

function insertChain(result: { data: GateRowFixture | null; error: { message: string } | null }) {
  const single = vi.fn(() => Promise.resolve(result));
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  return { insert, select, single };
}

function selectChain(result: { data: GateRowFixture | null; error: { message: string } | null }) {
  const maybeSingle = vi.fn(() => Promise.resolve(result));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, maybeSingle };
}

function updateChain(result: {
  data: GateRowFixture[] | null;
  error: { message: string } | null;
}) {
  const select = vi.fn(() => Promise.resolve(result));
  const eqStatus = vi.fn((_col: string, _val: unknown) => ({ select }));
  const eqId = vi.fn((_col: string, _val: unknown) => ({ eq: eqStatus }));
  const update = vi.fn((_patch: Record<string, unknown>) => ({ eq: eqId }));
  return { update, eqId, eqStatus, select };
}

// -------- Tests -------------------------------------------------------------

describe('SupabaseApprovalGateService.open', () => {
  it('inserts a pending gate and returns the row', async () => {
    const ins = insertChain({ data: sampleRow, error: null });
    const sb = {
      from: vi.fn((t: string) => {
        expect(t).toBe('runtime_approval_gates');
        return { insert: ins.insert };
      }),
    } as unknown as SupabaseClient;

    const svc = new SupabaseApprovalGateService(sb);
    const row = await svc.open({
      execution_id: 'exec-1',
      reason: 'Skill "shopify.consent_inject" requested',
      risk_level: 'medium',
      requested_action: 'shopify.consent_inject',
    });

    expect(ins.insert).toHaveBeenCalledWith({
      execution_id: 'exec-1',
      reason: 'Skill "shopify.consent_inject" requested',
      risk_level: 'medium',
      requested_action: 'shopify.consent_inject',
      status: 'pending',
    });
    expect(row.id).toBe('gate-1');
    expect(row.status).toBe('pending');
    expect(row.decided_at).toBeUndefined();
  });

  it('throws when insert fails', async () => {
    const ins = insertChain({ data: null, error: { message: 'fk_violation' } });
    const sb = { from: () => ({ insert: ins.insert }) } as unknown as SupabaseClient;
    const svc = new SupabaseApprovalGateService(sb);

    await expect(
      svc.open({
        execution_id: 'exec-1',
        reason: 'r',
        risk_level: 'low',
        requested_action: 'a',
      }),
    ).rejects.toThrow(/fk_violation/);
  });
});

describe('SupabaseApprovalGateService.get', () => {
  it('returns the mapped row when found', async () => {
    const sel = selectChain({ data: sampleRow, error: null });
    const sb = { from: () => ({ select: sel.select }) } as unknown as SupabaseClient;
    const svc = new SupabaseApprovalGateService(sb);

    const row = await svc.get('gate-1');
    expect(row?.id).toBe('gate-1');
    expect(sel.eq).toHaveBeenCalledWith('id', 'gate-1');
  });

  it('returns undefined when not found', async () => {
    const sel = selectChain({ data: null, error: null });
    const sb = { from: () => ({ select: sel.select }) } as unknown as SupabaseClient;
    const svc = new SupabaseApprovalGateService(sb);

    await expect(svc.get('nope')).resolves.toBeUndefined();
  });
});

describe('SupabaseApprovalGateService.decide', () => {
  it('updates only pending rows and returns the row on success', async () => {
    const decided: GateRowFixture = {
      ...sampleRow,
      status: 'granted',
      decided_at: '2026-05-14T00:01:00.000Z',
    };
    const upd = updateChain({ data: [decided], error: null });
    const sb = { from: () => ({ update: upd.update }) } as unknown as SupabaseClient;
    const svc = new SupabaseApprovalGateService(sb);

    const row = await svc.decide({
      id: 'gate-1',
      status: 'granted',
      decided_by: 'user-42',
    });

    const updatePayload = upd.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updatePayload).toMatchObject({ status: 'granted', decided_by: 'user-42' });
    expect(typeof updatePayload.decided_at).toBe('string');
    expect(upd.eqId).toHaveBeenCalledWith('id', 'gate-1');
    expect(upd.eqStatus).toHaveBeenCalledWith('status', 'pending');
    expect(row.status).toBe('granted');
  });

  it('throws when the conditional update affects no rows (already decided / race)', async () => {
    const upd = updateChain({ data: [], error: null });
    const sb = { from: () => ({ update: upd.update }) } as unknown as SupabaseClient;
    const svc = new SupabaseApprovalGateService(sb);

    await expect(
      svc.decide({ id: 'gate-1', status: 'denied' }),
    ).rejects.toThrow(/not pending/);
  });

  it('omits decided_by when caller does not provide it', async () => {
    const upd = updateChain({
      data: [{ ...sampleRow, status: 'denied', decided_at: 't' }],
      error: null,
    });
    const sb = { from: () => ({ update: upd.update }) } as unknown as SupabaseClient;
    const svc = new SupabaseApprovalGateService(sb);

    await svc.decide({ id: 'gate-1', status: 'denied' });

    const payload = upd.update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('decided_by');
  });
});
