import type { Agent } from './types.js';

/**
 * Initiale Agent-Registry — bewusst statisch in dieser MVP-Stufe.
 * Persistenz/Verwaltung folgt in einer Folge-PR (Supabase-backed registry,
 * RLS-isoliert pro Tenant).
 */
const AGENTS: ReadonlyArray<Agent> = [
  {
    id: 'website-drift-agent',
    name: 'Website Drift Agent',
    type: 'monitoring',
    tools: ['website_scan', 'tracker_detect', 'evidence_emit'],
    riskLevel: 'low',
    permissions: ['read:verified_domains', 'write:findings'],
    restricted: ['production_change'],
    requiresHumanReview: false,
  },
  {
    id: 'ai-risk-agent',
    name: 'AI Risk Agent',
    type: 'classification',
    tools: ['ai_usecase_classify', 'ai_act_map', 'flag_high_risk'],
    riskLevel: 'medium',
    permissions: ['read:ai_inventory', 'write:risk_assessments'],
    restricted: ['high_risk_ai_classification'],
    requiresHumanReview: true,
  },
  {
    id: 'evidence-agent',
    name: 'Evidence Agent',
    type: 'audit',
    tools: ['bundle_generate', 'hash_chain_extend', 'evidence_export'],
    riskLevel: 'medium',
    permissions: ['read:audit_events', 'write:evidence_bundles'],
    restricted: ['policy_export'],
    requiresHumanReview: true,
  },
  {
    id: 'policy-agent',
    name: 'Policy Agent',
    type: 'policy',
    tools: ['policy_evaluate', 'verdict_emit', 'audit_emit'],
    riskLevel: 'high',
    permissions: ['read:policies', 'read:events'],
    restricted: ['legal_surface_change', 'policy_export'],
    requiresHumanReview: true,
  },
  {
    id: 'developer-remediation-agent',
    name: 'Developer Remediation Agent',
    type: 'remediation',
    tools: ['jira_ticket_draft', 'github_pr_draft', 'cmp_config_suggest'],
    riskLevel: 'high',
    permissions: ['read:repos', 'write:drafts'],
    restricted: ['production_change', 'github_pr_create'],
    requiresHumanReview: true,
  },
];

export function listAgents(): ReadonlyArray<Agent> {
  return AGENTS;
}

export function findAgent(agentId: string): Agent | undefined {
  return AGENTS.find((a) => a.id === agentId);
}
