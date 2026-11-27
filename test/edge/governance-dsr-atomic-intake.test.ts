import { describe, expect, it } from 'vitest';
import { buildCreate } from '../../supabase/functions/governance-dsr/logic';
import {
  atomicCreateParams,
  parseAtomicOperationId,
} from '../../supabase/functions/governance-dsr/atomic-intake';

const TENANT = 'f7aa2c1e-b60c-4c63-8621-81c18a514191';
const ACTOR = '42bb69bb-f65d-4c45-87bb-af17deabb2ef';
const OP = '72c681d8-e343-4a9e-bd91-4be58a97d4a3';

describe('P0 #2360 – gated Edge atomic create contract', () => {
  it('accepts only canonical UUIDv4 operation IDs and normalizes case', () => {
    expect(parseAtomicOperationId(OP)).toBe(OP);
    expect(parseAtomicOperationId('  ' + OP.toUpperCase() + '  ')).toBe(OP);
    expect(parseAtomicOperationId('72c681d8-e343-1a9e-bd91-4be58a97d4a3')).toBeNull();
    expect(parseAtomicOperationId('72c681d8-e343-4a9e-7d91-4be58a97d4a3')).toBeNull();
    expect(parseAtomicOperationId('not-a-uuid')).toBeNull();
    expect(parseAtomicOperationId(null)).toBeNull();
    expect(parseAtomicOperationId(42)).toBeNull();
  });

  it('passes validated DSR fields and server-authenticated actor only', () => {
    const built = buildCreate({
      tenant_id: TENANT,
      request_type: 'erasure',
      requester_email: '  SUBJECT@Example.invalid ',
      requester_name: 'name',
      affected_assets: ['a', null, 'b'],
      actor_user_id: 'untrusted-client-actor',
      operation_id: OP,
    });
    expect(built.error).toBeUndefined();
    const row = built.row!;
    const params = atomicCreateParams(row, ACTOR, OP);

    expect(params).toEqual({
      p_tenant: TENANT,
      p_actor: ACTOR,
      p_operation: OP,
      p_type: 'erasure',
      p_email: 'SUBJECT@Example.invalid',
      p_name: 'name',
      p_description: null,
      p_assignee: null,
      p_assets: ['a', 'b'],
    });
    expect(Object.values(params)).not.toContain('untrusted-client-actor');
  });

  it('never sends mutable DSR status or arbitrary untrusted columns to the privileged RPC', () => {
    const row = buildCreate({
      tenant_id: TENANT,
      request_type: 'access',
      requester_email: 'subject@example.invalid',
      status: 'completed',
      metadata: { subject_ref: 'forged' },
      evidence_status: 'complete',
    }).row!;
    const params = atomicCreateParams(row, ACTOR, OP);
    expect(Object.keys(params).sort()).toEqual([
      'p_actor', 'p_assets', 'p_assignee', 'p_description', 'p_email',
      'p_name', 'p_operation', 'p_tenant', 'p_type',
    ]);
    expect(JSON.stringify(params)).not.toMatch(/evidence_status|forged|completed/);
  });
});
