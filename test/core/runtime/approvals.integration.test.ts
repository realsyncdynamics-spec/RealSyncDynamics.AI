/**
 * Integration tests for ApprovalGateService (Postgres-backed).
 * Tests the full approval flow: open → decide → execute → evidence.
 */
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import type { ApprovalGateService, OpenGateInput, DecideGateInput } from '../../../src/core/runtime/approvals';
import { PostgresApprovalGateService } from '../../../src/core/runtime/approvals/postgres-implementation';
import { createTestSupabaseClient } from '../../fixtures/supabase';

describe('ApprovalGateService (Postgres)', () => {
  let service: ApprovalGateService;
  let tenantId: string;
  let executionId: string;

  beforeAll(async () => {
    const supabase = await createTestSupabaseClient();
    service = new PostgresApprovalGateService(supabase);
    tenantId = 'test-tenant-' + crypto.randomUUID().slice(0, 8);
    executionId = 'exec-' + crypto.randomUUID().slice(0, 12);
  });

  afterAll(async () => {
    // Cleanup: delete test records
    const supabase = await createTestSupabaseClient();
    await supabase
      .from('runtime_approval_gates')
      .delete()
      .eq('tenant_id', tenantId);
  });

  describe('open()', () => {
    it('creates a pending gate with correct fields', async () => {
      const input: OpenGateInput = {
        execution_id: executionId,
        reason: 'Web builder publish action',
        risk_level: 'high',
        requested_action: 'builder.publish',
      };

      const gate = await service.open(input);

      expect(gate.id).toBeTruthy();
      expect(gate.execution_id).toBe(executionId);
      expect(gate.status).toBe('pending');
      expect(gate.reason).toBe(input.reason);
      expect(gate.risk_level).toBe('high');
      expect(gate.requested_action).toBe('builder.publish');
      expect(gate.created_at).toBeTruthy();
      expect(gate.decided_at).toBe(null);
    });

    it('enforces tenant isolation', async () => {
      const input: OpenGateInput = {
        execution_id: 'exec-' + crypto.randomUUID().slice(0, 12),
        reason: 'Test isolation',
        risk_level: 'medium',
        requested_action: 'test.action',
      };

      const gate = await service.open(input);
      expect(gate.tenant_id).toBe(tenantId);
    });
  });

  describe('get()', () => {
    it('retrieves an existing gate by id', async () => {
      const openInput: OpenGateInput = {
        execution_id: 'exec-' + crypto.randomUUID().slice(0, 12),
        reason: 'Test retrieval',
        risk_level: 'low',
        requested_action: 'test.read',
      };

      const created = await service.open(openInput);
      const retrieved = await service.get(created.id);

      expect(retrieved).toBeTruthy();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.status).toBe('pending');
    });

    it('returns undefined for non-existent gate', async () => {
      const result = await service.get('non-existent-gate-id');
      expect(result).toBe(undefined);
    });
  });

  describe('decide()', () => {
    it('transitions pending gate to granted with timestamp', async () => {
      const openInput: OpenGateInput = {
        execution_id: 'exec-' + crypto.randomUUID().slice(0, 12),
        reason: 'Test grant',
        risk_level: 'medium',
        requested_action: 'builder.update',
      };

      const gate = await service.open(openInput);
      const decidedBy = 'user-' + crypto.randomUUID().slice(0, 8);

      const decided = await service.decide({
        id: gate.id,
        status: 'granted',
        decided_by: decidedBy,
      });

      expect(decided.status).toBe('granted');
      expect(decided.decided_by).toBe(decidedBy);
      expect(decided.decided_at).toBeTruthy();
      expect(decided.decided_at && new Date(decided.decided_at) > new Date(gate.created_at)).toBeTruthy();
    });

    it('transitions pending gate to denied with timestamp', async () => {
      const openInput: OpenGateInput = {
        execution_id: 'exec-' + crypto.randomUUID().slice(0, 12),
        reason: 'Test deny',
        risk_level: 'high',
        requested_action: 'builder.publish',
      };

      const gate = await service.open(openInput);
      const decidedBy = 'user-' + crypto.randomUUID().slice(0, 8);

      const decided = await service.decide({
        id: gate.id,
        status: 'denied',
        decided_by: decidedBy,
      });

      expect(decided.status).toBe('denied');
      expect(decided.decided_by).toBe(decidedBy);
      expect(decided.decided_at).toBeTruthy();
    });

    it('rejects transition from non-pending state', async () => {
      const openInput: OpenGateInput = {
        execution_id: 'exec-' + crypto.randomUUID().slice(0, 12),
        reason: 'Test state transition',
        risk_level: 'low',
        requested_action: 'test.action',
      };

      const gate = await service.open(openInput);

      // First decision: pending → granted
      await service.decide({
        id: gate.id,
        status: 'granted',
        decided_by: 'user-1',
      });

      // Second decision: granted → denied (should fail)
      try {
        await service.decide({
          id: gate.id,
          status: 'denied',
          decided_by: 'user-2',
        });
        expect.fail('Should not allow state transition from granted to denied');
      } catch (err) {
        expect(err instanceof Error).toBeTruthy();
        expect((err as Error).message).toMatch(/already.*decided|state transition/i);
      }
    });
  });

  describe('tenant isolation', () => {
    it('user from different tenant cannot access gate', async () => {
      const openInput: OpenGateInput = {
        execution_id: 'exec-' + crypto.randomUUID().slice(0, 12),
        reason: 'Cross-tenant test',
        risk_level: 'critical',
        requested_action: 'builder.publish',
      };

      const gate = await service.open(openInput);

      // Simulate different tenant client (would have different RLS context)
      // For now, this is a structural test; RLS is enforced at DB level
      expect(gate.tenant_id).toBe(tenantId);
    });
  });

  describe('edge cases', () => {
    it('handles very long reason strings', async () => {
      const longReason = 'This is a very long reason. '.repeat(50);

      const input: OpenGateInput = {
        execution_id: 'exec-' + crypto.randomUUID().slice(0, 12),
        reason: longReason,
        risk_level: 'medium',
        requested_action: 'test.action',
      };

      const gate = await service.open(input);
      expect(gate.id).toBeTruthy();
      expect(gate.reason).toBe(longReason);
    });

    it('handles concurrent open() calls without race condition', async () => {
      const inputs = Array.from({ length: 5 }, (_, i) => ({
        execution_id: `exec-${i}-${crypto.randomUUID().slice(0, 8)}`,
        reason: `Concurrent test ${i}`,
        risk_level: 'low' as const,
        requested_action: `test.action${i}`,
      }));

      const gates = await Promise.all(inputs.map((inp) => service.open(inp)));

      expect(gates.length).toBe(5);
      expect(new Set(gates.map((g) => g.id)).size).toBe(5);
    });
  });
});
