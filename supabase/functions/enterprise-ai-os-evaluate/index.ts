// Enterprise AI OS — Policy evaluation endpoint.
//
// POST /functions/v1/enterprise-ai-os-evaluate
// Body: { model, dataCategories?, externalAction?, riskLevel?, policy? }
//
// Pure evaluation, no DB writes. Mirrors src/lib/enterprise-ai-os/policy-engine.ts.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AiRiskLevel = 'minimal' | 'limited' | 'high' | 'prohibited' | 'unknown';

interface PolicyInput {
  allowed_models: string[];
  forbidden_data_categories: string[];
  requires_human_approval: boolean;
  external_actions_allowed: boolean;
}

interface EvalInput {
  model: string;
  dataCategories: string[];
  externalAction: boolean;
  riskLevel: AiRiskLevel;
  policy: PolicyInput;
}

const PERSONAL_DATA = new Set(['personal_data', 'employee_data', 'customer_data']);
const SENSITIVE_DATA = new Set(['sensitive_data', 'health_data', 'payroll_data']);

function evaluateAgentAction(input: EvalInput) {
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

  const forbiddenMatches = input.dataCategories.filter((c) =>
    input.policy.forbidden_data_categories.includes(c),
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

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  let body: Partial<EvalInput> & { policy?: Partial<PolicyInput> };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid JSON' });
  }

  if (!body.model) return json(400, { error: 'model is required' });

  const policy: PolicyInput = {
    allowed_models: body.policy?.allowed_models ?? [],
    forbidden_data_categories: body.policy?.forbidden_data_categories ?? [],
    requires_human_approval: body.policy?.requires_human_approval ?? true,
    external_actions_allowed: body.policy?.external_actions_allowed ?? false,
  };

  const result = evaluateAgentAction({
    model: body.model,
    dataCategories: body.dataCategories ?? [],
    externalAction: Boolean(body.externalAction),
    riskLevel: (body.riskLevel ?? 'unknown') as AiRiskLevel,
    policy,
  });

  return json(200, result);
});
