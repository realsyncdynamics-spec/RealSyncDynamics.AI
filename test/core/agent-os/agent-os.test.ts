import { describe, it, expect, beforeEach } from 'vitest';
import { AgentOsStore } from '../../../src/core/agent-os/store';
import {
  Orchestrator,
  __resetDefaultOrchestratorForTests,
} from '../../../src/core/agent-os/orchestrator';
import type { HandlerResult, HandlerContext } from '../../../src/core/agent-os/orchestrator';

const TENANT = 't_test';

beforeEach(() => {
  __resetDefaultOrchestratorForTests();
});

// ── Memory ────────────────────────────────────────────────────────

describe('AgentOsStore — memory', () => {
  it('addMemory persists with status=active and emits memory.added event', () => {
    const s = new AgentOsStore();
    const m = s.addMemory({
      tenant_id: TENANT, source: 'audit', source_agent: 'monitoring-agent',
      topic: 'Pre-Consent-Tracker', content: 'GA fires before consent on /pricing.',
      tags: ['privacy', 'audit'], importance: 4,
    });
    expect(m.status).toBe('active');
    expect(s.queryMemory({ tenant_id: TENANT, tag: 'privacy' })).toHaveLength(1);
    const evs = s.listEvents({ tenant_id: TENANT, subject_type: 'memory' });
    expect(evs.length).toBe(1);
    expect(evs[0]?.event_type).toBe('memory.added');
  });

  it('supersedeMemory flips status and links replacement', () => {
    const s = new AgentOsStore();
    const m1 = s.addMemory({ tenant_id: TENANT, topic: 't', content: 'old' });
    const m2 = s.addMemory({ tenant_id: TENANT, topic: 't', content: 'new' });
    const updated = s.supersedeMemory(m1.id, m2.id);
    expect(updated?.status).toBe('superseded');
    expect(updated?.superseded_by).toBe(m2.id);
  });

  it('queryMemory respects tenant + tag + importance filters', () => {
    const s = new AgentOsStore();
    s.addMemory({ tenant_id: 'a', topic: 't', content: '1', tags: ['x'], importance: 5 });
    s.addMemory({ tenant_id: 'a', topic: 't', content: '2', tags: ['y'], importance: 2 });
    s.addMemory({ tenant_id: 'b', topic: 't', content: '3', tags: ['x'], importance: 5 });
    const rows = s.queryMemory({ tenant_id: 'a', tag: 'x', min_importance: 4 });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.content).toBe('1');
  });
});

// ── Tasks ─────────────────────────────────────────────────────────

describe('AgentOsStore — tasks', () => {
  it('createTask defaults to open + normal priority', () => {
    const s = new AgentOsStore();
    const t = s.createTask({ tenant_id: TENANT, agent: 'research-agent', task: 'gather data' });
    expect(t.status).toBe('open');
    expect(t.priority).toBe('normal');
    expect(t.output).toBeNull();
  });

  it('transitionTask in_progress → done sets started_at + completed_at', () => {
    const s = new AgentOsStore();
    const t = s.createTask({ tenant_id: TENANT, agent: 'a', task: 'x' });
    const started = s.transitionTask(t.id, 'in_progress');
    expect(started?.started_at).toBeDefined();
    const done = s.transitionTask(t.id, 'done', { output: { ok: true } });
    expect(done?.status).toBe('done');
    expect(done?.completed_at).toBeDefined();
    expect(done?.output?.ok).toBe(true);
  });

  it('cannot transition out of terminal state', () => {
    const s = new AgentOsStore();
    const t = s.createTask({ tenant_id: TENANT, agent: 'a', task: 'x' });
    s.transitionTask(t.id, 'in_progress');
    s.transitionTask(t.id, 'done');
    expect(() => s.transitionTask(t.id, 'in_progress')).toThrow(/terminal state/);
  });

  it('nextOpenTask honours priority ranking', () => {
    const s = new AgentOsStore();
    s.createTask({ tenant_id: TENANT, agent: 'a', task: 'low',      priority: 'low' });
    s.createTask({ tenant_id: TENANT, agent: 'a', task: 'critical', priority: 'critical' });
    s.createTask({ tenant_id: TENANT, agent: 'a', task: 'normal',   priority: 'normal' });
    expect(s.nextOpenTask()?.task).toBe('critical');
  });
});

// ── Decisions ─────────────────────────────────────────────────────

describe('AgentOsStore — decisions', () => {
  it('proposeDecision lands in proposed status', () => {
    const s = new AgentOsStore();
    const d = s.proposeDecision({
      tenant_id: TENANT,
      decision_title: 'Pricing change to €99',
      problem: 'Current price too low for enterprise tier.',
      options: [{ label: '€99' }, { label: '€149' }],
      recommendation: '€99',
      reason: 'Higher conversion based on the experiment.',
      risk_level: 'medium',
      reversibility: 'reversible',
      proposed_by: 'decision-agent',
    });
    expect(d.status).toBe('proposed');
    expect(d.approved_by).toBeNull();
  });

  it('resolveDecision flips proposed → approved with approver_user_id', () => {
    const s = new AgentOsStore();
    const d = s.proposeDecision({
      tenant_id: TENANT,
      decision_title: 'x', problem: 'p',
      options: [], recommendation: 'r', reason: 'why',
      risk_level: 'low', reversibility: 'reversible',
      proposed_by: 'a',
    });
    const ok = s.resolveDecision(d.id, 'approved', 'user_42');
    expect(ok?.status).toBe('approved');
    expect(ok?.approved_by).toBe('user_42');
    expect(ok?.approved_at).toBeDefined();
  });

  it('cannot resolve a decision twice', () => {
    const s = new AgentOsStore();
    const d = s.proposeDecision({
      tenant_id: TENANT,
      decision_title: 'x', problem: 'p',
      options: [], recommendation: 'r', reason: 'why',
      risk_level: 'low', reversibility: 'reversible',
      proposed_by: 'a',
    });
    s.resolveDecision(d.id, 'approved', 'u');
    expect(() => s.resolveDecision(d.id, 'rejected', 'u'))
      .toThrow(/not in 'proposed' status/);
  });

  it('agent-os never auto-approves — decisions stay proposed until resolveDecision is called', () => {
    const s = new AgentOsStore();
    const d = s.proposeDecision({
      tenant_id: TENANT,
      decision_title: 'x', problem: 'p',
      options: [], recommendation: 'r', reason: 'why',
      risk_level: 'critical', reversibility: 'irreversible',
      proposed_by: 'agent',
    });
    // Even after many other operations, status stays proposed.
    s.addMemory({ tenant_id: TENANT, topic: 't', content: 'c' });
    s.createTask({ tenant_id: TENANT, agent: 'a', task: 'x' });
    expect(s.listDecisions({ tenant_id: TENANT, status: 'proposed' })).toHaveLength(1);
    expect(s.listDecisions({ tenant_id: TENANT, status: 'approved' })).toHaveLength(0);
    void d;
  });
});

// ── Observations ──────────────────────────────────────────────────

describe('AgentOsStore — observations', () => {
  it('recordObservation defaults to unacknowledged', () => {
    const s = new AgentOsStore();
    const o = s.recordObservation({
      tenant_id: TENANT, agent: 'monitoring-agent',
      category: 'health', severity: 'high', title: 'Stripe webhook 5xx spike',
      detail: null, data: { count: 12 },
    });
    expect(o.acknowledged).toBe(false);
  });

  it('acknowledgeObservation flips acknowledged to true', () => {
    const s = new AgentOsStore();
    const o = s.recordObservation({
      tenant_id: TENANT, agent: 'monitoring-agent',
      category: 'health', severity: 'low', title: 't',
      detail: null, data: {},
    });
    const acked = s.acknowledgeObservation(o.id);
    expect(acked?.acknowledged).toBe(true);
  });

  it('listObservations filters by severity + acknowledged', () => {
    const s = new AgentOsStore();
    s.recordObservation({ tenant_id: TENANT, agent: 'm', category: 'c', severity: 'high', title: '1', detail: null, data: {} });
    s.recordObservation({ tenant_id: TENANT, agent: 'm', category: 'c', severity: 'low',  title: '2', detail: null, data: {} });
    const highs = s.listObservations({ tenant_id: TENANT, severity: 'high', acknowledged: false });
    expect(highs).toHaveLength(1);
  });
});

// ── Events (replay surface) ───────────────────────────────────────

describe('AgentOsStore — events', () => {
  it('every mutation emits exactly one event', () => {
    const s = new AgentOsStore();
    s.addMemory({ tenant_id: TENANT, topic: 't', content: 'c' });
    const t = s.createTask({ tenant_id: TENANT, agent: 'a', task: 'x' });
    s.transitionTask(t.id, 'in_progress');
    s.transitionTask(t.id, 'done');
    const evs = s.listEvents({ tenant_id: TENANT });
    expect(evs).toHaveLength(4);
    expect(evs.map(e => e.event_type)).toEqual([
      'memory.added', 'task.created', 'task.started', 'task.completed',
    ]);
  });

  it('event ids are monotonic across a single store', () => {
    const s = new AgentOsStore();
    s.addMemory({ tenant_id: TENANT, topic: 't', content: 'c1' });
    s.addMemory({ tenant_id: TENANT, topic: 't', content: 'c2' });
    s.addMemory({ tenant_id: TENANT, topic: 't', content: 'c3' });
    const evs = s.listEvents({ tenant_id: TENANT });
    for (let i = 1; i < evs.length; i++) {
      expect(evs[i]!.id).toBeGreaterThan(evs[i - 1]!.id);
    }
  });
});

// ── Persistence hook ──────────────────────────────────────────────

describe('AgentOsStore — persist hook', () => {
  it('saveMemory hook is called on addMemory', () => {
    const s = new AgentOsStore();
    const seen: string[] = [];
    s.setPersistHook({ saveMemory: m => { seen.push(m.id); } });
    s.addMemory({ tenant_id: TENANT, topic: 't', content: 'c' });
    expect(seen).toHaveLength(1);
  });

  it('saveEvent hook fires on every event', () => {
    const s = new AgentOsStore();
    let count = 0;
    s.setPersistHook({ saveEvent: () => { count++; } });
    s.addMemory({ tenant_id: TENANT, topic: 't', content: 'c' });
    s.createTask({ tenant_id: TENANT, agent: 'a', task: 'x' });
    expect(count).toBe(2);
  });
});

// ── Orchestrator ──────────────────────────────────────────────────

describe('Orchestrator', () => {
  it('registers and runs an agent handler', async () => {
    const orch = new Orchestrator();
    orch.registerAgent('research-agent', (ctx: HandlerContext): HandlerResult => ({
      content: { facts: ['fact 1'] },
      self_confidence: 80,
      evidence: ['evt_01'],
    }));
    const task = orch.store.createTask({
      tenant_id: TENANT, agent: 'research-agent', task: 'find facts',
    });
    const after = await orch.run(task.id);
    expect(after?.status).toBe('done');
    const outputs = orch.store.listOutputsForTask(task.id);
    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.self_confidence).toBe(80);
  });

  it('fails the task if no handler is registered for its agent', async () => {
    const orch = new Orchestrator();
    const task = orch.store.createTask({
      tenant_id: TENANT, agent: 'ghost-agent', task: 'x',
    });
    const after = await orch.run(task.id);
    expect(after?.status).toBe('failed');
    expect(after?.blocker_reason).toMatch(/no handler/);
  });

  it('marks task failed when handler throws', async () => {
    const orch = new Orchestrator();
    orch.registerAgent('flaky-agent', () => { throw new Error('upstream 500'); });
    const task = orch.store.createTask({ tenant_id: TENANT, agent: 'flaky-agent', task: 'x' });
    const after = await orch.run(task.id);
    expect(after?.status).toBe('failed');
    expect(after?.blocker_reason).toMatch(/upstream 500/);
  });

  it('handler-result outcome=blocked transitions to blocked with reason', async () => {
    const orch = new Orchestrator();
    orch.registerAgent('hesitant-agent', () => ({
      content: { hint: 'need more context' },
      outcome: 'blocked',
      reason: 'no source documents',
    }));
    const task = orch.store.createTask({ tenant_id: TENANT, agent: 'hesitant-agent', task: 'x' });
    const after = await orch.run(task.id);
    expect(after?.status).toBe('blocked');
    expect(after?.blocker_reason).toBe('no source documents');
  });

  it('handler-context.observe records an observation tied to the agent', async () => {
    const orch = new Orchestrator();
    orch.registerAgent('monitor-agent', (ctx: HandlerContext): HandlerResult => {
      ctx.observe({
        category: 'health', severity: 'medium',
        title: 'slow response time', detail: null, data: {},
      });
      return { content: 'observed' };
    });
    const task = orch.store.createTask({ tenant_id: TENANT, agent: 'monitor-agent', task: 'x' });
    await orch.run(task.id);
    const obs = orch.store.listObservations({ tenant_id: TENANT });
    expect(obs).toHaveLength(1);
    expect(obs[0]?.agent).toBe('monitor-agent');
  });

  it('handler-context.propose lands in proposed status (no auto-approve)', async () => {
    const orch = new Orchestrator();
    orch.registerAgent('thinker-agent', (ctx: HandlerContext): HandlerResult => {
      ctx.propose({
        decision_title: 'Move ai-gateway to EU-only',
        problem: 'US routing risk',
        options: [], recommendation: 'EU-only', reason: 'DSGVO',
        risk_level: 'high', reversibility: 'partially_reversible',
      });
      return { content: 'proposed' };
    });
    const task = orch.store.createTask({ tenant_id: TENANT, agent: 'thinker-agent', task: 'x' });
    await orch.run(task.id);
    const decs = orch.store.listDecisions({ tenant_id: TENANT });
    expect(decs).toHaveLength(1);
    expect(decs[0]?.status).toBe('proposed');     // CRITICAL: never auto-approved
    expect(decs[0]?.proposed_by).toBe('thinker-agent');
  });

  it('drain processes every open task across tenants', async () => {
    const orch = new Orchestrator();
    orch.registerAgent('a', () => ({ content: 'a' }));
    orch.registerAgent('b', () => ({ content: 'b' }));
    orch.store.createTask({ tenant_id: 't1', agent: 'a', task: '1' });
    orch.store.createTask({ tenant_id: 't1', agent: 'b', task: '2' });
    orch.store.createTask({ tenant_id: 't2', agent: 'a', task: '3' });
    const done = await orch.drain();
    expect(done).toHaveLength(3);
    expect(done.every(t => t.status === 'done')).toBe(true);
  });
});
