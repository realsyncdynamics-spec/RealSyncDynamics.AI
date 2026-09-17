import { describe, it, expect } from 'vitest';
import {
  createDelegationEdge,
  effectiveAlongPath,
  allowsResourceAction,
} from '../../../src/core/runtime/delegation/graph';
import type { AgentIdentity, Capability, DelegationEdge } from '../../../src/core/runtime/delegation/types';

const tenant = 'org_1';

function agent(id: string, caps: Capability[]): AgentIdentity {
  return {
    tenant_id: tenant,
    agent_id: id,
    principal_kind: 'agent',
    granted_capabilities: caps,
  };
}

describe('DelegationEdge invariant', () => {
  const A = agent('A', ['read:salesforce', 'read:stripe', 'write:stripe']);
  const B = agent('B', ['write:stripe']);
  const now = new Date('2026-09-17T20:00:00.000Z');
  const future = '2026-09-18T20:00:00.000Z';
  const base = {
    command_id: 'cmd-1',
    evaluation_hash: 'ev-abc',
    expires_at: future,
    max_depth: 2,
    remaining_depth: 2,
    now,
    id: () => 'dlg-1',
  };

  it('narrows A→B to write:stripe only', () => {
    const d = createDelegationEdge({
      ...base,
      parent: A,
      child: B,
      delegated_capabilities: ['write:stripe'],
    });
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect([...d.effective_capabilities]).toEqual(['write:stripe']);
    const path = effectiveAlongPath(A, [d.edge], now);
    expect(path.ok).toBe(true);
    if (!path.ok) return;
    expect(allowsResourceAction(path.effective_capabilities, { resource_kind: 'stripe', verb: 'write' })).toBe(true);
    expect(allowsResourceAction(path.effective_capabilities, { resource_kind: 'salesforce', verb: 'read' })).toBe(false);
  });

  it('rejects authority expansion', () => {
    const d = createDelegationEdge({
      ...base,
      parent: A,
      child: B,
      delegated_capabilities: ['write:salesforce'] as Capability[],
    });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('authority_expansion');
  });

  it('rejects a forged path edge', () => {
    const forged: DelegationEdge = {
      delegation_id: 'forged',
      command_id: 'cmd-1',
      tenant_id: tenant,
      from_agent_id: 'A',
      to_agent_id: 'B',
      delegated_capabilities: ['write:salesforce'],
      expires_at: future,
      max_depth: 1,
      evaluation_hash: 'ev-abc',
      created_at: now.toISOString(),
    };
    const path = effectiveAlongPath(A, [forged], now);
    expect(path.ok).toBe(false);
    if (!path.ok) expect(path.reason).toBe('authority_expansion');
  });

  it('rejects cross-tenant', () => {
    const d = createDelegationEdge({
      ...base,
      parent: A,
      child: { ...B, tenant_id: 'org_other' },
      delegated_capabilities: ['write:stripe'],
    });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('cross_tenant');
  });
});
