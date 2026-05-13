import type { AgentPolicy, AiRiskLevel } from './types';

export interface EvaluateAgentActionInput {
  model: string;
  dataCategories: string[];
  externalAction: boolean;
  riskLevel: AiRiskLevel;
  policy: Pick<
    AgentPolicy,
    | 'allowed_models'
    | 'forbidden_data_categories'
    | 'requires_human_approval'
    | 'external_actions_allowed'
  >;
}

export interface EvaluateAgentActionResult {
  allowed: boolean;
  requiresApproval: boolean;
  auditRequired: boolean;
  reasons: string[];
}

const PERSONAL_DATA = new Set(['personal_data', 'employee_data', 'customer_data']);
const SENSITIVE_DATA = new Set(['sensitive_data', 'health_data', 'payroll_data']);

export function evaluateAgentAction(
  input: EvaluateAgentActionInput,
): EvaluateAgentActionResult {
  const reasons: string[] = [];
  let allowed = true;
  let requiresApproval = false;
  let auditRequired = false;

  if (
    input.policy.allowed_models.length > 0 &&
    !input.policy.allowed_models.includes(input.model)
  ) {
    allowed = false;
    reasons.push(`Model ${input.model} is not allowed by policy.`);
  }

  const forbiddenMatches = input.dataCategories.filter((category) =>
    input.policy.forbidden_data_categories.includes(category),
  );

  if (forbiddenMatches.length > 0) {
    allowed = false;
    reasons.push(`Forbidden data categories detected: ${forbiddenMatches.join(', ')}.`);
  }

  if (input.externalAction && !input.policy.external_actions_allowed) {
    allowed = false;
    reasons.push('External actions are not allowed by this policy.');
  }

  if (
    input.externalAction &&
    (input.riskLevel === 'high' || input.riskLevel === 'prohibited')
  ) {
    requiresApproval = true;
    reasons.push('High/prohibited risk with external action requires approval.');
  }

  if (input.dataCategories.some((c) => PERSONAL_DATA.has(c))) {
    auditRequired = true;
    reasons.push('Personal data detected. Audit event required.');
  }

  if (input.dataCategories.some((c) => SENSITIVE_DATA.has(c))) {
    allowed = false;
    auditRequired = true;
    reasons.push('Sensitive data cannot be used for this action.');
  }

  if (input.policy.requires_human_approval) {
    requiresApproval = true;
    reasons.push('Policy requires human approval.');
  }

  return { allowed, requiresApproval, auditRequired, reasons };
}
