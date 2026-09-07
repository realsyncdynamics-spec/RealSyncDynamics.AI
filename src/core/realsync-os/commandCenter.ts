import { createExecutionPlan } from './planner';
import { DEFAULT_WEBSITE_AGENT_POLICY, evaluateToolAction } from './policyEngine';
import type {
  AgentPolicy,
  ExecutionPlan,
  Intent,
  OsEvent,
  PlanStep,
  RiskLevel,
} from './types';

export type CommandCenterPhase =
  | 'received'
  | 'planned'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'running'
  | 'blocked'
  | 'completed'
  | 'failed';

export type StepExecutionState = {
  stepId: string;
  status: 'pending' | 'ready' | 'running' | 'awaiting_approval' | 'blocked' | 'succeeded' | 'failed';
  policyReason?: string;
};

export type CommandSession = {
  id: string;
  intent: Intent;
  plan: ExecutionPlan;
  phase: CommandCenterPhase;
  steps: StepExecutionState[];
  events: OsEvent[];
  policyVersion: string;
};

export type CommandCenterOptions = {
  policy?: AgentPolicy;
  now?: () => string;
  id?: () => string;
};

const resourceForAction = (action: string): string => {
  if (action.includes('publish') || action === 'publish') return 'deployment';
  if (action.includes('write') || action.includes('frontend') || action.includes('design')) return 'frontend';
  if (action.includes('content')) return 'content';
  if (action.includes('governance')) return 'project';
  return 'project';
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
    steps: plan.steps.map((step) => ({ stepId: step.id, status: 'pending' })),
    events: [],
    policyVersion: policy.version,
  };

  emit(session, 'intent', 'receive_intent', 'succeeded', {}, now, id);
  emit(session, 'plan', 'create_plan', 'succeeded', { metadata: { risk: plan.risk, steps: plan.steps.length } }, now, id);

  if (session.phase === 'awaiting_approval') {
    emit(session, 'policy', 'approval_required', 'blocked', { metadata: { risk: plan.risk } }, now, id);
  }

  return session;
}

export function approveSession(session: CommandSession, actorId: string, options: CommandCenterOptions = {}): CommandSession {
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? (() => crypto.randomUUID());
  if (session.phase !== 'awaiting_approval' && session.phase !== 'planned') return session;
  session.phase = 'approved';
  emit(session, 'policy', 'approve_plan', 'succeeded', { actorId }, now, id);
  return session;
}

export function rejectSession(session: CommandSession, actorId: string, reason: string, options: CommandCenterOptions = {}): CommandSession {
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? (() => crypto.randomUUID());
  session.phase = 'rejected';
  emit(session, 'policy', 'reject_plan', 'blocked', { actorId, metadata: { reason } }, now, id);
  return session;
}

function dependentsReady(plan: ExecutionPlan, states: StepExecutionState[], step: PlanStep): boolean {
  return step.dependsOn.every((dep) => states.find((s) => s.stepId === dep)?.status === 'succeeded');
}

export function advanceSession(session: CommandSession, options: CommandCenterOptions = {}): CommandSession {
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? (() => crypto.randomUUID());
  const policy = options.policy ?? DEFAULT_WEBSITE_AGENT_POLICY;

  if (session.phase === 'awaiting_approval' || session.phase === 'rejected' || session.phase === 'completed' || session.phase === 'failed') {
    return session;
  }

  session.phase = 'running';

  for (const step of session.plan.steps) {
    const state = session.steps.find((s) => s.stepId === step.id);
    if (!state || state.status === 'succeeded' || state.status === 'failed' || state.status === 'blocked') continue;
    if (!dependentsReady(session.plan, session.steps, step)) continue;

    const decision = evaluateToolAction(policy, resourceForAction(step.action), mapAction(step.action), step.risk);
    if (!decision.allowed) {
      state.status = 'blocked';
      state.policyReason = decision.reason;
      session.phase = 'blocked';
      emit(session, 'policy', step.action, 'blocked', { agentId: step.agent, tool: step.action, metadata: { reason: decision.reason } }, now, id);
      return session;
    }

    if (decision.requiresApproval && session.phase !== 'approved' && step.requiresApproval) {
      state.status = 'awaiting_approval';
      session.phase = 'awaiting_approval';
      emit(session, 'policy', step.action, 'blocked', { agentId: step.agent, tool: step.action }, now, id);
      return session;
    }

    state.status = 'running';
    emit(session, 'execute', step.action, 'started', { agentId: step.agent, tool: step.action }, now, id);
    state.status = 'succeeded';
    emit(session, 'execute', step.action, 'succeeded', { agentId: step.agent, tool: step.action }, now, id);
  }

  const blocked = session.steps.some((s) => s.status === 'blocked');
  const failed = session.steps.some((s) => s.status === 'failed');
  const allDone = session.steps.every((s) => s.status === 'succeeded');

  if (failed) session.phase = 'failed';
  else if (blocked) session.phase = 'blocked';
  else if (allDone) {
    session.phase = 'completed';
    emit(session, 'verify', 'complete_session', 'succeeded', {}, now, id);
    emit(session, 'evidence', 'record_evidence', 'succeeded', {}, now, id);
  }

  return session;
}

function mapAction(action: string): string {
  if (action === 'publish') return 'publish';
  if (action.includes('write') || action.includes('frontend') || action.includes('design')) return 'write';
  if (action.includes('read') || action.includes('analyze') || action.includes('discover')) return 'read';
  return 'read';
}

export function runIntentToCompletion(intent: Intent, options: CommandCenterOptions & { autoApprove?: boolean } = {}): CommandSession {
  const session = openCommandSession(intent, options);
  if (session.phase === 'awaiting_approval' && options.autoApprove !== false) {
    approveSession(session, intent.actorId, options);
  }
  return advanceSession(session, options);
}

export function highestRisk(risks: RiskLevel[]): RiskLevel {
  if (risks.includes('critical')) return 'critical';
  if (risks.includes('high')) return 'high';
  if (risks.includes('medium')) return 'medium';
  return 'low';
}
