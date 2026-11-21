import { describe, expect, it } from 'vitest';
import { AgentOsStore } from '../../../src/core/agent-os/store';
import { buildChiefOfStaffInbox, buildAgentTaskReportCards } from '../../../src/core/agent-os/chiefOfStaff';

function propose(store: AgentOsStore, tenant_id: string, risk_level: 'low' | 'high' | 'critical' = 'high') {
  return store.proposeDecision({
    tenant_id, decision_title: 'Release freigeben', problem: 'CI-Nachweise prüfen',
    options: [{ label: 'freigeben' }, { label: 'sperren' }],
    recommendation: 'sperren', reason: 'Tests fehlen', risk_level,
    reversibility: 'partially_reversible', proposed_by: 'release-agent',
  });
}

describe('Chief of Staff — pure read model', () => {
  it('has an honest empty state instead of simulated live data', () => {
    const report = buildChiefOfStaffInbox(new AgentOsStore(), 'tenant-a');
    expect(report.live_verified).toBe(false);
    expect(report.source).toBe('agent_os_store');
    expect(report.counts.attention_total).toBe(0);
    expect(report.items).toEqual([]);
    expect(report.truncated).toBe(false);
  });

  it('isolates tenants across tasks, decisions, observations and cards', () => {
    const store = new AgentOsStore();
    propose(store, 'tenant-b', 'critical');
    const bTask = store.createTask({ tenant_id: 'tenant-b', agent: 'finance', task: 'Private B' });
    store.transitionTask(bTask.id, 'blocked');
    store.recordObservation({
      tenant_id: 'tenant-b', agent: 'security', category: 'health',
      severity: 'critical', title: 'Private alert B', detail: null, data: {},
    });
    const aTask = store.createTask({ tenant_id: 'tenant-a', agent: 'ops', task: 'Task A' });
    store.transitionTask(aTask.id, 'blocked');
    const report = buildChiefOfStaffInbox(store, 'tenant-a');
    expect(report.counts.attention_total).toBe(1);
    expect(report.items.map(x => x.title)).toEqual(['Task A']);
    expect(buildAgentTaskReportCards(store, 'tenant-a').map(x => x.agent)).toEqual(['ops']);
  });

  it('surfaces pending decisions but never approves them or writes events', () => {
    const store = new AgentOsStore();
    const d = propose(store, 'tenant-a');
    const before = store.listEvents({ tenant_id: 'tenant-a' }).length;
    const report = buildChiefOfStaffInbox(store, 'tenant-a');
    expect(report.items[0]?.kind).toBe('pending_decision');
    expect(store.listDecisions({ tenant_id: 'tenant-a', status: 'proposed' })[0]?.id).toBe(d.id);
    expect(store.listEvents({ tenant_id: 'tenant-a' })).toHaveLength(before);
  });

  it('counts the open backlog but only notifies blockers and high alerts', () => {
    const store = new AgentOsStore();
    store.createTask({ tenant_id: 'tenant-a', agent: 'dev', task: 'Ordinary backlog' });
    store.recordObservation({
      tenant_id: 'tenant-a', agent: 'sec', category: 'health',
      severity: 'low', title: 'Low-priority alert', detail: null, data: {},
    });
    const alert = store.recordObservation({
      tenant_id: 'tenant-a', agent: 'sec', category: 'health',
      severity: 'high', title: 'High-priority alert', detail: null, data: {},
    });
    const report = buildChiefOfStaffInbox(store, 'tenant-a');
    expect(report.counts.open_tasks).toBe(1);
    expect(report.counts.unacknowledged_high_alerts).toBe(1);
    expect(report.items.map(x => x.title)).toEqual(['High-priority alert']);
    store.acknowledgeObservation(alert.id);
    expect(buildChiefOfStaffInbox(store, 'tenant-a').counts.attention_total).toBe(0);
  });

  it('sorts by severity and supports limited display without hiding totals', () => {
    const store = new AgentOsStore();
    const blocked = store.createTask({
      tenant_id: 'tenant-a', agent: 'dev', task: 'Blocked high', priority: 'high',
    });
    store.transitionTask(blocked.id, 'blocked');
    propose(store, 'tenant-a', 'critical');
    propose(store, 'tenant-a', 'low');
    const report = buildChiefOfStaffInbox(store, 'tenant-a', { max_items: 1 });
    expect(report.counts.attention_total).toBe(3);
    expect(report.items).toHaveLength(1);
    expect(report.items[0]?.priority).toBe('critical');
    expect(report.truncated).toBe(true);
  });

  it('rejects missing tenant context', () => {
    const store = new AgentOsStore();
    expect(() => buildChiefOfStaffInbox(store, ' ')).toThrow('tenant_id is required');
    expect(() => buildAgentTaskReportCards(store, '')).toThrow('tenant_id is required');
  });
});

describe('Agent task report cards — evidence honesty', () => {
  it('does not invent quality grades or costs', () => {
    const store = new AgentOsStore();
    const done = store.createTask({ tenant_id: 'a', agent: 'dev', task: 'T1' });
    const failed = store.createTask({ tenant_id: 'a', agent: 'dev', task: 'T2' });
    const open = store.createTask({ tenant_id: 'a', agent: 'research', task: 'T3' });
    store.transitionTask(done.id, 'done');
    store.transitionTask(failed.id, 'failed');
    const cards = buildAgentTaskReportCards(store, 'a');
    const dev = cards.find(c => c.agent === 'dev');
    const research = cards.find(c => c.agent === 'research');
    expect(dev?.tasks).toEqual({ open: 0, in_progress: 0, blocked: 0, done: 1, failed: 1 });
    expect(dev?.observed_completion_rate).toBe(0.5);
    expect(dev?.quality_score).toBeNull();
    expect(dev?.cost_usd).toBeNull();
    expect(research?.observed_completion_rate).toBeNull();
    expect(research?.tasks.open).toBe(1);
    expect(open.status).toBe('open');
  });
});
