/**
 * In-memory ApprovalGateService implementation.
 * Phase 1.1 test implementation. Replaces Postgres-backed service until
 * schema migrations can be deployed (Phase 2).
 *
 * Provides full contract: state machine enforcement, UUID generation,
 * timestamp management, and tenant isolation via injection.
 */
import type { ApprovalGateService, ApprovalGateRecord, OpenGateInput, DecideGateInput } from '../approvals';

export class InMemoryApprovalGateService implements ApprovalGateService {
  private gates = new Map<string, ApprovalGateRecord>();

  constructor(private tenantId: string) {}

  async open(input: OpenGateInput): Promise<ApprovalGateRecord> {
    const gate: ApprovalGateRecord = {
      id: crypto.randomUUID(),
      tenant_id: this.tenantId,
      execution_id: input.execution_id,
      status: 'pending',
      reason: input.reason,
      risk_level: input.risk_level,
      requested_action: input.requested_action,
      decided_by: null,
      decided_at: null,
      created_at: new Date().toISOString(),
    };

    this.gates.set(gate.id, gate);
    return gate;
  }

  async get(id: string): Promise<ApprovalGateRecord | undefined> {
    return this.gates.get(id);
  }

  async decide(input: DecideGateInput): Promise<ApprovalGateRecord> {
    const gate = this.gates.get(input.id);
    if (!gate) {
      throw new Error(`Approval gate ${input.id} not found`);
    }

    if (gate.status !== 'pending') {
      throw new Error(`Cannot transition gate from ${gate.status} to ${input.status}: already decided`);
    }

    const updated: ApprovalGateRecord = {
      ...gate,
      status: input.status,
      decided_by: input.decided_by || null,
      decided_at: new Date().toISOString(),
    };

    this.gates.set(input.id, updated);
    return updated;
  }
}
