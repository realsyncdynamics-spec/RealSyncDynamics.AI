import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseExecutionTracer } from '../../../../src/core/runtime/supabase';
import type { ExecutionRecord } from '../../../../src/core/runtime';

/**
 * Captures every call against a Supabase fluent chain so the tests can
 * assert on the table, the verb, the payload, and the .eq() predicates.
 */
function spyClient(insertResult = { error: null }, updateResult = { error: null }) {
  const insert = vi.fn((_row: Record<string, unknown>) => Promise.resolve(insertResult));
  const eq = vi.fn((_col: string, _val: unknown) => Promise.resolve(updateResult));
  const update = vi.fn((_patch: Record<string, unknown>) => ({ eq }));
  const from = vi.fn((_table: string) => ({ insert, update }));
  const sb = { from } as unknown as SupabaseClient;
  return { sb, from, insert, update, eq };
}

const sampleRecord: ExecutionRecord = {
  id: 'exec-1',
  tenant_id: 'tenant-1',
  agent_id: 'audit-agent',
  skill_id: 'audit.cookie_scan',
  status: 'pending',
  input_hash: 'abc',
  started_at: '2026-05-14T00:00:00.000Z',
};

describe('SupabaseExecutionTracer.start', () => {
  it('inserts the full pending row into runtime_executions', async () => {
    const { sb, from, insert } = spyClient();
    const tracer = new SupabaseExecutionTracer(sb);

    await tracer.start(sampleRecord);

    expect(from).toHaveBeenCalledWith('runtime_executions');
    expect(insert).toHaveBeenCalledWith({
      id: 'exec-1',
      tenant_id: 'tenant-1',
      agent_id: 'audit-agent',
      skill_id: 'audit.cookie_scan',
      status: 'pending',
      input_hash: 'abc',
      started_at: '2026-05-14T00:00:00.000Z',
    });
  });

  it('throws when Postgres rejects the insert (RLS, constraint, etc.)', async () => {
    const { sb } = spyClient({ error: { message: 'row-level security' } });
    const tracer = new SupabaseExecutionTracer(sb);
    await expect(tracer.start(sampleRecord)).rejects.toThrow(/row-level security/);
  });
});

describe('SupabaseExecutionTracer.finish', () => {
  it('updates status + finished_at on terminal completion', async () => {
    const { sb, update, eq } = spyClient();
    const tracer = new SupabaseExecutionTracer(sb);

    await tracer.finish('exec-1', {
      status: 'completed',
      output_hash: 'deadbeef',
      finished_at: '2026-05-14T00:00:01.000Z',
    });

    expect(update).toHaveBeenCalledWith({
      status: 'completed',
      output_hash: 'deadbeef',
      finished_at: '2026-05-14T00:00:01.000Z',
    });
    expect(eq).toHaveBeenCalledWith('id', 'exec-1');
  });

  it('does not include output_hash when not provided', async () => {
    const { sb, update } = spyClient();
    const tracer = new SupabaseExecutionTracer(sb);

    await tracer.finish('exec-1', {
      status: 'failed',
      error_code: 'handler_threw',
      finished_at: '2026-05-14T00:00:01.000Z',
    });

    const payload = update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('output_hash');
    expect(payload).toMatchObject({
      status: 'failed',
      error_code: 'handler_threw',
    });
  });

  it('leaves finished_at null for non-terminal status transitions', async () => {
    const { sb, update } = spyClient();
    const tracer = new SupabaseExecutionTracer(sb);

    await tracer.finish('exec-1', { status: 'awaiting_approval' });

    const payload = update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe('awaiting_approval');
    expect(payload.finished_at).toBeNull();
  });

  it('stamps finished_at automatically on terminal status when caller omits it', async () => {
    const { sb, update } = spyClient();
    const tracer = new SupabaseExecutionTracer(sb);

    await tracer.finish('exec-1', { status: 'completed', output_hash: 'h' });

    const payload = update.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof payload.finished_at).toBe('string');
    expect(payload.finished_at).not.toBe('');
  });

  it('throws on update errors', async () => {
    const { sb } = spyClient({ error: null }, { error: { message: 'permission denied' } });
    const tracer = new SupabaseExecutionTracer(sb);

    await expect(
      tracer.finish('exec-1', { status: 'completed' }),
    ).rejects.toThrow(/permission denied/);
  });
});
