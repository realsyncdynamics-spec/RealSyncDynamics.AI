/**
 * resolveBot — Freigabe-Gate für Sekretariats-Bots (Schritt B).
 *
 * Die Freigabe-Prüfung selbst liegt in der Datenbank
 * (`secretariat_bot_gate_status`, Migration 20261125180000; geprüft in
 * test/runtime/db/secretariat-server-gate.db.test.ts). Hier steht nur das
 * Verhalten der Runtime: Sekretariats-Bots fragen die RPC und scheitern
 * fail-closed; alle anderen Bots bleiben exakt wie bisher, ohne RPC-Aufruf.
 */
import { describe, expect, it } from 'vitest';
import { BotError, resolveBot, type SupabaseAdmin } from '../../supabase/functions/_shared/bots';

type RpcResult = { data: unknown; error: unknown } | 'throw';

function fakeAdmin(row: Record<string, unknown> | null, rpcResult: RpcResult = { data: null, error: null }) {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const filters: Array<[string, unknown]> = [];
  const builder = {
    eq(col: string, val: unknown) { filters.push([col, val]); return builder; },
    maybeSingle: async () => ({ data: row, error: null }),
  };
  const admin = {
    from: (table: string) => {
      expect(table).toBe('bots');
      return { select: () => builder };
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (rpcResult === 'throw') throw new Error('network down');
      return rpcResult;
    },
  } as unknown as SupabaseAdmin;
  return { admin, rpcCalls, filters };
}

const TENANT = '11111111-1111-4111-8111-111111111111';
const BOT = '22222222-2222-4222-8222-222222222222';

function bot(overrides: Record<string, unknown> = {}) {
  return {
    id: BOT, tenant_id: TENANT, name: 'Bot', description: null, channel: 'chat',
    persona: null, greeting: null, capabilities: {}, config: {}, enabled: true,
    ...overrides,
  };
}

async function rejection(p: Promise<unknown>): Promise<BotError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(BotError);
    return e as BotError;
  }
  throw new Error('resolveBot hätte ablehnen müssen');
}

describe('resolveBot — Sekretariats-Bots', () => {
  it('freigegeben → Zeile wird geliefert, RPC mit p_bot_id gefragt', async () => {
    const row = bot({ config: { secretariat: { fields: {} } } });
    const { admin, rpcCalls } = fakeAdmin(row, { data: { is_secretariat: true, approved: true }, error: null });
    await expect(resolveBot(admin, TENANT, BOT)).resolves.toEqual(row);
    expect(rpcCalls).toEqual([{ fn: 'secretariat_bot_gate_status', args: { p_bot_id: BOT } }]);
  });

  it('approved=false → 403 secretariat not approved', async () => {
    const { admin } = fakeAdmin(bot({ config: { secretariat: {} } }), { data: { approved: false }, error: null });
    const e = await rejection(resolveBot(admin, TENANT, BOT));
    expect([e.status, e.code, e.message]).toEqual([403, 'FORBIDDEN', 'secretariat not approved']);
  });

  it('approved als Text "true" zählt nicht (nur boolean true)', async () => {
    const { admin } = fakeAdmin(bot({ config: { secretariat: {} } }), { data: { approved: 'true' }, error: null });
    expect((await rejection(resolveBot(admin, TENANT, BOT))).status).toBe(403);
  });

  it('RPC-Fehler (z. B. Funktion fehlt, Migration noch nicht live) → 403', async () => {
    const { admin } = fakeAdmin(bot({ config: { secretariat: {} } }), {
      data: null, error: { code: 'PGRST202', message: 'Could not find the function' },
    });
    const e = await rejection(resolveBot(admin, TENANT, BOT));
    expect([e.status, e.message]).toEqual([403, 'secretariat not approved']);
  });

  it('RPC wirft → 403', async () => {
    const { admin } = fakeAdmin(bot({ config: { secretariat: {} } }), 'throw');
    expect((await rejection(resolveBot(admin, TENANT, BOT))).status).toBe(403);
  });

  it('keine Antwort (data null) → 403', async () => {
    const { admin } = fakeAdmin(bot({ config: { secretariat: {} } }), { data: null, error: null });
    expect((await rejection(resolveBot(admin, TENANT, BOT))).status).toBe(403);
  });

  it('Marker mit beliebigem Wert (auch null) gilt als Sekretariat', async () => {
    const { admin, rpcCalls } = fakeAdmin(bot({ config: { secretariat: null } }), { data: { approved: false }, error: null });
    expect((await rejection(resolveBot(admin, TENANT, BOT))).status).toBe(403);
    expect(rpcCalls.length).toBe(1);
  });

  it('client-geschriebenes config.secretariat.approval ändert nichts', async () => {
    const row = bot({ config: { secretariat: { approval: { approvedBy: 'x', fieldsSha256: 'a'.repeat(64) } } } });
    const { admin } = fakeAdmin(row, { data: { approved: false }, error: null });
    expect((await rejection(resolveBot(admin, TENANT, BOT))).message).toBe('secretariat not approved');
  });

  it('deaktivierter Sekretariats-Bot → weiterhin 403 bot is disabled, ohne RPC', async () => {
    const { admin, rpcCalls } = fakeAdmin(bot({ enabled: false, config: { secretariat: {} } }), { data: { approved: true }, error: null });
    expect((await rejection(resolveBot(admin, TENANT, BOT))).message).toBe('bot is disabled');
    expect(rpcCalls).toEqual([]);
  });
});

describe('resolveBot — Nicht-Sekretariats-Bots unverändert', () => {
  it('aktiver Bot → Zeile, kein RPC-Aufruf, Filter auf id und tenant_id', async () => {
    const row = bot({ config: { vertical: 'restaurant' } });
    const { admin, rpcCalls, filters } = fakeAdmin(row);
    await expect(resolveBot(admin, TENANT, BOT)).resolves.toEqual(row);
    expect(rpcCalls).toEqual([]);
    expect(filters).toEqual([['id', BOT], ['tenant_id', TENANT]]);
  });

  it('deaktiviert → 403 bot is disabled', async () => {
    const { admin, rpcCalls } = fakeAdmin(bot({ enabled: false }));
    const e = await rejection(resolveBot(admin, TENANT, BOT));
    expect([e.status, e.message]).toEqual([403, 'bot is disabled']);
    expect(rpcCalls).toEqual([]);
  });

  it('nicht gefunden → 404', async () => {
    const { admin } = fakeAdmin(null);
    expect((await rejection(resolveBot(admin, TENANT, BOT))).status).toBe(404);
  });

  it('fehlende IDs → 400', async () => {
    const { admin } = fakeAdmin(bot());
    expect((await rejection(resolveBot(admin, '', BOT))).status).toBe(400);
    expect((await rejection(resolveBot(admin, TENANT, ''))).status).toBe(400);
  });
});
