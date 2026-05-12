/**
 * Curated policy templates for one-click install. Each template
 * is a shape that lines up exactly with `createPolicy` in
 * `resourcesApi.ts` — installing simply fills `tenant_id` and
 * fires the create_policy op.
 *
 * Templates are static (live in code, not in DB) so they version
 * with the codebase and can't be tampered with by a tenant admin
 * accidentally.
 */
import type {
  GovernancePolicyType,
  GovernancePolicyAction,
  GovernanceRiskLevel,
} from './types';

export type PolicyCategory =
  | 'GDPR'
  | 'EU_AI_ACT'
  | 'TRACKING'
  | 'AGENT_GOVERNANCE'
  | 'SECURITY'
  | 'CROSS_BORDER';

export interface PolicyTemplate {
  id: string;                  // stable string, NOT a uuid
  category: PolicyCategory;
  name: string;
  description: string;
  policy_type: GovernancePolicyType;
  severity: GovernanceRiskLevel;
  action: GovernancePolicyAction;
  condition: Record<string, unknown>;
  enabled: boolean;
  rationale: string;           // shown in the template card
}

export const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    id: 'pii-to-external-llm',
    category: 'GDPR',
    name: 'No PII to external LLMs',
    description: 'Block prompts that contain customer / employee / health data when the target vendor is external.',
    policy_type: 'data_transfer',
    severity: 'critical',
    action: 'block',
    condition: { data_types: ['customer_data', 'employee_data', 'health_data'] },
    enabled: true,
    rationale: 'GDPR Art. 5 + Schrems II: personenbezogene Daten dürfen nicht ohne Rechtsgrundlage und TIA an US-Vendor.',
  },
  {
    id: 'high-risk-ai-human-review',
    category: 'EU_AI_ACT',
    name: 'High-risk AI: human review required',
    description: 'Every AI system classified as high-risk under the EU AI Act needs documented human review before operational use.',
    policy_type: 'human_review',
    severity: 'critical',
    action: 'require_approval',
    condition: { ai_act_class: 'high' },
    enabled: true,
    rationale: 'EU AI Act Art. 14 — verpflichtende menschliche Aufsicht für Hochrisiko-KI.',
  },
  {
    id: 'prohibited-ai-blocked',
    category: 'EU_AI_ACT',
    name: 'Block prohibited AI uses',
    description: 'Any asset classified as prohibited (social scoring, untargeted facial recognition scraping, real-time biometric ID in public, etc.) is blocked outright.',
    policy_type: 'ai_act',
    severity: 'critical',
    action: 'block',
    condition: { ai_act_class: 'prohibited' },
    enabled: true,
    rationale: 'EU AI Act Art. 5 — bestimmte Praktiken sind verboten, nicht "risikoreich".',
  },
  {
    id: 'agent-actions-logged',
    category: 'AGENT_GOVERNANCE',
    name: 'Agent actions require audit logging',
    description: 'Agentic workflows that perform external actions (CRM writes, emails, API calls) must produce an immutable audit event.',
    policy_type: 'logging_required',
    severity: 'high',
    action: 'warn',
    condition: { event_source: 'agent_runtime' },
    enabled: true,
    rationale: 'EU AI Act Art. 12 + SOC 2 CC7.2 — Nachvollziehbarkeit jeder Agent-Aktion.',
  },
  {
    id: 'no-us-only-vendor-customer-data',
    category: 'CROSS_BORDER',
    name: 'No customer data to US-only vendors',
    description: 'Block model calls that send customer data to vendors without an EU residency option.',
    policy_type: 'data_transfer',
    severity: 'critical',
    action: 'block',
    condition: { data_types: ['customer_data'], vendor_region: 'us_only' },
    enabled: true,
    rationale: 'Schrems II + DSGVO Kapitel V — Drittlandsübermittlung braucht TIA und Schutzmaßnahmen.',
  },
  {
    id: 'iban-credit-card-prompt-warn',
    category: 'GDPR',
    name: 'Warn on prompts with IBAN / credit card',
    description: 'Tag any prompt that contains an IBAN or credit-card-shaped string so the event reviewer can decide.',
    policy_type: 'logging_required',
    severity: 'high',
    action: 'warn',
    condition: { data_types: ['iban', 'credit_card'] },
    enabled: true,
    rationale: 'GDPR Art. 9 (Finanzdaten) + PCI-DSS Awareness — sensitive Strings sollten nicht ohne Begründung an LLMs.',
  },
  {
    id: 'cookie-before-consent',
    category: 'TRACKING',
    name: 'Warn on cookies set before consent',
    description: 'Browser-extension events that fire `cookie.before_consent` get flagged.',
    policy_type: 'gdpr',
    severity: 'high',
    action: 'warn',
    condition: { event_type: 'cookie.before_consent' },
    enabled: true,
    rationale: 'TTDSG § 25 + GDPR Art. 6 — Nicht-essentielle Cookies brauchen aktive Einwilligung VOR dem Setzen.',
  },
  {
    id: 'tracker-from-non-approved-vendor',
    category: 'TRACKING',
    name: 'Warn on trackers from non-approved vendors',
    description: 'Page-scanner events for new tracker insertions trigger a review.',
    policy_type: 'vendor_restriction',
    severity: 'medium',
    action: 'warn',
    condition: { event_type: 'scanner.tracker_added' },
    enabled: true,
    rationale: 'GDPR Art. 30 — neue Drittanbieter müssen ins Verzeichnis von Verarbeitungstätigkeiten.',
  },
  {
    id: 'model-upgrade-requires-approval',
    category: 'EU_AI_ACT',
    name: 'Model upgrades require approval',
    description: 'Any deploy event where the model name changes triggers approval before the new model is considered active.',
    policy_type: 'model_usage',
    severity: 'high',
    action: 'require_approval',
    condition: { event_type: 'asset.model_changed' },
    enabled: true,
    rationale: 'EU AI Act Art. 9 — substantielle Änderungen am Modell sind neue Risk-Management-Trigger.',
  },
  {
    id: 'github-ci-deploy-logged',
    category: 'SECURITY',
    name: 'Log every CI/CD deploy of governed assets',
    description: 'GitHub / CI/CD events touching governance assets generate audit logs.',
    policy_type: 'logging_required',
    severity: 'medium',
    action: 'log',
    condition: { event_source: ['github', 'ci_cd'] },
    enabled: true,
    rationale: 'SOC 2 CC8.1 (Change Management) — jede Produktionsänderung muss nachvollziehbar sein.',
  },
];

/** Group templates by category for the UI. */
export function groupedTemplates(): Array<{ category: PolicyCategory; items: PolicyTemplate[] }> {
  const map = new Map<PolicyCategory, PolicyTemplate[]>();
  for (const t of POLICY_TEMPLATES) {
    if (!map.has(t.category)) map.set(t.category, []);
    map.get(t.category)!.push(t);
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}

export const CATEGORY_LABEL: Record<PolicyCategory, string> = {
  GDPR:              'GDPR',
  EU_AI_ACT:         'EU AI Act',
  TRACKING:          'Tracking & Consent',
  AGENT_GOVERNANCE:  'Agent Governance',
  SECURITY:          'Security',
  CROSS_BORDER:      'Cross-Border / Schrems',
};
