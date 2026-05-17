import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ExecutionRecord,
  ExecutionStatus,
} from '../types';
import type { ExecutionTracer } from '../observability';

/**
 * Postgres-backed ExecutionTracer for the runtime.
 *
 * Writes to `public.runtime_executions` (created in Phase-0 migration
 * 20260516300000_runtime_core.sql). Tenant isolation is enforced by the
 * `is_tenant_member` RLS policies on the table; this adapter does not
 * re-implement those checks — it relies on the caller's auth context.
 *
 * The adapter never touches raw inputs/outputs — only the hashes
 * produced by the executor. PII never reaches this table.
 */
export class SupabaseExecutionTracer implements ExecutionTracer {
  constructor(private readonly sb: SupabaseClient) {}

  async start(record: ExecutionRecord): Promise<void> {
    const { error } = await this.sb.from('runtime_executions').insert({
      id: record.id,
      tenant_id: record.tenant_id,
      agent_id: record.agent_id,
      skill_id: record.skill_id,
      status: record.status,
      input_hash: record.input_hash,
      started_at: record.started_at,
    });
    if (error) {
      throw new Error(`runtime_executions.insert failed: ${error.message}`);
    }
  }

  async finish(
    id: string,
    patch: Pick<ExecutionRecord, 'status'> &
      Partial<Pick<ExecutionRecord, 'output_hash' | 'finished_at' | 'error_code'>>,
  ): Promise<void> {
    const update: Record<string, unknown> = { status: patch.status };
    if (patch.output_hash !== undefined) update.output_hash = patch.output_hash;
    if (patch.error_code !== undefined) update.error_code = patch.error_code;
    update.finished_at = isTerminal(patch.status)
      ? patch.finished_at ?? new Date().toISOString()
      : patch.finished_at ?? null;

    const { error } = await this.sb
      .from('runtime_executions')
      .update(update)
      .eq('id', id);
    if (error) {
      throw new Error(`runtime_executions.update failed: ${error.message}`);
    }
  }
}

function isTerminal(status: ExecutionStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
