// P4-impl-3 — Cap-Enforcement-Middleware vor LLM-Calls
// (docs/architecture/runtime-kernel-rfc.md §P4.3 + §6 P4-impl-3)
//
// Thin TS wrappers around two SECURITY DEFINER RPCs from
// 20260604000000_economic_intelligence.sql:
//
//   cost_check_and_reserve(tenant_id, cost_kind, units, unit_price, attribution)
//     → atomically: pre-checks the monthly cap, and (if allowed) inserts
//       a reservation row in tenant_cost_ledger that locks the budget
//       for 5 minutes. Race-safe under concurrent calls.
//
//   cost_writer_settle(reservation_id, cost_kind, units_actual, unit_price)
//     → updates the reservation row in-place with the actual consumed
//       units and flips it to settled=true. Idempotent-safe: throws if
//       the reservation was already settled or swept.
//
// Cancellation of an unreached reservation is intentionally NOT a hot
// path here — cost_sweep_expired_reservations clears them after 5min,
// which is well within the latency budget of any single LLM call.

type AdminClient = {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

export type CostDecision = 'allow' | 'warn' | 'throttle';

export class CostCapError extends Error {
  decision: 'throttle';
  capRemaining: number;
  capUsed: number;
  capTotal: number;
  constructor(args: { capRemaining: number; capUsed: number; capTotal: number }) {
    super(`cost cap reached (used ${args.capUsed} of ${args.capTotal} USD)`);
    this.decision = 'throttle';
    this.capRemaining = args.capRemaining;
    this.capUsed = args.capUsed;
    this.capTotal = args.capTotal;
  }
}

export interface ReservationAttribution {
  agentRef?: string | null;
  flowRef?: string | null;
  traceId?: string | null;
  causationEvent?: string | null;
}

export interface ReserveLlmBudgetArgs extends ReservationAttribution {
  tenantId: string;
  /** Combined estimated USD for the planned call (input + output). */
  estimatedUsd: number;
}

export interface ReserveResult {
  decision: CostDecision;
  /** null when decision === 'throttle' (no row inserted). */
  reservationId: string | null;
  capRemaining: number;
  capUsed: number;
  capTotal: number;
}

export async function reserveLlmBudget(
  admin: AdminClient,
  args: ReserveLlmBudgetArgs
): Promise<ReserveResult> {
  if (!args.agentRef && !args.flowRef && !args.traceId) {
    throw new Error(
      'cost-cap: attribution required — set at least one of agentRef, flowRef, traceId'
    );
  }
  if (args.estimatedUsd < 0) {
    throw new Error('cost-cap: estimatedUsd must be non-negative');
  }

  const attribution: Record<string, string> = {};
  if (args.agentRef) attribution.agent_ref = args.agentRef;
  if (args.flowRef) attribution.flow_ref = args.flowRef;
  if (args.traceId) attribution.trace_id = args.traceId;
  if (args.causationEvent) attribution.causation_event = args.causationEvent;

  const { data, error } = await admin.rpc('cost_check_and_reserve', {
    p_tenant_id: args.tenantId,
    p_cost_kind: 'llm_input',
    p_units_estimate: 1,
    p_unit_price_usd: args.estimatedUsd,
    p_attribution: attribution,
  });

  if (error) {
    throw new Error(`cost-cap reserve failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    throw new Error('cost-cap reserve: empty RPC result');
  }

  const r = row as {
    decision: CostDecision;
    reservation_id: string | null;
    cap_remaining: number | string;
    cap_used: number | string;
    cap_total: number | string;
  };

  const result: ReserveResult = {
    decision: r.decision,
    reservationId: r.reservation_id,
    capRemaining: Number(r.cap_remaining),
    capUsed: Number(r.cap_used),
    capTotal: Number(r.cap_total),
  };

  if (result.decision === 'throttle') {
    throw new CostCapError({
      capRemaining: result.capRemaining,
      capUsed: result.capUsed,
      capTotal: result.capTotal,
    });
  }

  return result;
}

export interface SettleLlmBudgetArgs {
  reservationId: string;
  /** Final cost dimension for the settled row. */
  costKind: 'llm_input' | 'llm_output';
  /** Actual consumed units (tokens, GB-hours, …). */
  unitsActual: number;
  /** USD per unit (e.g. blended USD per token). */
  unitPriceUsd: number;
}

export async function settleLlmBudget(
  admin: AdminClient,
  args: SettleLlmBudgetArgs
): Promise<{ ledgerRowId: number }> {
  if (args.unitsActual < 0 || args.unitPriceUsd < 0) {
    throw new Error('cost-cap settle: unitsActual and unitPriceUsd must be non-negative');
  }
  const { data, error } = await admin.rpc('cost_writer_settle', {
    p_reservation_id: args.reservationId,
    p_cost_kind: args.costKind,
    p_units_actual: args.unitsActual,
    p_unit_price_usd: args.unitPriceUsd,
  });
  if (error) {
    throw new Error(`cost-cap settle failed: ${error.message}`);
  }
  return { ledgerRowId: Number(data) };
}
