// DecisionAgent — unit tests.
//
// Covers: hard-rule rejections (risk_level high/critical, irreversible),
// kill-switch (paused), confidence floor, policy whitelist, auto-approve
// happy path, escalation routing with SLA, overdue sweep, audit log.

import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionAgent } from '../../../src/core/decision-agent/decision';
import { AgentOsStore } from '../../../src/core/agent-os/store';

const TENANT = '00000000-0000-0000-0000-000000000001';

let agent: DecisionAgent;
let store: AgentOsStore;

beforeEach(() => {
  agent = new DecisionAgent();
  store = new AgentOsStore();
});

// ── Helper: propose a generic decision ─────────────────────────────

function propose(opts: {
  risk?: 'low' | 'medium' | 'high' | 'critical';
  reversibility?: 'reversible' | 'partially_reversible' | 'irreversible';
} = {}) {
  return store.proposeDecision({
    tenant_id:      TENANT,
    decision_title: 'do the thing',
    problem:        'should we do the thing?',
    options:        [{ label: 'yes' }, { label: 'no' }],
    recommendation: 'yes',
    reason:         'evidence indicates upside',
    risk_level:     opts.risk ?? 'low',
    reversibility:  opts.reversibility ?? 'reversible',
    proposed_by:    'planning-agent',
  });
}

// ── Policy ────────────────────────────────────────────────────────

describe('DecisionAgent.setPolicy', () => {
  it('creates policy from defaults', () => {
    const p = agent.setPolicy(TENANT, {});
    expect(p.auto_approve_confidence_floor).toBe(0.7);
    expect(p.auto_approve_risk_levels).toEqual(['low']);
    expect(p.paused).toBe(false);
  });

  it('merges patches', () => {
    agent.setPolicy(TENANT, { default_sla_hours: 4 });
    const p2 = agent.setPolicy(TENANT, { paused: true });
    expect(p2.default_sla_hours).toBe(4);
    expect(p2.paused).toBe(true);
  });

  it('rejects floor out of [0,1]', () => {
    expect(() => agent.setPolicy(TENANT, { auto_approve_confidence_floor: 1.5 })).toThrow(/floor/);
    expect(() => agent.setPolicy(TENANT, { auto_approve_confidence_floor: -0.1 })).toThrow(/floor/);
  });

  it('rejects non-positive sla', () => {
    expect(() => agent.setPolicy(TENANT, { default_sla_hours: 0 })).toThrow(/sla/);
  });

  it('returns a default policy when none is set', () => {
    const p = agent.getPolicy('unknown-tenant');
    expect(p.auto_approve_confidence_floor).toBe(0.7);
  });
});

// ── Auto-approve happy path ───────────────────────────────────────

describe('DecisionAgent.review — auto-approve', () => {
  it('approves low-risk + reversible + high-confidence', () => {
    const d = propose();
    const out = agent.review(store, { decision_id: d.id, self_confidence: 0.9 });
    expect(out.action).toBe('auto_approved');
    const after = store.listDecisions({ tenant_id: TENANT })[0];
    expect(after.status).toBe('approved');
    expect(after.approved_by).toBe('decision-agent');
  });
});

// ── Hard rules ────────────────────────────────────────────────────

describe('DecisionAgent.review — hard rules (never auto-approve)', () => {
  it('escalates risk_level=high even with confidence=1.0', () => {
    const d = propose({ risk: 'high' });
    const out = agent.review(store, { decision_id: d.id, self_confidence: 1.0 });
    expect(out.action).toBe('escalated');
    expect(out.reason).toMatch(/hard rule.*risk_level='high'/);
    expect(store.listDecisions({ tenant_id: TENANT })[0].status).toBe('proposed');
  });

  it('escalates risk_level=critical', () => {
    const d = propose({ risk: 'critical' });
    const out = agent.review(store, { decision_id: d.id, self_confidence: 1.0 });
    expect(out.action).toBe('escalated');
  });

  it('escalates reversibility=irreversible even when low-risk', () => {
    const d = propose({ risk: 'low', reversibility: 'irreversible' });
    const out = agent.review(store, { decision_id: d.id, self_confidence: 1.0 });
    expect(out.action).toBe('escalated');
    expect(out.reason).toMatch(/reversibility='irreversible'/);
  });
});

// ── Kill switch ──────────────────────────────────────────────────

describe('DecisionAgent.review — paused kill-switch', () => {
  it('escalates everything when paused=true, regardless of policy', () => {
    agent.setPolicy(TENANT, { paused: true });
    const d = propose();
    const out = agent.review(store, { decision_id: d.id, self_confidence: 1.0 });
    expect(out.action).toBe('escalated');
    expect(out.reason).toMatch(/paused/);
  });
});

// ── Policy whitelist ─────────────────────────────────────────────

describe('DecisionAgent.review — policy whitelist', () => {
  it('escalates risk=medium when policy only whitelists low', () => {
    const d = propose({ risk: 'medium' });
    const out = agent.review(store, { decision_id: d.id, self_confidence: 0.9 });
    expect(out.action).toBe('escalated');
    expect(out.reason).toMatch(/risk_level='medium' not in policy/);
  });

  it('auto-approves risk=medium when explicitly whitelisted', () => {
    agent.setPolicy(TENANT, { auto_approve_risk_levels: ['low', 'medium'] });
    const d = propose({ risk: 'medium' });
    const out = agent.review(store, { decision_id: d.id, self_confidence: 0.8 });
    expect(out.action).toBe('auto_approved');
  });

  it('escalates partially_reversible by default', () => {
    const d = propose({ reversibility: 'partially_reversible' });
    const out = agent.review(store, { decision_id: d.id, self_confidence: 0.9 });
    expect(out.action).toBe('escalated');
  });
});

// ── Confidence floor ─────────────────────────────────────────────

describe('DecisionAgent.review — confidence floor', () => {
  it('escalates when confidence < floor', () => {
    const d = propose();
    const out = agent.review(store, { decision_id: d.id, self_confidence: 0.5 });
    expect(out.action).toBe('escalated');
    expect(out.reason).toMatch(/below floor/);
  });

  it('honors per-tenant floor override', () => {
    agent.setPolicy(TENANT, { auto_approve_confidence_floor: 0.95 });
    const d = propose();
    const out = agent.review(store, { decision_id: d.id, self_confidence: 0.9 });
    expect(out.action).toBe('escalated');
  });

  it('clamps confidence to [0,1]', () => {
    const d = propose();
    const out = agent.review(store, { decision_id: d.id, self_confidence: 2.5 });
    expect(out.action).toBe('auto_approved');
    expect(out.routing.confidence_score).toBe(1);
  });
});

// ── Escalation routing ───────────────────────────────────────────

describe('DecisionAgent.review — escalation routing', () => {
  it('records routed_to + due_by from policy defaults', () => {
    agent.setPolicy(TENANT, {
      default_owner_user_id: 'owner-uuid',
      default_owner_handle:  '@founder',
      default_sla_hours:     8,
    });
    const d = propose({ risk: 'high' });
    const out = agent.review(store, { decision_id: d.id, self_confidence: 0.99 });
    expect(out.routing.routed_to_user_id).toBe('owner-uuid');
    expect(out.routing.routed_to_handle).toBe('@founder');
    expect(out.routing.due_by).toBeTruthy();
  });

  it('per-call overrides win over policy', () => {
    agent.setPolicy(TENANT, { default_owner_user_id: 'default-owner' });
    const d = propose({ risk: 'high' });
    const out = agent.review(store, {
      decision_id: d.id, self_confidence: 0.9,
      override_owner_user_id: 'override-owner',
      override_owner_handle:  '@override',
      override_sla_hours:     1,
    });
    expect(out.routing.routed_to_user_id).toBe('override-owner');
    expect(out.routing.routed_to_handle).toBe('@override');
  });
});

// ── Audit log ────────────────────────────────────────────────────

describe('DecisionAgent — audit log', () => {
  it('records one routing per review', () => {
    const d = propose();
    agent.review(store, { decision_id: d.id, self_confidence: 0.9 });
    expect(agent.routingsFor(d.id)).toHaveLength(1);
  });

  it('routingsByTenant filters by action', () => {
    const d1 = propose();
    const d2 = propose({ risk: 'high' });
    agent.review(store, { decision_id: d1.id, self_confidence: 0.9 });   // auto_approved
    agent.review(store, { decision_id: d2.id, self_confidence: 0.9 });   // escalated

    expect(agent.routingsByTenant(TENANT, 'auto_approved')).toHaveLength(1);
    expect(agent.routingsByTenant(TENANT, 'escalated')).toHaveLength(1);
    expect(agent.routingsByTenant(TENANT)).toHaveLength(2);
  });
});

// ── Overdue sweep ────────────────────────────────────────────────

describe('DecisionAgent.sweepOverdue', () => {
  it('flags escalated decisions past their SLA', () => {
    agent.setPolicy(TENANT, { default_sla_hours: 1 });
    const d = propose({ risk: 'high' });
    agent.review(store, { decision_id: d.id, self_confidence: 0.9 });
    // 2h later: should be overdue.
    const future = new Date(Date.now() + 2 * 3600_000).toISOString();
    const overdue = agent.sweepOverdue(store, TENANT, future);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].action).toBe('overdue');
    expect(overdue[0].decision_id).toBe(d.id);
  });

  it('does NOT flag decisions whose SLA is still in the future', () => {
    agent.setPolicy(TENANT, { default_sla_hours: 24 });
    const d = propose({ risk: 'high' });
    agent.review(store, { decision_id: d.id, self_confidence: 0.9 });
    const soon = new Date(Date.now() + 3600_000).toISOString();
    expect(agent.sweepOverdue(store, TENANT, soon)).toHaveLength(0);
  });

  it('is idempotent — re-running does not add duplicate overdue rows', () => {
    agent.setPolicy(TENANT, { default_sla_hours: 1 });
    const d = propose({ risk: 'high' });
    agent.review(store, { decision_id: d.id, self_confidence: 0.9 });
    const future = new Date(Date.now() + 2 * 3600_000).toISOString();
    const a = agent.sweepOverdue(store, TENANT, future);
    const b = agent.sweepOverdue(store, TENANT, future);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(0);
  });

  it('does NOT flag auto-approved decisions', () => {
    const d = propose();
    agent.review(store, { decision_id: d.id, self_confidence: 0.9 });   // auto_approved
    const future = new Date(Date.now() + 365 * 24 * 3600_000).toISOString();
    expect(agent.sweepOverdue(store, TENANT, future)).toHaveLength(0);
  });
});

// ── Persist hook ─────────────────────────────────────────────────

describe('DecisionAgent persist hook', () => {
  it('fires on setPolicy + review', () => {
    let policies = 0, routings = 0;
    agent.setPersistHook({
      savePolicy:  () => { policies++; },
      saveRouting: () => { routings++; },
    });
    agent.setPolicy(TENANT, {});
    const d = propose();
    agent.review(store, { decision_id: d.id, self_confidence: 0.9 });
    expect(policies).toBe(1);
    expect(routings).toBe(1);
  });
});

// ── Sanity: re-reviewing a resolved decision ─────────────────────

describe('DecisionAgent.review — already resolved', () => {
  it('throws when decision is already approved', () => {
    const d = propose();
    agent.review(store, { decision_id: d.id, self_confidence: 0.9 });
    expect(() => agent.review(store, { decision_id: d.id, self_confidence: 0.9 }))
      .toThrow(/not 'proposed'/);
  });

  it('throws when decision not found', () => {
    expect(() => agent.review(store, { decision_id: 'nope', self_confidence: 0.9 }))
      .toThrow(/not found/);
  });
});
