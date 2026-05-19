import { findAgent } from './agent-registry.js';
import type {
  PolicyDecision,
  RestrictedAction,
  RunAgentRequest,
} from './types.js';

/**
 * Aktionen, die immer Human-in-the-Loop erzwingen — auch wenn der Agent
 * sie technisch ausführen dürfte. Der Gateway markiert solche Requests
 * mit reviewRequired=true; die eigentliche Freigabe erfolgt außerhalb.
 *
 * Hält dem CLAUDE.md-Prinzip „kontrollierte Automatisierung" Stand.
 */
const REVIEW_REQUIRED_TASK_TYPES = new Set<RestrictedAction>([
  'legal_surface_change',
  'production_change',
  'github_pr_create',
  'policy_export',
  'high_risk_ai_classification',
]);

export function evaluate(req: RunAgentRequest): PolicyDecision {
  const agent = findAgent(req.agentId);
  if (!agent) {
    return { ok: false, reason: 'agent_not_found' };
  }

  if (!agent.tools.includes(req.requestedTool)) {
    return { ok: false, reason: 'tool_not_allowed' };
  }

  if (agent.restricted.includes(req.taskType as RestrictedAction)) {
    return { ok: false, reason: 'restricted_action' };
  }

  const reviewByTask = REVIEW_REQUIRED_TASK_TYPES.has(
    req.taskType as RestrictedAction,
  );
  const reviewRequired = agent.requiresHumanReview || reviewByTask;

  return { ok: true, reviewRequired };
}
