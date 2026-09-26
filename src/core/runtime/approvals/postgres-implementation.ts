/**
 * PostgreSQL-backed ApprovalGateService implementation.
 * Production service for Phase 1.2+.
 *
 * Uses Supabase's Postgres with RLS for tenant isolation and atomic state
 * transitions via stored functions. Safe for concurrent access.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ApprovalGateService,
  ApprovalGateRecord,
  OpenGateInput,
  DecideGateInput,
} from '../approvals';

export interface ApprovalGateTable {
  id: string;
  tenant_id: string;
  execution_id: string;
  status: 'pending' | 'granted' | 'denied' | 'expired';
  reason: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  requested_action: string;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export class PostgresApprovalGateService implements ApprovalGateService {
  constructor(
    private supabase: SupabaseClient,
    private tenantId?: string, // Injected for testing; normally derived from JWT
  ) {}

  async open(input: OpenGateInput): Promise<ApprovalGateRecord> {
    const tenantId = this.tenantId || this.getTenantFromJwt();

    const { data, error } = await this.supabase
      .from('runtime_approval_gates')
      .insert({
        tenant_id: tenantId,
        execution_id: input.execution_id,
        status: 'pending',
        reason: input.reason,
        risk_level: input.risk_level,
        requested_action: input.requested_action,
        metadata: null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to open approval gate: ${error.message}`);
    }

    return this.mapTableToRecord(data);
  }

  async get(id: string): Promise<ApprovalGateRecord | undefined> {
    const { data, error } = await this.supabase
      .from('runtime_approval_gates')
      .select()
      .eq('id', id)
      .single();

    if (error?.code === 'PGRST116') {
      // Not found
      return undefined;
    }

    if (error) {
      throw new Error(`Failed to fetch approval gate: ${error.message}`);
    }

    return this.mapTableToRecord(data);
  }

  async decide(input: DecideGateInput): Promise<ApprovalGateRecord> {
    // Use stored function for atomic state transition
    const { data, error } = await this.supabase
      .rpc('decide_gate', {
        gate_id: input.id,
        new_status: input.status,
        decided_by_user_id: input.decided_by || null,
      })
      .select()
      .single();

    if (error) {
      // Check if it's a state transition error
      if (error.message.includes('Invalid state transition')) {
        throw new Error(`Cannot transition gate to ${input.status}: gate may already be decided`);
      }
      throw new Error(`Failed to decide approval gate: ${error.message}`);
    }

    // Fetch full record to return complete ApprovalGateRecord
    return this.get(input.id).then((record) => {
      if (!record) {
        throw new Error(`Approval gate ${input.id} not found after decision`);
      }
      return record;
    });
  }

  /**
   * List pending gates for a tenant (for dashboard).
   * Does not use RLS directly; caller must verify tenant context.
   */
  async listPending(limit: number = 50): Promise<ApprovalGateRecord[]> {
    const tenantId = this.tenantId || this.getTenantFromJwt();

    const { data, error } = await this.supabase
      .from('runtime_approval_gates')
      .select()
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to list pending gates: ${error.message}`);
    }

    return data?.map((row) => this.mapTableToRecord(row)) || [];
  }

  /**
   * Get decision history for an execution (for evidence audit trail).
   */
  async getDecisionHistory(executionId: string): Promise<ApprovalGateRecord[]> {
    const { data, error } = await this.supabase
      .from('runtime_approval_gates')
      .select()
      .eq('execution_id', executionId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch decision history: ${error.message}`);
    }

    return data?.map((row) => this.mapTableToRecord(row)) || [];
  }

  // ──────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────

  private mapTableToRecord(row: ApprovalGateTable): ApprovalGateRecord {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      execution_id: row.execution_id,
      status: row.status,
      reason: row.reason,
      risk_level: row.risk_level,
      requested_action: row.requested_action,
      decided_by: row.decided_by,
      decided_at: row.decided_at,
      created_at: row.created_at,
    };
  }

  private getTenantFromJwt(): string {
    // In production, this is derived from auth.jwt() → session.user.tenant_id
    // During testing, tenantId is injected via constructor.
    // Edge Functions will call this with service_role, bypassing JWT extraction.
    throw new Error(
      'Tenant ID must be provided via constructor or extracted from JWT in Edge Function context',
    );
  }
}

/**
 * Factory for creating PostgresApprovalGateService in different contexts.
 */
export function createApprovalGateService(
  supabase: SupabaseClient,
  tenantId?: string,
): ApprovalGateService {
  return new PostgresApprovalGateService(supabase, tenantId);
}
