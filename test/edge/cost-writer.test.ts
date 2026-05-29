/**
 * Vertragstests fuer den LLM-Cost-Writer (P4-impl-2, runtime-kernel-rfc.md §P4).
 *
 * Was hier bewiesen wird:
 *   - attribution-required: ohne agent_ref/flow_ref/trace_id → throws
 *     (matched die `cost_ledger_has_attribution` CHECK aus dem Schema)
 *   - simulated braucht replay_run_id (matched `cost_ledger_sim_has_run`)
 *   - keine negativen token-counts
 *   - leere Token-Buckets erzeugen KEINE Row (kein 0-Eintrag)
 *   - unit_price wird korrekt aus per-million-USD abgeleitet
 *   - genau zwei Rows bei input+output > 0 (llm_input + llm_output)
 *   - cost_kind matched die Schema-Whitelist
 *   - writeLlmCostEntries propagiert DB-Errors
 *
 * NICHT getestet (out-of-scope, in cost-ledger.db.test.ts):
 *   - amount_usd GENERATED-Spalte rechnet richtig
 *   - RLS-Verhalten gegen tenant_cost_ledger
 */
import { describe, it, expect, vi } from 'vitest';
import {
  buildLlmLedgerRows,
  writeLlmCostEntries,
  type LlmCostArgs,
} from '../../supabase/functions/_shared/cost-writer.ts';

const baseArgs: LlmCostArgs = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  agentRef: 'audit-summarize',
  inputTokens: 1500,
  outputTokens: 600,
  inputPricePerMillionUsd: 3.0,
  outputPricePerMillionUsd: 15.0,
  vendor: 'anthropic',
  modelRef: 'claude-sonnet-4-6',
};

describe('buildLlmLedgerRows', () => {
  it('rejects entries without any attribution', () => {
    expect(() =>
      buildLlmLedgerRows({ ...baseArgs, agentRef: null, flowRef: null, traceId: null }),
    ).toThrow(/attribution required/);
  });

  it('accepts flow_ref alone as attribution', () => {
    const rows = buildLlmLedgerRows({
      ...baseArgs,
      agentRef: null,
      flowRef: 'onboarding-v1',
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].agent_ref).toBeNull();
    expect(rows[0].flow_ref).toBe('onboarding-v1');
  });

  it('rejects simulated entries without replay_run_id', () => {
    expect(() =>
      buildLlmLedgerRows({ ...baseArgs, isSimulated: true }),
    ).toThrow(/replayRunId/);
  });

  it('accepts simulated entries with replay_run_id', () => {
    const rows = buildLlmLedgerRows({
      ...baseArgs,
      isSimulated: true,
      replayRunId: '22222222-2222-2222-2222-222222222222',
    });
    expect(rows[0].is_simulated).toBe(true);
    expect(rows[0].replay_run_id).toBe('22222222-2222-2222-2222-222222222222');
  });

  it('rejects negative token counts', () => {
    expect(() =>
      buildLlmLedgerRows({ ...baseArgs, inputTokens: -1 }),
    ).toThrow(/non-negative/);
    expect(() =>
      buildLlmLedgerRows({ ...baseArgs, outputTokens: -1 }),
    ).toThrow(/non-negative/);
  });

  it('emits no rows when both buckets are zero', () => {
    const rows = buildLlmLedgerRows({
      ...baseArgs,
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(rows).toEqual([]);
  });

  it('emits only the llm_input row when output is zero', () => {
    const rows = buildLlmLedgerRows({ ...baseArgs, outputTokens: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0].cost_kind).toBe('llm_input');
  });

  it('emits both rows in input,output order', () => {
    const rows = buildLlmLedgerRows(baseArgs);
    expect(rows).toHaveLength(2);
    expect(rows[0].cost_kind).toBe('llm_input');
    expect(rows[1].cost_kind).toBe('llm_output');
  });

  it('derives unit_price_usd from the per-million price (input)', () => {
    const rows = buildLlmLedgerRows(baseArgs);
    // 3.0 USD per 1_000_000 input tokens → 0.000003 per token
    expect(rows[0].unit_price_usd).toBeCloseTo(0.000003, 12);
    expect(rows[0].units).toBe(1500);
  });

  it('derives unit_price_usd from the per-million price (output)', () => {
    const rows = buildLlmLedgerRows(baseArgs);
    expect(rows[1].unit_price_usd).toBeCloseTo(0.000015, 12);
    expect(rows[1].units).toBe(600);
  });

  it('uses every cost_kind value that the schema whitelist allows for LLMs', () => {
    const kinds = buildLlmLedgerRows(baseArgs).map((r) => r.cost_kind);
    expect(new Set(kinds)).toEqual(new Set(['llm_input', 'llm_output']));
  });

  it('defaults vendor + model_ref + raw_metadata when omitted', () => {
    const rows = buildLlmLedgerRows({
      ...baseArgs,
      vendor: undefined,
      modelRef: undefined,
      rawMetadata: undefined,
    });
    expect(rows[0].vendor).toBeNull();
    expect(rows[0].model_ref).toBeNull();
    expect(rows[0].raw_metadata).toEqual({});
  });
});

describe('writeLlmCostEntries', () => {
  it('skips the DB call entirely when there are no rows to insert', async () => {
    const insert = vi.fn();
    const admin = { from: () => ({ insert }) };
    const result = await writeLlmCostEntries(admin as never, {
      ...baseArgs,
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(result.inserted).toBe(0);
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts both ledger rows into tenant_cost_ledger', async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn(() => ({ insert }));
    const admin = { from };

    const result = await writeLlmCostEntries(admin as never, baseArgs);

    expect(from).toHaveBeenCalledWith('tenant_cost_ledger');
    expect(insert).toHaveBeenCalledTimes(1);
    const rows = insert.mock.calls[0][0] as Array<{ cost_kind: string }>;
    expect(rows).toHaveLength(2);
    expect(result.inserted).toBe(2);
  });

  it('propagates DB errors as a thrown Error', async () => {
    const insert = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'check constraint cost_ledger_has_attribution' },
    });
    const admin = { from: () => ({ insert }) };
    await expect(writeLlmCostEntries(admin as never, baseArgs)).rejects.toThrow(
      /cost-writer insert failed/,
    );
  });
});
