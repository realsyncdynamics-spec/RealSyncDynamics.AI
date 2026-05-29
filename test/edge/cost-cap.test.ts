/**
 * Vertragstests fuer die Cap-Enforcement-Middleware (P4-impl-3,
 * runtime-kernel-rfc.md §P4.3).
 *
 * Was hier bewiesen wird:
 *   - reserve: attribution-required, negative-Estimate-Guard
 *   - reserve: 'allow' und 'warn' geben reservation_id durch
 *   - reserve: 'throttle' wirft CostCapError mit cap_used/cap_total
 *   - reserve: RPC-Errors werden mit Kontext propagiert
 *   - settle: negative-Werte-Guard
 *   - settle: gibt ledger row id zurueck, ruft cost_writer_settle korrekt
 *   - settle: RPC-Errors werden propagiert (already-settled / swept)
 *
 * NICHT getestet (out-of-scope — DB-Integration):
 *   - dass cost_check_and_reserve atomar ist gegen parallele Calls
 *   - cost_sweep_expired_reservations Verhalten
 *   - dass die Reservation den SUM in der naechsten reserve-call beruecksichtigt
 */
import { describe, it, expect, vi } from 'vitest';
import {
  reserveLlmBudget,
  settleLlmBudget,
  CostCapError,
  type ReserveLlmBudgetArgs,
} from '../../supabase/functions/_shared/cost-cap.ts';

const baseArgs: ReserveLlmBudgetArgs = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  agentRef: 'audit-summarize',
  estimatedUsd: 0.045,
};

function rpcMock(response: { data: unknown; error: { message: string } | null }) {
  return vi.fn().mockResolvedValue(response);
}

describe('reserveLlmBudget', () => {
  it('rejects calls without any attribution', async () => {
    const admin = { rpc: rpcMock({ data: null, error: null }) };
    await expect(
      reserveLlmBudget(admin, { ...baseArgs, agentRef: null }),
    ).rejects.toThrow(/attribution required/);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('rejects negative estimatedUsd', async () => {
    const admin = { rpc: rpcMock({ data: null, error: null }) };
    await expect(
      reserveLlmBudget(admin, { ...baseArgs, estimatedUsd: -0.01 }),
    ).rejects.toThrow(/non-negative/);
  });

  it('passes through "allow" decisions and surfaces reservation_id', async () => {
    const rpc = rpcMock({
      data: [{
        decision: 'allow',
        reservation_id: 'aaaa-bbbb',
        cap_remaining: '249.95',
        cap_used: '0.05',
        cap_total: '250.00',
      }],
      error: null,
    });
    const result = await reserveLlmBudget({ rpc }, baseArgs);
    expect(result.decision).toBe('allow');
    expect(result.reservationId).toBe('aaaa-bbbb');
    expect(result.capRemaining).toBe(249.95);
    expect(rpc).toHaveBeenCalledWith('cost_check_and_reserve', {
      p_tenant_id: baseArgs.tenantId,
      p_cost_kind: 'llm_input',
      p_units_estimate: 1,
      p_unit_price_usd: 0.045,
      p_attribution: { agent_ref: 'audit-summarize' },
    });
  });

  it('passes through "warn" decisions without throwing', async () => {
    const rpc = rpcMock({
      data: [{
        decision: 'warn',
        reservation_id: 'cccc-dddd',
        cap_remaining: '40',
        cap_used: '210',
        cap_total: '250',
      }],
      error: null,
    });
    const result = await reserveLlmBudget({ rpc }, baseArgs);
    expect(result.decision).toBe('warn');
    expect(result.reservationId).toBe('cccc-dddd');
  });

  it('throws CostCapError on "throttle" with cap numbers', async () => {
    const rpc = rpcMock({
      data: [{
        decision: 'throttle',
        reservation_id: null,
        cap_remaining: '0.20',
        cap_used: '249.80',
        cap_total: '250.00',
      }],
      error: null,
    });
    try {
      await reserveLlmBudget({ rpc }, baseArgs);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CostCapError);
      const cap = e as CostCapError;
      expect(cap.decision).toBe('throttle');
      expect(cap.capUsed).toBe(249.8);
      expect(cap.capTotal).toBe(250);
      expect(cap.capRemaining).toBe(0.2);
    }
  });

  it('serialises all attribution keys that are set', async () => {
    const rpc = rpcMock({
      data: [{ decision: 'allow', reservation_id: 'x', cap_remaining: '1', cap_used: '0', cap_total: '1' }],
      error: null,
    });
    await reserveLlmBudget({ rpc }, {
      ...baseArgs,
      flowRef: 'onboarding-v1',
      traceId: '22222222-2222-2222-2222-222222222222',
      causationEvent: '33333333-3333-3333-3333-333333333333',
    });
    expect(rpc.mock.calls[0][1].p_attribution).toEqual({
      agent_ref: 'audit-summarize',
      flow_ref: 'onboarding-v1',
      trace_id: '22222222-2222-2222-2222-222222222222',
      causation_event: '33333333-3333-3333-3333-333333333333',
    });
  });

  it('propagates RPC errors with prefixed context', async () => {
    const rpc = rpcMock({ data: null, error: { message: 'forbidden' } });
    await expect(reserveLlmBudget({ rpc }, baseArgs)).rejects.toThrow(
      /cost-cap reserve failed: forbidden/,
    );
  });

  it('throws on empty RPC results', async () => {
    const rpc = rpcMock({ data: null, error: null });
    await expect(reserveLlmBudget({ rpc }, baseArgs)).rejects.toThrow(
      /empty RPC result/,
    );
  });
});

describe('settleLlmBudget', () => {
  const settleArgs = {
    reservationId: 'aaaa-bbbb',
    costKind: 'llm_input' as const,
    unitsActual: 2100,
    unitPriceUsd: 0.000005,
  };

  it('rejects negative actuals', async () => {
    const admin = { rpc: rpcMock({ data: null, error: null }) };
    await expect(
      settleLlmBudget(admin, { ...settleArgs, unitsActual: -1 }),
    ).rejects.toThrow(/non-negative/);
    await expect(
      settleLlmBudget(admin, { ...settleArgs, unitPriceUsd: -1 }),
    ).rejects.toThrow(/non-negative/);
  });

  it('calls cost_writer_settle with the correct shape', async () => {
    const rpc = rpcMock({ data: 4242, error: null });
    const result = await settleLlmBudget({ rpc }, settleArgs);
    expect(rpc).toHaveBeenCalledWith('cost_writer_settle', {
      p_reservation_id: 'aaaa-bbbb',
      p_cost_kind: 'llm_input',
      p_units_actual: 2100,
      p_unit_price_usd: 0.000005,
    });
    expect(result.ledgerRowId).toBe(4242);
  });

  it('propagates RPC errors (e.g. already-settled, swept)', async () => {
    const rpc = rpcMock({
      data: null,
      error: { message: 'reservation aaaa-bbbb not found or already settled' },
    });
    await expect(settleLlmBudget({ rpc }, settleArgs)).rejects.toThrow(
      /cost-cap settle failed: reservation .* not found or already settled/,
    );
  });
});
