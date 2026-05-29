/**
 * Quota + chat-history helper tests for the governance-agent.
 *
 * What this proves:
 *   1) checkTenantQuota maps plan tier → cap correctly via the
 *      RPC (-1 unlimited fast-path, exceeded path, allowed path).
 *   2) checkAnonQuota uses the constant 10 cap + per-IP counter.
 *   3) RPC errors map to QUOTA_LOOKUP_FAILED (fail-closed contract).
 *   4) recordChatHistory writes the right row shape, truncates long
 *      summaries, and refuses inserts without tenant_id or session_id.
 *
 * No real Supabase round-trips — we mock the admin client with a
 * structural AdminLike to keep the tests fast and Deno-free.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  checkTenantQuota,
  checkAnonQuota,
  recordChatHistory,
  type AdminLike,
} from '../../supabase/functions/_shared/llm-quota';

function makeAdmin(opts: {
  rpcResults?: Record<string, { data?: unknown; error?: { message: string } | null }>;
  insertResult?: { error: { message: string } | null };
} = {}): {
  admin:       AdminLike;
  rpcCalls:    Array<{ name: string; args?: Record<string, unknown> }>;
  insertCalls: Array<{ table: string; row: Record<string, unknown> }>;
} {
  const rpcCalls:    Array<{ name: string; args?: Record<string, unknown> }> = [];
  const insertCalls: Array<{ table: string; row: Record<string, unknown> }> = [];
  const admin: AdminLike = {
    rpc(name, args) {
      rpcCalls.push({ name, args });
      const r = opts.rpcResults?.[name] ?? { data: null, error: null };
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
    },
    from(table) {
      return {
        insert(row) {
          insertCalls.push({ table, row });
          return Promise.resolve(opts.insertResult ?? { error: null });
        },
      };
    },
  };
  return { admin, rpcCalls, insertCalls };
}

describe('checkTenantQuota', () => {
  it('returns allowed when usage < cap', async () => {
    const { admin } = makeAdmin({
      rpcResults: {
        llm_quota_for_tenant:      { data: 100 },
        llm_quota_used_for_tenant: { data: 42 },
      },
    });
    const r = await checkTenantQuota(admin, 'tenant-1');
    expect(r.allowed).toBe(true);
    expect(r.cap).toBe(100);
    expect(r.used).toBe(42);
  });

  it('returns allowed=false with QUOTA_EXCEEDED when used >= cap', async () => {
    const { admin } = makeAdmin({
      rpcResults: {
        llm_quota_for_tenant:      { data: 10 },
        llm_quota_used_for_tenant: { data: 10 },
      },
    });
    const r = await checkTenantQuota(admin, 'tenant-1');
    expect(r.allowed).toBe(false);
    expect(r.errorCode).toBe('QUOTA_EXCEEDED');
    expect(r.cap).toBe(10);
    expect(r.used).toBe(10);
    expect(r.reason).toMatch(/Monatslimit/);
  });

  it('treats cap=-1 as unlimited and skips the used-query', async () => {
    const { admin, rpcCalls } = makeAdmin({
      rpcResults: {
        llm_quota_for_tenant: { data: -1 },
      },
    });
    const r = await checkTenantQuota(admin, 'tenant-1');
    expect(r.allowed).toBe(true);
    expect(r.cap).toBe(-1);
    // Only the cap RPC fires; used-RPC is skipped for unlimited.
    expect(rpcCalls.map((c) => c.name)).toEqual(['llm_quota_for_tenant']);
  });

  it('fails closed with QUOTA_LOOKUP_FAILED on cap-RPC error', async () => {
    const { admin } = makeAdmin({
      rpcResults: {
        llm_quota_for_tenant: { data: null, error: { message: 'boom' } },
      },
    });
    const r = await checkTenantQuota(admin, 'tenant-1');
    expect(r.allowed).toBe(false);
    expect(r.errorCode).toBe('QUOTA_LOOKUP_FAILED');
  });

  it('fails closed with QUOTA_LOOKUP_FAILED on used-RPC error', async () => {
    const { admin } = makeAdmin({
      rpcResults: {
        llm_quota_for_tenant:      { data: 100 },
        llm_quota_used_for_tenant: { data: null, error: { message: 'boom-used' } },
      },
    });
    const r = await checkTenantQuota(admin, 'tenant-1');
    expect(r.allowed).toBe(false);
    expect(r.errorCode).toBe('QUOTA_LOOKUP_FAILED');
  });

  it('handles array-shape RPC return (used by some Supabase clients)', async () => {
    const { admin } = makeAdmin({
      rpcResults: {
        llm_quota_for_tenant:      { data: [100] },
        llm_quota_used_for_tenant: { data: [5]   },
      },
    });
    const r = await checkTenantQuota(admin, 'tenant-1');
    expect(r.allowed).toBe(true);
    expect(r.cap).toBe(100);
    expect(r.used).toBe(5);
  });
});

describe('checkAnonQuota', () => {
  it('returns allowed when usage < anon cap', async () => {
    const { admin } = makeAdmin({
      rpcResults: {
        llm_quota_for_anon:       { data: 10 },
        llm_quota_used_for_anon:  { data: 3  },
      },
    });
    const r = await checkAnonQuota(admin, 'ip-hash-abc');
    expect(r.allowed).toBe(true);
    expect(r.cap).toBe(10);
    expect(r.used).toBe(3);
  });

  it('blocks when used reaches cap (off-by-one boundary)', async () => {
    const { admin } = makeAdmin({
      rpcResults: {
        llm_quota_for_anon:      { data: 10 },
        llm_quota_used_for_anon: { data: 10 },
      },
    });
    const r = await checkAnonQuota(admin, 'ip-hash-abc');
    expect(r.allowed).toBe(false);
    expect(r.errorCode).toBe('QUOTA_EXCEEDED');
  });

  it('defaults cap to 10 if RPC returns null (forward-compat with seed change)', async () => {
    const { admin } = makeAdmin({
      rpcResults: {
        llm_quota_for_anon:      { data: null },
        llm_quota_used_for_anon: { data: 5    },
      },
    });
    const r = await checkAnonQuota(admin, 'ip-hash-abc');
    expect(r.allowed).toBe(true);
    expect(r.cap).toBe(10);
  });

  it('passes ip_hash positionally to llm_quota_used_for_anon', async () => {
    const { admin, rpcCalls } = makeAdmin({
      rpcResults: {
        llm_quota_for_anon:      { data: 10 },
        llm_quota_used_for_anon: { data: 0  },
      },
    });
    await checkAnonQuota(admin, 'specific-ip-hash');
    const usedCall = rpcCalls.find((c) => c.name === 'llm_quota_used_for_anon');
    expect(usedCall?.args).toEqual({ p_ip_hash: 'specific-ip-hash' });
  });
});

describe('recordChatHistory', () => {
  it('writes the row with all fields when tenant_id provided', async () => {
    const { admin, insertCalls } = makeAdmin();
    const r = await recordChatHistory(admin, {
      tenant_id:        'tenant-1',
      user_id:          'user-1',
      session_id:       'session-1',
      op:               'chat',
      provider:         'anthropic',
      model:            'claude-sonnet-4',
      query_text:       'Was ist DSGVO Art. 6?',
      response_summary: 'Rechtsgrundlagen für Verarbeitung.',
      input_tokens:     50,
      output_tokens:    200,
      correlation_id:   'corr-1',
    });
    expect(r.ok).toBe(true);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].table).toBe('llm_query_history');
    expect(insertCalls[0].row).toMatchObject({
      tenant_id:  'tenant-1',
      user_id:    'user-1',
      session_id: 'session-1',
      op:         'chat',
      provider:   'anthropic',
      model:      'claude-sonnet-4',
    });
  });

  it('truncates response_summary to 280 chars', async () => {
    const { admin, insertCalls } = makeAdmin();
    const long = 'x'.repeat(2000);
    await recordChatHistory(admin, {
      session_id:       's',
      op:               'chat_anon',
      provider:         'ai_gateway',
      model:            'qwen3:4b',
      query_text:       'hi',
      response_summary: long,
    });
    expect((insertCalls[0].row.response_summary as string).length).toBe(280);
  });

  it('truncates query_text to 4000 chars', async () => {
    const { admin, insertCalls } = makeAdmin();
    await recordChatHistory(admin, {
      session_id: 's',
      op:         'chat_anon',
      provider:   'ai_gateway',
      model:      'qwen3:4b',
      query_text: 'q'.repeat(10_000),
    });
    expect((insertCalls[0].row.query_text as string).length).toBe(4000);
  });

  it('refuses insert when neither tenant_id nor session_id present', async () => {
    const { admin, insertCalls } = makeAdmin();
    const r = await recordChatHistory(admin, {
      op:         'chat',
      provider:   'anthropic',
      model:      'claude-sonnet-4',
      query_text: 'q',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/required/);
    expect(insertCalls).toHaveLength(0);
  });

  it('returns ok:false with the DB error when insert fails', async () => {
    const { admin } = makeAdmin({
      insertResult: { error: { message: 'pg-failure' } },
    });
    const r = await recordChatHistory(admin, {
      tenant_id:  'tenant-1',
      op:         'chat',
      provider:   'anthropic',
      model:      'claude-sonnet-4',
      query_text: 'q',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('pg-failure');
  });

  it('sets response_summary to null when empty string passed', async () => {
    const { admin, insertCalls } = makeAdmin();
    await recordChatHistory(admin, {
      session_id:       's',
      op:               'chat_anon',
      provider:         'ai_gateway',
      model:            'qwen3:4b',
      query_text:       'q',
      response_summary: '',
    });
    expect(insertCalls[0].row.response_summary).toBeNull();
  });
});
