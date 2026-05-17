// MonitoringAgent — unit tests.

import { describe, it, expect, beforeEach } from 'vitest';
import { MonitoringAgent } from '../../../src/core/monitoring-agent/monitoring';
import { AgentOsStore } from '../../../src/core/agent-os/store';

const TENANT = '00000000-0000-0000-0000-000000000001';

let agent: MonitoringAgent;
let store: AgentOsStore;

beforeEach(() => {
  agent = new MonitoringAgent();
  store = new AgentOsStore();
});

// ── defineSlo ─────────────────────────────────────────────────────

describe('MonitoringAgent.defineSlo', () => {
  it('creates an SLO with defaults', () => {
    const s = agent.defineSlo({
      tenant_id: TENANT,
      name: 'promotion failure rate',
      metric: 'task_failure_rate',
      comparator: 'gt',
      threshold: 0.05,
    });
    expect(s.window_hours).toBe(24);
    expect(s.alert_severity).toBe('high');
    expect(s.enabled).toBe(true);
  });

  it('rejects duplicate names per tenant', () => {
    agent.defineSlo({
      tenant_id: TENANT, name: 'x', metric: 'task_failure_rate', comparator: 'gt', threshold: 1,
    });
    expect(() => agent.defineSlo({
      tenant_id: TENANT, name: 'x', metric: 'task_failure_rate', comparator: 'gt', threshold: 1,
    })).toThrow(/already exists/);
  });

  it('rejects window_hours out of bounds', () => {
    expect(() => agent.defineSlo({
      tenant_id: TENANT, name: 'a', metric: 'task_failure_rate',
      comparator: 'gt', threshold: 0.1, window_hours: 0,
    })).toThrow(/window_hours/);
    expect(() => agent.defineSlo({
      tenant_id: TENANT, name: 'b', metric: 'task_failure_rate',
      comparator: 'gt', threshold: 0.1, window_hours: 9999,
    })).toThrow(/window_hours/);
  });

  it('rejects empty name', () => {
    expect(() => agent.defineSlo({
      tenant_id: TENANT, name: '   ', metric: 'task_failure_rate', comparator: 'gt', threshold: 1,
    })).toThrow(/name/);
  });
});

// ── task_open_count ───────────────────────────────────────────────

describe('MonitoringAgent.evaluate — task_open_count', () => {
  it('breaches when open count exceeds threshold', () => {
    agent.defineSlo({
      tenant_id: TENANT, name: 'backlog', metric: 'task_open_count',
      comparator: 'gt', threshold: 2,
    });
    for (let i = 0; i < 3; i++) {
      store.createTask({ tenant_id: TENANT, agent: 'a', task: `t${i}` });
    }
    const results = agent.evaluate(store, TENANT);
    expect(results[0].observed).toBe(3);
    expect(results[0].breached).toBe(true);
    expect(results[0].observation_id).toBeTruthy();

    // An observation row should now exist.
    const obs = store.listObservations({ tenant_id: TENANT });
    expect(obs).toHaveLength(1);
    expect(obs[0].category).toBe('slo');
    expect(obs[0].severity).toBe('high');
  });

  it('does not breach when under threshold', () => {
    agent.defineSlo({
      tenant_id: TENANT, name: 'backlog', metric: 'task_open_count',
      comparator: 'gt', threshold: 10,
    });
    store.createTask({ tenant_id: TENANT, agent: 'a', task: 't' });
    const results = agent.evaluate(store, TENANT);
    expect(results[0].breached).toBe(false);
    expect(store.listObservations({ tenant_id: TENANT })).toHaveLength(0);
  });
});

// ── task_failure_rate ─────────────────────────────────────────────

describe('MonitoringAgent.evaluate — task_failure_rate', () => {
  it('breaches when failure rate exceeds threshold', () => {
    agent.defineSlo({
      tenant_id: TENANT, name: 'fail-rate', metric: 'task_failure_rate',
      comparator: 'gt', threshold: 0.5, agent: 'promotion-agent',
    });
    // 1 done, 2 failed = 66% failure rate
    const t1 = store.createTask({ tenant_id: TENANT, agent: 'promotion-agent', task: 'a' });
    const t2 = store.createTask({ tenant_id: TENANT, agent: 'promotion-agent', task: 'b' });
    const t3 = store.createTask({ tenant_id: TENANT, agent: 'promotion-agent', task: 'c' });
    store.transitionTask(t1.id, 'in_progress');
    store.transitionTask(t1.id, 'done');
    store.transitionTask(t2.id, 'in_progress');
    store.transitionTask(t2.id, 'failed', { blocker_reason: 'nope' });
    store.transitionTask(t3.id, 'in_progress');
    store.transitionTask(t3.id, 'failed', { blocker_reason: 'nope' });

    const results = agent.evaluate(store, TENANT);
    expect(results[0].observed).toBeCloseTo(0.6667, 3);
    expect(results[0].breached).toBe(true);
  });

  it('filters by agent — other agents do not count', () => {
    agent.defineSlo({
      tenant_id: TENANT, name: 'fail-rate', metric: 'task_failure_rate',
      comparator: 'gt', threshold: 0.5, agent: 'promotion-agent',
    });
    // 1 task by promotion-agent (done), 2 by other-agent (failed).
    const t1 = store.createTask({ tenant_id: TENANT, agent: 'promotion-agent', task: 'a' });
    const t2 = store.createTask({ tenant_id: TENANT, agent: 'other-agent',     task: 'b' });
    const t3 = store.createTask({ tenant_id: TENANT, agent: 'other-agent',     task: 'c' });
    store.transitionTask(t1.id, 'in_progress'); store.transitionTask(t1.id, 'done');
    store.transitionTask(t2.id, 'in_progress'); store.transitionTask(t2.id, 'failed', { blocker_reason: 'x' });
    store.transitionTask(t3.id, 'in_progress'); store.transitionTask(t3.id, 'failed', { blocker_reason: 'x' });

    const results = agent.evaluate(store, TENANT);
    // promotion-agent: 1 done, 0 failed = 0% — not breached.
    expect(results[0].observed).toBe(0);
    expect(results[0].breached).toBe(false);
  });
});

// ── observation_unack_count ──────────────────────────────────────

describe('MonitoringAgent.evaluate — observation_unack_count', () => {
  it('counts only unack high+critical observations', () => {
    agent.defineSlo({
      tenant_id: TENANT, name: 'unack', metric: 'observation_unack_count',
      comparator: 'gt', threshold: 1,
    });
    store.recordObservation({ tenant_id: TENANT, agent: 'a', category: 'x', severity: 'high', title: 't', detail: null, data: {} });
    store.recordObservation({ tenant_id: TENANT, agent: 'a', category: 'x', severity: 'critical', title: 't', detail: null, data: {} });
    store.recordObservation({ tenant_id: TENANT, agent: 'a', category: 'x', severity: 'low', title: 't', detail: null, data: {} });
    // 2 unack high/critical → breached at threshold>1
    const results = agent.evaluate(store, TENANT);
    expect(results[0].observed).toBe(2);
    expect(results[0].breached).toBe(true);
  });
});

// ── decision_escalation_rate (via injected callback) ─────────────

describe('MonitoringAgent.evaluate — decision_escalation_rate', () => {
  it('breaches when escalation rate exceeds threshold', () => {
    agent.defineSlo({
      tenant_id: TENANT, name: 'escalation', metric: 'decision_escalation_rate',
      comparator: 'gt', threshold: 0.5,
    });
    const now = new Date().toISOString();
    const recent = new Date(Date.now() - 3600_000).toISOString();
    const routings = [
      { action: 'auto_approved', created_at: recent },
      { action: 'escalated',     created_at: recent },
      { action: 'escalated',     created_at: recent },
    ];
    const results = agent.evaluate(store, TENANT, {
      now,
      decisionRoutingsByTenant: () => routings,
    });
    expect(results[0].observed).toBeCloseTo(0.6667, 3);
    expect(results[0].breached).toBe(true);
  });

  it('returns 0 when no routings callback provided', () => {
    agent.defineSlo({
      tenant_id: TENANT, name: 'escalation', metric: 'decision_escalation_rate',
      comparator: 'gt', threshold: 0,
    });
    const results = agent.evaluate(store, TENANT);
    expect(results[0].observed).toBe(0);
    expect(results[0].breached).toBe(false);
  });
});

// ── Idempotency ──────────────────────────────────────────────────

describe('MonitoringAgent.evaluate — idempotency', () => {
  it('does NOT emit duplicate observations on repeated evaluate() in same window', () => {
    agent.defineSlo({
      tenant_id: TENANT, name: 'backlog', metric: 'task_open_count',
      comparator: 'gt', threshold: 0,
    });
    store.createTask({ tenant_id: TENANT, agent: 'a', task: 't' });
    agent.evaluate(store, TENANT);
    agent.evaluate(store, TENANT);
    agent.evaluate(store, TENANT);
    expect(store.listObservations({ tenant_id: TENANT })).toHaveLength(1);
  });

  it('emits again in a new window bucket', () => {
    agent.defineSlo({
      tenant_id: TENANT, name: 'backlog', metric: 'task_open_count',
      comparator: 'gt', threshold: 0, window_hours: 1,
    });
    store.createTask({ tenant_id: TENANT, agent: 'a', task: 't' });
    const t0 = new Date('2026-05-17T00:00:00Z').toISOString();
    const t1 = new Date('2026-05-17T02:00:00Z').toISOString();  // 2h later, new bucket
    agent.evaluate(store, TENANT, { now: t0 });
    agent.evaluate(store, TENANT, { now: t1 });
    expect(store.listObservations({ tenant_id: TENANT })).toHaveLength(2);
  });
});

// ── Disabled SLOs ────────────────────────────────────────────────

describe('MonitoringAgent.setEnabled', () => {
  it('skips evaluation when disabled', () => {
    const s = agent.defineSlo({
      tenant_id: TENANT, name: 'backlog', metric: 'task_open_count',
      comparator: 'gt', threshold: 0,
    });
    store.createTask({ tenant_id: TENANT, agent: 'a', task: 't' });
    agent.setEnabled(s.id, false);
    const results = agent.evaluate(store, TENANT);
    expect(results).toHaveLength(0);
    expect(store.listObservations({ tenant_id: TENANT })).toHaveLength(0);
  });
});

// ── Tenant isolation ─────────────────────────────────────────────

describe('MonitoringAgent — tenant isolation', () => {
  it('does not evaluate SLOs from other tenants', () => {
    const OTHER = '00000000-0000-0000-0000-000000000002';
    agent.defineSlo({
      tenant_id: TENANT, name: 'a', metric: 'task_open_count', comparator: 'gt', threshold: 0,
    });
    agent.defineSlo({
      tenant_id: OTHER, name: 'b', metric: 'task_open_count', comparator: 'gt', threshold: 0,
    });
    store.createTask({ tenant_id: OTHER, agent: 'a', task: 't' });
    const results = agent.evaluate(store, TENANT);
    expect(results).toHaveLength(1);
    expect(results[0].breached).toBe(false);
  });
});

// ── Persist hook ─────────────────────────────────────────────────

describe('MonitoringAgent persist hook', () => {
  it('fires saveSlo on define + setEnabled', () => {
    let saves = 0;
    agent.setPersistHook({ saveSlo: () => { saves++; } });
    const s = agent.defineSlo({
      tenant_id: TENANT, name: 'x', metric: 'task_open_count', comparator: 'gt', threshold: 1,
    });
    agent.setEnabled(s.id, false);
    expect(saves).toBe(2);
  });
});
