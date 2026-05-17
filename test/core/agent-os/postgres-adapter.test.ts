// Agent OS Postgres adapter — unit tests with a mock SupabaseClient.
//
// We never reach a real Postgres in CI. The mock client records every
// table operation; the adapter is correct iff the recorded calls match
// what each AgentOsStore record would produce.

import { describe, it, expect, beforeEach } from 'vitest';
import { createPostgresPersistHook } from '../../../src/core/agent-os/postgres-adapter';
import { AgentOsStore } from '../../../src/core/agent-os/store';
import type { SupabaseClient } from '@supabase/supabase-js';

interface RecordedCall {
  table:   string;
  op:      'insert' | 'upsert';
  payload: unknown;
  options?: unknown;
}

interface MockClient {
  calls: RecordedCall[];
  failNext: { table: string; error: string } | null;
}

function createMockClient(): { client: SupabaseClient; mock: MockClient } {
  const mock: MockClient = { calls: [], failNext: null };
  const client = {
    from(table: string) {
      const handler = (op: 'insert' | 'upsert') =>
        (payload: unknown, options?: unknown) => {
          const shouldFail = mock.failNext?.table === table;
          if (shouldFail) {
            const err = { message: mock.failNext!.error };
            mock.failNext = null;
            return Promise.resolve({ error: err, data: null });
          }
          mock.calls.push({ table, op, payload, options });
          return Promise.resolve({ error: null, data: null });
        };
      return { insert: handler('insert'), upsert: handler('upsert') };
    },
  } as unknown as SupabaseClient;
  return { client, mock };
}

const TENANT = '00000000-0000-0000-0000-000000000001';

let store: AgentOsStore;
let mock: MockClient;

beforeEach(() => {
  const m = createMockClient();
  store = new AgentOsStore();
  store.setPersistHook(createPostgresPersistHook(m.client));
  mock = m.mock;
});

// helper — flush microtasks so the void-ed hook promise resolves
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('postgres-adapter — saveMemory', () => {
  it('upserts into agent_memory with full record', async () => {
    store.addMemory({ tenant_id: TENANT, topic: 't', content: 'c', importance: 4 });
    await flush();
    expect(mock.calls).toHaveLength(2);  // memory + memory.added event
    const memCall = mock.calls.find(c => c.table === 'agent_memory')!;
    expect(memCall.op).toBe('upsert');
    expect(memCall.options).toEqual({ onConflict: 'id' });
    const p = memCall.payload as Record<string, unknown>;
    expect(p.tenant_id).toBe(TENANT);
    expect(p.topic).toBe('t');
    expect(p.importance).toBe(4);
    expect(p.status).toBe('active');
    expect('id' in p).toBe(false);  // id intentionally stripped (Postgres default)
  });

  it('saves again on supersede with status=superseded', async () => {
    const a = store.addMemory({ tenant_id: TENANT, topic: 't1', content: 'c1' });
    const b = store.addMemory({ tenant_id: TENANT, topic: 't2', content: 'c2' });
    await flush();
    mock.calls.length = 0;
    store.supersedeMemory(a.id, b.id);
    await flush();
    const memCall = mock.calls.find(c => c.table === 'agent_memory')!;
    const p = memCall.payload as Record<string, unknown>;
    expect(p.status).toBe('superseded');
    expect(p.superseded_by).toBe(b.id);
  });
});

describe('postgres-adapter — saveTask', () => {
  it('upserts into agent_tasks on createTask and again on transition', async () => {
    const t = store.createTask({ tenant_id: TENANT, agent: 'a', task: 'do x' });
    await flush();
    const initial = mock.calls.filter(c => c.table === 'agent_tasks');
    expect(initial).toHaveLength(1);
    expect((initial[0].payload as Record<string, unknown>).status).toBe('open');

    mock.calls.length = 0;
    store.transitionTask(t.id, 'in_progress');
    await flush();
    const second = mock.calls.filter(c => c.table === 'agent_tasks');
    expect(second).toHaveLength(1);
    expect((second[0].payload as Record<string, unknown>).status).toBe('in_progress');
  });
});

describe('postgres-adapter — saveDecision', () => {
  it('upserts into agent_decisions on proposeDecision and resolveDecision', async () => {
    const d = store.proposeDecision({
      tenant_id: TENANT, decision_title: 't', problem: 'p',
      options: [{ label: 'yes' }, { label: 'no' }],
      recommendation: 'yes', reason: 'r',
      risk_level: 'low', reversibility: 'reversible',
      proposed_by: 'planning-agent',
    });
    await flush();
    expect(mock.calls.find(c => c.table === 'agent_decisions')).toBeDefined();

    mock.calls.length = 0;
    store.resolveDecision(d.id, 'approved', 'uid-1');
    await flush();
    const call = mock.calls.find(c => c.table === 'agent_decisions')!;
    const p = call.payload as Record<string, unknown>;
    expect(p.status).toBe('approved');
    expect(p.approved_by).toBe('uid-1');
  });
});

describe('postgres-adapter — saveOutput + saveObservation', () => {
  it('inserts into agent_outputs', async () => {
    store.recordOutput({
      tenant_id: TENANT, task_id: null, agent: 'a', content: { ok: true },
      self_confidence: 80, evidence: ['url1'], risk_dimensions: ['privacy'],
    });
    await flush();
    const call = mock.calls.find(c => c.table === 'agent_outputs')!;
    expect(call.op).toBe('insert');
    expect((call.payload as Record<string, unknown>).self_confidence).toBe(80);
  });

  it('upserts into agent_observations', async () => {
    store.recordObservation({
      tenant_id: TENANT, agent: 'a', category: 'slo', severity: 'high',
      title: 't', detail: 'd', data: { k: 1 },
    });
    await flush();
    const call = mock.calls.find(c => c.table === 'agent_observations')!;
    expect(call.op).toBe('upsert');
    expect((call.payload as Record<string, unknown>).severity).toBe('high');
  });
});

describe('postgres-adapter — saveEvent', () => {
  it('strips the in-memory id (BIGSERIAL on the server)', async () => {
    store.addMemory({ tenant_id: TENANT, topic: 't', content: 'c' });
    await flush();
    const evCall = mock.calls.find(c => c.table === 'agent_events')!;
    expect('id' in (evCall.payload as Record<string, unknown>)).toBe(false);
    expect((evCall.payload as Record<string, unknown>).event_type).toBe('memory.added');
  });
});

describe('postgres-adapter — error reporting (best-effort writes)', () => {
  it('does NOT throw when a save fails', async () => {
    const errors: Array<{ op: string; err: unknown }> = [];
    const hook = createPostgresPersistHook(
      ((store as unknown as { hook: unknown }).hook as { _client?: SupabaseClient })._client
        ?? createMockClient().client,
      { onError: (op, err) => errors.push({ op, err }) },
    );
    // Re-wire with a fresh failing client.
    const m = createMockClient();
    m.mock.failNext = { table: 'agent_memory', error: 'simulated 503' };
    const adapter = createPostgresPersistHook(m.client, {
      onError: (op, err) => errors.push({ op, err }),
    });
    store.setPersistHook(adapter);

    store.addMemory({ tenant_id: TENANT, topic: 't', content: 'c' });
    await flush();
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].op).toBe('saveMemory');
    expect((errors[0].err as { message: string }).message).toBe('simulated 503');
    // Adapter and hook are not used after construction.
    void hook;
  });

  it('continues to persist subsequent records after a failure', async () => {
    const errors: Array<{ op: string }> = [];
    const m = createMockClient();
    m.mock.failNext = { table: 'agent_memory', error: 'transient' };
    store.setPersistHook(createPostgresPersistHook(m.client, {
      onError: (op) => errors.push({ op }),
    }));
    store.addMemory({ tenant_id: TENANT, topic: 't1', content: 'c1' });
    await flush();
    expect(errors).toHaveLength(1);
    // Second call: should succeed.
    store.addMemory({ tenant_id: TENANT, topic: 't2', content: 'c2' });
    await flush();
    expect(errors).toHaveLength(1);
    // Two events should be recorded successfully.
    expect(m.mock.calls.filter(c => c.table === 'agent_events').length).toBeGreaterThanOrEqual(2);
  });
});
