import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ChiefOfStaffReadError, loadPersistedChiefOfStaffInbox } from '../../../src/features/command-center/chiefOfStaffApi';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

type Row = Record<string, unknown>;
type DbFixture = Partial<Record<'memberships' | 'agent_tasks' | 'agent_decisions' | 'agent_observations', Row[]>>;

function mockClient(
  data: DbFixture,
  settings: { unauthorized?: boolean; anonymous?: boolean; failTable?: string; missingCount?: boolean } = {},
) {
  const calls: Array<{ table: string; method: string; key?: string; value?: unknown }> = [];
  const auth = {
    getUser: async () => ({
      data: { user: settings.unauthorized ? null : { id: USER, is_anonymous: !!settings.anonymous } },
      error: null,
    }),
  };

  function from(table: string) {
    let rows = [...(data[table as keyof DbFixture] ?? [])];
    let countRequested = false;
    let head = false;
    let maxRows: number | null = null;
    const orderKeys: Array<{ key: string; ascending: boolean }> = [];
    const query = {
      select(_columns: string, options?: { count?: string; head?: boolean }) {
        calls.push({ table, method: 'select' });
        countRequested = options?.count === 'exact';
        head = options?.head === true;
        return query;
      },
      eq(key: string, value: unknown) {
        calls.push({ table, method: 'eq', key, value });
        rows = rows.filter(row => row[key] === value);
        return query;
      },
      in(key: string, values: unknown[]) {
        calls.push({ table, method: 'in', key, value: values });
        rows = rows.filter(row => values.includes(row[key]));
        return query;
      },
      order(key: string, options: { ascending: boolean }) {
        calls.push({ table, method: 'order', key });
        orderKeys.push({ key, ascending: options.ascending });
        return query;
      },
      limit(n: number) {
        calls.push({ table, method: 'limit', value: n });
        maxRows = n;
        return query;
      },
      async maybeSingle() {
        calls.push({ table, method: 'maybeSingle' });
        return { data: rows[0] ?? null, error: settings.failTable === table ? { message: 'db unavailable' } : null };
      },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        const total = rows.length;
        const ordered = [...rows].sort((a, b) => {
          for (const { key, ascending } of orderKeys) {
            const cmp = String(a[key]).localeCompare(String(b[key]));
            if (cmp !== 0) return cmp * (ascending ? 1 : -1);
          }
          return 0;
        });
        const response = {
          data: head ? null : ordered.slice(0, maxRows ?? ordered.length),
          count: countRequested ? (settings.missingCount ? null : total) : null,
          error: settings.failTable === table ? { message: 'db unavailable' } : null,
        };
        return Promise.resolve(response).then(resolve, reject);
      },
    };
    return query;
  }
  return { client: { auth, from } as unknown as SupabaseClient, calls };
}

const base: DbFixture = {
  memberships: [{ tenant_id: A, user_id: USER, role: 'admin' }, { tenant_id: B, user_id: 'someone-else', role: 'owner' }],
  agent_tasks: [
    { id: 'a-open', tenant_id: A, status: 'open', priority: 'normal', task: 'Ordinary backlog', agent: 'ops', created_at: '2026-11-19T10:00:00Z' },
    { id: 'a-blocked', tenant_id: A, status: 'blocked', priority: 'high', task: 'Release blocker', agent: 'dev', created_at: '2026-11-19T11:00:00Z' },
    { id: 'b-failed', tenant_id: B, status: 'failed', priority: 'critical', task: 'Private B', agent: 'private', created_at: '2026-11-19T11:00:00Z' },
  ],
  agent_decisions: [
    { id: 'a-decision', tenant_id: A, status: 'proposed', risk_level: 'critical', decision_title: 'Human approval', proposed_by: 'deploy', created_at: '2026-11-19T12:00:00Z' },
    { id: 'b-decision', tenant_id: B, status: 'proposed', risk_level: 'critical', decision_title: 'Private B approval', proposed_by: 'finance', created_at: '2026-11-19T12:00:00Z' },
  ],
  agent_observations: [
    { id: 'a-alert', tenant_id: A, acknowledged: false, severity: 'high', title: 'SLO high', agent: 'monitor', created_at: '2026-11-19T13:00:00Z' },
    { id: 'a-low', tenant_id: A, acknowledged: false, severity: 'low', title: 'Noise', agent: 'monitor', created_at: '2026-11-19T14:00:00Z' },
    { id: 'b-alert', tenant_id: B, acknowledged: false, severity: 'critical', title: 'Private B alert', agent: 'private', created_at: '2026-11-19T15:00:00Z' },
  ],
};

describe('RLS-backed Chief of Staff loader', () => {
  it('fails closed without authenticated user', async () => {
    const { client, calls } = mockClient(base, { unauthorized: true });
    await expect(loadPersistedChiefOfStaffInbox(client, A))
      .rejects.toMatchObject({ code: 'unauthorized' } satisfies Partial<ChiefOfStaffReadError>);
    expect(calls).toHaveLength(0);
  });

  it('rejects anonymous auth and invalid tenant IDs', async () => {
    await expect(loadPersistedChiefOfStaffInbox(mockClient(base).client, 'not-uuid'))
      .rejects.toMatchObject({ code: 'invalid_tenant' });
    await expect(loadPersistedChiefOfStaffInbox(mockClient(base, { anonymous: true }).client, A))
      .rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('requires owner/admin membership rather than accepting any tenant member', async () => {
    const viewer = { ...base, memberships: [{ tenant_id: A, user_id: USER, role: 'viewer' }] };
    await expect(loadPersistedChiefOfStaffInbox(mockClient(viewer).client, A))
      .rejects.toMatchObject({ code: 'forbidden' });
    await expect(loadPersistedChiefOfStaffInbox(mockClient(base).client, B))
      .rejects.toMatchObject({ code: 'forbidden' });
  });

  it('returns tenant-filtered exact counts, prioritizes alerts and avoids raw payloads', async () => {
    const { client, calls } = mockClient(base);
    const output = await loadPersistedChiefOfStaffInbox(client, A);
    expect(output.source).toBe('supabase_agent_os');
    expect(output.live_verified).toBe(true);
    expect(output.counts).toEqual({
      open_tasks: 1, in_progress_tasks: 0, blocked_tasks: 1, failed_tasks: 0,
      pending_decisions: 1, unacknowledged_high_alerts: 1, attention_total: 3,
    });
    expect(output.items.map(item => item.title)).toEqual(['Human approval', 'SLO high', 'Release blocker']);
    expect(JSON.stringify(output)).not.toContain('Private B');
    expect(calls.filter(call => call.table !== 'memberships' && call.method === 'eq' && call.key === 'tenant_id'))
      .toHaveLength(7);
    expect(calls.every(call => ['select', 'eq', 'in', 'order', 'limit', 'maybeSingle'].includes(call.method))).toBe(true);
  });

  it('shows bounded inbox with totals rather than losing truncated item counts', async () => {
    const output = await loadPersistedChiefOfStaffInbox(mockClient(base).client, A, { max_items: 1 });
    expect(output.items).toHaveLength(1);
    expect(output.items[0]?.priority).toBe('critical');
    expect(output.counts.attention_total).toBe(3);
    expect(output.truncated).toBe(true);
  });

  it('selects an older critical task before a newer high task at the query limit', async () => {
    const data: DbFixture = {
      ...base,
      agent_tasks: [
        { id: 'older-critical', tenant_id: A, agent: 'sec', task: 'Critical', priority: 'critical', status: 'blocked', created_at: '2026-01-01T00:00:00Z' },
        { id: 'newer-high', tenant_id: A, agent: 'dev', task: 'High', priority: 'high', status: 'blocked', created_at: '2026-11-19T00:00:00Z' },
      ],
      agent_decisions: [],
      agent_observations: [],
    };
    const output = await loadPersistedChiefOfStaffInbox(mockClient(data).client, A, { max_items: 1 });
    expect(output.items.map(x => x.title)).toEqual(['Critical']);
    expect(output.counts.attention_total).toBe(2);
    expect(output.truncated).toBe(true);
  });

  it('never maps a failed DB read to an empty successful inbox', async () => {
    await expect(loadPersistedChiefOfStaffInbox(mockClient(base, { failTable: 'agent_observations' }).client, A))
      .rejects.toMatchObject({ code: 'source_unavailable' });
    await expect(loadPersistedChiefOfStaffInbox(mockClient(base, { missingCount: true }).client, A))
      .rejects.toMatchObject({ code: 'source_unavailable' });
  });
});
