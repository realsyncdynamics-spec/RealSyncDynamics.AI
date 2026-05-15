import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  InMemoryEventBus,
  type RuntimeEvent,
} from '../../../../src/core/runtime';
import {
  SupabaseEventLog,
  TeeEventBus,
} from '../../../../src/core/runtime/supabase';

function event(overrides: Partial<RuntimeEvent> = {}): RuntimeEvent {
  return {
    name: 'execution.started',
    tenant_id: 'tenant-1',
    execution_id: 'exec-1',
    agent_id: 'audit-agent',
    skill_id: 'audit.cookie_scan',
    payload: { input_hash: 'abc' },
    occurred_at: '2026-05-14T00:00:00.000Z',
    ...overrides,
  };
}

describe('SupabaseEventLog', () => {
  it('writes the full event to runtime_events', async () => {
    const insert = vi.fn(() => Promise.resolve({ error: null }));
    const from = vi.fn((t: string) => {
      expect(t).toBe('runtime_events');
      return { insert };
    });
    const sb = { from } as unknown as SupabaseClient;

    const log = new SupabaseEventLog(sb);
    await log.emit(event());

    expect(insert).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      execution_id: 'exec-1',
      agent_id: 'audit-agent',
      skill_id: 'audit.cookie_scan',
      name: 'execution.started',
      payload: { input_hash: 'abc' },
      occurred_at: '2026-05-14T00:00:00.000Z',
    });
  });

  it('coalesces optional fields to null in the row', async () => {
    const insert = vi.fn((_row: Record<string, unknown>) => Promise.resolve({ error: null }));
    const sb = { from: () => ({ insert }) } as unknown as SupabaseClient;
    const log = new SupabaseEventLog(sb);

    await log.emit(
      event({
        execution_id: undefined,
        agent_id: undefined,
        skill_id: undefined,
      }),
    );

    const payload = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.execution_id).toBeNull();
    expect(payload.agent_id).toBeNull();
    expect(payload.skill_id).toBeNull();
  });

  it('throws on insert error so the audit trail is not silently lost', async () => {
    const insert = vi.fn(() => Promise.resolve({ error: { message: 'rls' } }));
    const sb = { from: () => ({ insert }) } as unknown as SupabaseClient;
    const log = new SupabaseEventLog(sb);
    await expect(log.emit(event())).rejects.toThrow(/rls/);
  });
});

describe('TeeEventBus', () => {
  it('fans an emit out to the primary bus and every sink, in order', async () => {
    const order: string[] = [];
    const primary = new InMemoryEventBus();
    primary.subscribe('execution.started', () => {
      order.push('primary');
    });
    const sinkA = { emit: vi.fn(async () => void order.push('sinkA')) };
    const sinkB = { emit: vi.fn(async () => void order.push('sinkB')) };

    const bus = new TeeEventBus(primary, [sinkA, sinkB]);
    await bus.emit(event());

    expect(order).toEqual(['primary', 'sinkA', 'sinkB']);
  });

  it('surfaces a sink failure (no silent drop of audit row)', async () => {
    const primary = new InMemoryEventBus();
    const sink = { emit: vi.fn(async () => { throw new Error('db down'); }) };
    const bus = new TeeEventBus(primary, [sink]);
    await expect(bus.emit(event())).rejects.toThrow(/db down/);
  });

  it('delegates subscribe to the primary bus only', () => {
    const primary = new InMemoryEventBus();
    const handler = vi.fn();
    const sink = { emit: vi.fn(async () => {}) };
    const bus = new TeeEventBus(primary, [sink]);

    const unsubscribe = bus.subscribe('execution.completed', handler);
    expect(typeof unsubscribe).toBe('function');
  });
});
