// appointment-book: Datenbank-Bausteine aus deps.ts gegen einen
// nachgebildeten PostgREST-Client. Prüft die Filter, die Mandantenzuordnung,
// das Entitlement-Mapping und die Konfliktbehandlung — also den echten
// Schreibpfad, den index.ts verdrahtet.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  makeFindDuplicate,
  makeGate,
  makeInsertAppointment,
  makeUpsertConversation,
  type QueryBuilder,
  type TableClient,
} from '../../supabase/functions/appointment-book/deps.ts';
import { createAppointmentHandler, type AppointmentBot, type AppointmentDeps } from '../../supabase/functions/appointment-book/handler.ts';
import type { AppointmentInput } from '../../supabase/functions/appointment-book/validate.ts';

const T1 = '11111111-1111-4111-8111-111111111111';
const B1 = 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';
const BOT: AppointmentBot = { id: B1, tenant_id: T1, config: {}, capabilities: { appointments: true } };
const INPUT: AppointmentInput = {
  tenantId: 'ignored-body-tenant', botId: B1, customerName: 'Max', contact: null, service: null,
  requestedAt: '2026-12-01T09:00:00.000Z', notes: null, conversationRef: 'call-1',
};

type Result = { data: unknown; error: { message: string; code?: string } | null };

/** Zeichnet die Query-Kette auf und liefert ein vorgegebenes Ergebnis. */
function fakeClient(result: Result) {
  const log: Array<{ table: string; ops: Array<[string, ...unknown[]]> }> = [];
  const client: TableClient = {
    from(table) {
      const entry = { table, ops: [] as Array<[string, ...unknown[]]> };
      log.push(entry);
      const b: QueryBuilder = {
        select: (c) => { entry.ops.push(['select', c]); return b; },
        eq: (c, v) => { entry.ops.push(['eq', c, v]); return b; },
        is: (c, v) => { entry.ops.push(['is', c, v]); return b; },
        order: (c, o) => { entry.ops.push(['order', c, o]); return b; },
        limit: (n) => { entry.ops.push(['limit', n]); return b; },
        insert: (row) => { entry.ops.push(['insert', row]); return b; },
        maybeSingle: () => { entry.ops.push(['maybeSingle']); return Promise.resolve(result); },
        single: () => { entry.ops.push(['single']); return Promise.resolve(result); },
      };
      return b;
    },
  };
  const eqs = () => Object.fromEntries(log.flatMap((e) => e.ops.filter((o) => o[0] === 'eq').map((o) => [o[1], o[2]])));
  return { client, log, eqs };
}

describe('makeGate — Entitlement-Mapping', () => {
  class EntitlementError extends Error {}
  it('ok, wenn das Gate durchläuft', async () => {
    expect(await makeGate(async () => {}, (e) => e instanceof EntitlementError)(BOT)).toBe('ok');
  });
  it("Entitlement-Fehler → 'missing' (nicht 'ok')", async () => {
    const gate = makeGate(async () => { throw new EntitlementError('nope'); }, (e) => e instanceof EntitlementError);
    expect(await gate(BOT)).toBe('missing');
  });
  it('andere Fehler werden weitergeworfen (fail-closed → 500)', async () => {
    const gate = makeGate(async () => { throw new Error('db down'); }, (e) => e instanceof EntitlementError);
    await expect(gate(BOT)).rejects.toThrow('db down');
  });
});

describe('makeFindDuplicate — gleiche Regel wie der Unique-Index', () => {
  it('filtert auf Mandant, Bot, Konversation, Name, offenen Status und Wunschtermin', async () => {
    const f = fakeClient({ data: null, error: null });
    await makeFindDuplicate(f.client)(BOT, 'conv-1', INPUT);
    expect(f.log[0]!.table).toBe('bot_appointments');
    expect(f.eqs()).toEqual({
      tenant_id: T1, bot_id: B1, conversation_id: 'conv-1', customer_name: 'Max',
      status: 'requested', requested_at: '2026-12-01T09:00:00.000Z',
    });
  });
  it('Mandant kommt aus dem Bot, nie aus dem Request-Body', async () => {
    const f = fakeClient({ data: null, error: null });
    await makeFindDuplicate(f.client)(BOT, 'conv-1', INPUT);
    expect(f.eqs().tenant_id).toBe(T1);
    expect(JSON.stringify(f.log)).not.toContain('ignored-body-tenant');
  });
  it('ohne Wunschtermin: requested_at IS NULL statt Gleichheit', async () => {
    const f = fakeClient({ data: null, error: null });
    await makeFindDuplicate(f.client)(BOT, 'conv-1', { ...INPUT, requestedAt: null });
    expect(f.log[0]!.ops).toContainEqual(['is', 'requested_at', null]);
    expect(f.eqs().requested_at).toBeUndefined();
  });
  it('liefert den Treffer und wirft bei DB-Fehler', async () => {
    expect(await makeFindDuplicate(fakeClient({ data: { id: 'a', status: 'requested' }, error: null }).client)(BOT, 'c', INPUT))
      .toEqual({ id: 'a', status: 'requested' });
    await expect(makeFindDuplicate(fakeClient({ data: null, error: { message: 'x' } }).client)(BOT, 'c', INPUT)).rejects.toThrow();
  });
});

describe('makeInsertAppointment', () => {
  it('schreibt den Mandanten und Bot aus dem aufgelösten Bot', async () => {
    const f = fakeClient({ data: { id: 'n', status: 'requested' }, error: null });
    const res = await makeInsertAppointment(f.client)(BOT, 'conv-1', INPUT);
    expect(res).toEqual({ id: 'n', status: 'requested' });
    const row = f.log[0]!.ops.find((o) => o[0] === 'insert')![1] as Record<string, unknown>;
    expect(row).toMatchObject({ tenant_id: T1, bot_id: B1, conversation_id: 'conv-1', customer_name: 'Max', metadata: { source: 'bot' } });
    expect(row).not.toHaveProperty('status');
  });
  it('23505 → { conflict: true }', async () => {
    const f = fakeClient({ data: null, error: { message: 'duplicate key', code: '23505' } });
    expect(await makeInsertAppointment(f.client)(BOT, 'conv-1', INPUT)).toEqual({ conflict: true });
  });
  it('andere DB-Fehler werfen (→ neutrale 500)', async () => {
    const f = fakeClient({ data: null, error: { message: 'boom', code: '23503' } });
    await expect(makeInsertAppointment(f.client)(BOT, 'conv-1', INPUT)).rejects.toThrow();
  });
});

describe('makeUpsertConversation — gleichzeitige Erstanfragen', () => {
  it('liest die Konversation neu, wenn das Anlegen am Unique-Index scheitert', async () => {
    const upsert = makeUpsertConversation(
      async () => { throw new Error('duplicate key value violates unique constraint "uq_bot_conversations_bot_ref"'); },
      async () => 'conv-winner',
    );
    expect(await upsert(BOT, 'call-1', 'Max')).toBe('conv-winner');
  });
  it('wirft weiter, wenn danach keine Konversation existiert', async () => {
    const upsert = makeUpsertConversation(async () => { throw new Error('db down'); }, async () => null);
    await expect(upsert(BOT, 'call-1', 'Max')).rejects.toThrow('db down');
  });

  it('10 gleichzeitige Erstanfragen mit neuer conversation_ref → 1 Termin, alle 200, 9 × duplicate', async () => {
    // Konversationen und Termine mit echter Unique-Semantik (bots.ts: erst
    // suchen, dann anlegen — nicht idempotent).
    const conversations = new Map<string, string>();
    const appts: Array<{ id: string; key: string; status: string }> = [];
    const tick = () => new Promise((r) => setTimeout(r, Math.random() * 3));
    const rawUpsert = async (_b: AppointmentBot, ref: string) => {
      const found = conversations.get(ref);
      await tick();
      if (found) return found;
      if (conversations.has(ref)) throw new Error('duplicate key value violates unique constraint "uq_bot_conversations_bot_ref"');
      await tick();
      if (conversations.has(ref)) throw new Error('duplicate key value violates unique constraint "uq_bot_conversations_bot_ref"');
      const id = `conv-${ref}`;
      conversations.set(ref, id);
      return id;
    };
    const deps: AppointmentDeps = {
      now: () => new Date('2026-11-25T12:00:00Z'),
      hashIp: async () => 'h',
      rateIp: async () => ({ allowed: true }),
      rateBot: async () => ({ allowed: true }),
      resolveBot: async () => BOT,
      originAllowed: () => true,
      hasCapability: () => true,
      gate: async () => 'ok',
      upsertConversation: makeUpsertConversation(rawUpsert, async (_b, ref) => conversations.get(ref) ?? null),
      findDuplicate: async (_b, conv, input) => {
        await tick();
        const hit = appts.find((a) => a.key === `${conv}|${input.customerName}|${input.requestedAt}` && a.status === 'requested');
        return hit ? { id: hit.id, status: hit.status } : null;
      },
      insertAppointment: async (_b, conv, input) => {
        await tick();
        const key = `${conv}|${input.customerName}|${input.requestedAt}`;
        if (appts.some((a) => a.key === key && a.status === 'requested')) return { conflict: true };
        const row = { id: `appt-${appts.length + 1}`, key, status: 'requested' };
        appts.push(row);
        return { id: row.id, status: row.status };
      },
      logError: () => {},
    };
    const handler = createAppointmentHandler(deps);
    const body = JSON.stringify({ tenant_id: T1, bot_id: B1, customer_name: 'Max', conversation_ref: 'neu-1', requested_at: '2026-12-01T09:00:00Z' });
    const res = await Promise.all(Array.from({ length: 10 }, () =>
      handler(new Request('https://x/functions/v1/appointment-book', { method: 'POST', body, headers: { 'content-type': 'application/json' } })),
    ));
    expect(res.map((r) => r.status)).toEqual(Array(10).fill(200));
    const bodies = await Promise.all(res.map((r) => r.json() as Promise<{ appointment_id: string; duplicate?: boolean }>));
    expect(new Set(bodies.map((b) => b.appointment_id)).size).toBe(1);
    expect(bodies.filter((b) => b.duplicate).length).toBe(9);
    expect(appts).toHaveLength(1);
    expect(conversations.size).toBe(1);
  });
});

describe('index.ts verdrahtet die geprüften Bausteine', () => {
  const src = readFileSync('supabase/functions/appointment-book/index.ts', 'utf8');
  it('nutzt makeGate, makeUpsertConversation, makeFindDuplicate, makeInsertAppointment', () => {
    for (const fn of ['makeGate(', 'makeUpsertConversation(', 'makeFindDuplicate(tables)', 'makeInsertAppointment(tables)']) {
      expect(src).toContain(fn);
    }
    expect(src).toContain('(e) => e instanceof EntitlementError');
    expect(src).toContain('findExistingConversationId(admin');
  });
  it('enthält keine eigene Query-Logik mehr', () => {
    expect(src).not.toContain(".from('bot_appointments')");
  });
});
