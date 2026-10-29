/**
 * PR A2 — runAiTool fail-closed bei technischem Reservierungsfehler im
 * Altledger (tenant_cost_ledger / cost_check_and_reserve).
 *
 * Abnahme 29 (Teil A2): Reservierungsfehler → kein Anbieteraufruf.
 * Ausnahme Auftrag 0b Pkt. 2: Ist der Aufruf bereits über bot_usage_*
 * reserviert, blockiert der Altpfad nicht zusätzlich, protokolliert aber.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const callProvider = vi.fn();
const reserveLlmBudget = vi.fn();

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
    capUsed = 10; capTotal = 10; capRemaining = 0;
  }
  return {
    reserveLlmBudget: (...a: unknown[]) => reserveLlmBudget(...a),
    settleLlmBudget: vi.fn(async () => ({ ledgerRowId: 1 })),
    CostCapError,
  };
});

// Laufzeit-Import über Pfad-Variable (Hausregel: ai.ts zieht jsr:/npm:-Specifier).
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

const tables: string[] = [];
const inserts: Array<Record<string, unknown>> = [];

function admin() {
  const chain = {
    select: () => chain, eq: () => chain,
    maybeSingle: async () => ({ data: tool, error: null }),
    single: async () => ({ data: { id: 'run1' }, error: null }),
    insert: (row: Record<string, unknown>) => { inserts.push(row); return chain; },
    then: (r: (v: unknown) => unknown) => r({ data: null, error: null }),
  };
  return {
    from: (t: string) => { tables.push(t); return chain; },
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

const okProvider = { text: 'ok', inputTokens: 10, outputTokens: 20, cachedTokens: 0, pricedUsage: { input: 10, output: 20 } };

describe('PR A2 — runAiTool fail-closed (Altledger)', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    callProvider.mockReset();
    reserveLlmBudget.mockReset();
    tables.length = 0;
    inserts.length = 0;
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => { errSpy.mockRestore(); warnSpy.mockRestore(); });

  it('DB-Fehler bei der Reservierung → COST_CAP_UNAVAILABLE, kein Anbieteraufruf', async () => {
    reserveLlmBudget.mockRejectedValue(new Error('cost-cap reserve failed: connection reset'));
    await expect(runAiTool(admin() as never, 't1', 'u1', 'vps_status', 'hi'))
      .rejects.toMatchObject({ code: 'COST_CAP_UNAVAILABLE', status: 503 });
    expect(callProvider).toHaveBeenCalledTimes(0);
    expect(errSpy.mock.calls.some((c: unknown[]) => String(c[0]).includes('cost_cap_reserve_unavailable'))).toBe(true);
    // Nachvollziehbar: Fehlerlauf in ai_tool_runs.
    expect(tables).toContain('ai_tool_runs');
    expect(inserts.some((r) => r.error_code === 'COST_CAP_UNAVAILABLE')).toBe(true);
  });

  it('Timeout/leeres RPC-Ergebnis → ebenfalls kein Anbieteraufruf', async () => {
    reserveLlmBudget.mockRejectedValue(new Error('cost-cap reserve: empty RPC result'));
    await expect(runAiTool(admin() as never, 't1', 'u1', 'vps_status', 'hi'))
      .rejects.toMatchObject({ code: 'COST_CAP_UNAVAILABLE' });
    expect(callProvider).toHaveBeenCalledTimes(0);
  });

  it('Log enthält weder Prompt noch Eingabe', async () => {
    reserveLlmBudget.mockRejectedValue(new Error('cost-cap reserve failed: x'));
    await expect(runAiTool(admin() as never, 't1', 'u1', 'vps_status', 'GEHEIMER-KUNDENTEXT'))
      .rejects.toBeTruthy();
    const logged = JSON.stringify(errSpy.mock.calls);
    expect(logged).not.toContain('GEHEIMER-KUNDENTEXT');
    expect(logged).not.toContain('sys');
  });

  it('bot_usage_*-Reservierung vorhanden → kein Anbieteraufruf, Bot-Reservierung freigegeben (#2051)', async () => {
    reserveLlmBudget.mockRejectedValue(new Error('cost-cap reserve failed: connection reset'));
    callProvider.mockResolvedValue(okProvider);
    const g = botGuard();
    await expect(runAiTool(admin() as never, 't1', null, 'vps_status', 'hi', { budget: g }))
      .rejects.toMatchObject({ code: 'COST_CAP_UNAVAILABLE', status: 503 });
    expect(callProvider).toHaveBeenCalledTimes(0);
    expect(g.release).toHaveBeenCalledTimes(1);
    expect(g.settleMeasured).toHaveBeenCalledTimes(0);
  });

  it('fachliche Deckel-Ablehnung bleibt COST_LIMIT_EXCEEDED (unverändert)', async () => {
    const { CostCapError } = (await import(/* @vite-ignore */ COST_CAP_MODULE)) as {
      CostCapError: new (m: string) => Error;
    };
    reserveLlmBudget.mockRejectedValue(new CostCapError('cap'));
    await expect(runAiTool(admin() as never, 't1', 'u1', 'vps_status', 'hi'))
      .rejects.toMatchObject({ code: 'COST_LIMIT_EXCEEDED', status: 429 });
    expect(callProvider).toHaveBeenCalledTimes(0);
  });

  it('erfolgreiche Reservierung → Anbieteraufruf wie bisher', async () => {
    reserveLlmBudget.mockResolvedValue({ decision: 'allow', reservationId: 'r1' });
    callProvider.mockResolvedValue(okProvider);
    const r = await runAiTool(admin() as never, 't1', 'u1', 'vps_status', 'hi');
    expect(r.output).toBe('ok');
    expect(callProvider).toHaveBeenCalledTimes(1);
  });
});
