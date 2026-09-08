import { createExecutionPlan } from './planner';
import { DEFAULT_WEBSITE_AGENT_POLICY, evaluateToolAction } from './policyEngine';
import { defaultExecuteStep, mergeArtifacts, type StepExecutor } from './executor';
import type {
  AgentPolicy,
  CommandCenterPhase,
  CommandSession,
  ExecutionPlan,
  Intent,
  OsEvent,
  PlanStep,
  RiskLevel,
  StepExecutionState,
  StepResult,
} from './types';

export type { CommandCenterPhase, CommandSession, StepExecutionState };

export type CommandCenterOptions = {
  policy?: AgentPolicy;
  now?: () => string;
  id?: () => string;
  executeStep?: StepExecutor;
};

const TERMINAL: ReadonlySet<CommandCenterPhase> = new Set([
  'rejected',
  'completed',
  'failed',
]);

export const resourceForAction = (action: string): string => {
  if (action.includes('publish') || action === 'publish') return 'deployment';
  if (action.includes('write') || action.includes('frontend') || action.includes('design')) return 'frontend';
  if (action.includes('content')) return 'content';
  if (action.includes('governance')) return 'project';
  return 'project';
};

export const mapAction = (action: string): string => {
  if (action === 'publish') return 'publish';
  if (action.includes('write') || action.includes('frontend') || action.includes('design')) return 'write';
  if (action.includes('read') || action.includes('analyze') || action.includes('discover') || action.includes('verify')) {
    return 'read';
  }
  return 'read';
};

const emit = (
  session: CommandSession,
  stage: OsEvent['stage'],
  action: string,
  result: OsEvent['result'],
  extras: Partial<OsEvent> = {},
  now: () => string,
  id: () => string,
): void => {
  session.events.push({
    id: id(),
    tenantId: session.intent.tenantId,
    projectId: session.intent.projectId,
    intentId: session.intent.id,
    stage,
    actorId: session.intent.actorId,
    action,
    result,
    policyVersion: session.policyVersion,
    occurredAt: now(),
    ...extras,
  });
};

export function openCommandSession(intent: Intent, options: CommandCenterOptions = {}): CommandSession {
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? (() => crypto.randomUUID());
  const policy = options.policy ?? DEFAULT_WEBSITE_AGENT_POLICY;
  const plan = createExecutionPlan(intent);

  const session: CommandSession = {
    id: id(),
    intent,
    plan,
    phase: plan.requiresApproval ? 'awaiting_approval' : 'planned',
    approved: false,
    steps: plan.steps.map((item) => ({ stepId: item.id, status: 'pending' })),
    events: [],
    policyVersion: policy.version,
    artifacts: {},
  };

  emit(session, 'intent', 'receive_intent', 'succeeded', {}, now, id);
  emit(
    session,
    'plan',
    'create_plan',
    'succeeded',
    { metadata: { risk: plan.risk, steps: plan.steps.length, capabilities: plan.capabilities } },
    now,
    id,
  );

  if (session.phase === 'awaiting_approval') {
    emit(session, 'policy', 'approval_required', 'blocked', { metadata: { risk: plan.risk } }, now, id);
  }

  return session;
}

export function approveSession(session: CommandSession, actorId: string, options: CommandCenterOptions = {}): CommandSession {
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? (() => crypto.randomUUID());
  if (session.phase !== 'awaiting_approval' && session.phase !== 'planned') return session;
  session.approved = true;
  session.phase = 'approved';
  emit(session, 'policy', 'approve_plan', 'succeeded', { actorId }, now, id);
  return session;
}

export function rejectSession(session: CommandSession, actorId: string, reason: string, options: CommandCenterOptions = {}): CommandSession {
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? (() => crypto.randomUUID());
  session.phase = 'rejected';
  session.approved = false;
  emit(session, 'policy', 'reject_plan', 'blocked', { actorId, metadata: { reason } }, now, id);
  return session;
}

function dependentsReady(plan: ExecutionPlan, states: StepExecutionState[], step: PlanStep): boolean {
  return step.dependsOn.every((dep) => states.find((item) => item.stepId === dep)?.status === 'succeeded');
}

function applyStepResult(state: StepExecutionState, result: StepResult): void {
  state.tool = result.tool;
  state.observation = result.observation;
  state.policyReason = result.reason;
  if (result.status === 'succeeded') {
    state.status = 'succeeded';
    state.notImplemented = false;
  } else if (result.status === 'not_implemented') {
    state.status = 'blocked';
    state.notImplemented = true;
  } else if (result.status === 'blocked') {
    state.status = 'blocked';
  } else {
    state.status = 'failed';
  }
}

function finalize(session: CommandSession, now: () => string, id: () => string): void {
  const blocked = session.steps.some((item) => item.status === 'blocked');
  const failed = session.steps.some((item) => item.status === 'failed');
  const allDone = session.steps.every((item) => item.status === 'succeeded');

  if (failed) session.phase = 'failed';
  else if (blocked) session.phase = 'blocked';
  else if (allDone) {
    session.phase = 'completed';
    emit(session, 'verify', 'complete_session', 'succeeded', {}, now, id);
    emit(session, 'evidence', 'record_evidence', 'succeeded', { metadata: { events: session.events.length } }, now, id);
  }
}

/**
 * Advances exactly one ready step. Policy is evaluated before execution.
 * No step is marked succeeded unless an executor reports success.
 */
export async function advanceSession(session: CommandSession, options: CommandCenterOptions = {}): Promise<CommandSession> {
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? (() => crypto.randomUUID());
  const policy = options.policy ?? DEFAULT_WEBSITE_AGENT_POLICY;
  const executeStep = options.executeStep ?? defaultExecuteStep;

  if (TERMINAL.has(session.phase) || session.phase === 'awaiting_approval') {
    return session;
  }

  if (session.phase === 'planned' || session.phase === 'approved') {
    session.phase = 'running';
  }

  const next = session.plan.steps.find((step) => {
    const state = session.steps.find((item) => item.stepId === step.id);
    if (!state) return false;
    if (state.status === 'succeeded' || state.status === 'failed' || state.status === 'blocked') return false;
    return dependentsReady(session.plan, session.steps, step);
  });

  if (!next) {
    finalize(session, now, id);
    return session;
  }

  const state = session.steps.find((item) => item.stepId === next.id)!;
  const decision = evaluateToolAction(policy, resourceForAction(next.action), mapAction(next.action), next.risk);

  if (!decision.allowed) {
    state.status = 'blocked';
    state.policyReason = decision.reason;
    session.phase = 'blocked';
    emit(session, 'policy', next.action, 'blocked', { agentId: next.agent, tool: next.action, metadata: { reason: decision.reason } }, now, id);
    return session;
  }

  if (decision.requiresApproval && !session.approved) {
    state.status = 'awaiting_approval';
    session.phase = 'awaiting_approval';
    emit(session, 'policy', next.action, 'blocked', { agentId: next.agent, tool: next.action }, now, id);
    return session;
  }

  state.status = 'running';
  emit(session, 'execute', next.action, 'started', { agentId: next.agent, tool: next.action }, now, id);

  const result = await executeStep({ step: next, session });
  applyStepResult(state, result);
  session.artifacts = mergeArtifacts(session.artifacts, result.artifacts);

  if (result.status === 'succeeded') {
    emit(session, 'observe', next.action, 'succeeded', { agentId: next.agent, tool: result.tool ?? next.action, metadata: result.observation }, now, id);
    emit(session, 'execute', next.action, 'succeeded', { agentId: next.agent, tool: result.tool ?? next.action }, now, id);
    emit(session, 'verify', next.action, 'succeeded', { agentId: next.agent, tool: result.tool ?? next.action }, now, id);
  } else {
    emit(
      session,
      'execute',
      next.action,
      result.status === 'failed' ? 'failed' : 'blocked',
      {
        agentId: next.agent,
        tool: result.tool ?? next.action,
        metadata: { reason: result.reason, notImplemented: result.status === 'not_implemented' },
      },
      now,
      id,
    );
    session.phase = result.status === 'failed' ? 'failed' : 'blocked';
    return session;
  }

  finalize(session, now, id);
  if (session.phase !== 'completed' && session.phase !== 'failed' && session.phase !== 'blocked') {
    session.phase = 'running';
  }
  return session;
}

export async function runUntilTerminal(session: CommandSession, options: CommandCenterOptions = {}): Promise<CommandSession> {
  const max = session.plan.steps.length + 2;
  for (let i = 0; i < max; i += 1) {
    if (TERMINAL.has(session.phase) || session.phase === 'awaiting_approval' || session.phase === 'blocked') {
      return session;
    }
    const before = session.steps.map((item) => item.status).join('|');
    await advanceSession(session, options);
    const after = session.steps.map((item) => item.status).join('|');
    if (before === after) return session;
  }
  return session;
}

export async function runIntentToCompletion(
  intent: Intent,
  options: CommandCenterOptions & { autoApprove?: boolean; execute?: boolean } = {},
): Promise<CommandSession> {
  const session = openCommandSession(intent, options);
  const execute = options.execute === true || options.autoApprove === true;

  if (session.phase === 'awaiting_approval' && options.autoApprove === true) {
    approveSession(session, intent.actorId, options);
  }

  if (execute && session.phase !== 'awaiting_approval' && session.phase !== 'rejected') {
    return runUntilTerminal(session, options);
  }

  return session;
}

export function highestRisk(risks: RiskLevel[]): RiskLevel {
  if (risks.includes('critical')) return 'critical';
  if (risks.includes('high')) return 'high';
  if (risks.includes('medium')) return 'medium';
  return 'low';
}
