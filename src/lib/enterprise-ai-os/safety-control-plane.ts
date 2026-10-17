/**
 * Internal safety-control-plane primitives.
 *
 * This module is deliberately pure: no model calls, no database writes and no
 * side effects. It defines deterministic safety contracts that higher-level
 * orchestration must enforce.
 *
 * AI safety reviewers are advisory only. They NEVER satisfy the Human Review
 * Protocol (HRP) and never authorize execution.
 */

export type SafetyLight = 'green' | 'yellow' | 'red';

export type SafetySignalKind =
  | 'policy_violation'
  | 'scope_uncertain'
  | 'effect_uncertain'
  | 'irreversible_effect'
  | 'privilege_escalation_attempt'
  | 'cross_tenant_risk'
  | 'secret_exposure_risk'
  | 'prompt_injection_suspected'
  | 'approval_required'
  | 'approval_bypass_attempt'
  | 'evidence_incomplete'
  | 'control_plane_unavailable'
  | 'unexpected_runtime_state'
  | 'human_safety_risk';

export interface SafetySignal {
  kind: SafetySignalKind;
  reason: string;
  /** A hard stop always yields RED regardless of other signals. */
  hardStop?: boolean;
}

export interface SafetyClassification {
  light: SafetyLight;
  reasons: string[];
  mustStop: boolean;
  requiresIndependentReview: boolean;
  requiresHumanDecision: boolean;
}

const RED_KINDS = new Set<SafetySignalKind>([
  'privilege_escalation_attempt',
  'cross_tenant_risk',
  'approval_bypass_attempt',
  'control_plane_unavailable',
  'human_safety_risk',
]);

const YELLOW_KINDS = new Set<SafetySignalKind>([
  'policy_violation',
  'scope_uncertain',
  'effect_uncertain',
  'irreversible_effect',
  'secret_exposure_risk',
  'prompt_injection_suspected',
  'approval_required',
  'evidence_incomplete',
  'unexpected_runtime_state',
]);

/**
 * Deterministic precedence: RED > YELLOW > GREEN.
 *
 * GREEN means "within an already-authorized bounded policy", not "safe forever".
 * YELLOW pauses execution and requires three isolated advisory reviews followed
 * by a human decision.
 * RED stops normal work immediately and permits only pre-authorized emergency
 * safety actions.
 */
export function classifySafetyState(signals: readonly SafetySignal[]): SafetyClassification {
  const reasons = signals.map((signal) => signal.reason);

  if (signals.some((signal) => signal.hardStop || RED_KINDS.has(signal.kind))) {
    return {
      light: 'red',
      reasons,
      mustStop: true,
      requiresIndependentReview: false,
      requiresHumanDecision: true,
    };
  }

  if (signals.some((signal) => YELLOW_KINDS.has(signal.kind))) {
    return {
      light: 'yellow',
      reasons,
      mustStop: true,
      requiresIndependentReview: true,
      requiresHumanDecision: true,
    };
  }

  return {
    light: 'green',
    reasons,
    mustStop: false,
    requiresIndependentReview: false,
    requiresHumanDecision: false,
  };
}

export type RedEmergencyAction =
  | 'pause_workflow'
  | 'block_new_executions'
  | 'disable_write_operations'
  | 'revoke_temporary_token'
  | 'isolate_session'
  | 'close_connection'
  | 'freeze_queue'
  | 'preserve_logs'
  | 'preserve_evidence'
  | 'create_incident_snapshot'
  | 'notify_human';

const RED_EMERGENCY_ACTIONS = new Set<RedEmergencyAction>([
  'pause_workflow',
  'block_new_executions',
  'disable_write_operations',
  'revoke_temporary_token',
  'isolate_session',
  'close_connection',
  'freeze_queue',
  'preserve_logs',
  'preserve_evidence',
  'create_incident_snapshot',
  'notify_human',
]);

export function isPermittedRedEmergencyAction(action: string): action is RedEmergencyAction {
  return RED_EMERGENCY_ACTIONS.has(action as RedEmergencyAction);
}

export interface IndependentSafetyReview {
  reviewId: string;
  reviewerId: string;
  /** Must be unique per reviewer to demonstrate isolated review contexts. */
  isolationKey: string;
  /** Must remain false. Reviewers may not see peer reports. */
  peerReportsVisible: false;
  light: SafetyLight;
  reasons: string[];
  uncertainties: string[];
  recommendedAction: string;
  confidence: number;
}

export interface ReviewSetValidation {
  valid: boolean;
  errors: string[];
}

export function validateIndependentReviewSet(
  reviews: readonly IndependentSafetyReview[],
): ReviewSetValidation {
  const errors: string[] = [];

  if (reviews.length !== 3) {
    errors.push('Exactly three independent safety reviews are required.');
  }

  const reviewerIds = new Set(reviews.map((review) => review.reviewerId));
  if (reviewerIds.size !== reviews.length) {
    errors.push('Each safety review must come from a distinct reviewer.');
  }

  const isolationKeys = new Set(reviews.map((review) => review.isolationKey));
  if (isolationKeys.size !== reviews.length) {
    errors.push('Each safety review must use a distinct isolation context.');
  }

  if (reviews.some((review) => review.peerReportsVisible !== false)) {
    errors.push('Safety reviewers must never receive peer reports.');
  }

  if (reviews.some((review) => review.confidence < 0 || review.confidence > 1)) {
    errors.push('Reviewer confidence must be between 0 and 1.');
  }

  return { valid: errors.length === 0, errors };
}

export interface ReviewDisposition {
  /** Advisory only. Human approval is still mandatory. */
  recommendedLight: SafetyLight;
  requiresHumanDecision: true;
  reason: string;
}

/**
 * No majority voting. One RED review can never be outvoted by two GREEN reviews.
 * Even three GREEN reviews after a YELLOW escalation remain advisory and require
 * a human decision.
 */
export function deriveReviewDisposition(
  reviews: readonly IndependentSafetyReview[],
): ReviewDisposition {
  const validation = validateIndependentReviewSet(reviews);
  if (!validation.valid) {
    return {
      recommendedLight: 'red',
      requiresHumanDecision: true,
      reason: `Invalid independent-review set: ${validation.errors.join(' ')}`,
    };
  }

  if (reviews.some((review) => review.light === 'red')) {
    return {
      recommendedLight: 'red',
      requiresHumanDecision: true,
      reason: 'At least one independent reviewer reported RED; majority voting is forbidden.',
    };
  }

  if (reviews.some((review) => review.light === 'yellow')) {
    return {
      recommendedLight: 'yellow',
      requiresHumanDecision: true,
      reason: 'At least one independent reviewer reported YELLOW.',
    };
  }

  return {
    recommendedLight: 'green',
    requiresHumanDecision: true,
    reason: 'All three reviewers reported GREEN, but only a human may authorize continuation.',
  };
}

export interface PostRedRecoveryEvidence {
  rootCauseIdentified: boolean;
  remediationApplied: boolean;
  independentSafetyReviewComplete: boolean;
  verificationPassed: boolean;
  regressionTestsPassed: boolean;
  permissionsRevalidated: boolean;
  residualRiskDocumented: boolean;
  humanRestartApproval: boolean;
  restartAtReducedAutonomy: boolean;
}

export interface PostRedRecoveryDecision {
  eligibleForNewAutomationRequest: boolean;
  missing: (keyof PostRedRecoveryEvidence)[];
}

/**
 * RED never self-clears. A new automation request is permitted only when every
 * recovery criterion has been satisfied, including explicit human approval and
 * a reduced-autonomy restart.
 */
export function evaluatePostRedRecovery(
  evidence: PostRedRecoveryEvidence,
): PostRedRecoveryDecision {
  const missing = (Object.keys(evidence) as (keyof PostRedRecoveryEvidence)[])
    .filter((key) => evidence[key] !== true);

  return {
    eligibleForNewAutomationRequest: missing.length === 0,
    missing,
  };
}
