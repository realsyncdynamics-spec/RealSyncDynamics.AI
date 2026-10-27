/**
 * Telefon: Abschlussphase + Rückrufstatus (Merge-Blocker PR #2044,
 * „kein stummes Auflegen“). Migration 20261027160000_bot_voice_closing_callback.sql.
 *
 * Geprüft
 *   C1  Rückrufstatus wird genau einmal gesetzt (auch bei 20 parallelen
 *       Aufrufen über echte Verbindungen); Folgeaufrufe → already_captured
 *   C2  Unterdrückte/ungültige Nummern → no_number, kein Status
 *   C3  Fremder Mandant / unbekannte CallSid → no_conversation, nichts geändert
 *   C4  Ansagefenster: [Ende − closing, Ende − hard); davor und danach nicht
 *   C5  Beanspruchung genau einmal (auch parallel); ändert weder Status,
 *       Betrag noch Ledger der Reservierung
 *   C6  Nach hartem Abbruch (hangup_done) keine Ansage mehr
 *   R   Nur service_role; Mitglieder lesen Rückrufstatus nur im eigenen
 *       Mandanten und können ihn nicht schreiben
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { createTenantWithMember, closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

interface PgError extends Error { code?: string }
const SERVER = { role: 'service_role' } as const;
const ACCOUNT = 'AC' + '0'.repeat(32);

function asServer<T>(ctx: DbCtx, fn: () => Promise<T>): Promise<T> {
  return ctx.withClaims(SERVER, fn);
}

async function sqlState(p: Promise<unknown>): Promise<string> {
  try { await p; return 'OK'; } catch (e) { return (e as PgError).code ?? (e as Error).message; }
}

/** Muster aus voice-runtime.db.test.ts: Plan mit Bot-Recht, dann Voice-Bot (bots_enforce_quota). */
async function voiceBotRaw(client: Client | DbCtx['client'], tenantId: string): Promise<string> {
  await client.query(
    `INSERT INTO public.subscriptions (tenant_id, plan_key, status) VALUES ($1, 'growth', 'active')
     ON CONFLICT (tenant_id) DO UPDATE SET plan_key = 'growth', status = 'active',
       stripe_price_id = NULL, past_due_since = NULL, updated_at = now()`,
    [tenantId],
  );
  return (await client.query<{ id: string }>(
    `INSERT INTO public.bots (tenant_id, name, channel) VALUES ($1, 'Empfang', 'voice') RETURNING id`, [tenantId],
  )).rows[0]!.id;
}

async function conversationRaw(client: Client | DbCtx['client'], tenantId: string, botId: string, callRef: string, from: string | null): Promise<string> {
  return (await client.query<{ id: string }>(
    `INSERT INTO public.bot_conversations (tenant_id, bot_id, channel, external_ref, contact_label)
     VALUES ($1, $2, 'voice', $3, $4) RETURNING id`, [tenantId, botId, callRef, from],
  )).rows[0]!.id;
}

/** Fixtures im Transaktionskontext als service_role (bots_enforce_quota prüft auth.role()). */
const voiceBot = (ctx: DbCtx, tenantId: string) => asServer(ctx, () => voiceBotRaw(ctx.client, tenantId));
const conversation = (ctx: DbCtx, tenantId: string, botId: string, callRef: string, from: string | null) =>
  asServer(ctx, () => conversationRaw(ctx.client, tenantId, botId, callRef, from));

async function mark(ctx: DbCtx, tenantId: string, callRef: string, reason = 'zeitlimit'): Promise<string> {
  return asServer(ctx, async () => (await ctx.client.query<{ r: string }>(
    `SELECT public.bot_voice_mark_callback($1, $2, $3) AS r`, [tenantId, callRef, reason],
  )).rows[0]!.r);
}

async function callbackRow(ctx: DbCtx, id: string) {
  return (await ctx.client.query(
    `SELECT callback_status, callback_requested_at, callback_reason FROM public.bot_conversations WHERE id = $1`, [id],
  )).rows[0];
}

const callSid = () => 'CA' + Array.from({ length: 32 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

d('C1–C3 Rückrufstatus', () => {
  let ctx: DbCtx;
  let tenant: string;
  let bot: string;
  beforeEach(async () => {
    ctx = await openDb();
    tenant = (await createTenantWithMember(ctx)).tenantId;
    bot = await voiceBot(ctx, tenant);
  });
  afterEach(async () => { await closeDb(ctx); });

  it('C1: genau einmal gesetzt, Folgeaufruf already_captured, Zeitstempel unverändert', async () => {
    const ref = callSid();
    const id = await conversation(ctx, tenant, bot, ref, '+491701234567');
    expect(await mark(ctx, tenant, ref)).toBe('captured');
    const first = await callbackRow(ctx, id);
    expect(first).toMatchObject({ callback_status: 'erfasst', callback_reason: 'zeitlimit' });
    expect(await mark(ctx, tenant, ref, 'budget')).toBe('already_captured');
    const second = await callbackRow(ctx, id);
    expect(second.callback_requested_at).toEqual(first.callback_requested_at);
    expect(second.callback_reason).toBe('zeitlimit');
  });

  it.each([
    ['anonymous'], ['+266696687'], ['+7378742833'], ['+2562533'], ['+8656696'], ['+86282452253'], ['+464'],
    [''], [null], ['0170 1234567'], ['+0123'],
  ])('C2: Nummer %s → no_number, kein Status', async (from) => {
    const ref = callSid();
    const id = await conversation(ctx, tenant, bot, ref, from);
    expect(await mark(ctx, tenant, ref)).toBe('no_number');
    expect((await callbackRow(ctx, id)).callback_status).toBeNull();
  });

  it('C3: fremder Mandant oder unbekannte CallSid → no_conversation, nichts geändert', async () => {
    const other = (await createTenantWithMember(ctx)).tenantId;
    const ref = callSid();
    const id = await conversation(ctx, tenant, bot, ref, '+491701234567');
    expect(await mark(ctx, other, ref)).toBe('no_conversation');
    expect(await mark(ctx, tenant, callSid())).toBe('no_conversation');
    expect((await callbackRow(ctx, id)).callback_status).toBeNull();
  });

  it('ungültiger Grund wird abgewiesen', async () => {
    expect(await sqlState(mark(ctx, tenant, callSid(), 'irgendwas'))).toBe('22023');
  });
});

d('C1 parallel: 20 gleichzeitige Aufrufe, genau ein captured', () => {
  it('echte Verbindungen, festgeschriebene Fixtures', async () => {
    const url = getDbUrl()!;
    const admin = new Client({ connectionString: url });
    await admin.connect();
    await admin.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ role: 'service_role' })]);
    const tid = (await admin.query<{ id: string }>(
      `INSERT INTO public.tenants (name) VALUES ($1) RETURNING id`, [`callback_race_${Date.now()}`],
    )).rows[0]!.id;
    const workers: Client[] = [];
    try {
      const botId = await voiceBotRaw(admin, tid);
      const ref = callSid();
      const convId = await conversationRaw(admin, tid, botId, ref, '+491701234567');
      for (let i = 0; i < 20; i++) {
        const c = new Client({ connectionString: url });
        await c.connect();
        await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ role: 'service_role' })]);
        await c.query(`SET ROLE service_role`);
        workers.push(c);
      }
      const results = await Promise.all(workers.map((c, i) => c.query<{ r: string }>(
        `SELECT public.bot_voice_mark_callback($1, $2, $3) AS r`, [tid, ref, i % 2 ? 'budget' : 'zeitlimit'],
      ).then((x) => x.rows[0]!.r)));
      expect(results.filter((r) => r === 'captured')).toHaveLength(1);
      expect(results.filter((r) => r === 'already_captured')).toHaveLength(19);
      const n = await admin.query(`SELECT count(*)::int AS n FROM public.bot_conversations WHERE id = $1 AND callback_status = 'erfasst'`, [convId]);
      expect(n.rows[0].n).toBe(1);
    } finally {
      await Promise.all(workers.map((c) => c.end()));
      await admin.query(`DELETE FROM public.tenants WHERE id = $1`, [tid]);
      await admin.end();
    }
  });
});

d('C4–C6 Ansagefenster und Beanspruchung', () => {
  let ctx: DbCtx;
  let tenant: string;
  beforeEach(async () => {
    ctx = await openDb();
    tenant = (await createTenantWithMember(ctx)).tenantId;
    await ctx.client.query(
      `INSERT INTO public.bot_usage_limits (tenant_id, voice_max_call_seconds, voice_max_concurrent_calls) VALUES ($1, 600, 10)`, [tenant],
    );
  });
  afterEach(async () => { await closeDb(ctx); });

  async function call(ref: string, ageSeconds: number): Promise<string> {
    const r = await asServer(ctx, async () => (await ctx.client.query<{ reservation_id: string }>(
      `SELECT reservation_id FROM public.bot_voice_call_reserve($1, NULL, 'twilio', $2, NULL, $3::jsonb)`,
      [tenant, ref, JSON.stringify({ account_sid: ACCOUNT })],
    )).rows[0]!);
    await ctx.client.query(
      `UPDATE public.bot_usage_reservations SET created_at = now() - make_interval(secs => $2) WHERE id = $1`,
      [r.reservation_id, ageSeconds],
    );
    return r.reservation_id;
  }

  async function closing(): Promise<string[]> {
    return asServer(ctx, async () => (await ctx.client.query<{ call_ref: string; tenant_id: string }>(
      `SELECT * FROM public.bot_voice_closing_calls(120, 60, 100)`,
    )).rows.filter((r) => r.tenant_id === tenant).map((r) => r.call_ref));
  }

  const claim = (id: string) => asServer(ctx, async () => (await ctx.client.query<{ c: boolean }>(
    `SELECT public.bot_voice_claim_closing($1) AS c`, [id])).rows[0]!.c);

  it('C4: nur Anrufe im Fenster [Ende−120, Ende−60) werden geliefert', async () => {
    const early = callSid(); const inside = callSid(); const late = callSid();
    await call(early, 600 - 130);   // 130 s Rest → noch nicht
    await call(inside, 600 - 90);   // 90 s Rest → Ansage
    await call(late, 600 - 30);     // 30 s Rest → nur noch harter Abbruch
    expect(await closing()).toEqual([inside]);
  });

  it('C5: Beanspruchung genau einmal; Status, Betrag, Ledger unverändert; danach nicht mehr geliefert', async () => {
    const ref = callSid();
    const id = await call(ref, 600 - 90);
    const before = (await ctx.client.query(`SELECT status, reserved_amount, expires_at FROM public.bot_usage_reservations WHERE id = $1`, [id])).rows[0];
    const ledgerBefore = (await ctx.client.query(`SELECT count(*)::int AS n FROM public.bot_usage_ledger WHERE tenant_id = $1`, [tenant])).rows[0].n;
    expect(await claim(id)).toBe(true);
    expect(await claim(id)).toBe(false);
    const after = (await ctx.client.query(`SELECT status, reserved_amount, expires_at FROM public.bot_usage_reservations WHERE id = $1`, [id])).rows[0];
    expect(after).toEqual(before);
    expect((await ctx.client.query(`SELECT count(*)::int AS n FROM public.bot_usage_ledger WHERE tenant_id = $1`, [tenant])).rows[0].n).toBe(ledgerBefore);
    expect(await closing()).toEqual([]);
    // Ergebnisprotokoll ändert ebenfalls nichts am Budget.
    await asServer(ctx, () => ctx.client.query(`SELECT public.bot_voice_record_closing($1, 'announced:captured')`, [id]));
    expect((await ctx.client.query(`SELECT status, reserved_amount, expires_at FROM public.bot_usage_reservations WHERE id = $1`, [id])).rows[0]).toEqual(before);
  });

  it('C6: nach hartem Abbruch (hangup_done) keine Ansage', async () => {
    const ref = callSid();
    const id = await call(ref, 600 - 90);
    await asServer(ctx, () => ctx.client.query(`SELECT public.bot_voice_record_hangup($1, true, 'ended')`, [id]));
    expect(await closing()).toEqual([]);
  });

  it('Argumente: Abschlussvorlauf muss größer als harter Vorlauf sein', async () => {
    expect(await sqlState(asServer(ctx, () => ctx.client.query(`SELECT * FROM public.bot_voice_closing_calls(60, 60, 10)`)))).toBe('22023');
    expect(await sqlState(asServer(ctx, () => ctx.client.query(`SELECT * FROM public.bot_voice_closing_calls(120, -1, 10)`)))).toBe('22023');
  });
});

d('C5 parallel: 20 Worker beanspruchen dieselbe Ansage', () => {
  it('genau ein Gewinner', async () => {
    const url = getDbUrl()!;
    const admin = new Client({ connectionString: url });
    await admin.connect();
    await admin.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ role: 'service_role' })]);
    const tid = (await admin.query<{ id: string }>(
      `INSERT INTO public.tenants (name) VALUES ($1) RETURNING id`, [`closing_race_${Date.now()}`],
    )).rows[0]!.id;
    const workers: Client[] = [];
    try {
      await admin.query(`INSERT INTO public.bot_usage_limits (tenant_id, voice_max_call_seconds) VALUES ($1, 600)`, [tid]);
      const id = (await admin.query<{ reservation_id: string }>(
        `SELECT reservation_id FROM public.bot_voice_call_reserve($1, NULL, 'twilio', $2, NULL, $3::jsonb)`,
        [tid, callSid(), JSON.stringify({ account_sid: ACCOUNT })],
      )).rows[0]!.reservation_id;
      for (let i = 0; i < 20; i++) {
        const c = new Client({ connectionString: url });
        await c.connect();
        await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ role: 'service_role' })]);
        await c.query(`SET ROLE service_role`);
        workers.push(c);
      }
      const wins = await Promise.all(workers.map((c) => c.query<{ c: boolean }>(
        `SELECT public.bot_voice_claim_closing($1) AS c`, [id]).then((x) => x.rows[0]!.c)));
      expect(wins.filter(Boolean)).toHaveLength(1);
    } finally {
      await Promise.all(workers.map((c) => c.end()));
      await admin.query(`DELETE FROM public.bot_usage_reservations WHERE tenant_id = $1`, [tid]);
      await admin.query(`DELETE FROM public.tenants WHERE id = $1`, [tid]);
      await admin.end();
    }
  });
});

d('R Rechte und Mandantentrennung', () => {
  let ctx: DbCtx;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); });

  it('authenticated darf keine der neuen Funktionen ausführen', async () => {
    const a = await createTenantWithMember(ctx);
    const asUser = (sql: string, params: unknown[] = []) =>
      sqlState(ctx.withClaims({ sub: a.userId, role: 'authenticated' }, () => ctx.client.query(sql, params)));
    expect(await asUser(`SELECT public.bot_voice_mark_callback($1, 'CAx', 'zeitlimit')`, [a.tenantId])).toBe('42501');
    expect(await asUser(`SELECT * FROM public.bot_voice_closing_calls(120, 60, 10)`)).toBe('42501');
    expect(await asUser(`SELECT public.bot_voice_claim_closing(gen_random_uuid())`)).toBe('42501');
    expect(await asUser(`SELECT public.bot_voice_record_closing(gen_random_uuid(), 'x')`)).toBe('42501');
  });

  it('Mitglied A liest und ändert Rückrufstatus nur im eigenen Mandanten', async () => {
    const a = await createTenantWithMember(ctx);
    const b = await createTenantWithMember(ctx);
    const botA = await voiceBot(ctx, a.tenantId);
    const botB = await voiceBot(ctx, b.tenantId);
    const refA = callSid(); const refB = callSid();
    await conversation(ctx, a.tenantId, botA, refA, '+491701111111');
    const convB = await conversation(ctx, b.tenantId, botB, refB, '+491702222222');
    expect(await mark(ctx, a.tenantId, refA)).toBe('captured');
    expect(await mark(ctx, b.tenantId, refB)).toBe('captured');

    const seen = await ctx.withClaims({ sub: a.userId, role: 'authenticated' }, async () =>
      (await ctx.client.query(`SELECT tenant_id, callback_status FROM public.bot_conversations WHERE callback_status IS NOT NULL`)).rows);
    expect(seen).toEqual([{ tenant_id: a.tenantId, callback_status: 'erfasst' }]);

    // Fremder Mandant: kein Schreibzugriff (Policy bot_conversations_upd).
    const updB = await ctx.withClaims({ sub: a.userId, role: 'authenticated' }, async () =>
      (await ctx.client.query(`UPDATE public.bot_conversations SET callback_status = NULL, callback_requested_at = NULL WHERE id = $1`, [convB])).rowCount);
    expect(updB).toBe(0);
    expect((await callbackRow(ctx, convB)).callback_status).toBe('erfasst');
    // Hinweis (Befund, unverändert übernommen): Owner/Admin des EIGENEN
    // Mandanten dürfen bot_conversations laut bestehender Policy ändern —
    // auch den Rückrufstatus. Die Rechte bleiben in diesem PR unverändert.
  });

  it('Konsistenz: Status ohne Zeitstempel wird von der Tabelle abgewiesen', async () => {
    const a = await createTenantWithMember(ctx);
    const bot = await voiceBot(ctx, a.tenantId);
    const id = await conversation(ctx, a.tenantId, bot, callSid(), '+491701111111');
    expect(await sqlState(ctx.client.query(`SAVEPOINT s1; UPDATE public.bot_conversations SET callback_status = 'erfasst' WHERE id = '${id}'`))).toBe('23514');
  });
});
