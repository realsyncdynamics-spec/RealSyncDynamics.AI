import { describe, expect, it } from 'vitest';
import {
  classifySafetyState,
  deriveReviewDisposition,
  evaluatePostRedRecovery,
  isPermittedRedEmergencyAction,
  validateIndependentReviewSet,
  type IndependentSafetyReview,
} from '../../src/lib/enterprise-ai-os/safety-control-plane';

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
    uncertainties: [],
    recommendedAction: 'human review',
    confidence: 0.8,
  };
}

describe('Safety Control Plane · traffic light', () => {
  it('returns GREEN only when no escalation signal exists', () => {
    expect(classifySafetyState([])).toEqual({
      light: 'green',
      reasons: [],
      mustStop: false,
      requiresIndependentReview: false,
      requiresHumanDecision: false,
    });
  });

  it('returns YELLOW for uncertainty and stops execution', () => {
    const result = classifySafetyState([
      { kind: 'scope_uncertain', reason: 'Target scope cannot be established.' },
    ]);

    expect(result.light).toBe('yellow');
    expect(result.mustStop).toBe(true);
    expect(result.requiresIndependentReview).toBe(true);
    expect(result.requiresHumanDecision).toBe(true);
  });

  it('gives RED precedence over YELLOW', () => {
    const result = classifySafetyState([
      { kind: 'approval_required', reason: 'Approval is needed.' },
      { kind: 'cross_tenant_risk', reason: 'Tenant boundary may be crossed.' },
    ]);

    expect(result.light).toBe('red');
    expect(result.mustStop).toBe(true);
    expect(result.requiresIndependentReview).toBe(false);
  });

  it('treats any hardStop signal as RED', () => {
    const result = classifySafetyState([
      {
        kind: 'unexpected_runtime_state',
        reason: 'Runtime invariant failed.',
        hardStop: true,
      },
    ]);

    expect(result.light).toBe('red');
  });
});

describe('Safety Control Plane · RED emergency actions', () => {
  it('allows only bounded pre-authorized protective actions', () => {
    expect(isPermittedRedEmergencyAction('pause_workflow')).toBe(true);
    expect(isPermittedRedEmergencyAction('preserve_evidence')).toBe(true);
    expect(isPermittedRedEmergencyAction('notify_human')).toBe(true);

    expect(isPermittedRedEmergencyAction('deploy_fix')).toBe(false);
    expect(isPermittedRedEmergencyAction('delete_customer_data')).toBe(false);
    expect(isPermittedRedEmergencyAction('send_customer_email')).toBe(false);
  });
});

describe('Safety Control Plane · independent reviewers', () => {
  it('requires exactly three isolated reviewers', () => {
    const valid = [
      review('A', 'iso-A', 'green'),
      review('B', 'iso-B', 'green'),
      review('C', 'iso-C', 'yellow'),
    ];

    expect(validateIndependentReviewSet(valid).valid).toBe(true);

    const invalid = [
      review('A', 'same', 'green'),
      review('A', 'same', 'green'),
      review('C', 'iso-C', 'green'),
    ];

    const result = validateIndependentReviewSet(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('distinct reviewer');
    expect(result.errors.join(' ')).toContain('distinct isolation');
  });

  it('never lets two GREEN reviews outvote one RED review', () => {
    const result = deriveReviewDisposition([
      review('A', 'iso-A', 'green'),
      review('B', 'iso-B', 'green'),
      review('C', 'iso-C', 'red'),
    ]);

    expect(result.recommendedLight).toBe('red');
    expect(result.requiresHumanDecision).toBe(true);
    expect(result.reason).toContain('majority voting is forbidden');
  });

  it('still requires a human when all three reviewers return GREEN', () => {
    const result = deriveReviewDisposition([
      review('A', 'iso-A', 'green'),
      review('B', 'iso-B', 'green'),
      review('C', 'iso-C', 'green'),
    ]);

    expect(result.recommendedLight).toBe('green');
    expect(result.requiresHumanDecision).toBe(true);
  });

  it('fails closed when the review set itself is invalid', () => {
    const result = deriveReviewDisposition([
      review('A', 'iso-A', 'green'),
      review('B', 'iso-B', 'green'),
    ]);

    expect(result.recommendedLight).toBe('red');
    expect(result.requiresHumanDecision).toBe(true);
  });
});

describe('Safety Control Plane · post-RED recovery', () => {
  const complete = {
    rootCauseIdentified: true,
    remediationApplied: true,
    independentSafetyReviewComplete: true,
    verificationPassed: true,
    regressionTestsPassed: true,
    permissionsRevalidated: true,
    residualRiskDocumented: true,
    humanRestartApproval: true,
    restartAtReducedAutonomy: true,
  };

  it('does not allow a new automation request while any recovery step is missing', () => {
    const result = evaluatePostRedRecovery({
      ...complete,
      humanRestartApproval: false,
      restartAtReducedAutonomy: false,
    });

    expect(result.eligibleForNewAutomationRequest).toBe(false);
    expect(result.missing).toEqual(
      expect.arrayContaining(['humanRestartApproval', 'restartAtReducedAutonomy']),
    );
  });

  it('permits a new automation request only after the full recovery contract', () => {
    const result = evaluatePostRedRecovery(complete);

    expect(result.eligibleForNewAutomationRequest).toBe(true);
    expect(result.missing).toEqual([]);
  });
});
