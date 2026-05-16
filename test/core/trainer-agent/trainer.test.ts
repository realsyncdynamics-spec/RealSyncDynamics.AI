import { describe, it, expect, beforeEach } from 'vitest';
import {
  TrainerAgent,
  __resetDefaultTrainerForTests,
} from '../../../src/core/trainer-agent/trainer';
import { TrainerStore } from '../../../src/core/trainer-agent/store';
import {
  defaultScoreOutput, aggregateScore, shouldApprove, riskBand,
} from '../../../src/core/trainer-agent/qualityRubric';
import {
  createHandoff, validateHandoffArgs, transitionHandoff,
} from '../../../src/core/trainer-agent/handoff';
import {
  suggestRotationRole, createRotationLog,
} from '../../../src/core/trainer-agent/rotation';
import type {
  AgentOutput, AgentProfile,
} from '../../../src/core/trainer-agent/types';

beforeEach(() => {
  __resetDefaultTrainerForTests();
});

function output(o: Partial<AgentOutput> = {}): AgentOutput {
  return {
    task_id: 'task_1',
    agent_name: 'promotion-agent',
    content: 'Wir empfehlen die Aktualisierung der DSGVO-Konfiguration. Das schließt das Pre-Consent-Tracking auf der Marketing-Page. Verify im Network-Tab nach dem Patch.',
    self_confidence: 75,
    evidence: ['evt_01ABC', 'evt_01DEF'],
    risk_dimensions: ['privacy'],
    created_at: '2026-05-16T22:00:00Z',
    ...o,
  };
}

function profile(p: Partial<AgentProfile> = {}): AgentProfile {
  return {
    id: 'p1',
    name: 'promotion-agent',
    role: 'PromotionAgent',
    strengths: [],
    weaknesses: [],
    current_skill_level: 50,
    last_training_at: null,
    created_at: '2026-05-01T00:00:00Z',
    ...p,
  };
}

// ── 1. Rubric ──────────────────────────────────────────────────────

describe('qualityRubric', () => {
  it('high-confidence + evidence + actionable output scores ≥ 80', () => {
    const scores = defaultScoreOutput(output());
    const agg = aggregateScore(scores);
    expect(agg).toBeGreaterThanOrEqual(80);
    expect(shouldApprove(agg)).toBe(true);
  });

  it('empty content scores 0 on correctness + completeness', () => {
    const scores = defaultScoreOutput(output({ content: '' }));
    expect(scores.correctness).toBe(0);
    expect(scores.completeness).toBe(0);
  });

  it('no-evidence outputs drop hard on evidence_quality', () => {
    const scores = defaultScoreOutput(output({ evidence: [] }));
    expect(scores.evidence_quality).toBe(0);
    expect(aggregateScore(scores)).toBeLessThan(80);
  });

  it('risky vocabulary + no evidence triggers high risk_level → lower aggregate', () => {
    const scores = defaultScoreOutput(output({
      content: 'Sicheres Bußgeld droht bei jedem Verstoß. Das Deploy ist strafbar.',
      evidence: [],
    }));
    expect(scores.risk_level).toBeGreaterThanOrEqual(70);
    expect(aggregateScore(scores)).toBeLessThan(80);
  });

  it('riskBand maps aggregate to coarse colour', () => {
    expect(riskBand(95)).toBe('green');
    expect(riskBand(70)).toBe('yellow');
    expect(riskBand(40)).toBe('red');
  });
});

// ── 2. TrainerAgent.reviewOutput ──────────────────────────────────

describe('TrainerAgent.reviewOutput', () => {
  it('approves a good output and emits approve_output recommendation', () => {
    const t = new TrainerAgent();
    const { review, recommendation } = t.reviewOutput(output());
    expect(review.approved).toBe(true);
    expect(recommendation.kind).toBe('approve_output');
    expect(review.score).toBeGreaterThanOrEqual(80);
  });

  it('blocks a weak output and emits block_output recommendation + improvement plan', () => {
    const t = new TrainerAgent();
    const { review, recommendation } = t.reviewOutput(output({
      content: 'lol',
      evidence: [],
      self_confidence: 20,
    }));
    expect(review.approved).toBe(false);
    expect(recommendation.kind).toBe('block_output');
    expect(review.issues_found.length).toBeGreaterThan(0);
  });

  it('persists the review to the store', () => {
    const t = new TrainerAgent();
    t.reviewOutput(output({ task_id: 'task_42' }));
    const stored = t.store.listReviewsForAgent('promotion-agent');
    expect(stored).toHaveLength(1);
    expect(stored[0]?.task_id).toBe('task_42');
  });
});

// ── 3. TrainerAgent.trainAgent ────────────────────────────────────

describe('TrainerAgent.trainAgent', () => {
  it('produces a training session with role-aware lesson + improvement plan', () => {
    const t = new TrainerAgent();
    const { review } = t.reviewOutput(output({ content: 'short', evidence: [], self_confidence: 30 }));
    const session = t.trainAgent({
      agent_name: 'promotion-agent',
      agent_role: 'PromotionAgent',
      review,
      task_brief: 'Erzeuge einen LinkedIn-Post aus einem Audit-Finding.',
    });
    expect(session.lesson).toMatch(/Role principle/);
    expect(session.lesson).toMatch(/Improvement plan/);
    expect(session.improvement_plan.length).toBeGreaterThan(0);
    expect(session.score_before).toBe(review.score);
    expect(session.score_after).toBeNull();
  });

  it('bumps last_training_at on the profile when one exists', () => {
    const t = new TrainerAgent();
    t.store.upsertProfile(profile());
    const { review } = t.reviewOutput(output({ content: 'short', evidence: [], self_confidence: 30 }));
    t.trainAgent({ agent_name: 'promotion-agent', agent_role: 'PromotionAgent', review });
    const p = t.store.getProfile('promotion-agent');
    expect(p?.last_training_at).not.toBeNull();
  });

  it('recordPostTrainingScore updates score_after', () => {
    const t = new TrainerAgent();
    const { review } = t.reviewOutput(output({ content: 'short', evidence: [], self_confidence: 30 }));
    const session = t.trainAgent({ agent_name: 'promotion-agent', agent_role: 'PromotionAgent', review });
    const updated = t.recordPostTrainingScore(session.id, 86);
    expect(updated?.score_after).toBe(86);
  });
});

// ── 4. reviewAndMaybeCoach (one-shot) ─────────────────────────────

describe('TrainerAgent.reviewAndMaybeCoach', () => {
  it('skips training when output is approved', () => {
    const t = new TrainerAgent();
    const r = t.reviewAndMaybeCoach({ output: output(), agent_role: 'PromotionAgent' });
    expect(r.review.approved).toBe(true);
    expect(r.training).toBeUndefined();
  });

  it('runs training when output is blocked', () => {
    const t = new TrainerAgent();
    const r = t.reviewAndMaybeCoach({
      output:     output({ content: 'short', evidence: [], self_confidence: 30 }),
      agent_role: 'PromotionAgent',
    });
    expect(r.review.approved).toBe(false);
    expect(r.training).toBeDefined();
  });
});

// ── 5. Handoff helpers ────────────────────────────────────────────

describe('handoff', () => {
  it('createHandoff produces a valid pending packet', () => {
    const h = createHandoff({
      source_agent: 'promotion-agent',
      target_agent: 'research-agent',
      task_id: 't1',
      context_summary: 'Need stronger facts for LinkedIn post.',
      known_facts: ['Audit found 3 trackers.'],
      open_questions: ['What is the consent posture?'],
      recommended_next_step: 'Pull last consent log entries.',
    });
    expect(h.status).toBe('pending');
    expect(h.id).toMatch(/^handoff_/);
  });

  it('validateHandoffArgs rejects same source + target', () => {
    const errs = validateHandoffArgs({
      source_agent: 'x', target_agent: 'x',
      task_id: 't', context_summary: 'ctx',
      recommended_next_step: 'step',
    });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('transitionHandoff to completed sets resolved_at', () => {
    const h = createHandoff({
      source_agent: 'a', target_agent: 'b',
      task_id: 't', context_summary: 'c', recommended_next_step: 's',
    });
    const done = transitionHandoff(h, 'completed');
    expect(done.status).toBe('completed');
    expect(done.resolved_at).toBeDefined();
  });

  it('cannot transition out of a terminal state', () => {
    const h = createHandoff({
      source_agent: 'a', target_agent: 'b',
      task_id: 't', context_summary: 'c', recommended_next_step: 's',
    });
    const done = transitionHandoff(h, 'completed');
    expect(() => transitionHandoff(done, 'accepted')).toThrow(/terminal state/);
  });
});

// ── 6. Rotation ───────────────────────────────────────────────────

describe('rotation', () => {
  it('suggestRotationRole returns a different role for the source', () => {
    const r = suggestRotationRole('PromotionAgent');
    expect(r).not.toBe('PromotionAgent');
    expect(r).not.toBeNull();
  });

  it('TrainerAgent never rotates', () => {
    expect(suggestRotationRole('TrainerAgent')).toBeNull();
  });

  it('createRotationLog stamps created_at', () => {
    const log = createRotationLog({
      agent_name: 'a',
      original_role: 'ResearchAgent',
      rotated_role: 'PlanningAgent',
      task: 't', result: 'r', trainer_feedback: 'f',
      produced_usable_output: true,
    });
    expect(log.created_at).toBeDefined();
  });
});

// ── 7. requestPeerHelp ────────────────────────────────────────────

describe('TrainerAgent.requestPeerHelp', () => {
  it('assigns a helper that matches the preferred role', () => {
    const t = new TrainerAgent();
    t.store.upsertProfile(profile({ name: 'promotion-agent', role: 'PromotionAgent' }));
    t.store.upsertProfile(profile({ name: 'research-agent',  role: 'ResearchAgent' }));
    const { request, recommendation } = t.requestPeerHelp({
      requesting_agent: 'promotion-agent',
      task_id: 't',
      context: 'Need facts',
      blocker: 'no evidence',
      preferred_roles: ['ResearchAgent'],
    });
    expect(request.assigned_to).toBe('research-agent');
    expect(recommendation.kind).toBe('request_peer_help');
  });

  it('returns no assignment when no candidate matches', () => {
    const t = new TrainerAgent();
    const { request } = t.requestPeerHelp({
      requesting_agent: 'promotion-agent',
      task_id: 't',
      context: 'x',
      blocker: 'y',
      preferred_roles: ['ResearchAgent'],
      candidate_profiles: [],
    });
    expect(request.assigned_to).toBeUndefined();
  });
});

// ── 8. createLearningNote + storeTrainingSession ──────────────────

describe('learning notes + spec passthrough', () => {
  it('createLearningNote persists with tags', () => {
    const t = new TrainerAgent();
    const note = t.createLearningNote({
      author_agent: 'trainer-agent',
      about_agent:  'promotion-agent',
      title:        'Hook framing for B2B governance',
      content:      'Lead with a specific finding, not with a category.',
      tags:         ['promotion', 'hook'],
    });
    expect(note.id).toMatch(/^note_/);
    expect(t.store.listNotes({ tag: 'hook' })).toHaveLength(1);
  });
});

// ── 9. Safety rule (spec §12) ─────────────────────────────────────

describe('safety: trainer never decides', () => {
  it('every code path returns a recommendation, not an enforced action', () => {
    const t = new TrainerAgent();
    const r1 = t.reviewOutput(output()).recommendation;
    const r2 = t.requestPeerHelp({
      requesting_agent: 'a', task_id: 't', context: 'c', blocker: 'b',
    }).recommendation;
    const r3 = t.rotateAgentRole({
      agent_name: 'promotion-agent',
      original_role: 'PromotionAgent',
      task: 'tk', result: 'rs',
      produced_usable_output: true,
    }).recommendation;
    for (const r of [r1, r2, r3]) {
      expect(r.suggested_action).toBeDefined();
      expect(typeof r.suggested_action).toBe('string');
      expect(['approve_output', 'block_output', 'retrain_agent',
              'request_peer_help', 'escalate_to_human', 'rotate_role'])
        .toContain(r.kind);
    }
  });
});
