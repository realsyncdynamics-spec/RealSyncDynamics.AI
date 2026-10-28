/**
 * PR A2 — runAiTool fail-closed bei technischem Fehler der Altreservierung
 * (tenant_cost_ledger über cost_check_and_reserve).
 *
 * Vorher: "cost-cap reserve failed (proceeding)" → Anbieteraufruf ohne
 * Budgetprüfung. Jetzt: kein Anbieteraufruf, Fehlercode
 * BUDGET_RESERVATION_FAILED (503) — außer der Aufruf ist bereits über
 * bot_usage_* (opts.budget) reserviert.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const callProvider = vi.fn();
const reserveLlmBudget = vi.fn();
const settleLlmBudget = vi.fn(async () => ({ ledgerRowId: 1 }));

vi.mock('../../supabase/functions/_shared/providers.ts', () => {
  class ProviderError extends Error {
    code: string;
    constructor(message: string, code = 'PROVIDER_ERROR') { super(message); this.code = code; }
  }
  return { callProvider: (...a: unknown[]) => callProvider(...a), ProviderError };
});
vi.mock('../../supabase/functions/_shared/entitlements.ts', () => ({
  gateFeature: vi.fn(async () => undefined),
  EntitlementError: class extends Error { code = 'X'; },
}));
vi.mock('../../supabase/functions/_shared/providerCost.ts', () => ({
  NO_USAGE: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  providerCostUsd: (_p: string, _m: string, u: { input: number; output: number }) => (u.input + u.output) / 1000,
}));
vi.mock('../../supabase/functions/_shared/residencyGuard.ts', () => ({
  requireVerifiedAiResidency: () => 'cloud',
}));
vi.mock('../../supabase/functions/_shared/cost-cap.ts', () => {
  class CostCapError extends Error {
    capRemaining = 0; capUsed = 250; capTotal = 250;
  }
  return {
    reserveLlmBudget: (...a: unknown[]) => reserveLlmBudget(...a),
    settleLlmBudget: (...a: unknown[]) => settleLlmBudget(...(a as [])),
    CostCapError,
  };
});

// Laufzeit-Import (Deno-Specifier bleiben aus dem tsc-Programm), wie in botBudget.test.ts.
const AI_MODULE = '../../supabase/functions/_shared/ai.ts';
const COST_CAP_MODULE = '../../supabase/functions/_shared/cost-cap.ts';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunAiTool = (...args: any[]) => Promise<any>;
const runAiTool: RunAiTool = async (...args) =>
  ((await import(/* @vite-ignore */ AI_MODULE)) as { runAiTool: RunAiTool }).runAiTool(...args);

const tool = {
  id: 'tool1', key: 'vps_status', model_provider: 'anthropic', model_id: 'm', ollama_model_id: null,
  system_prompt: 'sys', max_tokens: 500, temperature: 0, required_entitlement_key: null, enabled: true,
};

function admin() {
  const inserts: Array<Record<string, unknown>> = [];
  const chain = {
    select: () => chain, eq: () => chain,
    maybeSingle: async () => ({ data: tool, error: null }),
    single: async () => ({ data: { id: 'run1' }, error: null }),
    insert: (row: Record<string, unknown>) => { inserts.push(row); return chain; },
    then: (r: (v: unknown) => unknown) => r({ data: null, error: null }),
  };
  return {
    inserts,
    from: () => chain,
    rpc: async (fn: string) => {
      if (fn === 'tenant_entitlements') return { data: [], error: null };
      if (fn === 'resolve_ai_residency') return { data: 'cloud', error: null };
      return { data: null, error: null };
    },
  };
}

function guard() {
  return {
    reserve: vi.fn(async () => 'res1'),
    settleMeasured: vi.fn(async () => undefined),
    settleUnknown: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
  };
}

const ok = { text: 'ok', inputTokens: 10, outputTokens: 20, cachedTokens: 0, pricedUsage: { input: 10, output: 20 } };

describe('runAiTool — Altreservierung fail-closed (PR A2)', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    callProvider.mockReset();
    reserveLlmBudget.mockReset();
    settleLlmBudget.mockClear();
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it.each([
    ['DB-Fehler', new Error('cost-cap reserve failed: connection refused')],
    ['Timeout', new Error('cost-cap reserve failed: canceling statement due to statement timeout')],
    ['leeres RPC-Ergebnis', new Error('cost-cap reserve: empty RPC result')],
  ])('%s ohne Bot-Budget → kein Anbieteraufruf, BUDGET_RESERVATION_FAILED', async (_l, err) => {
    reserveLlmBudget.mockRejectedValue(err);
    const a = admin();
    await expect(runAiTool(a as never, 't1', 'u1', 'vps_status', 'hi'))
      .rejects.toMatchObject({ code: 'BUDGET_RESERVATION_FAILED', status: 503 });
    expect(callProvider).toHaveBeenCalledTimes(0);
    // Nachvollziehbar: Fehlerzeile in ai_tool_runs + strukturierter Log.
    expect(a.inserts.some((r) => r.error_code === 'BUDGET_RESERVATION_FAILED')).toBe(true);
    const logged = errSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(logged).toContain('cost_cap_reserve_failed_blocked');
    // Keine Eingabe/Prompt-Inhalte im Log.
    expect(logged).not.toContain('"hi"');
  });

  it('mit bot_usage-Reservierung → Anbieteraufruf erfolgt, Protokolleintrag vorhanden', async () => {
    reserveLlmBudget.mockRejectedValue(new Error('cost-cap reserve failed: connection refused'));
    callProvider.mockResolvedValue(ok);
    const g = guard();
    const r = await runAiTool(admin() as never, 't1', null, 'bot_reply', 'hi', { budget: g });
    expect(r.output).toBe('ok');
    expect(callProvider).toHaveBeenCalledTimes(1);
    expect(g.settleMeasured).toHaveBeenCalledWith('res1', 0.03, expect.any(Object));
    const logged = errSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(logged).toContain('cost_cap_reserve_failed_bot_budget_covers');
  });

  it('fachliche Ablehnung (Deckel erreicht) bleibt COST_LIMIT_EXCEEDED ohne Anbieteraufruf', async () => {
    const { CostCapError } = await import(/* @vite-ignore */ COST_CAP_MODULE) as unknown as {
      CostCapError: new (m?: string) => Error;
    };
    reserveLlmBudget.mockRejectedValue(new CostCapError('cap'));
    await expect(runAiTool(admin() as never, 't1', 'u1', 'vps_status', 'hi'))
      .rejects.toMatchObject({ code: 'COST_LIMIT_EXCEEDED', status: 429 });
    expect(callProvider).not.toHaveBeenCalled();
  });

  it('erfolgreiche Reservierung (auch Mandant ohne eigene Deckelzeile → DB-Default) → unverändert', async () => {
    reserveLlmBudget.mockResolvedValue({ decision: 'allow', reservationId: 'rid1', capRemaining: 250, capUsed: 0, capTotal: 250 });
    callProvider.mockResolvedValue(ok);
    const r = await runAiTool(admin() as never, 't1', 'u1', 'vps_status', 'hi');
    expect(r.output).toBe('ok');
    expect(settleLlmBudget).toHaveBeenCalledTimes(1);
  });

  it('Quelltext: kein "proceeding"-Durchlauf mehr nach Reservierungsfehler', () => {
    const src = readFileSync('supabase/functions/_shared/ai.ts', 'utf8');
    expect(src).not.toContain('cost-cap reserve failed (proceeding)');
    expect(src).toContain("'BUDGET_RESERVATION_FAILED'");
  });
});
