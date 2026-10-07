import {
  classifySafetyState,
  type SafetyClassification,
} from '../../lib/enterprise-ai-os/safety-control-plane';
import type { Capability, PiiClass, RiskLevel } from './types';

export interface RuntimeSafetyAssessmentInput {
  execution_id: string;
  tenant_id: string;
  agent_id: string;
  skill_id: string;
  risk_level: RiskLevel;
  capabilities: readonly Capability[];
  pii_class: PiiClass;
  auto_approve: boolean;
  /** Hash only. Raw arguments must not cross this boundary. */
  input_hash: string;
}

export interface RuntimeSafetyControlService {
  /**
   * Evaluate the execution before any handler side effect runs.
   *
   * Implementations must derive their result from trusted runtime/policy state.
   * Caller-provided args are intentionally excluded from this contract.
   */
  assess(input: RuntimeSafetyAssessmentInput): Promise<SafetyClassification>;
}

/**
 * Used when the safety control plane is not configured or fails.
 *
 * This is intentionally RED: missing safety infrastructure must never become
 * implicit permission to execute.
 */
export class FailClosedRuntimeSafetyControl implements RuntimeSafetyControlService {
  async assess(_input: RuntimeSafetyAssessmentInput): Promise<SafetyClassification> {
    return classifySafetyState([
      {
        kind: 'control_plane_unavailable',
        reason: 'Runtime safety control is unavailable or not configured.',
      },
    ]);
  }
}

/**
 * Calls the configured safety control and converts failures or malformed
 * responses into RED.
 *
 * The runtime must not trust an exception, undefined result or malformed object
 * as GREEN.
 */
export async function assessRuntimeSafetyFailClosed(
  service: RuntimeSafetyControlService,
  input: RuntimeSafetyAssessmentInput,
): Promise<SafetyClassification> {
  try {
    const result = await service.assess(input);
    if (!isValidSafetyClassification(result)) {
      return malformedSafetyResult();
    }
    return result;
  } catch {
    return classifySafetyState([
      {
        kind: 'control_plane_unavailable',
        reason: 'Runtime safety control failed during assessment.',
      },
    ]);
  }
}

function isValidSafetyClassification(value: unknown): value is SafetyClassification {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SafetyClassification>;
  if (!['green', 'yellow', 'red'].includes(candidate.light ?? '')) return false;
  if (!Array.isArray(candidate.reasons) || !candidate.reasons.every((x) => typeof x === 'string')) {
    return false;
  }
  if (
    typeof candidate.mustStop !== 'boolean' ||
    typeof candidate.requiresIndependentReview !== 'boolean' ||
    typeof candidate.requiresHumanDecision !== 'boolean'
  ) {
    return false;
  }

  if (candidate.light === 'green') {
    return (
      candidate.mustStop === false &&
      candidate.requiresIndependentReview === false &&
      candidate.requiresHumanDecision === false
    );
  }

  if (candidate.light === 'yellow') {
    return (
      candidate.mustStop === true &&
      candidate.requiresIndependentReview === true &&
      candidate.requiresHumanDecision === true
    );
  }

  return (
    candidate.light === 'red' &&
    candidate.mustStop === true &&
    candidate.requiresIndependentReview === false &&
    candidate.requiresHumanDecision === true
  );
}

function malformedSafetyResult(): SafetyClassification {
  return classifySafetyState([
    {
      kind: 'control_plane_unavailable',
      reason: 'Runtime safety control returned an invalid assessment.',
    },
  ]);
}
