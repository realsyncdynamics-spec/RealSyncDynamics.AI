/**
 * Agenten der Assistent-Seitenleiste. Die ID geht als `agent` an die
 * Edge Function `governance-agent`, die daraus einen fachlichen Fokus-Block
 * baut (supabase/functions/_shared/agent-focus.ts). Beide Listen müssen
 * übereinstimmen — Test: test/features/governance/agent-focus.test.ts.
 */
export const GOVERNANCE_AGENTS = [
  { id: 'dsgvo', label: 'DSGVO Agent' },
  { id: 'ai-act', label: 'AI Act Agent' },
  { id: 'evidence', label: 'Evidence Agent' },
  { id: 'risk', label: 'Risk Agent' },
  { id: 'cookie', label: 'Cookie Agent' },
  { id: 'tracking', label: 'Tracking Agent' },
  { id: 'website', label: 'Website Agent' },
  { id: 'avv', label: 'AVV Agent' },
  { id: 'tom', label: 'TOM Agent' },
  { id: 'vvz', label: 'VVZ Agent' },
  { id: 'incident', label: 'Incident Agent' },
  { id: 'audit', label: 'Audit Agent' },
  { id: 'security-header', label: 'Security Header Agent' },
  { id: 'third-country', label: 'Third Country Transfer Agent' },
  { id: 'consent', label: 'Consent Agent' },
] as const;

export type GovernanceAgentId = (typeof GOVERNANCE_AGENTS)[number]['id'];
