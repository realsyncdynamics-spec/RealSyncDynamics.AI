// PlanningAgent — unit tests.
//
// Covers the lifecycle (draft → review → approved → active → completed),
// the safety rails (no skipping review, no anonymous reviews, no plan
// without milestones), and the Hermes-handoff + AgentOS-orchestrator
// bridges.

import { describe, it, expect, beforeEach } from 'vitest';
import { PlanningAgent } from '../../../src/core/planning-agent/planning';
import { AgentOsStore } from '../../../src/core/agent-os/store';

const TENANT = '00000000-0000-0000-0000-000000000001';

let pa: PlanningAgent;

beforeEach(() => {
  pa = new PlanningAgent();
});

describe('PlanningAgent.draftPlan', () => {
  it('creates a draft plan with required fields', () => {
    const plan = pa.draftPlan({
      tenant_id: TENANT,
      title:     'Launch DACH compliance suite',
      objective: 'Reach 100 paying tenants in DACH by Q4',
      priority:  'high',
    });
    expect(plan.status).toBe('draft');
    expect(plan.priority).toBe('high');
    expect(plan.confidence_score).toBe(0.5);
    expect(plan.approved_by).toBeNull();
  });

  it('clamps confidence_score to [0,1]', () => {
    const high = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o', confidence_score: 1.7 });
    const low  = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o', confidence_score: -0.4 });
    expect(high.confidence_score).toBe(1);
    expect(low.confidence_score).toBe(0);
  });

  it('throws when objective is empty', () => {
    expect(() => pa.draftPlan({ tenant_id: TENANT, title: 't', objective: '   ' }))
      .toThrow(/objective/);
  });

  it('throws when title is empty', () => {
    expect(() => pa.draftPlan({ tenant_id: TENANT, title: '', objective: 'o' }))
      .toThrow(/title/);
  });
});

describe('PlanningAgent.addMilestone', () => {
  it('auto-assigns sequence', () => {
    const plan = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o' });
    const m1 = pa.addMilestone({ plan_id: plan.id, title: 'first' });
    const m2 = pa.addMilestone({ plan_id: plan.id, title: 'second' });
    expect(m1.sequence).toBe(0);
    expect(m2.sequence).toBe(1);
  });

  it('rejects duplicate sequence', () => {
    const plan = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o' });
    pa.addMilestone({ plan_id: plan.id, title: 'a', sequence: 0 });
    expect(() => pa.addMilestone({ plan_id: plan.id, title: 'b', sequence: 0 }))
      .toThrow(/sequence/);
  });

  it('rejects depends_on referencing another plan', () => {
    const planA = pa.draftPlan({ tenant_id: TENANT, title: 'A', objective: 'o' });
    const planB = pa.draftPlan({ tenant_id: TENANT, title: 'B', objective: 'o' });
    const a1 = pa.addMilestone({ plan_id: planA.id, title: 'a1' });
    expect(() => pa.addMilestone({
      plan_id: planB.id, title: 'b1', depends_on_milestone_id: a1.id,
    })).toThrow(/depends_on/);
  });

  it('rejects adding to a completed plan', () => {
    const plan = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o' });
    pa.addMilestone({ plan_id: plan.id, title: 'a' });
    pa.requestReview({ plan_id: plan.id });
    pa.recordReview({ plan_id: plan.id, decision: 'approved', reviewer: 'user-1' });
    pa.activatePlan(plan.id);
    pa.cancelPlan(plan.id, 'pivot');
    expect(() => pa.addMilestone({ plan_id: plan.id, title: 'late' }))
      .toThrow(/cancelled/);
  });
});

describe('PlanningAgent.requestReview', () => {
  it('moves draft → pending_review', () => {
    const plan = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o' });
    pa.addMilestone({ plan_id: plan.id, title: 'm' });
    const after = pa.requestReview({ plan_id: plan.id });
    expect(after.status).toBe('pending_review');
  });

  it('rejects a plan with zero milestones', () => {
    const plan = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o' });
    expect(() => pa.requestReview({ plan_id: plan.id })).toThrow(/zero milestones/);
  });

  it('rejects non-draft plans', () => {
    const plan = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o' });
    pa.addMilestone({ plan_id: plan.id, title: 'm' });
    pa.requestReview({ plan_id: plan.id });
    expect(() => pa.requestReview({ plan_id: plan.id })).toThrow(/only 'draft'/);
  });
});

describe('PlanningAgent.recordReview', () => {
  function readyPlan() {
    const plan = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o' });
    pa.addMilestone({ plan_id: plan.id, title: 'm' });
    pa.requestReview({ plan_id: plan.id });
    return plan;
  }

  it('approves a pending plan', () => {
    const plan = readyPlan();
    const { plan: after, review } = pa.recordReview({
      plan_id: plan.id, decision: 'approved', reviewer: 'user-1', reviewer_user_id: 'uid-1',
    });
    expect(after.status).toBe('approved');
    expect(after.approved_by).toBe('uid-1');
    expect(after.approved_at).toBeTruthy();
    expect(review.decision).toBe('approved');
  });

  it('rejects without notes throws', () => {
    const plan = readyPlan();
    expect(() => pa.recordReview({
      plan_id: plan.id, decision: 'rejected', reviewer: 'user-1',
    })).toThrow(/notes/);
  });

  it('needs_revision sends plan back to draft', () => {
    const plan = readyPlan();
    const { plan: after } = pa.recordReview({
      plan_id: plan.id, decision: 'needs_revision', reviewer: 'user-1', notes: 'tighten KPIs',
    });
    expect(after.status).toBe('draft');
  });

  it('rejects anonymous reviewer', () => {
    const plan = readyPlan();
    expect(() => pa.recordReview({
      plan_id: plan.id, decision: 'approved', reviewer: '   ',
    })).toThrow(/reviewer/);
  });

  it('appends a row per review (full audit history)', () => {
    const plan = readyPlan();
    pa.recordReview({ plan_id: plan.id, decision: 'needs_revision', reviewer: 'r1', notes: 'fix' });
    pa.requestReview({ plan_id: plan.id });
    pa.recordReview({ plan_id: plan.id, decision: 'approved', reviewer: 'r2' });
    expect(pa.reviewsForPlan(plan.id)).toHaveLength(2);
  });
});

describe('PlanningAgent.activatePlan', () => {
  function approvedPlan() {
    const plan = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o' });
    pa.addMilestone({ plan_id: plan.id, title: 'm1', assignee_agent: 'promotion-agent' });
    pa.addMilestone({ plan_id: plan.id, title: 'm2', assignee_role: 'founder' });
    pa.requestReview({ plan_id: plan.id });
    pa.recordReview({ plan_id: plan.id, decision: 'approved', reviewer: 'user-1' });
    return plan;
  }

  it('throws when not approved', () => {
    const plan = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o' });
    pa.addMilestone({ plan_id: plan.id, title: 'm' });
    expect(() => pa.activatePlan(plan.id)).toThrow(/approved/);
  });

  it('flips approved → active and sets start_date', () => {
    const plan = approvedPlan();
    const after = pa.activatePlan(plan.id);
    expect(after.status).toBe('active');
    expect(after.start_date).toBeTruthy();
  });

  it('materialises agent tasks for milestones with assignee_agent', () => {
    const plan = approvedPlan();
    const store = new AgentOsStore();
    pa.activatePlan(plan.id, { orchestratorStore: store });

    const milestones = pa.milestonesByPlan(plan.id);
    const withAgent = milestones.filter(m => m.assignee_agent);
    const withRole  = milestones.filter(m => !m.assignee_agent);

    // One task per agent-assigned milestone; none for role-only.
    for (const m of withAgent) {
      expect(m.materialised_task_id).toBeTruthy();
      const task = store.getTaskById(m.materialised_task_id!);
      expect(task).toBeDefined();
      expect(task!.agent).toBe(m.assignee_agent);
      expect(task!.input.plan_id).toBe(plan.id);
      expect(task!.input.milestone_id).toBe(m.id);
      expect(m.status).toBe('active');
    }
    for (const m of withRole) {
      expect(m.materialised_task_id).toBeNull();
      expect(m.status).toBe('pending');
    }
  });
});

describe('PlanningAgent.markMilestone + auto-complete', () => {
  it('auto-completes the plan when every milestone is terminal-success', () => {
    const plan = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o' });
    const m1 = pa.addMilestone({ plan_id: plan.id, title: 'a' });
    const m2 = pa.addMilestone({ plan_id: plan.id, title: 'b' });
    pa.requestReview({ plan_id: plan.id });
    pa.recordReview({ plan_id: plan.id, decision: 'approved', reviewer: 'u' });
    pa.activatePlan(plan.id);

    pa.markMilestone(m1.id, 'done');
    expect(pa.getPlan(plan.id)!.status).toBe('active');   // still active
    pa.markMilestone(m2.id, 'done');
    expect(pa.getPlan(plan.id)!.status).toBe('completed');
  });

  it('does NOT auto-complete if any milestone failed', () => {
    const plan = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o' });
    const m1 = pa.addMilestone({ plan_id: plan.id, title: 'a' });
    const m2 = pa.addMilestone({ plan_id: plan.id, title: 'b' });
    pa.requestReview({ plan_id: plan.id });
    pa.recordReview({ plan_id: plan.id, decision: 'approved', reviewer: 'u' });
    pa.activatePlan(plan.id);

    pa.markMilestone(m1.id, 'done');
    pa.markMilestone(m2.id, 'failed');
    expect(pa.getPlan(plan.id)!.status).toBe('active');
  });
});

describe('PlanningAgent.draftFromHermesHandoff', () => {
  it('creates a draft plan that retains source attribution', () => {
    const plan = pa.draftFromHermesHandoff({
      id:               'hh_abc',
      tenant_id:        TENANT,
      target_agent:     'promotion-agent',
      task_kind:        'content_from_trend',
      context_summary:  'Three rising signals about agentic compliance.',
      payload:          { signal_ids: ['sig_1', 'sig_2'] },
      source_signal_id: null,
      source_market_gap_id: null,
    });
    expect(plan.status).toBe('draft');
    expect(plan.source_handoff_id).toBe('hh_abc');
    expect(plan.source_signal_ids).toEqual(['sig_1', 'sig_2']);
    expect(plan.owner_agent).toBe('promotion-agent');
  });

  it('falls back to source_signal_id when payload has no signal_ids', () => {
    const plan = pa.draftFromHermesHandoff({
      id:                  'hh_xyz',
      tenant_id:           TENANT,
      target_agent:        'decision-agent',
      source_signal_id:    'sig_99',
      source_market_gap_id: null,
    });
    expect(plan.source_signal_ids).toEqual(['sig_99']);
  });
});

describe('PlanningAgent persist hook', () => {
  it('invokes savePlan + saveMilestone + saveReview', () => {
    const saved = { plans: 0, milestones: 0, reviews: 0 };
    pa.setPersistHook({
      savePlan:      () => { saved.plans++; },
      saveMilestone: () => { saved.milestones++; },
      saveReview:    () => { saved.reviews++; },
    });
    const plan = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o' });
    pa.addMilestone({ plan_id: plan.id, title: 'm' });
    pa.requestReview({ plan_id: plan.id });
    pa.recordReview({ plan_id: plan.id, decision: 'approved', reviewer: 'u' });
    pa.activatePlan(plan.id);
    expect(saved.plans).toBeGreaterThanOrEqual(3);     // draft + review/approve + activate
    expect(saved.milestones).toBeGreaterThanOrEqual(1);
    expect(saved.reviews).toBe(1);
  });
});

describe('PlanningAgent.cancelPlan', () => {
  it('cancels an active plan with a reason', () => {
    const plan = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o' });
    pa.addMilestone({ plan_id: plan.id, title: 'm' });
    pa.requestReview({ plan_id: plan.id });
    pa.recordReview({ plan_id: plan.id, decision: 'approved', reviewer: 'u' });
    pa.activatePlan(plan.id);
    const after = pa.cancelPlan(plan.id, 'priority shifted');
    expect(after.status).toBe('cancelled');
    expect(after.rejected_reason).toBe('priority shifted');
  });

  it('rejects cancelling an already-terminal plan', () => {
    const plan = pa.draftPlan({ tenant_id: TENANT, title: 't', objective: 'o' });
    pa.addMilestone({ plan_id: plan.id, title: 'm' });
    pa.requestReview({ plan_id: plan.id });
    pa.recordReview({ plan_id: plan.id, decision: 'rejected', reviewer: 'u', notes: 'no' });
    expect(() => pa.cancelPlan(plan.id, 'why')).not.toThrow();   // rejected → cancelled is allowed
    expect(() => pa.cancelPlan(plan.id, 'again')).toThrow(/already/);
  });
});
