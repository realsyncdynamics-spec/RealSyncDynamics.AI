import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ApprovalGateRecord,
  ApprovalStatus,
  RiskLevel,
} from '../types';
import type {
  ApprovalGateService,
  DecideGateInput,
  OpenGateInput,
} from '../approvals';

/**
 * Postgres-backed ApprovalGateService. Writes to
 * `public.runtime_approval_gates` (Phase-0 migration). The decide() path
 * uses a conditional UPDATE so concurrent decisions cannot transition a
 * gate twice — if zero rows are returned, the caller raced and the
 * adapter throws.
 */
export class SupabaseApprovalGateService implements ApprovalGateService {
  constructor(private readonly sb: SupabaseClient) {}

  async open(input: OpenGateInput): Promise<ApprovalGateRecord> {
    const { data, error } = await this.sb
      .from('runtime_approval_gates')
      .insert({
        execution_id: input.execution_id,
        reason: input.reason,
        risk_level: input.risk_level,
        requested_action: input.requested_action,
        status: 'pending',
      })
      .select('*')
      .single();
    if (error || !data) {
      throw new Error(
        `runtime_approval_gates.insert failed: ${error?.message ?? 'no row'}`,
      );
    }
    return mapRow(data);
  }

  async get(id: string): Promise<ApprovalGateRecord | undefined> {
    const { data, error } = await this.sb
      .from('runtime_approval_gates')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new Error(`runtime_approval_gates.select failed: ${error.message}`);
    }
    return data ? mapRow(data) : undefined;
  }

  async decide(input: DecideGateInput): Promise<ApprovalGateRecord> {
    const update: Record<string, unknown> = {
      status: input.status,
      decided_at: new Date().toISOString(),
    };
    if (input.decided_by !== undefined) update.decided_by = input.decided_by;

    // Conditional update: only transition from `pending`. Anything else
    // (granted/denied/expired) is a no-op and we throw to surface the race
    // or replay. Using .select() after update returns the affected rows.
    const { data, error } = await this.sb
      .from('runtime_approval_gates')
      .update(update)
      .eq('id', input.id)
      .eq('status', 'pending')
      .select('*');
    if (error) {
      throw new Error(`runtime_approval_gates.update failed: ${error.message}`);
    }
    if (!data || data.length === 0) {
      throw new Error(
        `runtime_approval_gates.decide: gate ${input.id} is not pending or does not exist`,
      );
    }
    return mapRow(data[0]);
  }
}

interface GateRow {
  id: string;
  execution_id: string;
  reason: string;
  risk_level: RiskLevel;
  requested_action: string;
  status: ApprovalStatus;
  created_at: string;
  decided_at: string | null;
}

function mapRow(row: GateRow): ApprovalGateRecord {
  return {
    id: row.id,
    execution_id: row.execution_id,
    reason: row.reason,
    risk_level: row.risk_level,
    requested_action: row.requested_action,
    status: row.status,
    created_at: row.created_at,
    decided_at: row.decided_at ?? undefined,
  };
}
