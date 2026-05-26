/**
 * scansApi tests — mocks getSupabase so the queries are traceable
 * without a real client. No HTTP, no DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface MockCall { table: string; chain: string[]; args?: unknown }
const calls: MockCall[] = [];
let nextData: unknown = null;
let nextError: { message: string } | null = null;

vi.mock('../../../../src/lib/supabase', () => ({
  getSupabase: () => ({
    from(table: string) {
      const chain: string[] = [];
      // deno-lint-ignore no-explicit-any
      const obj: any = {
        select(_cols: string) { chain.push('select'); return obj; },
        eq(_col: string, _val: unknown) { chain.push(`eq:${_col}=${String(_val)}`); return obj; },
        order(_col: string) { chain.push(`order:${_col}`); return obj; },
        limit(n: number) {
          chain.push(`limit:${n}`);
          calls.push({ table, chain });
          return Promise.resolve({ data: nextData, error: nextError });
        },
        maybeSingle() {
          chain.push('maybeSingle');
          calls.push({ table, chain });
          return Promise.resolve({ data: nextData, error: nextError });
        },
      };
      // chain itself returns the same obj on resolve — for the cases
      // that resolve without limit() / maybeSingle(); used by findings list.
      obj.then = (resolve: (v: { data: unknown; error: unknown }) => void) => {
        calls.push({ table, chain });
        resolve({ data: nextData, error: nextError });
      };
      return obj;
    },
  }),
}));

import {
  listScanRuns,
  getScanRun,
  listFindingsForScan,
  getScanReport,
} from '../../../../src/features/governance/scans/scansApi';

beforeEach(() => {
  calls.length = 0;
  nextData = null;
  nextError = null;
});

describe('listScanRuns', () => {
  it('queries scan_runs filtered by tenant, ordered desc, default limit 50', async () => {
    nextData = [];
    await listScanRuns('t-1');
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('scan_runs');
    expect(calls[0].chain).toEqual(expect.arrayContaining([
      'select', 'eq:tenant_id=t-1', 'order:created_at', 'limit:50',
    ]));
  });

  it('respects custom limit and clamps to 1..200', async () => {
    nextData = [];
    await listScanRuns('t-1', { limit: 500 });
    expect(calls[0].chain).toEqual(expect.arrayContaining(['limit:200']));
  });

  it('passes status filter through as extra .eq', async () => {
    nextData = [];
    await listScanRuns('t-1', { status: 'completed' });
    expect(calls[0].chain).toEqual(expect.arrayContaining(['eq:status=completed']));
  });

  it('throws on supabase error', async () => {
    nextError = { message: 'rls-blocked' };
    await expect(listScanRuns('t-1')).rejects.toThrow('rls-blocked');
  });
});

describe('getScanRun', () => {
  it('returns null when maybeSingle returns no row', async () => {
    nextData = null;
    const r = await getScanRun('missing');
    expect(r).toBeNull();
  });

  it('returns the row when found', async () => {
    nextData = { id: 's-1', tenant_id: 't-1' };
    const r = await getScanRun('s-1');
    expect(r?.id).toBe('s-1');
  });
});

describe('listFindingsForScan', () => {
  it('queries findings filtered by scan_run_id', async () => {
    nextData = [];
    await listFindingsForScan('s-1');
    expect(calls[0].table).toBe('findings');
    expect(calls[0].chain).toEqual(expect.arrayContaining(['eq:scan_run_id=s-1']));
  });
});

describe('getScanReport', () => {
  it('returns null when scan_run is missing', async () => {
    // First call (scan_runs) returns null; second (findings) returns [].
    let callIdx = 0;
    nextData = null;
    const originalData = { /* placeholder */ };
    void originalData;

    // Override the resolver: for the first invocation return null;
    // for the second (findings) return []. We use a small counter.
    vi.doMock('../../../../src/lib/supabase', () => ({
      getSupabase: () => ({
        from(table: string) {
          // deno-lint-ignore no-explicit-any
          const obj: any = {
            select() { return obj; },
            eq() { return obj; },
            order() { return obj; },
            maybeSingle() {
              return Promise.resolve({ data: callIdx++ === 0 ? null : [], error: null });
            },
            then(resolve: (v: { data: unknown; error: null }) => void) {
              resolve({ data: [], error: null });
            },
          };
          void table;
          return obj;
        },
      }),
    }));

    // The original module is cached — re-mocking after import won't
    // actually swap. Test the SAME contract via the existing mock by
    // setting nextData=null (the global) and asserting the resolved
    // value is null.
    nextData = null;
    const r = await getScanReport('s-missing');
    // With the existing mock returning null for scan_runs AND empty
    // for findings, the function returns null because scan_run is null.
    expect(r).toBeNull();
  });
});
