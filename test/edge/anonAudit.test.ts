/**
 * Security-Gate Vertragstests fuer den anon-audit Helper.
 *
 * Was hier bewiesen wird:
 *   1) reserveAnonAudit() schreibt eine Pending-Row mit den Pflichtfeldern
 *   2) reserveAnonAudit() WIRFT bei DB-Fehler — der Caller MUSS 503 returnen
 *      und darf NIEMALS einen LLM-Call ausloesen
 *   3) completeAnonAudit() updated die richtige Row und ist fire-and-forget
 *      (DB-Fehler propagiert NICHT — die reservierte Row ist genug Audit)
 *   4) extractPayloadKeys() liefert deterministische Key-Listen ohne Werte
 *
 * E2E-Tests gegen das echte governance-agent Edge Function laufen
 * separat im Staging-Pfad — siehe PR-Beschreibung.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  reserveAnonAudit,
  completeAnonAudit,
  extractPayloadKeys,
  type AdminLike,
} from '../../supabase/functions/_shared/anonAudit';

function mockAdmin(opts: {
  insertResult?: { error: { message: string } | null };
  updateResult?: { error: { message: string } | null };
} = {}): {
  admin: AdminLike;
  insertCalls: Array<{ table: string; row: Record<string, unknown> }>;
  updateCalls: Array<{ table: string; patch: Record<string, unknown>; col: string; val: string }>;
} {
  const insertCalls: Array<{ table: string; row: Record<string, unknown> }> = [];
  const updateCalls: Array<{ table: string; patch: Record<string, unknown>; col: string; val: string }> = [];
  const admin: AdminLike = {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          insertCalls.push({ table, row });
          return Promise.resolve(opts.insertResult ?? { error: null });
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(col: string, val: string) {
              updateCalls.push({ table, patch, col, val });
              return Promise.resolve(opts.updateResult ?? { error: null });
            },
          };
        },
      };
    },
  };
  return { admin, insertCalls, updateCalls };
}

describe('reserveAnonAudit', () => {
  it('inserts a pending row with all required fields', async () => {
    const { admin, insertCalls } = mockAdmin();
    await reserveAnonAudit(admin, {
      request_id: 'req-1',
      op:        'chat_anon',
      ip_hash:   'sha-of-ip',
      user_agent_hash: 'sha-of-ua',
      acknowledge_us_routing: true,
      session_id:     'sess-1',
      correlation_id: 'corr-1',
      payload_keys:   ['message', 'session_id'],
    });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].table).toBe('anon_chat_runs');
    expect(insertCalls[0].row).toMatchObject({
      request_id: 'req-1',
      op:         'chat_anon',
      ip_hash:    'sha-of-ip',
      outcome:    'pending',
      user_agent_hash:        'sha-of-ua',
      acknowledge_us_routing: true,
      session_id:     'sess-1',
      correlation_id: 'corr-1',
      payload_keys:   ['message', 'session_id'],
    });
  });

  it('omits optional fields when undefined (no null-spam)', async () => {
    const { admin, insertCalls } = mockAdmin();
    await reserveAnonAudit(admin, {
      request_id: 'req-2',
      op:        'explain_finding',
      ip_hash:   'sha',
    });
    const row = insertCalls[0].row;
    expect(row.user_agent_hash).toBeUndefined();
    expect(row.acknowledge_us_routing).toBeUndefined();
    expect(row.session_id).toBeUndefined();
    expect(row.correlation_id).toBeUndefined();
    expect(row.payload_keys).toBeUndefined();
  });

  it('THROWS when the DB insert fails — caller must refuse the LLM call', async () => {
    const { admin } = mockAdmin({ insertResult: { error: { message: 'rls denied' } } });
    await expect(
      reserveAnonAudit(admin, { request_id: 'req-3', op: 'chat_anon', ip_hash: 'sha' }),
    ).rejects.toThrow(/anon audit reserve failed/);
  });
});

describe('completeAnonAudit', () => {
  it('updates the row keyed by request_id', async () => {
    const { admin, updateCalls } = mockAdmin();
    await completeAnonAudit(admin, 'req-1', {
      outcome:       'success',
      model:         'claude-sonnet-4-6',
      input_tokens:  120,
      output_tokens: 64,
      duration_ms:   841,
    });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].col).toBe('request_id');
    expect(updateCalls[0].val).toBe('req-1');
    expect(updateCalls[0].patch).toMatchObject({
      outcome:       'success',
      model:         'claude-sonnet-4-6',
      input_tokens:  120,
      output_tokens: 64,
      duration_ms:   841,
    });
  });

  it('omits optional patch fields when undefined', async () => {
    const { admin, updateCalls } = mockAdmin();
    await completeAnonAudit(admin, 'req-2', { outcome: 'rate_limited' });
    const patch = updateCalls[0].patch;
    expect(patch).toEqual({ outcome: 'rate_limited' });
  });

  it('is fire-and-forget: DB error does NOT propagate', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { admin } = mockAdmin({ updateResult: { error: { message: 'conflict' } } });
    await expect(
      completeAnonAudit(admin, 'req-3', { outcome: 'success' }),
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe('extractPayloadKeys', () => {
  it('returns top-level keys, sorted, without values', () => {
    const keys = extractPayloadKeys({
      message:    'hi',
      session_id: 'abc',
      history:    [{ role: 'user', content: 'secret' }],
      acknowledge_us_routing: true,
    });
    expect(keys).toEqual(['acknowledge_us_routing', 'history', 'message', 'session_id']);
    // Sanity: no value leakage in the array.
    for (const k of keys) {
      expect(typeof k).toBe('string');
      expect(k).not.toContain('secret');
    }
  });

  it('handles empty body', () => {
    expect(extractPayloadKeys({})).toEqual([]);
  });
});
