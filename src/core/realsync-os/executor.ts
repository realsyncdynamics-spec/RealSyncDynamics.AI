import type { CommandSession, PlanStep, SessionArtifacts, StepResult } from './types';

export type StepExecutorContext = {
  step: PlanStep;
  session: CommandSession;
};

export type StepExecutor = (ctx: StepExecutorContext) => Promise<StepResult> | StepResult;

const KERNEL_LOCAL_ACTIONS = new Set([
  'discover',
  'refine_plan',
  'analyze_project',
  'create_design_system',
]);

/**
 * Default executor: kernel-local planning steps may succeed with an observation.
 * Anything that would mutate a site, run a SiteOS agent, or deploy is
 * NOT IMPLEMENTED until a SiteOS executor is bound. Never fake a run.
 */
export function defaultExecuteStep(ctx: StepExecutorContext): StepResult {
  const { step, session } = ctx;

  if (KERNEL_LOCAL_ACTIONS.has(step.action)) {
    return {
      status: 'succeeded',
      tool: 'kernel',
      observation: {
        kind: 'kernel_local',
        action: step.action,
        intent: session.intent.text,
        capabilities: session.plan.capabilities,
      },
    };
  }

  return {
    status: 'not_implemented',
    tool: mapStepToSiteOsTool(step.action),
    reason: `NOT IMPLEMENTED: ${step.action} requires a bound SiteOS executor.`,
  };
}

export function mapStepToSiteOsTool(action: string): string {
  switch (action) {
    case 'analyze_project':
    case 'discover':
      return 'siteos.listSites';
    case 'create_design_system':
    case 'write_frontend':
      return 'siteos.builder';
    case 'verify_frontend':
      return 'siteos.runtime-scan';
    case 'optimize_visibility':
      return 'siteos.agents.seo';
    case 'evaluate_governance':
      return 'siteos.agents.compliance';
    case 'publish':
      return 'siteos.publish-gate';
    default:
      return `siteos.unknown:${action}`;
  }
}

export function mergeArtifacts(
  current: SessionArtifacts,
  incoming?: Partial<SessionArtifacts>,
): SessionArtifacts {
  if (!incoming) return current;
  return { ...current, ...incoming };
}
