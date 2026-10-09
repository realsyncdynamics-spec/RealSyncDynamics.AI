/**
 * Voice API — tenant filter required; no fetch without tenant.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = { data: unknown; error: { message: string } | null };

const { fromMock, calls } = vi.hoisted(() => {
  const calls = {
    from: [] as string[],
    eq: [] as Array<[string, unknown]>,
    order: [] as Array<[string, unknown]>,
    range: [] as Array<[number, number]>,
    in: [] as Array<[string, unknown]>,
  };

  function makeBuilder(result: QueryResult = { data: [], error: null }) {
    const builder: Record<string, unknown> = {};
    const self = () => builder;
    builder.select = vi.fn(self);
    builder.eq = vi.fn((col: string, val: unknown) => {
      calls.eq.push([col, val]);
      return builder;
    });
    builder.order = vi.fn((col: string, opts: unknown) => {
      calls.order.push([col, opts]);
      return builder;
    });
    builder.range = vi.fn((from: number, to: number) => {
      calls.range.push([from, to]);
      return Promise.resolve(result);
    });
    builder.in = vi.fn((col: string, val: unknown) => {
      calls.in.push([col, val]);
      return Promise.resolve(result);
    });
    builder.maybeSingle = vi.fn(() => Promise.resolve(result));
    builder.then = (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected);
    return builder;
  }

  const fromMock = vi.fn((table: string) => {
    calls.from.push(table);
    return makeBuilder({ data: [], error: null });
  });

  return { fromMock, calls };
});

vi.mock('@/src/lib/supabase', () => ({
  getSupabase: () => ({ from: fromMock }),
}));

import {
  listVoiceSessions,
  getVoiceSession,
  listVoiceToolRequests,
  listVoiceEvidence,
  listVoiceExecutionsForRequests,
  shortenHash,
} from '@/src/features/governance/voice/voiceApi';

describe('voiceApi', () => {
  beforeEach(() => {
    fromMock.mockClear();
    calls.from.length = 0;
    calls.eq.length = 0;
    calls.order.length = 0;
    calls.range.length = 0;
    calls.in.length = 0;
  });

  it('wirft ohne Tenant — kein Fetch', async () => {
    await expect(listVoiceSessions('')).rejects.toThrow(/Kein aktiver Mandant/);
    await expect(listVoiceSessions(null as unknown as string)).rejects.toThrow(/Kein aktiver Mandant/);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('setzt tenant_id-Filter auf voice_sessions', async () => {
    await listVoiceSessions('tenant-abc', { limit: 10, offset: 0 });
    expect(calls.from).toContain('voice_sessions');
    expect(calls.eq).toContainEqual(['tenant_id', 'tenant-abc']);
    expect(calls.order).toContainEqual(['started_at', { ascending: false }]);
    expect(calls.range).toContainEqual([0, 9]);
  });

  it('scoped getVoiceSession auf tenant_id + id', async () => {
    await getVoiceSession('tenant-abc', 'sess-1');
    expect(calls.from).toContain('voice_sessions');
    expect(calls.eq).toContainEqual(['tenant_id', 'tenant-abc']);
    expect(calls.eq).toContainEqual(['id', 'sess-1']);
  });

  it('scoped Tool-Requests auf tenant_id + session_id', async () => {
    await listVoiceToolRequests('tenant-abc', 'sess-1');
    expect(calls.from).toContain('voice_tool_requests');
    expect(calls.eq).toContainEqual(['tenant_id', 'tenant-abc']);
    expect(calls.eq).toContainEqual(['session_id', 'sess-1']);
  });

  it('scoped voice_evidence auf tenant_id + session_id', async () => {
    await listVoiceEvidence('tenant-xyz', 'sess-9');
    expect(calls.from).toContain('voice_evidence');
    expect(calls.eq).toContainEqual(['tenant_id', 'tenant-xyz']);
    expect(calls.eq).toContainEqual(['session_id', 'sess-9']);
  });

  it('fetcht keine Executions ohne Request-IDs (kein Query)', async () => {
    const rows = await listVoiceExecutionsForRequests('tenant-abc', []);
    expect(rows).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('shortenHash kürzt Digests', () => {
    const h = 'a'.repeat(64);
    expect(shortenHash(h)).toBe(`${'a'.repeat(8)}…${'a'.repeat(6)}`);
    expect(shortenHash('short')).toBe('short');
  });
});
