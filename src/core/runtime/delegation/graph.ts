import type {
  AgentIdentity,
  Capability,
  CorrelationIds,
  DelegationDecision,
  DelegationEdge,
  ResourceAction,
  ToolInvocation,
} from './types';
import { assertNarrowing, subtractCapabilities, uniqueSorted } from './invariant';

export interface CreateDelegationInput {
  command_id: string;
  evaluation_hash: string;
  parent: AgentIdentity;
  child: AgentIdentity;
  delegated_capabilities: readonly Capability[];
  denied_capabilities?: readonly Capability[];
  expires_at: string;
  max_depth: number;
  remaining_depth: number;
  approval_id?: string;
  now?: Date;
  id?: () => string;
}

export function createDelegationEdge(input: CreateDelegationInput): DelegationDecision {
  if (!input.command_id) {
    return { ok: false, reason: 'missing_command', detail: 'command_id required' };
  }
  if (!input.evaluation_hash) {
    return { ok: false, reason: 'missing_evaluation_hash', detail: 'evaluation_hash required' };
  }
  if (input.parent.tenant_id !== input.child.tenant_id) {
    return { ok: false, reason: 'cross_tenant', detail: 'v1 forbids cross-tenant delegation' };
  }
  if (input.parent.agent_id === input.child.agent_id) {
    return { ok: false, reason: 'self_delegation', detail: 'from_agent_id === to_agent_id' };
  }
  if (input.remaining_depth <= 0 || input.max_depth <= 0) {
    return { ok: false, reason: 'depth_exceeded', detail: 'no remaining delegation depth' };
  }

  const parentEffective = uniqueSorted(input.parent.granted_capabilities);
  const delegated = uniqueSorted(
    subtractCapabilities(input.delegated_capabilities, input.denied_capabilities),
  );

  if (delegated.length === 0) {
    return { ok: false, reason: 'empty_capability_set', detail: 'delegation would grant nothing' };
  }

  const narrowing = assertNarrowing({
    parentEffective,
    delegated,
    childEffective: delegated,
  });
  if (!narrowing.ok) {
    return {
      ok: false,
      reason: 'authority_expansion',
      detail: `invariant violated: ${narrowing.violated}`,
    };
  }

  const now = input.now ?? new Date();
  if (Date.parse(input.expires_at) <= now.getTime()) {
    return { ok: false, reason: 'expired', detail: 'expires_at is not in the future' };
  }

  const edge: DelegationEdge = {
    delegation_id: (input.id ?? defaultId)(),
    command_id: input.command_id,
    tenant_id: input.parent.tenant_id,
    from_agent_id: input.parent.agent_id,
    to_agent_id: input.child.agent_id,
    delegated_capabilities: delegated,
    denied_capabilities: input.denied_capabilities,
    expires_at: input.expires_at,
    max_depth: Math.min(input.max_depth, input.remaining_depth) - 1,
    approval_id: input.approval_id,
    evaluation_hash: input.evaluation_hash,
    created_at: now.toISOString(),
  };

  return { ok: true, edge, effective_capabilities: delegated };
}

export function isEdgeActive(edge: DelegationEdge, now: Date = new Date()): DelegationDecision {
  if (edge.revoked_at) {
    return { ok: false, reason: 'revoked', detail: `revoked_at=${edge.revoked_at}` };
  }
  if (Date.parse(edge.expires_at) <= now.getTime()) {
    return { ok: false, reason: 'expired', detail: `expires_at=${edge.expires_at}` };
  }
  return { ok: true, edge, effective_capabilities: edge.delegated_capabilities };
}

export function effectiveAlongPath(
  root: AgentIdentity,
  edges: readonly DelegationEdge[],
  now?: Date,
): DelegationDecision {
  let current = uniqueSorted(root.granted_capabilities);
  let last: DelegationEdge | undefined;
  let expectedFrom = root.agent_id;

  for (const edge of edges) {
    if (edge.tenant_id !== root.tenant_id) {
      return { ok: false, reason: 'cross_tenant', detail: `edge ${edge.delegation_id}` };
    }
    if (edge.from_agent_id !== expectedFrom) {
      return {
        ok: false,
        reason: 'authority_expansion',
        detail: `path break: expected from=${expectedFrom} got ${edge.from_agent_id}`,
      };
    }
    const live = isEdgeActive(edge, now);
    if (!live.ok) return live;

    const narrowing = assertNarrowing({
      parentEffective: current,
      delegated: edge.delegated_capabilities,
      childEffective: edge.delegated_capabilities,
    });
    if (!narrowing.ok) {
      return {
        ok: false,
        reason: 'authority_expansion',
        detail: `edge ${edge.delegation_id}: ${narrowing.violated}`,
      };
    }
    current = uniqueSorted(edge.delegated_capabilities);
    expectedFrom = edge.to_agent_id;
    last = edge;
  }

  if (!last) {
    return {
      ok: true,
      edge: {
        delegation_id: 'root',
        command_id: '',
        tenant_id: root.tenant_id,
        from_agent_id: root.agent_id,
        to_agent_id: root.agent_id,
        delegated_capabilities: current,
        expires_at: '9999-12-31T00:00:00.000Z',
        max_depth: 0,
        evaluation_hash: '',
        created_at: new Date(0).toISOString(),
      },
      effective_capabilities: current,
    };
  }
  return { ok: true, edge: last, effective_capabilities: current };
}

export function allowsResourceAction(
  effective: readonly Capability[],
  action: Pick<ResourceAction, 'resource_kind' | 'verb'>,
): boolean {
  const cap: Capability =
    action.verb === 'read'
      ? (`read:${action.resource_kind}` as Capability)
      : (`write:${action.resource_kind}` as Capability);
  if (action.verb === 'read') return effective.includes(cap);
  return effective.includes(cap);
}

export function bindCorrelation(args: {
  command_id: string;
  agent_id: string;
  edge?: DelegationEdge;
  tool?: ToolInvocation;
  resource?: ResourceAction;
  policy_decision_id?: string;
  approval_id?: string;
  execution_id?: string;
  evidence_event_id?: string;
}): CorrelationIds {
  return {
    command_id: args.command_id,
    agent_id: args.agent_id,
    delegation_id: args.edge?.delegation_id,
    tool_invocation_id: args.tool?.tool_invocation_id,
    resource_action_id: args.resource?.resource_action_id,
    policy_decision_id: args.policy_decision_id,
    approval_id: args.approval_id ?? args.edge?.approval_id,
    execution_id: args.execution_id,
    evidence_event_id: args.evidence_event_id,
  };
}

function defaultId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `dlg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
