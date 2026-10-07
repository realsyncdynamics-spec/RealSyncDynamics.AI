import { describe, expect, it } from 'vitest';
import {
  SafetyReviewCoordinator,
  type HumanSafetyReviewBundle,
} from '../../../src/core/runtime/safety-review';
import type { IndependentSafetyReview } from '../../../src/lib/enterprise-ai-os/safety-control-plane';

const H = (char: string) => char.repeat(64);

function makeCoordinator() {
  let id = 0;
  const times = [
    '2026-10-07T01:00:00.000Z',
    '2026-10-07T01:00:01.000Z',
    '2026-10-07T01:00:02.000Z',
    '2026-10-07T01:00:03.000Z',
    '2026-10-07T01:00:04.000Z',
    '2026-10-07T01:00:05.000Z',
  ];
  let tick = 0;
  return new SafetyReviewCoordinator({
    id: () => `case-${++id}`,
    clock: () => new Date(times[Math.min(tick++, times.length - 1)]),
  });
}

const reviewers = [
  { reviewerId: 'reviewer-a', isolationKey: 'iso-a' },
  { reviewerId: 'reviewer-b', isolationKey: 'iso-b' },
  { reviewerId: 'reviewer-c', isolationKey: 'iso-c' },
] as const;

function openCase(coordinator: SafetyReviewCoordinator) {
  return coordinator.openCase({
    tenantId: 'tenant-1',
    executionId: 'exec-1',
    agentId: 'implementation-agent',
    skillId: 'system.change',
    caseFingerprint: H('a'),
    actionHash: H('b'),
    evidenceHash: H('c'),
    evidenceRefs: ['evidence://bundle/1'],
    policyVersion: 'policy-v7',
    producerUserId: 'producer-user',
    reviewers,
  });
}

function review(
  reviewerId: string,
  isolationKey: string,
  light: 'green' | 'yellow' | 'red',
): IndependentSafetyReview {
  return {
    reviewId: `review-${reviewerId}`,
    reviewerId,
    isolationKey,
    peerReportsVisible: false,
    light,
    reasons: [`${reviewerId} reason`],
    uncertainties: [`${reviewerId} uncertainty`],
    recommendedAction: 'human review',
    confidence: 0.8,
  };
}

function submitAll(
  coordinator: SafetyReviewCoordinator,
  lights: readonly ['green' | 'yellow' | 'red', 'green' | 'yellow' | 'red', 'green' | 'yellow' | 'red'],
) {
  const current = coordinator.getCase('case-1')!;
  coordinator.submitReview({
    caseId: current.caseId,
    caseVersion: 1,
    caseFingerprint: current.caseFingerprint,
    reportHash: H('d'),
    review: review('reviewer-a', 'iso-a', lights[0]),
  });
  coordinator.submitReview({
    caseId: current.caseId,
    caseVersion: 1,
    caseFingerprint: current.caseFingerprint,
    reportHash: H('e'),
    review: review('reviewer-b', 'iso-b', lights[1]),
  });
  coordinator.submitReview({
    caseId: current.caseId,
    caseVersion: 1,
    caseFingerprint: current.caseFingerprint,
    reportHash: H('f'),
    review: review('reviewer-c', 'iso-c', lights[2]),
  });
}

describe('SafetyReviewCoordinator', () => {
  it('requires exactly three distinct reviewer identities and isolation contexts', () => {
    const coordinator = makeCoordinator();

    expect(() =>
      coordinator.openCase({
        tenantId: 'tenant-1',
        executionId: 'exec-1',
        agentId: 'agent',
        skillId: 'skill.action',
        caseFingerprint: H('a'),
        actionHash: H('b'),
        evidenceHash: H('c'),
        evidenceRefs: [],
        policyVersion: 'v1',
        reviewers: [
          { reviewerId: 'a', isolationKey: 'same' },
          { reviewerId: 'a', isolationKey: 'same' },
          { reviewerId: 'c', isolationKey: 'c' },
        ],
      }),
    ).toThrow(/distinct/i);
  });

  it('gives a reviewer only the frozen case packet and never peer reports', () => {
    const coordinator = makeCoordinator();
    openCase(coordinator);

    const packet = coordinator.getReviewerPacket('case-1', 'reviewer-a');

    expect(packet.peerReportsVisible).toBe(false);
    expect(packet.evidenceHash).toBe(H('c'));
    expect(packet.evidenceRefs).toEqual(['evidence://bundle/1']);
    expect('reviews' in packet).toBe(false);
    expect('synthesis' in packet).toBe(false);
    expect(Object.isFrozen(packet)).toBe(true);
    expect(Object.isFrozen(packet.evidenceRefs)).toBe(true);
  });

  it('rejects a report submitted from the wrong isolation context', () => {
    const coordinator = makeCoordinator();
    const current = openCase(coordinator);

    expect(() =>
      coordinator.submitReview({
        caseId: current.caseId,
        caseVersion: 1,
        caseFingerprint: current.caseFingerprint,
        reportHash: H('d'),
        review: review('reviewer-a', 'iso-wrong', 'green'),
      }),
    ).toThrow(/isolation context/i);
  });

  it('does not expose a human bundle until all three independent reports exist', () => {
    const coordinator = makeCoordinator();
    const current = openCase(coordinator);

    coordinator.submitReview({
      caseId: current.caseId,
      caseVersion: 1,
      caseFingerprint: current.caseFingerprint,
      reportHash: H('d'),
      review: review('reviewer-a', 'iso-a', 'green'),
    });

    expect(() => coordinator.getHumanBundle(current.caseId)).toThrow(/all three/i);
    expect(coordinator.getCase(current.caseId)?.status).toBe('awaiting_reviews');
  });

  it('never lets two GREEN reviewers outvote one RED reviewer', () => {
    const coordinator = makeCoordinator();
    openCase(coordinator);
    submitAll(coordinator, ['green', 'green', 'red']);

    const bundle = coordinator.getHumanBundle('case-1');

    expect(bundle.originalReviews).toHaveLength(3);
    expect(bundle.disposition.recommendedLight).toBe('red');
    expect(bundle.disposition.requiresHumanDecision).toBe(true);
    expect(bundle.disposition.reason).toContain('majority voting is forbidden');
    expect(coordinator.getCase('case-1')?.status).toBe('awaiting_human');
  });

  it('still requires a human decision when all three reviewers report GREEN', () => {
    const coordinator = makeCoordinator();
    openCase(coordinator);
    submitAll(coordinator, ['green', 'green', 'green']);

    const bundle = coordinator.getHumanBundle('case-1');

    expect(bundle.disposition.recommendedLight).toBe('green');
    expect(bundle.disposition.requiresHumanDecision).toBe(true);
  });

  it('records synthesis as read-only advisory output and does not authorize execution', () => {
    const coordinator = makeCoordinator();
    openCase(coordinator);
    submitAll(coordinator, ['green', 'yellow', 'green']);

    const before: HumanSafetyReviewBundle = coordinator.getHumanBundle('case-1');
    const originalHashes = before.originalReviews.map((item) => item.reportHash);

    const synthesis = coordinator.recordSynthesis({
      caseId: 'case-1',
      caseVersion: 1,
      caseFingerprint: H('a'),
      synthesisId: 'synth-1',
      agentId: 'safety-synthesis-agent',
      analysisHash: H('1'),
      proposal: 'Require a narrower scope and new approval.',
      rationale: 'Reviewer B identified unresolved scope uncertainty.',
      uncertainties: ['External API behavior remains uncertain.'],
    });

    const after = coordinator.getHumanBundle('case-1');

    expect(synthesis.authorizesExecution).toBe(false);
    expect(after.originalReviews.map((item) => item.reportHash)).toEqual(originalHashes);
    expect(after.humanDecision).toBeUndefined();
    expect(after.caseSnapshot.status).toBe('awaiting_human');
  });

  it('binds human GO to the exact frozen version and refuses producer self-review', () => {
    const coordinator = makeCoordinator();
    openCase(coordinator);
    submitAll(coordinator, ['green', 'green', 'green']);

    expect(() =>
      coordinator.recordHumanDecision({
        caseId: 'case-1',
        caseVersion: 1,
        caseFingerprint: H('a'),
        userId: 'producer-user',
        decision: 'approve',
        intent: 'I approve.',
      }),
    ).toThrow(/different users/i);

    expect(() =>
      coordinator.recordHumanDecision({
        caseId: 'case-1',
        caseVersion: 1,
        caseFingerprint: H('9'),
        userId: 'human-owner',
        decision: 'approve',
        intent: 'I verified the exact reviewed action.',
      }),
    ).toThrow(/fingerprint/i);

    const decision = coordinator.recordHumanDecision({
      caseId: 'case-1',
      caseVersion: 1,
      caseFingerprint: H('a'),
      userId: 'human-owner',
      decision: 'approve_with_conditions',
      intent: 'Proceed only with the reduced scope reviewed above.',
      conditions: ['Read-only API scope only.'],
    });

    expect(decision.decision).toBe('approve_with_conditions');
    expect(coordinator.getCase('case-1')?.status).toBe('human_decided');
    expect(coordinator.getHumanBundle('case-1').humanDecision?.userId).toBe('human-owner');
  });

  it('never resumes or executes the original action after human approval', () => {
    const coordinator = makeCoordinator();
    openCase(coordinator);
    submitAll(coordinator, ['green', 'green', 'green']);

    coordinator.recordHumanDecision({
      caseId: 'case-1',
      caseVersion: 1,
      caseFingerprint: H('a'),
      userId: 'human-owner',
      decision: 'approve',
      intent: 'Approved after reading all three original reports.',
    });

    const snapshot = coordinator.getCase('case-1')!;
    expect(snapshot.status).toBe('human_decided');
    // No execute/resume authority exists on the coordinator by design.
    expect('execute' in coordinator).toBe(false);
    expect('resume' in coordinator).toBe(false);
  });
});


describe('SafetyReviewCoordinator — escalation hardening', () => {
  it('does not let a RED review disposition be directly approved', () => {
    const coordinator = makeCoordinator();
    openCase(coordinator);
    submitAll(coordinator, ['green', 'green', 'red']);

    expect(() =>
      coordinator.recordHumanDecision({
        caseId: 'case-1',
        caseVersion: 1,
        caseFingerprint: H('a'),
        userId: 'human-owner',
        decision: 'approve',
        intent: 'Attempt to override the RED disposition.',
      }),
    ).toThrow(/cannot be directly approved/i);

    const decision = coordinator.recordHumanDecision({
      caseId: 'case-1',
      caseVersion: 1,
      caseFingerprint: H('a'),
      userId: 'human-owner',
      decision: 'modify',
      intent: 'Create a safer replacement action instead of executing this version.',
    });

    expect(decision.decision).toBe('modify');
  });

  it('requires the synthesis agent to be separate from producer and reviewers', () => {
    const coordinator = makeCoordinator();
    openCase(coordinator);
    submitAll(coordinator, ['green', 'yellow', 'green']);

    expect(() =>
      coordinator.recordSynthesis({
        caseId: 'case-1',
        caseVersion: 1,
        caseFingerprint: H('a'),
        synthesisId: 'synth-1',
        agentId: 'reviewer-a',
        analysisHash: H('1'),
        proposal: 'Proposal',
        rationale: 'Rationale',
      }),
    ).toThrow(/separate from all three safety reviewers/i);

    expect(() =>
      coordinator.recordSynthesis({
        caseId: 'case-1',
        caseVersion: 1,
        caseFingerprint: H('a'),
        synthesisId: 'synth-2',
        agentId: 'implementation-agent',
        analysisHash: H('2'),
        proposal: 'Proposal',
        rationale: 'Rationale',
      }),
    ).toThrow(/separate from the producing agent/i);
  });
});
