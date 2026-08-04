/**
 * AdminSocialStore in persisted mode (tenantId + Supabase configured).
 *
 * Exercises the path that submitEvent()/approve()/reject() take once a
 * tenant is active: DistributionQueue({ supabase, tenantId }) writes rows
 * into distribution_queue_entries instead of localStorage, and the store
 * never publishes directly (that's social-publisher-worker's job,
 * server-side). See src/features/admin/social/api.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Minimal in-memory fake of the Supabase query builder ────────────
// Covers exactly the calls DistributionQueue makes: insert / select+eq+in /
// update+eq+eq / channel+on+subscribe+unsubscribe.

interface Row {
  id: string;
  tenant_id: string;
  post_id: string;
  channel: string;
  body: string;
  hashtags: string[];
  status: string;
  approval_status: string;
  post_data: unknown;
  enqueued_at: string;
  [key: string]: unknown;
}

let rows: Row[] = [];
let auditRows: Record<string, unknown>[] = [];

function makeQueryBuilder(table: string) {
  const filters: Array<{ col: string; val: unknown; op: 'eq' | 'in' }> = [];
  let pendingUpdate: Record<string, unknown> | null = null;
  let wantSingle = false;

  function source(): Row[] {
    return table === 'distribution_queue_entries' ? rows : [];
  }

  function applyFilters(): Row[] {
    return source().filter((r) =>
      filters.every((f) => (f.op === 'eq' ? r[f.col] === f.val : (f.val as unknown[]).includes(r[f.col])))
    );
  }

  const builder = {
    insert(payload: Record<string, unknown>) {
      if (table === 'distribution_queue_entries') {
        rows.push({ ...(payload as unknown as Row) });
      } else if (table === 'distribution_audit_log') {
        auditRows.push(payload);
      }
      return Promise.resolve({ data: payload, error: null });
    },
    select() {
      return builder;
    },
    eq(col: string, val: unknown) {
      filters.push({ col, val, op: 'eq' });
      return builder;
    },
    in(col: string, val: unknown[]) {
      filters.push({ col, val, op: 'in' });
      return builder;
    },
    single() {
      wantSingle = true;
      return builder;
    },
    update(payload: Record<string, unknown>) {
      pendingUpdate = payload;
      return builder;
    },
    then(
      resolve: (v: { data: unknown; error: null }) => void,
      _reject?: (e: unknown) => void
    ) {
      if (pendingUpdate) {
        const targets = applyFilters();
        for (const t of targets) Object.assign(t, pendingUpdate);
        resolve({ data: null, error: null });
        return;
      }
      const matched = applyFilters();
      resolve({ data: wantSingle ? matched[0] ?? null : matched, error: null });
    },
  };

  return builder;
}

const fakeSupabase = {
  from(table: string) {
    return makeQueryBuilder(table);
  },
  channel(_name: string) {
    const ch = {
      on() {
        return ch;
      },
      subscribe() {
        return ch;
      },
      unsubscribe() {
        return Promise.resolve('ok');
      },
    };
    return ch;
  },
};

vi.mock('../../../../src/lib/supabase', () => ({
  getSupabase: () => fakeSupabase,
  isSupabaseConfigured: () => true,
}));

import {
  getAdminSocialStore,
  __resetAdminSocialStoreForTests,
} from '../../../../src/features/admin/social/api';

const TENANT = 'tenant-persisted-1';

beforeEach(() => {
  __resetAdminSocialStoreForTests();
  rows = [];
  auditRows = [];
});

describe('admin social store — persisted mode', () => {
  it('isPersisted is true once a tenantId is provided', () => {
    const store = getAdminSocialStore(TENANT);
    expect(store.isPersisted).toBe(true);
  });

  it('writes generated posts into distribution_queue_entries with valid UUID ids', async () => {
    const store = getAdminSocialStore(TENANT);
    const result = await store.submitEvent({
      id: 'evt_persist_auto',
      type: 'tracker.detected',
      occurred_at: '2026-08-04T10:00:00Z',
      severity: 'high',
      payload: {},
    });
    expect(result.queueEntries.length).toBeGreaterThan(0);
    expect(rows.length).toBe(result.queueEntries.length);
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const r of rows) {
      expect(r.id).toMatch(uuidRe);
      expect(r.tenant_id).toBe(TENANT);
      // approval_status must satisfy the fixed CHECK constraint domain.
      expect(['AUTO', 'REVIEW', 'BLOCKED']).toContain(r.approval_status);
    }
  });

  it('AUTO posts persist with status=auto (claimable by distribution_queue_claim_next)', async () => {
    const store = getAdminSocialStore(TENANT);
    await store.submitEvent({
      id: 'evt_persist_auto2',
      type: 'tracker.detected',
      occurred_at: '2026-08-04T10:00:00Z',
      severity: 'high',
      payload: {},
    });
    const autoRows = rows.filter((r) => r.approval_status === 'AUTO');
    expect(autoRows.length).toBeGreaterThan(0);
    for (const r of autoRows) expect(r.status).toBe('auto');
  });

  it('approve() persists the status change via update()', async () => {
    const store = getAdminSocialStore(TENANT);
    await store.submitEvent({
      id: 'evt_persist_review',
      type: 'high_risk.classified',
      occurred_at: '2026-08-04T10:00:00Z',
      severity: 'high',
      payload: {},
    });
    const pending = store.getSnapshot().find((e) => e.status === 'pending');
    expect(pending).toBeDefined();

    const updated = await store.approve(pending!.id, 'reviewer-1');
    expect(updated?.status).toBe('approved');
    const row = rows.find((r) => r.id === pending!.id);
    expect(row?.status).toBe('approved');
  });

  it('publish() never performs a real publish in persisted mode', async () => {
    const store = getAdminSocialStore(TENANT);
    await store.submitEvent({
      id: 'evt_persist_pub',
      type: 'tracker.detected',
      occurred_at: '2026-08-04T10:00:00Z',
      severity: 'high',
      payload: {},
    });
    const auto = store.getSnapshot().find((e) => e.status === 'auto');
    expect(auto).toBeDefined();

    const result = await store.publish(auto!.id);
    // Status is untouched — publishing happens server-side in
    // social-publisher-worker, never from the browser.
    expect(result?.status).toBe('auto');
    expect(result?.publishResult).toBeUndefined();
  });

  it('clearAll() is a no-op in persisted mode', async () => {
    const store = getAdminSocialStore(TENANT);
    await store.submitEvent({
      id: 'evt_persist_clear',
      type: 'tracker.detected',
      occurred_at: '2026-08-04T10:00:00Z',
      severity: 'high',
      payload: {},
    });
    const before = store.getSnapshot().length;
    expect(before).toBeGreaterThan(0);
    store.clearAll();
    expect(store.getSnapshot().length).toBe(before);
  });

  it('falls back to local/mock mode when no tenantId is given', () => {
    const store = getAdminSocialStore();
    expect(store.isPersisted).toBe(false);
  });
});
