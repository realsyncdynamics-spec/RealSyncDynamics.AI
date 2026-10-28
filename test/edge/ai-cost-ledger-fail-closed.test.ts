/**
 * PR A2 — runAiTool fail-closed bei technischem Reservierungsfehler im Altledger
 * (tenant_cost_ledger / cost_check_and_reserve).
 *
 * Auftrag A2 §3 Test 4: Reservierungsfehler bei mandantengebundenem Aufruf →
 *   kein Anbieteraufruf, Fehlercode BUDGET_RESERVATION_FAILED.
 * Auftrag A2 §3 Test 5: Aufruf mit bot_usage_*-Reservierung und
 *   fehlgeschlagener Alt-Reservierung → Anbieteraufruf erfolgt, Protokolleintrag.
 * Fachliche Ablehnung (Deckel erreicht) bleibt unverändert COST_LIMIT_EXCEEDED.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

// Laufzeit-Import (Deno-Specifier bleiben aus dem tsc-Programm, vgl. botBudget.test.ts).
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

function botGuard() {
  return {
    reserve: vi.fn(async () => 'bot-res-1'),
    settleMeasured: vi.fn(async () => undefined),
    settleUnknown: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
  };
}

const okResult = { text: 'ok', inputTokens: 10, outputTokens: 20, cachedTokens: 0, pricedUsage: { input: 10, output: 20 } };

describe('PR A2 — runAiTool fail-closed (Altledger)', () => {
  beforeEach(() => {
    callProvider.mockReset();
    reserveLlmBudget.mockReset();
    settleLlmBudget.mockClear();
  });

  it('Test 4: DB-Fehler bei der Reservierung → kein Anbieteraufruf, BUDGET_RESERVATION_FAILED', async () => {
    reserveLlmBudget.mockRejectedValue(new Error('cost-cap reserve failed: connection reset'));
    const a = admin();
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(runAiTool(a as never, 'tenant-1', 'user-1', 'vps_status', 'hi'))
      .rejects.toMatchObject({ code: 'BUDGET_RESERVATION_FAILED', status: 503 });

    expect(callProvider).toHaveBeenCalledTimes(0);
    // Sichtbar in ai_tool_runs und im Log — ohne Prompt oder Eingabe.
    expect(a.inserts).toContainEqual(expect.objectContaining({
      status: 'error', error_code: 'BUDGET_RESERVATION_FAILED', tenant_id: 'tenant-1',
    }));
    const logged = err.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('cost_cap_reserve_failed_blocked');
    expect(logged).not.toContain('hi');
    err.mockRestore();
  });

  it('Test 4b: Timeout / leeres RPC-Ergebnis → ebenfalls kein Anbieteraufruf', async () => {
    reserveLlmBudget.mockRejectedValue(new Error('cost-cap reserve: empty RPC result'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(runAiTool(admin() as never, 'tenant-1', null, 'vps_status', 'x'))
      .rejects.toMatchObject({ code: 'BUDGET_RESERVATION_FAILED' });
    expect(callProvider).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('Test 5: bot_usage_*-Reservierung vorhanden → Anbieteraufruf erfolgt, Altpfad protokolliert', async () => {
    reserveLlmBudget.mockRejectedValue(new Error('cost-cap reserve failed: timeout'));
    callProvider.mockResolvedValue(okResult);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const g = botGuard();

    const r = await runAiTool(admin() as never, 'tenant-1', null, 'bot_reply', 'hi', { budget: g });

    expect(r.output).toBe('ok');
    expect(callProvider).toHaveBeenCalledTimes(1);
    expect(g.reserve).toHaveBeenCalledTimes(1);
    expect(g.settleMeasured).toHaveBeenCalledWith('bot-res-1', 0.03, expect.any(Object));
    const logged = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('cost_cap_reserve_failed_bot_budget_covers');
    warn.mockRestore();
  });

  it('Bot-Budget-Option ohne tatsächliche Reservierung (0 USD) deckt den Altpfad nicht ab', async () => {
    reserveLlmBudget.mockRejectedValue(new Error('db down'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const g = { ...botGuard(), reserve: vi.fn(async () => null) };
    await expect(runAiTool(admin() as never, 'tenant-1', null, 'bot_reply', 'hi', { budget: g }))
      .rejects.toMatchObject({ code: 'BUDGET_RESERVATION_FAILED' });
    expect(callProvider).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('Fachliche Ablehnung bleibt unverändert: Deckel erreicht → COST_LIMIT_EXCEEDED, kein Anbieteraufruf', async () => {
    const { CostCapError } = await import(/* @vite-ignore */ COST_CAP_MODULE) as unknown as {
      CostCapError: new (m?: string) => Error;
    };
    reserveLlmBudget.mockRejectedValue(new CostCapError('cap'));
    await expect(runAiTool(admin() as never, 'tenant-1', null, 'vps_status', 'hi'))
      .rejects.toMatchObject({ code: 'COST_LIMIT_EXCEEDED', status: 429 });
    expect(callProvider).not.toHaveBeenCalled();
  });

  it('Reservierung erfolgreich → Verhalten wie vor A2 (Aufruf, Settle mit gemessenem Verbrauch)', async () => {
    reserveLlmBudget.mockResolvedValue({ decision: 'allow', reservationId: 'r1', capRemaining: 250, capUsed: 0, capTotal: 250 });
    callProvider.mockResolvedValue(okResult);
    const r = await runAiTool(admin() as never, 'tenant-1', null, 'vps_status', 'hi');
    expect(r.output).toBe('ok');
    expect(settleLlmBudget).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      reservationId: 'r1', unitsActual: 30,
    }));
  });
});
