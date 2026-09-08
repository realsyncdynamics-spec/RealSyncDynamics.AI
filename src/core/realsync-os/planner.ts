import { classifyIntent, detectCapabilities } from './capabilities';
import { classifyDesignIntent, createDesignPlanSteps } from './design';
import type { ExecutionPlan, Intent, PlanStep, RiskLevel } from './types';

const step = (
  id: string,
  title: string,
  agent: string,
  action: string,
  risk: RiskLevel,
  requiresApproval: boolean,
  dependsOn: string[] = [],
): PlanStep => ({ id, title, agent, action, risk, requiresApproval, dependsOn });

export function createExecutionPlan(intent: Intent): ExecutionPlan {
  const signals = classifyIntent(intent.text);
  let steps: PlanStep[] = [];

  if (signals.design) {
    const designIntent = classifyDesignIntent(intent.text);
    steps = createDesignPlanSteps(designIntent, {
      includePublish: signals.deploy,
      includeSeo: true,
    });
  } else {
    if (signals.seo) {
      steps.push(step('seo', 'Technisches SEO und AI-Visibility prüfen', 'seo', 'optimize_visibility', 'low', false));
    }
    if (signals.governance) {
      steps.push(step('governance', 'Governance, Datenschutz und AI-Act-Risiken bewerten', 'governance', 'evaluate_governance', 'high', true, steps.length ? [steps[steps.length - 1].id] : []));
    }
    if (signals.deploy) {
      steps.push(step('deploy', 'Production Deployment vorbereiten', 'deployment', 'publish', 'critical', true, steps.length ? [steps[steps.length - 1].id] : []));
    }
  }

  if (steps.length === 0) {
    steps.push(step('discover', 'Intent in Projektkontext einordnen', 'orchestrator', 'discover', 'low', false));
    steps.push(step('plan', 'Ausführbaren Arbeitsplan erstellen', 'orchestrator', 'refine_plan', 'low', false, ['discover']));
  }

  const risk = steps.some((item) => item.risk === 'critical') ? 'critical'
    : steps.some((item) => item.risk === 'high') ? 'high'
      : steps.some((item) => item.risk === 'medium') ? 'medium' : 'low';

  return {
    id: crypto.randomUUID(),
    intentId: intent.id,
    steps,
    risk,
    requiresApproval: steps.some((item) => item.requiresApproval),
    capabilities: detectCapabilities(intent.text),
    generatedAt: new Date().toISOString(),
  };
}
