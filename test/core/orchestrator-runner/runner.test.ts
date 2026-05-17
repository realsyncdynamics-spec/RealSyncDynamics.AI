// OrchestratorRunner — unit tests.
//
// Uses STUB agents (not the real classes) so this PR remains
// independent of #306 / #309 / #311. The stubs match the structural
// interfaces (HermesLike / MonitoringLike / DecisionLike).

import { describe, it, expect } from 'vitest';
import {
  runHourly, runDaily,
  type HermesLike, type MonitoringLike, type DecisionLike,
} from '../../../src/core/orchestrator-runner/runner';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const TENANT_B = '00000000-0000-0000-0000-000000000002';

// ── Stub builders ─────────────────────────────────────────────────

function stubHermes(opts: { throws?: boolean; briefId?: string } = {}): HermesLike {
  return {
    async dailyHermesRun({ tenant_id }) {
      if (opts.throws) throw new Error('boom hermes');
      return { id: opts.briefId ?? `brief_${tenant_id.slice(-4)}` };
    },
  };
}

function stubMonitoring(opts: { breachedOf?: number; total?: number; throws?: boolean } = {}): MonitoringLike {
  return {
    evaluate() {
      if (opts.throws) throw new Error('boom monitoring');
      const total    = opts.total    ?? 3;
      const breached = opts.breachedOf ?? 1;
      return Array.from({ length: total }, (_, i) => ({ breached: i < breached }));
    },
  };
}

function stubDecision(opts: { overdueCount?: number; throws?: boolean } = {}): DecisionLike {
  return {
    sweepOverdue() {
      if (opts.throws) throw new Error('boom decision');
      return Array.from({ length: opts.overdueCount ?? 0 }, (_, i) => ({ idx: i }));
    },
    routingsByTenant() { return []; },
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('runHourly', () => {
  it('runs monitoring + decision per tenant, skips hermes', async () => {
    const report = await runHourly({
      hermes:     stubHermes(),
      monitoring: stubMonitoring({ total: 5, breachedOf: 2 }),
      decision:   stubDecision({ overdueCount: 3 }),
      store:      {},
    }, { tenant_ids: [TENANT_A, TENANT_B] });

    expect(report.cadence).toBe('hourly');
    expect(report.tenants).toHaveLength(2);
    for (const t of report.tenants) {
      expect(t.hermes_brief_created).toBe(false);     // hourly does not run hermes
      expect(t.hermes_brief_id).toBeNull();
      expect(t.monitoring_slos_evaluated).toBe(5);
      expect(t.monitoring_slos_breached).toBe(2);
      expect(t.decision_overdue_flagged).toBe(3);
    }
    expect(report.total_errors).toBe(0);
  });
});

describe('runDaily', () => {
  it('runs all three per tenant', async () => {
    const report = await runDaily({
      hermes:     stubHermes(),
      monitoring: stubMonitoring({ total: 4, breachedOf: 0 }),
      decision:   stubDecision({ overdueCount: 1 }),
      store:      {},
    }, { tenant_ids: [TENANT_A] });

    expect(report.cadence).toBe('daily');
    expect(report.tenants[0].hermes_brief_created).toBe(true);
    expect(report.tenants[0].hermes_brief_id).toMatch(/^brief_/);
    expect(report.tenants[0].monitoring_slos_evaluated).toBe(4);
    expect(report.tenants[0].decision_overdue_flagged).toBe(1);
  });

  it('forwards hermes_inputs per tenant', async () => {
    let captured: { tenant_id: string; inputs?: unknown[] } | null = null;
    const hermes: HermesLike = {
      async dailyHermesRun(args) { captured = args; return { id: 'brief_x' }; },
    };
    await runDaily({
      hermes,
      monitoring: stubMonitoring(),
      decision:   stubDecision(),
      store:      {},
    }, {
      tenant_ids: [TENANT_A],
      hermes_inputs: { [TENANT_A]: [{ title: 'EDPB notice' }] },
    });
    expect(captured!.tenant_id).toBe(TENANT_A);
    expect(captured!.inputs).toEqual([{ title: 'EDPB notice' }]);
  });
});

describe('error isolation', () => {
  it('one tenant failing does not poison the next', async () => {
    let call = 0;
    const flaky: MonitoringLike = {
      evaluate() {
        call++;
        if (call === 1) throw new Error('first tenant explodes');
        return [{ breached: false }];
      },
    };
    const report = await runHourly({
      monitoring: flaky,
      decision:   stubDecision(),
      store:      {},
    }, { tenant_ids: [TENANT_A, TENANT_B] });

    expect(report.tenants[0].errors).toEqual(['monitoring: first tenant explodes']);
    expect(report.tenants[1].errors).toEqual([]);
    expect(report.tenants[1].monitoring_slos_evaluated).toBe(1);
    expect(report.total_errors).toBe(1);
  });

  it('each agent error is reported separately', async () => {
    const report = await runDaily({
      hermes:     stubHermes({ throws: true }),
      monitoring: stubMonitoring({ throws: true }),
      decision:   stubDecision({ throws: true }),
      store:      {},
    }, { tenant_ids: [TENANT_A] });

    const errs = report.tenants[0].errors;
    expect(errs).toHaveLength(3);
    expect(errs[0]).toMatch(/hermes:/);
    expect(errs[1]).toMatch(/monitoring:/);
    expect(errs[2]).toMatch(/decision:/);
  });
});

describe('partial agent presence', () => {
  it('runs only with monitoring (no hermes/decision)', async () => {
    const report = await runHourly({
      monitoring: stubMonitoring({ total: 2, breachedOf: 1 }),
      store:      {},
    }, { tenant_ids: [TENANT_A] });
    expect(report.tenants[0].monitoring_slos_evaluated).toBe(2);
    expect(report.tenants[0].decision_overdue_flagged).toBe(0);
    expect(report.tenants[0].errors).toEqual([]);
  });

  it('runs with hermes only on daily cadence', async () => {
    const report = await runDaily({
      hermes: stubHermes(),
      store:  {},
    }, { tenant_ids: [TENANT_A] });
    expect(report.tenants[0].hermes_brief_created).toBe(true);
  });
});

describe('report timing', () => {
  it('honors a fixed "now"', async () => {
    const fixed = '2026-05-17T00:00:00.000Z';
    const report = await runHourly({
      monitoring: stubMonitoring(),
      store:      {},
    }, { tenant_ids: [TENANT_A], now: fixed });
    expect(report.started_at).toBe(fixed);
  });

  it('records non-negative duration_ms', async () => {
    const report = await runHourly({
      monitoring: stubMonitoring(),
      store:      {},
    }, { tenant_ids: [TENANT_A] });
    expect(report.duration_ms).toBeGreaterThanOrEqual(0);
  });
});

describe('empty tenant list', () => {
  it('returns a report with zero tenants and zero errors', async () => {
    const report = await runHourly({
      monitoring: stubMonitoring(),
      decision:   stubDecision(),
      store:      {},
    }, { tenant_ids: [] });
    expect(report.tenants).toHaveLength(0);
    expect(report.total_errors).toBe(0);
  });
});
