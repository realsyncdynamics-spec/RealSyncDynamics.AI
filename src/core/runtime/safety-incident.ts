import {
  evaluatePostRedRecovery,
  isPermittedRedEmergencyAction,
  type PostRedRecoveryDecision,
  type PostRedRecoveryEvidence,
  type RedEmergencyAction,
} from '../../lib/enterprise-ai-os/safety-control-plane';

export type SafetyIncidentState =
  | 'emergency_actions_running'
  | 'recovery_required'
  | 'reduced_autonomy';

export interface OpenRedIncidentInput {
  incidentId?: string;
  tenantId: string;
  executionId: string;
  agentId?: string;
  skillId?: string;
  caseFingerprint?: string;
  evidenceHash: string;
  /**
   * Optional extra protective actions requested by a caller.
   * Unknown/non-safety actions are rejected and recorded; required protective
   * actions still run.
   */
  requestedEmergencyActions?: readonly string[];
}

export interface EmergencySafetyActionContext {
  incidentId: string;
  tenantId: string;
  executionId: string;
  agentId?: string;
  skillId?: string;
  evidenceHash: string;
}

export interface EmergencySafetyActionResult {
  ok: boolean;
  evidenceRef?: string;
  errorCode?: string;
}

export interface EmergencySafetyExecutor {
  execute(
    action: RedEmergencyAction,
    context: EmergencySafetyActionContext,
  ): Promise<EmergencySafetyActionResult>;
}

export interface EmergencySafetyActionRecord {
  action: RedEmergencyAction;
  ok: boolean;
  attemptedAt: string;
  evidenceRef?: string;
  errorCode?: string;
}

export interface SafetyIncidentRecord {
  incidentId: string;
  tenantId: string;
  executionId: string;
  agentId?: string;
  skillId?: string;
  caseFingerprint?: string;
  evidenceHash: string;
  state: SafetyIncidentState;
  openedAt: string;
  emergencyActions: readonly EmergencySafetyActionRecord[];
  rejectedRequestedActions: readonly string[];
  recoveryEvidence?: PostRedRecoveryEvidence;
  recoveryEvaluatedAt?: string;
}

export interface RecoveryEvaluation {
  incident: SafetyIncidentRecord;
  decision: PostRedRecoveryDecision;
  /**
   * True means a NEW automation request may be raised. It never resumes the
   * incident's previous automation by itself.
   */
  newAutomationRequestAllowed: boolean;
}

const SHA256_HEX = /^[a-f0-9]{64}$/;

const REQUIRED_RED_ACTIONS: readonly RedEmergencyAction[] = Object.freeze([
  'pause_workflow',
  'block_new_executions',
  'disable_write_operations',
  'preserve_logs',
  'preserve_evidence',
  'create_incident_snapshot',
  'notify_human',
]);

const EMERGENCY_ACTION_ORDER: readonly RedEmergencyAction[] = Object.freeze([
  'pause_workflow',
  'block_new_executions',
  'disable_write_operations',
  'isolate_session',
  'freeze_queue',
  'revoke_temporary_token',
  'close_connection',
  'preserve_logs',
  'preserve_evidence',
  'create_incident_snapshot',
  'notify_human',
]);

/**
 * RED incident domain controller.
 *
 * It deliberately does not reuse the generic circuit breaker utilities in the
 * repository because those are reliability helpers and some fail open when
 * their backing state is unavailable. Safety incidents must fail closed.
 *
 * RED can trigger only the bounded emergency actions in the safety-control
 * allowlist. It never deploys a fix, changes policy, deletes business data,
 * communicates with customers or expands privileges.
 */
export class SafetyIncidentController {
  readonly #byIncident = new Map<string, SafetyIncidentRecord>();
  readonly #incidentByExecution = new Map<string, string>();
  readonly #executor: EmergencySafetyExecutor;
  readonly #id: () => string;
  readonly #clock: () => Date;

  constructor(
    executor: EmergencySafetyExecutor,
    options?: { id?: () => string; clock?: () => Date },
  ) {
    this.#executor = executor;
    this.#id = options?.id ?? defaultId;
    this.#clock = options?.clock ?? (() => new Date());
  }

  async openRedIncident(input: OpenRedIncidentInput): Promise<SafetyIncidentRecord> {
    validateOpenIncident(input);

    const existingId = this.#incidentByExecution.get(input.executionId);
    if (existingId) {
      const existing = this.#byIncident.get(existingId);
      if (!existing) throw new Error('Incident index is inconsistent.');
      return existing;
    }

    const incidentId = input.incidentId ?? this.#id();
    if (this.#byIncident.has(incidentId)) {
      throw new Error(`Safety incident already exists: ${incidentId}`);
    }

    const { actions, rejected } = buildEmergencyPlan(
      input.requestedEmergencyActions ?? [],
    );

    let record: SafetyIncidentRecord = freezeIncident({
      incidentId,
      tenantId: input.tenantId,
      executionId: input.executionId,
      agentId: input.agentId,
      skillId: input.skillId,
      caseFingerprint: input.caseFingerprint,
      evidenceHash: input.evidenceHash,
      state: 'emergency_actions_running',
      openedAt: this.#clock().toISOString(),
      emergencyActions: Object.freeze([]),
      rejectedRequestedActions: Object.freeze(rejected),
    });

    // Register before side effects so a repeated RED signal cannot run the
    // emergency plan twice.
    this.#byIncident.set(incidentId, record);
    this.#incidentByExecution.set(input.executionId, incidentId);

    const actionRecords: EmergencySafetyActionRecord[] = [];
    const context: EmergencySafetyActionContext = Object.freeze({
      incidentId,
      tenantId: input.tenantId,
      executionId: input.executionId,
      agentId: input.agentId,
      skillId: input.skillId,
      evidenceHash: input.evidenceHash,
    });

    for (const action of actions) {
      const attemptedAt = this.#clock().toISOString();
      try {
        const result = await this.#executor.execute(action, context);
        actionRecords.push(
          Object.freeze({
            action,
            ok: result.ok,
            attemptedAt,
            evidenceRef: result.evidenceRef,
            errorCode: result.errorCode,
          }),
        );
      } catch {
        // Never expose the thrown message into the incident record. Keep
        // executing the remaining protective actions, especially notify_human.
        actionRecords.push(
          Object.freeze({
            action,
            ok: false,
            attemptedAt,
            errorCode: 'emergency_action_failed',
          }),
        );
      }
    }

    record = freezeIncident({
      ...record,
      state: 'recovery_required',
      emergencyActions: Object.freeze(actionRecords),
    });
    this.#byIncident.set(incidentId, record);

    return record;
  }

  getIncident(incidentId: string): SafetyIncidentRecord | undefined {
    return this.#byIncident.get(incidentId);
  }

  canStartNewAutomationRequest(incidentId: string): boolean {
    return this.#requireIncident(incidentId).state === 'reduced_autonomy';
  }

  /**
   * Evaluate post-RED recovery. Incomplete evidence leaves the incident in
   * recovery_required. Complete evidence moves only to reduced_autonomy.
   *
   * There is intentionally no transition back to the previous automatic mode.
   * A caller must raise a fresh automation request with fresh policy/risk review.
   */
  evaluateRecovery(
    incidentId: string,
    evidence: PostRedRecoveryEvidence,
  ): RecoveryEvaluation {
    const current = this.#requireIncident(incidentId);
    if (current.state === 'emergency_actions_running') {
      throw new Error('Recovery cannot be evaluated while emergency actions are still running.');
    }

    const decision = evaluatePostRedRecovery(evidence);
    const nextState: SafetyIncidentState = decision.eligibleForNewAutomationRequest
      ? 'reduced_autonomy'
      : 'recovery_required';

    const updated = freezeIncident({
      ...current,
      state: nextState,
      recoveryEvidence: Object.freeze({ ...evidence }),
      recoveryEvaluatedAt: this.#clock().toISOString(),
    });
    this.#byIncident.set(incidentId, updated);

    return Object.freeze({
      incident: updated,
      decision: Object.freeze({
        eligibleForNewAutomationRequest: decision.eligibleForNewAutomationRequest,
        missing: Object.freeze([...decision.missing]),
      }),
      newAutomationRequestAllowed: nextState === 'reduced_autonomy',
    });
  }

  #requireIncident(incidentId: string): SafetyIncidentRecord {
    const incident = this.#byIncident.get(incidentId);
    if (!incident) throw new Error(`Safety incident not found: ${incidentId}`);
    return incident;
  }
}

function validateOpenIncident(input: OpenRedIncidentInput): void {
  if (!input.tenantId || !input.executionId) {
    throw new Error('tenantId and executionId are required for a RED incident.');
  }
  if (!SHA256_HEX.test(input.evidenceHash)) {
    throw new Error('evidenceHash must be a lowercase SHA-256 hex digest.');
  }
  if (input.caseFingerprint && !SHA256_HEX.test(input.caseFingerprint)) {
    throw new Error('caseFingerprint must be a lowercase SHA-256 hex digest.');
  }
}

function buildEmergencyPlan(
  requested: readonly string[],
): { actions: readonly RedEmergencyAction[]; rejected: string[] } {
  const accepted = new Set<RedEmergencyAction>(REQUIRED_RED_ACTIONS);
  const rejected: string[] = [];

  for (const action of requested) {
    if (isPermittedRedEmergencyAction(action)) {
      accepted.add(action);
    } else {
      rejected.push(action);
    }
  }

  const actions = EMERGENCY_ACTION_ORDER.filter((action) => accepted.has(action));
  return {
    actions: Object.freeze(actions),
    rejected,
  };
}

function freezeIncident(incident: SafetyIncidentRecord): SafetyIncidentRecord {
  return Object.freeze({
    ...incident,
    emergencyActions: Object.freeze([...incident.emergencyActions]),
    rejectedRequestedActions: Object.freeze([...incident.rejectedRequestedActions]),
    recoveryEvidence: incident.recoveryEvidence
      ? Object.freeze({ ...incident.recoveryEvidence })
      : undefined,
  });
}

function defaultId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `safety_incident_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
