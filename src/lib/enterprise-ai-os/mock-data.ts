import type {
  AgentPolicy,
  AiAuditEvent,
  AiSystemRegistryEntry,
  EnterpriseConnector,
} from './types';

const NOW = new Date('2026-05-13T00:00:00Z').toISOString();

export const mockConnectors: EnterpriseConnector[] = [
  {
    id: 'connector-m365',
    name: 'Microsoft 365',
    type: 'microsoft365',
    status: 'connected',
    config: { scopes: ['mail', 'files', 'users'] },
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'connector-slack',
    name: 'Slack Workspace',
    type: 'slack',
    status: 'pending',
    config: {},
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'connector-sap',
    name: 'SAP ERP',
    type: 'sap',
    status: 'disabled',
    config: {},
    created_at: NOW,
    updated_at: NOW,
  },
];

export const mockAiSystems: AiSystemRegistryEntry[] = [
  {
    id: 'ai-chatgpt',
    name: 'ChatGPT Enterprise',
    provider: 'OpenAI',
    model: 'gpt-4.1',
    usage_context: 'Research, Textgenerierung, interne Automatisierung',
    risk_level: 'limited',
    contains_personal_data: true,
    contains_sensitive_data: false,
    approved: true,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'ai-copilot',
    name: 'Microsoft Copilot',
    provider: 'Microsoft',
    model: 'copilot',
    usage_context: 'Dokumente, E-Mail, Meetings',
    risk_level: 'high',
    contains_personal_data: true,
    contains_sensitive_data: true,
    approved: false,
    created_at: NOW,
    updated_at: NOW,
  },
];

export const mockPolicies: AgentPolicy[] = [
  {
    id: 'policy-default',
    name: 'Default Enterprise AI Policy',
    description: 'Baseline-Policy für kontrollierte KI-Nutzung im Unternehmen.',
    allowed_models: ['gpt-4.1', 'claude-3.5-sonnet', 'copilot'],
    forbidden_data_categories: ['payroll_data', 'health_data', 'sensitive_data'],
    requires_human_approval: true,
    external_actions_allowed: false,
    policy_json: { retention: 'minimal', audit: 'required' },
    created_at: NOW,
    updated_at: NOW,
  },
];

export const mockAuditEvents: AiAuditEvent[] = [
  {
    id: 'audit-1',
    actor: 'system',
    action: 'AI system detected',
    system_name: 'ChatGPT Enterprise',
    risk_level: 'limited',
    metadata: { source: 'manual_registry' },
    created_at: NOW,
  },
  {
    id: 'audit-2',
    actor: 'policy-engine',
    action: 'Action blocked',
    system_name: 'Microsoft Copilot',
    risk_level: 'high',
    metadata: { reason: 'Sensitive data with external action' },
    created_at: NOW,
  },
];
