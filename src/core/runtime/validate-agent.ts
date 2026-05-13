import type { AgentDefinition, Capability } from './types';
import type { SkillRegistry } from './registry';
import { diffCapabilities } from './permissions';

export type ValidationIssue =
  | { code: 'missing_field'; field: keyof AgentDefinition }
  | { code: 'invalid_id' }
  | { code: 'unknown_skill'; skill_id: string }
  | { code: 'duplicate_skill'; skill_id: string }
  | { code: 'missing_capability'; skill_id: string; capability: Capability }
  | { code: 'capability_surplus'; extra: readonly Capability[] }
  | { code: 'empty_capability'; capability: string };

export interface ValidationResult {
  valid: boolean;
  issues: readonly ValidationIssue[];
}

/**
 * Static validation for AgentDefinition. No network, no I/O. Catches
 * configuration drift before an agent is ever loaded into the runtime.
 *
 * Rules enforced:
 *  1. Required fields present and non-empty.
 *  2. Every referenced skill_id exists in the registry.
 *  3. No duplicate skill_ids.
 *  4. The union of all skills' required capabilities is a subset of the
 *     agent's granted_capabilities.
 *  5. By default the granted set is forbidden from containing extras
 *     beyond the union (least-privilege). Opt out with
 *     `allow_capability_surplus`.
 */
export function validateAgent(
  agent: AgentDefinition,
  registry: SkillRegistry,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const field of ['id', 'tenant_id', 'title'] as const) {
    if (!agent[field] || String(agent[field]).trim() === '') {
      issues.push({ code: 'missing_field', field });
    }
  }

  if (agent.id && !/^[a-z][a-z0-9_-]*$/.test(agent.id)) {
    issues.push({ code: 'invalid_id' });
  }

  for (const cap of agent.granted_capabilities ?? []) {
    if (!cap || typeof cap !== 'string' || cap.trim() === '') {
      issues.push({ code: 'empty_capability', capability: String(cap) });
    }
  }

  const seen = new Set<string>();
  const requiredUnion = new Set<Capability>();

  for (const skillId of agent.skill_ids ?? []) {
    if (seen.has(skillId)) {
      issues.push({ code: 'duplicate_skill', skill_id: skillId });
      continue;
    }
    seen.add(skillId);

    const skill = registry.get(skillId);
    if (!skill) {
      issues.push({ code: 'unknown_skill', skill_id: skillId });
      continue;
    }

    for (const cap of skill.capabilities) requiredUnion.add(cap);

    const missing = diffCapabilities(agent.granted_capabilities ?? [], skill.capabilities);
    for (const cap of missing) {
      issues.push({ code: 'missing_capability', skill_id: skillId, capability: cap });
    }
  }

  if (!agent.allow_capability_surplus) {
    const extra = (agent.granted_capabilities ?? []).filter((c) => !requiredUnion.has(c));
    if (extra.length > 0) {
      issues.push({ code: 'capability_surplus', extra });
    }
  }

  return { valid: issues.length === 0, issues };
}
