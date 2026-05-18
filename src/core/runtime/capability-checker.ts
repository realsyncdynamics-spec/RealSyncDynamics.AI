import type {
  PermissionChecker,
  PermissionCheckInput,
  PermissionDecision,
} from './permissions';
import { diffCapabilities } from './permissions';
import type { AgentCapabilityResolver } from './agent-resolver';

/**
 * Capability-layer PermissionChecker (Phase 1.3).
 *
 * This is layer 3 of the three-tier model from
 * `docs/architecture/agent-os.md` §3.4:
 *
 *   1. Postgres RLS         — physical tenant isolation. Not this file.
 *   2. RBAC (user roles)    — enforced upstream in the API layer.
 *   3. Capabilities         — what THIS class enforces.
 *
 * The decision is purely about whether the agent has been granted every
 * capability that the requested skill declares. Cross-tenant smuggling
 * (an agent_id from tenant A being invoked under tenant B) is rejected
 * here as a defense in depth even though RLS would also block the DB
 * writes downstream.
 *
 * Deny-by-default: an unknown agent yields `denied` with the full
 * required set listed as missing.
 */
export class CapabilityPermissionChecker implements PermissionChecker {
  constructor(private readonly resolver: AgentCapabilityResolver) {}

  async check(input: PermissionCheckInput): Promise<PermissionDecision> {
    const agent = await this.resolver.resolve({
      tenant_id: input.tenant_id,
      agent_id: input.agent_id,
    });

    if (!agent) {
      return {
        outcome: 'denied',
        missing: input.required,
        reason: `agent_not_found: ${input.agent_id}`,
      };
    }

    if (agent.tenant_id !== input.tenant_id) {
      // Defense in depth. A resolver implementation that ignores
      // tenant_id and returns an agent from another tenant must not
      // produce a grant — RLS would still catch the downstream write,
      // but we should not even attempt it.
      return {
        outcome: 'denied',
        missing: input.required,
        reason: `agent_tenant_mismatch: agent ${input.agent_id} belongs to a different tenant`,
      };
    }

    const missing = diffCapabilities(agent.granted_capabilities, input.required);
    if (missing.length > 0) {
      return {
        outcome: 'denied',
        missing,
        reason: `missing_capabilities: ${missing.join(', ')}`,
      };
    }

    return { outcome: 'granted' };
  }
}
