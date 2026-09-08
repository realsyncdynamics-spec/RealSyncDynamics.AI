import type { AgentPolicy } from '../types';

export const DESIGN_AGENTS = [
  'designer',
  'ux',
  'brand',
  'copy',
  'responsive',
  'accessibility',
  'seo',
  'governance',
] as const;

export type DesignAgentId = (typeof DESIGN_AGENTS)[number];

export type DesignAgentDeclaration = {
  id: DesignAgentId;
  role: string;
  loop: readonly string[];
};

/**
 * Declarative agent roster. Not a second runtime.
 * Execution still goes Intent → Plan → Policy → Approval → Kernel step.
 */
export const DESIGN_AGENT_DECLARATIONS: DesignAgentDeclaration[] = [
  { id: 'designer', role: 'Owns semantic structure and visual hierarchy', loop: ['understand', 'plan', 'generate', 'critique'] },
  { id: 'ux', role: 'Wireframe, flow, CTA and information architecture', loop: ['analyze', 'plan', 'generate'] },
  { id: 'brand', role: 'Extract or define brand intelligence and tokens', loop: ['analyze', 'generate'] },
  { id: 'copy', role: 'Headlines, body and CTA language', loop: ['generate', 'critique'] },
  { id: 'responsive', role: 'Breakpoint variants over the same semantic tree', loop: ['observe', 'modify'] },
  { id: 'accessibility', role: 'Structural a11y on the design graph, not fake scores', loop: ['observe', 'verify'] },
  { id: 'seo', role: 'Structural SEO signals on the design graph', loop: ['observe', 'verify'] },
  { id: 'governance', role: 'Provenance, policy and evidence for generated design', loop: ['verify', 'evidence'] },
];

export const DEFAULT_DESIGN_AGENT_POLICY: AgentPolicy = {
  agentId: 'design-agent',
  version: 'design-1.0.0',
  permissions: [
    { resource: 'project', actions: ['read'], approval: 'never' },
    { resource: 'website', actions: ['read'], approval: 'never' },
    { resource: 'brand', actions: ['read', 'write'], approval: 'never' },
    { resource: 'analytics', actions: ['read'], approval: 'never' },
    { resource: 'design', actions: ['read', 'write'], approval: 'on-risk' },
    { resource: 'frontend', actions: ['write'], approval: 'on-risk' },
    { resource: 'content', actions: ['write'], approval: 'on-risk' },
    { resource: 'deployment', actions: ['publish'], approval: 'always' },
  ],
  deniedResources: ['production_database', 'secrets', 'unrestricted_personal_data'],
  restrictedDataClasses: ['customer_data', 'personal_data', 'special_category_data'],
  requireProvenanceForGeneratedContent: true,
  requireEvidence: true,
};
