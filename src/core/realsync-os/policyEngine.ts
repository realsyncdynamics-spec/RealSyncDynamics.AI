import type { AgentPolicy, ToolPermission } from './types';

export type PolicyDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
  matchedPermission?: ToolPermission;
};

export function evaluateToolAction(
  policy: AgentPolicy,
  resource: string,
  action: string,
  risk: 'low' | 'medium' | 'high' | 'critical',
): PolicyDecision {
  if (policy.deniedResources.includes(resource)) {
    return { allowed: false, requiresApproval: false, reason: `Resource denied by policy: ${resource}` };
  }

  const permission = policy.permissions.find((entry) =>
    entry.resource === resource && entry.actions.includes(action),
  );

  if (!permission) {
    return { allowed: false, requiresApproval: false, reason: `Action not granted: ${resource}.${action}` };
  }

  const riskRequiresApproval = risk === 'high' || risk === 'critical';
  const requiresApproval = permission.approval === 'always'
    || (permission.approval === 'on-risk' && riskRequiresApproval);

  return {
    allowed: true,
    requiresApproval,
    reason: requiresApproval ? 'Policy permits action with approval gate.' : 'Policy permits action.',
    matchedPermission: permission,
  };
}

export const DEFAULT_WEBSITE_AGENT_POLICY: AgentPolicy = {
  agentId: 'website-agent',
  version: '1.0.0',
  permissions: [
    { resource: 'project', actions: ['read'], approval: 'never' },
    { resource: 'website', actions: ['read'], approval: 'never' },
    { resource: 'frontend', actions: ['write'], approval: 'on-risk' },
    { resource: 'content', actions: ['write'], approval: 'on-risk' },
    { resource: 'deployment', actions: ['publish'], approval: 'always' },
  ],
  deniedResources: ['production_database', 'secrets'],
  restrictedDataClasses: ['personal_data', 'special_category_data'],
  requireProvenanceForGeneratedContent: true,
  requireEvidence: true,
};
