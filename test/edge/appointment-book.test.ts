// appointment-book: öffentlicher Endpunkt (verify_jwt = false). Zugriff nur
// über das Paar (tenant_id, bot_id), Capability + Entitlement, Rate-Limit je
// IP-Hash/Bot, Längengrenzen, doppelte Anfragen und neutrale Fehler.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createAppointmentHandler,
  type AppointmentBot,
  type AppointmentDeps,
} from '../../supabase/functions/appointment-book/handler.ts';
import { APPOINTMENT_LIMITS, parseAppointmentInput } from '../../supabase/functions/appointment-book/validate.ts';
import {
  APPOINTMENT_RATE_LIMITS,
  checkAppointmentBotRateLimit,
  checkAppointmentIpRateLimit,
  type RpcAdmin,
} from '../../supabase/functions/appointment-book/ratelimit.ts';

const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';
const B1 = 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';
const NOW = new Date('2026-11-25T12:00:00Z');
const URL_FN = 'https://x.supabase.co/functions/v1/appointment-book';

const BOT: AppointmentBot = { id: B1, tenant_id: T1, config: {}, capabilities: { appointments: true } };

function harness(over: Partial<AppointmentDeps> = {}) {
  const calls: string[] = [];
  const inserted: Array<Record<string, unknown>> = [];
  const logged: unknown[] = [];
  const deps: AppointmentDeps = {
    now: () => NOW,
    hashIp: async () => 'iphash',
    rateIp: async () => { calls.push('rateIp'); return { allowed: true }; },
    rateBot: async () => { calls.push('rateBot'); return { allowed: true }; },
    resolveBot: async (tenantId, botId) => {
      calls.push('resolveBot');
      if (tenantId === T1 && botId === B1) return BOT;
      throw Object.assign(new Error('bot not found'), { status: 404, code: 'NOT_FOUND' });
    },
    originAllowed: () => true,
    hasCapability: (bot) => { calls.push('capability'); return Boolean(bot.capabilities?.appointments); },
    gate: async () => { calls.push('gate'); return 'ok'; },
    upsertConversation: async () => { calls.push('conversation'); return 'conv-1'; },
    findDuplicate: async () => { calls.push('duplicate'); return null; },
    insertAppointment: async (bot, conversationId, input) => {
      calls.push('insert');
      inserted.push({ tenant_id: bot.tenant_id, bot_id: bot.id, conversation_id: conversationId, ...input });
      return { id: 'appt-1', status: 'requested' };
    },
    logError: (_s, e) => logged.push(e),
    ...over,
  };
  return { handler: createAppointmentHandler(deps), calls, inserted, logged };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(URL_FN, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const VALID = { tenant_id: T1, bot_id: B1, customer_name: 'Max Muster', contact: '+49 170 0000000', service: 'Beratung' };

async function json(res: Response) {
  return (await res.json()) as { ok: boolean; appointment_id?: string; duplicate?: boolean; error?: { code: string; message: string } };
}

describe('appointment-book — positive Fälle', () => {
  it('legt eine gültige Terminanfrage an', async () => {
    const h = harness();
    const res = await h.handler(post({ ...VALID, requested_at: '2026-12-01T09:00:00Z', notes: 'Bitte vormittags' }));
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ ok: true, appointment_id: 'appt-1' });
    expect(h.inserted).toHaveLength(1);
    expect(h.inserted[0]).toMatchObject({ tenant_id: T1, bot_id: B1, requestedAt: '2026-12-01T09:00:00.000Z' });
  });

  it('akzeptiert die Telefonnummer als Zahl', async () => {
    const h = harness();
    const res = await h.handler(post({ ...VALID, contact: 4917000000 }));
    expect(res.status).toBe(200);
    expect(h.inserted[0]).toMatchObject({ contact: '4917000000' });
  });

  it('hält die Reihenfolge ein: IP-Limit → Bot → Bot-Limit → Capability → Gate → Insert', async () => {
    const h = harness();
    await h.handler(post({ ...VALID, conversation_ref: 'call-1' }));
    expect(h.calls).toEqual(['rateIp', 'resolveBot', 'rateBot', 'capability', 'gate', 'conversation', 'duplicate', 'insert']);
  });

  it('gibt bei doppelter Anfrage derselben Konversation den bestehenden Termin zurück', async () => {
    const h = harness({ findDuplicate: async () => ({ id: 'appt-0', status: 'requested' }) });
    const res = await h.handler(post({ ...VALID, conversation_ref: 'call-1' }));
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ ok: true, appointment_id: 'appt-0', duplicate: true });
    expect(h.inserted).toHaveLength(0);
  });

  it('beantwortet OPTIONS (CORS-Preflight)', async () => {
    const h = harness();
    const res = await h.handler(new Request(URL_FN, { method: 'OPTIONS' }));
    expect(res.status).toBeLessThan(300);
  });
});

describe('appointment-book — Mandantentrennung und Berechtigung', () => {
  it('fremder Mandant zum Bot → 404, kein Insert', async () => {
    const h = harness();
    const res = await h.handler(post({ ...VALID, tenant_id: T2 }));
    expect(res.status).toBe(404);
    expect(h.inserted).toHaveLength(0);
  });

  it('der Termin trägt immer den Mandanten des aufgelösten Bots', async () => {
    const h = harness();
    await h.handler(post(VALID));
    expect(h.inserted[0].tenant_id).toBe(BOT.tenant_id);
  });

  it('Capability aus → 403, Gate und Insert laufen nicht', async () => {
    const h = harness({ resolveBot: async () => ({ ...BOT, capabilities: { appointments: false } }) });
    const res = await h.handler(post(VALID));
    expect(res.status).toBe(403);
    expect(h.calls).not.toContain('gate');
    expect(h.inserted).toHaveLength(0);
  });

  it('Plan ohne bots.appointments → 403, kein Insert', async () => {
    const h = harness({ gate: async () => 'missing' });
    const res = await h.handler(post(VALID));
    expect(res.status).toBe(403);
    expect((await json(res)).error?.code).toBe('ENTITLEMENT_MISSING');
    expect(h.inserted).toHaveLength(0);
  });

  it('nicht erlaubte Origin → 403, kein Insert', async () => {
    const h = harness({ originAllowed: () => false });
    const res = await h.handler(post(VALID, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(h.inserted).toHaveLength(0);
  });
});

describe('appointment-book — Rate-Limit (fail-closed)', () => {
  it('IP-Limit erreicht → 429 mit Retry-After, kein Bot-Lookup', async () => {
    const h = harness({ rateIp: async () => ({ allowed: false, scope: 'ip' }) });
    const res = await h.handler(post(VALID));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(h.calls).not.toContain('resolveBot');
  });

  it('Zähler nicht erreichbar → 503, kein Insert', async () => {
    const h = harness({ rateIp: async () => ({ allowed: false, scope: 'unavailable' }) });
    const res = await h.handler(post(VALID));
    expect(res.status).toBe(503);
    expect(h.inserted).toHaveLength(0);
  });

  it('Bot-Limit erreicht → 429, kein Insert', async () => {
    const h = harness({ rateBot: async () => ({ allowed: false, scope: 'ip_bot' }) });
    const res = await h.handler(post(VALID));
    expect(res.status).toBe(429);
    expect(h.inserted).toHaveLength(0);
  });
});

describe('appointment-book — Eingabeprüfung', () => {
  const bad: Array<[string, unknown]> = [
    ['ungültiges JSON', '{nope'],
    ['Array statt Objekt', [VALID]],
    ['tenant_id fehlt', { ...VALID, tenant_id: undefined }],
    ['bot_id keine UUID', { ...VALID, bot_id: 'bot-1' }],
    ['tenant_id als Objekt', { ...VALID, tenant_id: { $ne: null } }],
    ['customer_name fehlt', { ...VALID, customer_name: '   ' }],
    ['customer_name kein String', { ...VALID, customer_name: ['a'] }],
    ['customer_name zu lang', { ...VALID, customer_name: 'x'.repeat(APPOINTMENT_LIMITS.customerName + 1) }],
    ['notes zu lang', { ...VALID, notes: 'x'.repeat(APPOINTMENT_LIMITS.notes + 1) }],
    ['contact zu lang', { ...VALID, contact: 'x'.repeat(APPOINTMENT_LIMITS.contact + 1) }],
    ['service als Objekt', { ...VALID, service: { a: 1 } }],
    ['conversation_ref zu lang', { ...VALID, conversation_ref: 'x'.repeat(APPOINTMENT_LIMITS.conversationRef + 1) }],
    ['requested_at kein Datum', { ...VALID, requested_at: 'morgen' }],
    ['requested_at als Zahl', { ...VALID, requested_at: 1764000000000 }],
    ['requested_at weit in der Vergangenheit', { ...VALID, requested_at: '2020-01-01T00:00:00Z' }],
    ['requested_at weit in der Zukunft', { ...VALID, requested_at: '2099-01-01T00:00:00Z' }],
  ];

  it.each(bad)('%s → 400, kein DB-Zugriff', async (_name, body) => {
    const h = harness();
    const res = await h.handler(post(body));
    expect(res.status).toBe(400);
    expect(h.calls).toEqual([]);
    expect(h.inserted).toHaveLength(0);
  });

  it('GET → 405', async () => {
    const h = harness();
    const res = await h.handler(new Request(URL_FN, { method: 'GET' }));
    expect(res.status).toBe(405);
  });

  it('parseAppointmentInput trimmt und setzt leere optionale Felder auf null', () => {
    const r = parseAppointmentInput({ ...VALID, customer_name: '  Max  ', notes: '   ', service: '' }, NOW);
    expect(r).toMatchObject({ ok: true, value: { customerName: 'Max', notes: null, service: null } });
  });
});

describe('appointment-book — neutrale Fehler', () => {
  it('interner Fehler → 500 ohne Fehlertext, Fehler wird serverseitig geloggt', async () => {
    const h = harness({ insertAppointment: async () => { throw new Error('duplicate key value violates "secret_idx"'); } });
    const res = await h.handler(post(VALID));
    expect(res.status).toBe(500);
    const body = await json(res);
    expect(body.error?.message).toBe('internal error');
    expect(JSON.stringify(body)).not.toContain('secret_idx');
    expect(h.logged).toHaveLength(1);
  });

  it('DB-Fehler beim Bot-Lookup (BotError 500) → neutrale 500', async () => {
    const h = harness({
      resolveBot: async () => { throw Object.assign(new Error('relation "bots" leaked'), { status: 500, code: 'INTERNAL' }); },
    });
    const res = await h.handler(post(VALID));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await json(res))).not.toContain('leaked');
  });

  it('index.ts gibt keine DB-Fehlertexte an den Client und nutzt die eigenen Limits', () => {
    const src = readFileSync('supabase/functions/appointment-book/index.ts', 'utf8');
    expect(src).not.toMatch(/jsonError\([^)]*error\.message/);
    expect(src).toContain('checkAppointmentIpRateLimit');
    expect(src).toContain('checkAppointmentBotRateLimit');
    expect(src).toContain("gateFeature(admin, bot.tenant_id, 'bots.appointments')");
    const handlerSrc = readFileSync('supabase/functions/appointment-book/handler.ts', 'utf8');
    // Nur Bot-Fehler unter 500 (feste Texte aus _shared/bots.ts) gehen durch;
    // jeder andere Fehler endet in der neutralen 500.
    expect(handlerSrc).toContain('isBotError(e) && e.status < 500');
    expect(handlerSrc).toContain("jsonError(500, 'INTERNAL', 'internal error')");
    expect(handlerSrc).not.toMatch(/jsonError\(500[^)]*\.message/);
  });
});

describe('Rate-Limit-Helfer für appointment-book', () => {
  function rpcAdmin(answers: Array<boolean | 'error'>): RpcAdmin & { keys: string[] } {
    const keys: string[] = [];
    let i = 0;
    return {
      keys,
      rpc: async (_fn, args) => {
        keys.push(String(args.p_bucket_key));
        const a = answers[i++];
        if (a === 'error') return { data: null, error: { message: 'down' } };
        return { data: [{ allowed: a, hits: 1 }], error: null };
      },
    };
  }

  it('nutzt eigene Buckets, getrennt von bot-chat', async () => {
    const a = rpcAdmin([true, true, true]);
    expect(await checkAppointmentIpRateLimit(a, 'h')).toEqual({ allowed: true });
    expect(await checkAppointmentBotRateLimit(a, 'h', B1)).toEqual({ allowed: true });
    expect(a.keys).toEqual(['appt:ip:h', `appt:ipbot:h:${B1}`, `appt:bot:${B1}`]);
  });

  it('ändert den gemeinsamen Code nicht (kleiner Deploy-Umfang)', () => {
    const shared = readFileSync('supabase/functions/_shared/bot-budget.ts', 'utf8');
    expect(shared).not.toContain('appt:');
  });

  it('ist strenger als das Chat-Limit', () => {
    expect(APPOINTMENT_RATE_LIMITS.perIp.max).toBeLessThanOrEqual(5);
    expect(APPOINTMENT_RATE_LIMITS.perIpBot.max).toBeLessThanOrEqual(3);
  });

  it('meldet Überschreitung und Ausfall (fail-closed)', async () => {
    expect(await checkAppointmentIpRateLimit(rpcAdmin([false]), 'h')).toEqual({ allowed: false, scope: 'ip' });
    expect(await checkAppointmentIpRateLimit(rpcAdmin(['error']), 'h')).toEqual({ allowed: false, scope: 'unavailable' });
    expect(await checkAppointmentBotRateLimit(rpcAdmin([false]), 'h', B1)).toEqual({ allowed: false, scope: 'ip_bot' });
    expect(await checkAppointmentBotRateLimit(rpcAdmin([true, false]), 'h', B1)).toEqual({ allowed: false, scope: 'bot' });
    expect(await checkAppointmentBotRateLimit(rpcAdmin([true, 'error']), 'h', B1)).toEqual({ allowed: false, scope: 'unavailable' });
  });
});

describe('appointment-book — gleichzeitige Anfragen und Folgetermine', () => {
  // In-Memory-Tabelle mit derselben Eindeutigkeitsregel wie der Unique-Index
  // bot_appointments_open_conversation_uniq (Migration 20261125190000).
  function dbHarness() {
    const rows: Array<{ id: string; status: string; key: string | null }> = [];
    let seq = 0;
    const keyOf = (conv: string | null, name: string, at: string | null) =>
      conv ? `${T1}|${B1}|${conv}|${name}|${at ?? 'epoch'}` : null;
    const tick = () => new Promise((r) => setTimeout(r, Math.random() * 3));
    const h = harness({
      upsertConversation: async (_b, ref) => `conv-${ref}`,
      findDuplicate: async (_b, conv, input) => {
        await tick();
        const k = keyOf(conv, input.customerName, input.requestedAt);
        const hit = rows.find((r) => r.key === k && r.status === 'requested');
        return hit ? { id: hit.id, status: hit.status } : null;
      },
      insertAppointment: async (_b, conv, input) => {
        await tick();
        const k = keyOf(conv, input.customerName, input.requestedAt);
        if (k && rows.some((r) => r.key === k && r.status === 'requested')) return { conflict: true };
        const row = { id: `appt-${++seq}`, status: 'requested', key: k };
        rows.push(row);
        return { id: row.id, status: row.status };
      },
    });
    return { ...h, rows };
  }

  it('10 gleichzeitige identische Anfragen → genau ein Termin, alle erhalten dieselbe ID', async () => {
    const d = dbHarness();
    const body = { ...VALID, conversation_ref: 'call-7', requested_at: '2026-12-01T09:00:00Z' };
    const results = await Promise.all(Array.from({ length: 10 }, () => d.handler(post(body)).then(json)));
    expect(d.rows).toHaveLength(1);
    const ids = new Set(results.map((r) => r.appointment_id));
    expect(ids.size).toBe(1);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.duplicate).length).toBe(9);
  });

  it('Folgetermin mit anderem Wunschtermin in derselben Konversation wird angelegt', async () => {
    const d = dbHarness();
    await d.handler(post({ ...VALID, conversation_ref: 'call-8', requested_at: '2026-12-01T09:00:00Z' }));
    const res = await d.handler(post({ ...VALID, conversation_ref: 'call-8', requested_at: '2026-12-08T09:00:00Z' }));
    expect((await json(res)).duplicate).toBeUndefined();
    expect(d.rows).toHaveLength(2);
  });

  it('nach Bestätigung oder Absage ist eine neue Anfrage möglich', async () => {
    const d = dbHarness();
    const body = { ...VALID, conversation_ref: 'call-9', requested_at: '2026-12-01T09:00:00Z' };
    await d.handler(post(body));
    d.rows[0].status = 'cancelled';
    const res = await d.handler(post(body));
    expect((await json(res)).duplicate).toBeUndefined();
    expect(d.rows).toHaveLength(2);
  });

  it('Anfragen ohne Konversation werden nicht zusammengelegt', async () => {
    const d = dbHarness();
    await d.handler(post(VALID));
    await d.handler(post(VALID));
    expect(d.rows).toHaveLength(2);
  });

  it('Konflikt ohne auffindbaren Gewinner → neutrale 409, kein zweiter Insert', async () => {
    const h = harness({ insertAppointment: async () => ({ conflict: true }), findDuplicate: async () => null });
    const res = await h.handler(post({ ...VALID, conversation_ref: 'call-x' }));
    expect(res.status).toBe(409);
  });

  it('index.ts behandelt den Unique-Konflikt 23505 und nutzt kein Zeitfenster mehr', () => {
    const src = readFileSync('supabase/functions/appointment-book/index.ts', 'utf8');
    expect(src).toContain("=== '23505'");
    expect(src).not.toContain('DUPLICATE_WINDOW_MS');
  });
});
