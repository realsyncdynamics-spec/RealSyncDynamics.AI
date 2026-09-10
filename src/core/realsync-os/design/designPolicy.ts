import { evaluateToolAction, type PolicyDecision } from '../policyEngine';
import type { RiskLevel } from '../types';
import { DEFAULT_DESIGN_AGENT_POLICY } from './designAgents';
import type { DesignProject } from './types';

export { DEFAULT_DESIGN_AGENT_POLICY };

export const DESIGN_KERNEL_ACTIONS = new Set([
  'discover_design',
  'extract_brand',
  'define_design_system',
  'create_wireframe',
  'generate_hero',
  'generate_sections',
  'apply_responsive',
  'verify_accessibility',
  'verify_seo_structure',
  'evaluate_design_governance',
  'map_siteos_blueprint',
]);

export function isDesignKernelAction(action: string): boolean {
  return DESIGN_KERNEL_ACTIONS.has(action);
}

export function designResourceForAction(action: string): string {
  if (action === 'publish') return 'deployment';
  if (action === 'extract_brand') return 'brand';
  if (action === 'evaluate_design_governance') return 'design';
  if (
    action.startsWith('generate_') ||
    action.startsWith('create_') ||
    action.startsWith('define_') ||
    action.startsWith('apply_') ||
    action === 'map_siteos_blueprint'
  ) {
    return 'design';
  }
  if (action.startsWith('discover') || action.startsWith('verify_')) return 'website';
  return 'design';
}

export function designMapAction(action: string): string {
  if (action === 'publish') return 'publish';
  if (
    action.startsWith('generate_') ||
    action.startsWith('create_') ||
    action.startsWith('define_') ||
    action.startsWith('apply_') ||
    action === 'extract_brand' ||
    action === 'map_siteos_blueprint'
  ) {
    return 'write';
  }
  return 'read';
}

export function evaluateDesignAction(
  action: string,
  risk: RiskLevel,
  approved: boolean,
): PolicyDecision & { provenanceRequired: boolean } {
  const decision = evaluateToolAction(
    DEFAULT_DESIGN_AGENT_POLICY,
    designResourceForAction(action),
    designMapAction(action),
    risk,
  );
  return {
    ...decision,
    provenanceRequired: DEFAULT_DESIGN_AGENT_POLICY.requireProvenanceForGeneratedContent,
    requiresApproval: decision.requiresApproval && !approved ? decision.requiresApproval : decision.requiresApproval,
  };
}

export function evaluateGeneratedAsset(project: DesignProject): PolicyDecision {
  const missing = project.documents
    .flatMap((doc) => Object.values(doc.nodes))
    .filter((node) => node.provenance.generated && !node.provenance.policyVersion);

  if (missing.length > 0) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: 'Generated design nodes are missing provenance.',
    };
  }

  const customerLeak = project.documents
    .flatMap((doc) => Object.values(doc.nodes))
    .some((node) => /kundenakte|personal data|ssn|iban/i.test(node.props.text ?? ''));

  if (customerLeak) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: 'Restricted customer data detected in design copy.',
    };
  }

  return {
    allowed: true,
    requiresApproval: false,
    reason: 'Generated design carries provenance and no restricted data.',
  };
}
