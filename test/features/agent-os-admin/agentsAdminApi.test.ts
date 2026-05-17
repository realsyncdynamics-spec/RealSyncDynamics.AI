// Agent OS Admin API — smoke tests with a mock supabase client.
//
// We can't reach a real Postgres in CI, so we mock getSupabase()
// via vitest.mock(). Tests verify:
//   - the right table is queried
//   - the right filters are applied (tenant_id, status, severity, etc.)
//   - errors propagate as thrown exceptions
//   - empty data → empty array (not null)

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface MockCall {
  table:    string;
  selects:  string[];
  filters:  Array<{ method: string; args: unknown[] }>;
  orderBys: Array<{ column: string; ascending: boolean }>;
  limits:   number[];
  isHead:   boolean;
}

const calls: MockCall[] = [];
const responseBuckets: Record<string, { data: unknown[] | null; error: unknown | null; count?: number }> = {};

function makeBuilder(table: string) {
  const call: MockCall = { table, selects: [], filters: [], orderBys: [], limits: [], isHead: false };
  calls.push(call);
  const builder: Record<string, unknown> & PromiseLike<unknown> = {
    select(cols: string, opts?: { count?: string; head?: boolean }) {
      call.selects.push(cols);
      if (opts?.head) call.isHead = true;
      return builder;
    },
    eq(col: string, val: unknown) { call.filters.push({ method: 'eq', args: [col, val] }); return builder; },
    in(col: string, vals: unknown[]) { call.filters.push({ method: 'in', args: [col, vals] }); return builder; },
    order(col: string, opts: { ascending: boolean }) { call.orderBys.push({ column: col, ascending: opts.ascending }); return builder; },
    limit(n: number) { call.limits.push(n); return builder; },
    then(resolve: (v: unknown) => unknown) {
      const r = responseBuckets[table] ?? { data: [], error: null };
      const result = call.isHead
        ? { data: null, error: r.error, count: r.count ?? 0 }
        : { data: r.data, error: r.error };
      return Promise.resolve(resolve(result));
    },
  } as unknown as Record<string, unknown> & PromiseLike<unknown>;
  return builder;
}

vi.mock('../../../src/lib/supabase', () => ({
  getSupabase: () => ({ from: (table: string) => makeBuilder(table) }),
  isSupabaseConfigured: () => true,
}));

// Now we can import — the mock is set up above the import.
import {
  listRecentEvents, listOpenTasks, listProposedDecisions,
  listActiveObservations, listRecentMemory, getOverviewCounts,
} from '../../../src/features/agent-os-admin/agentsAdminApi';

const TENANT = '00000000-0000-0000-0000-000000000001';

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(responseBuckets)) delete responseBuckets[k];
});

describe('agentsAdminApi.listRecentEvents', () => {
  it('queries agent_events filtered by tenant_id, ordered by id desc', async () => {
    responseBuckets.agent_events = { data: [], error: null };
    await listRecentEvents(TENANT, 25);
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('agent_events');
    expect(calls[0].filters).toContainEqual({ method: 'eq', args: ['tenant_id', TENANT] });
    expect(calls[0].orderBys[0]).toEqual({ column: 'id', ascending: false });
    expect(calls[0].limits).toEqual([25]);
  });

  it('returns the data array (never null)', async () => {
    responseBuckets.agent_events = { data: [{ id: 1 }, { id: 2 }] as unknown[], error: null };
    const rows = await listRecentEvents(TENANT);
    expect(rows).toHaveLength(2);
  });

  it('returns [] when supabase returns null data', async () => {
    responseBuckets.agent_events = { data: null, error: null };
    const rows = await listRecentEvents(TENANT);
    expect(rows).toEqual([]);
  });

  it('throws when supabase returns an error', async () => {
    responseBuckets.agent_events = { data: null, error: { message: 'rls denied' } };
    await expect(listRecentEvents(TENANT)).rejects.toMatchObject({ message: 'rls denied' });
  });
});

describe('agentsAdminApi.listOpenTasks', () => {
  it('queries agent_tasks filtered by status IN (open, in_progress, blocked)', async () => {
    responseBuckets.agent_tasks = { data: [], error: null };
    await listOpenTasks(TENANT);
    const filter = calls[0].filters.find(f => f.method === 'in');
    expect(filter).toBeDefined();
    expect(filter!.args[0]).toBe('status');
    expect(filter!.args[1]).toEqual(['open', 'in_progress', 'blocked']);
  });
});

describe('agentsAdminApi.listProposedDecisions', () => {
  it("filters by status='proposed'", async () => {
    responseBuckets.agent_decisions = { data: [], error: null };
    await listProposedDecisions(TENANT);
    expect(calls[0].filters).toContainEqual({ method: 'eq', args: ['status', 'proposed'] });
  });
});

describe('agentsAdminApi.listActiveObservations', () => {
  it('filters acknowledged=false AND severity IN (medium, high, critical)', async () => {
    responseBuckets.agent_observations = { data: [], error: null };
    await listActiveObservations(TENANT);
    expect(calls[0].filters).toContainEqual({ method: 'eq', args: ['acknowledged', false] });
    const sevFilter = calls[0].filters.find(f => f.method === 'in' && f.args[0] === 'severity');
    expect(sevFilter!.args[1]).toEqual(['medium', 'high', 'critical']);
  });
});

describe('agentsAdminApi.listRecentMemory', () => {
  it("filters status='active' and double-orders by importance, then created_at", async () => {
    responseBuckets.agent_memory = { data: [], error: null };
    await listRecentMemory(TENANT, 10);
    expect(calls[0].filters).toContainEqual({ method: 'eq', args: ['status', 'active'] });
    expect(calls[0].orderBys[0]).toEqual({ column: 'importance', ascending: false });
    expect(calls[0].orderBys[1]).toEqual({ column: 'created_at', ascending: false });
    expect(calls[0].limits).toEqual([10]);
  });
});

describe('agentsAdminApi.getOverviewCounts', () => {
  it('issues 4 parallel head-count queries and returns counts', async () => {
    responseBuckets.agent_tasks        = { data: null, error: null, count: 5  };
    responseBuckets.agent_decisions    = { data: null, error: null, count: 2  };
    responseBuckets.agent_observations = { data: null, error: null, count: 1  };
    responseBuckets.agent_memory       = { data: null, error: null, count: 42 };

    const counts = await getOverviewCounts(TENANT);

    expect(counts).toEqual({
      open_tasks:         5,
      pending_decisions:  2,
      unack_observations: 1,
      active_memories:    42,
    });
    expect(calls.every(c => c.isHead)).toBe(true);
    expect(calls.map(c => c.table).sort()).toEqual([
      'agent_decisions', 'agent_memory', 'agent_observations', 'agent_tasks',
    ]);
  });

  it('returns 0 when count is missing', async () => {
    responseBuckets.agent_tasks        = { data: null, error: null };
    responseBuckets.agent_decisions    = { data: null, error: null };
    responseBuckets.agent_observations = { data: null, error: null };
    responseBuckets.agent_memory       = { data: null, error: null };
    const counts = await getOverviewCounts(TENANT);
    expect(counts.open_tasks).toBe(0);
  });
});
