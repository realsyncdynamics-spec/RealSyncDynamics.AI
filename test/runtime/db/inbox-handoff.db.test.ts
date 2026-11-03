/**
 * PR C, Schritt 2: Posteingang mit Übergabe an Menschen (E8 = B, E10).
 * Migration 20261103000000_inbox_handoff.sql.
 *
 * Geprüft
 *   H1  Owner/Admin übernehmen open → in_bearbeitung und erledigen
 *       in_bearbeitung → erledigt; Zuständigkeit, Zeitstempel, Prüfpfad
 *   H2  Ungültige Übergänge → 'conflict'; fremder Mandant / unbekannt →
 *       'not_found' (nicht unterscheidbar); anon ohne EXECUTE
 *   H3  Tenant-Isolation: Konversation, Intake und Events nur im eigenen Mandanten
 *   H4  Direkte Client-Updates der Inbox-Felder gesperrt (auch Owner);
 *       open ↔ closed und Bestandsfelder unverändert möglich (Regression)
 *   H5  Intake/Events nicht vom Client schreibbar; Intake-Mandant geprüft;
 *       Events append-only (auch service_role: kein UPDATE/TRUNCATE)
 *   H6  20 parallele Übernahmen über echte Verbindungen → genau ein 'ok'
 *   H7  Regression: chat/voice/whatsapp-Konversationen wie bisher anlegbar
 *   H8  Editor/DPO/Viewer-Auditor haben nur Lesezugriff; direkte RPC-Aufrufe
 *       bleiben fail-closed ohne Zustandsänderung oder Existenz-Leckage
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { closeDb, createTenantWithMember, getDbUrl, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const skip = !requireDbOrFail('inbox handoff');
const d = skip ? describe.skip : describe;

interface PgError extends Error { code?: string }
const SERVER = { role: 'service_role' } as const;

async function sqlState(p: Promise<unknown>): Promise<string> {
  try { await p; return 'OK'; } catch (e) { return (e as PgError).code ?? (e as Error).message; }
}

const asUser = <T>(ctx: DbCtx, sub: string, fn: () => Promise<T>) =>
  ctx.withClaims({ sub, role: 'authenticated' }, fn);
const asServer = <T>(ctx: DbCtx, fn: () => Promise<T>) => ctx.withClaims(SERVER, fn);

async function setupTenant(ctx: DbCtx): Promise<{
  tenantId: string; ownerId: string; adminId: string; editorId: string;
  auditorId: string; dpoId: string; bot: string;
}> {
  const { tenantId, userId: ownerId } = await createTenantWithMember(ctx);
  const addMember = async (role: 'admin' | 'editor' | 'viewer_auditor' | 'dpo'): Promise<string> => {
    const id = (await ctx.client.query<{ id: string }>(
      `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
      [`${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`],
    )).rows[0]!.id;
    await ctx.client.query(
      `INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1, $2, $3)`,
      [tenantId, id, role],
    );
    return id;
  };
  const adminId = await addMember('admin');
  const editorId = await addMember('editor');
  const auditorId = await addMember('viewer_auditor');
  const dpoId = await addMember('dpo');
  const bot = await asServer(ctx, async () => {
    await ctx.client.query(
      `INSERT INTO public.subscriptions (tenant_id, plan_key, status) VALUES ($1, 'growth', 'active')
       ON CONFLICT (tenant_id) DO UPDATE SET plan_key = 'growth', status = 'active',
         stripe_price_id = NULL, past_due_since = NULL, updated_at = now()`, [tenantId]);
    return (await ctx.client.query<{ id: string }>(
      `INSERT INTO public.bots (tenant_id, name) VALUES ($1, 'Empfang') RETURNING id`, [tenantId])).rows[0]!.id;
  });
  return { tenantId, ownerId, adminId, editorId, auditorId, dpoId, bot };
}

function conversation(ctx: DbCtx, tenantId: string, bot: string, channel = 'form'): Promise<string> {
  return asServer(ctx, async () => (await ctx.client.query<{ id: string }>(
    `INSERT INTO public.bot_conversations (tenant_id, bot_id, channel, contact_label)
     VALUES ($1, $2, $3, 'Max') RETURNING id`, [tenantId, bot, channel])).rows[0]!.id);
}

const rpc = (ctx: DbCtx, sub: string, fn: 'inbox_take_over' | 'inbox_resolve', id: string) =>
  asUser(ctx, sub, async () => (await ctx.client.query<{ r: string }>(
    `SELECT public.${fn}($1) AS r`, [id])).rows[0]!.r);

d('inbox handoff', () => {
  let ctx: DbCtx;
  let a: Awaited<ReturnType<typeof setupTenant>>;
  let b: Awaited<ReturnType<typeof setupTenant>>;

  beforeEach(async () => {
    ctx = await openDb();
    a = await setupTenant(ctx);
    b = await setupTenant(ctx);
  });
  afterEach(async () => { await closeDb(ctx); });

  it('H1: Admin übernimmt und erledigt, Prüfpfad vollständig', async () => {
    const id = await conversation(ctx, a.tenantId, a.bot);
    expect(await rpc(ctx, a.adminId, 'inbox_take_over', id)).toBe('ok');
    expect(await rpc(ctx, a.adminId, 'inbox_resolve', id)).toBe('ok');
    const row = (await ctx.client.query(
      `SELECT status, assigned_to, handed_off_at, resolved_at FROM public.bot_conversations WHERE id = $1`, [id])).rows[0];
    expect(row.status).toBe('erledigt');
    expect(row.assigned_to).toBe(a.adminId);
    expect(row.handed_off_at).not.toBeNull();
    expect(row.resolved_at).not.toBeNull();
    const events = await asUser(ctx, a.adminId, async () => (await ctx.client.query(
      `SELECT event, actor_id, from_status, to_status FROM public.bot_conversation_events
       WHERE conversation_id = $1 ORDER BY created_at, event DESC`, [id])).rows);
    expect(events).toEqual([
      { event: 'taken_over', actor_id: a.adminId, from_status: 'open', to_status: 'in_bearbeitung' },
      { event: 'resolved', actor_id: a.adminId, from_status: 'in_bearbeitung', to_status: 'erledigt' },
    ]);
  });

  it('H2: ungültige Übergänge conflict, fremd/unbekannt not_found, anon gesperrt', async () => {
    const id = await conversation(ctx, a.tenantId, a.bot);
    expect(await rpc(ctx, a.adminId, 'inbox_resolve', id)).toBe('conflict');
    expect(await rpc(ctx, a.adminId, 'inbox_take_over', id)).toBe('ok');
    expect(await rpc(ctx, a.ownerId, 'inbox_take_over', id)).toBe('conflict');
    expect(await rpc(ctx, a.adminId, 'inbox_resolve', id)).toBe('ok');
    expect(await rpc(ctx, a.adminId, 'inbox_take_over', id)).toBe('conflict');
    expect(await rpc(ctx, b.ownerId, 'inbox_take_over', id)).toBe('not_found');
    expect(await rpc(ctx, a.adminId, 'inbox_take_over', '00000000-0000-0000-0000-000000000000')).toBe('not_found');
    expect(await sqlState(ctx.withClaims({ role: 'anon' }, () => ctx.client.query(
      `SET LOCAL ROLE anon; SELECT public.inbox_take_over('${id}')`)))).toBe('42501');
  });

  it('H3: Tenant-Isolation für Konversation, Intake, Events', async () => {
    const idA = await conversation(ctx, a.tenantId, a.bot);
    const idB = await conversation(ctx, b.tenantId, b.bot);
    await asServer(ctx, () => ctx.client.query(
      `INSERT INTO public.bot_conversation_intake (conversation_id, tenant_id, anliegen, quelle)
       VALUES ($1, $2, 'A', 'form'), ($3, $4, 'B', 'form')`, [idA, a.tenantId, idB, b.tenantId]));
    expect(await rpc(ctx, b.ownerId, 'inbox_take_over', idB)).toBe('ok');
    const seen = await asUser(ctx, a.auditorId, async () => ({
      conv: (await ctx.client.query(`SELECT id FROM public.bot_conversations`)).rows.map((r) => r.id),
      intake: (await ctx.client.query(`SELECT anliegen FROM public.bot_conversation_intake`)).rows.map((r) => r.anliegen),
      events: (await ctx.client.query(`SELECT id FROM public.bot_conversation_events`)).rowCount,
    }));
    expect(seen.conv).toEqual([idA]);
    expect(seen.intake).toEqual(['A']);
    expect(seen.events).toBe(0);
  });

  it('H4: direkte Inbox-Updates gesperrt, open ↔ closed bleibt (Regression)', async () => {
    const id = await conversation(ctx, a.tenantId, a.bot);
    const upd = (sql: string) => sqlState(asUser(ctx, a.ownerId, () => ctx.client.query(sql, [id])));
    expect(await upd(`UPDATE public.bot_conversations SET status = 'in_bearbeitung' WHERE id = $1`)).toBe('42501');
    expect(await upd(`UPDATE public.bot_conversations SET assigned_to = auth.uid() WHERE id = $1`)).toBe('42501');
    expect(await upd(`UPDATE public.bot_conversations SET resolved_at = now() WHERE id = $1`)).toBe('42501');
    expect(await upd(`UPDATE public.bot_conversations SET status = 'closed' WHERE id = $1`)).toBe('OK');
    expect(await upd(`UPDATE public.bot_conversations SET status = 'open', contact_label = 'Neu' WHERE id = $1`)).toBe('OK');
    expect(await sqlState(asUser(ctx, a.ownerId, () => ctx.client.query(
      `INSERT INTO public.bot_conversations (tenant_id, bot_id, status) VALUES ($1, $2, 'erledigt')`,
      [a.tenantId, a.bot])))).toBe('42501');

    // Mitglied ohne Admin: direkte Änderung wirkt nicht (bestehende Policy unverändert)
    const n = await asUser(ctx, a.editorId, async () => (await ctx.client.query(
      `UPDATE public.bot_conversations SET contact_label = 'x' WHERE id = $1`, [id])).rowCount);
    expect(n).toBe(0);
  });

  it('H5: Intake/Events nicht vom Client schreibbar, Events append-only', async () => {
    const id = await conversation(ctx, a.tenantId, a.bot);
    expect(await sqlState(asUser(ctx, a.ownerId, () => ctx.client.query(
      `INSERT INTO public.bot_conversation_intake (conversation_id, tenant_id, quelle) VALUES ($1, $2, 'form')`,
      [id, a.tenantId])))).toBe('42501');
    expect(await sqlState(asServer(ctx, () => ctx.client.query(
      `INSERT INTO public.bot_conversation_intake (conversation_id, tenant_id, quelle) VALUES ($1, $2, 'form')`,
      [id, b.tenantId])))).toBe('42501');
    expect(await rpc(ctx, a.ownerId, 'inbox_take_over', id)).toBe('ok');
    expect(await sqlState(asUser(ctx, a.ownerId, () => ctx.client.query(
      `INSERT INTO public.bot_conversation_events (tenant_id, conversation_id, event, from_status, to_status)
       VALUES ($1, $2, 'resolved', 'a', 'b')`, [a.tenantId, id])))).toBe('42501');
    expect(await sqlState(asServer(ctx, () => ctx.client.query(
      `UPDATE public.bot_conversation_events SET to_status = 'x'`)))).toBe('42501');
    expect(await sqlState(asServer(ctx, () => ctx.client.query(
      `TRUNCATE public.bot_conversation_events`)))).toBe('42501');
  });

  it('H8: Editor/DPO/Auditor können RPCs nicht ausführen; keine Existenz-Leckage', async () => {
    const id = await conversation(ctx, a.tenantId, a.bot);
    const missing = '00000000-0000-0000-0000-000000000000';
    const readonly = [a.editorId, a.dpoId, a.auditorId];
    for (const uid of readonly) {
      // Gleiches Resultat für existierende, fremde und unbekannte Konversation.
      expect(await rpc(ctx, uid, 'inbox_take_over', id)).toBe('not_found');
      expect(await rpc(ctx, uid, 'inbox_resolve', id)).toBe('not_found');
      expect(await rpc(ctx, uid, 'inbox_take_over', missing)).toBe('not_found');
      expect(await rpc(ctx, uid, 'inbox_resolve', missing)).toBe('not_found');
    }
    expect(await rpc(ctx, b.ownerId, 'inbox_take_over', id)).toBe('not_found');
    const original = (await ctx.client.query(
      `SELECT status, assigned_to, handed_off_at, resolved_at
         FROM public.bot_conversations WHERE id = $1`, [id])).rows[0];
    expect(original).toEqual({
      status: 'open', assigned_to: null, handed_off_at: null, resolved_at: null,
    });
    expect((await ctx.client.query(
      `SELECT id FROM public.bot_conversation_events WHERE conversation_id = $1`, [id])).rowCount).toBe(0);

    // Der Owner kann übernehmen; nur Admin/Owner können anschließend erledigen.
    expect(await rpc(ctx, a.ownerId, 'inbox_take_over', id)).toBe('ok');
    for (const uid of readonly) {
      expect(await rpc(ctx, uid, 'inbox_resolve', id)).toBe('not_found');
      expect(await rpc(ctx, uid, 'inbox_take_over', id)).toBe('not_found');
    }
    expect(await rpc(ctx, a.adminId, 'inbox_resolve', id)).toBe('ok');
    const events = (await ctx.client.query<{ event: string }>(
      `SELECT event FROM public.bot_conversation_events WHERE conversation_id = $1 ORDER BY created_at, event DESC`, [id])).rows;
    expect(events.map((e) => e.event)).toEqual(['taken_over', 'resolved']);
  });

  it('H7: Bestandskanäle unverändert anlegbar (Regression)', async () => {
    for (const channel of ['chat', 'voice', 'whatsapp', 'telegram', 'form']) {
      expect(await sqlState(conversation(ctx, a.tenantId, a.bot, channel))).toBe('OK');
    }
  });
});

d('H6 parallel: 20 gleichzeitige Übernahmen, genau ein ok', () => {
  it('echte Verbindungen, festgeschriebene Fixtures', async () => {
    const url = getDbUrl()!;
    const admin = new Client({ connectionString: url });
    await admin.connect();
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let tenantId: string | null = null;
    const userIds: string[] = [];
    try {
      await admin.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ role: 'service_role' })]);
      tenantId = (await admin.query<{ id: string }>(
        `INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [`par_${tag}`])).rows[0]!.id;
      await admin.query(
        `INSERT INTO public.subscriptions (tenant_id, plan_key, status) VALUES ($1, 'growth', 'active')
         ON CONFLICT (tenant_id) DO UPDATE SET plan_key = 'growth', status = 'active',
           stripe_price_id = NULL, past_due_since = NULL, updated_at = now()`, [tenantId]);
      for (let i = 0; i < 20; i++) {
        const uid = (await admin.query<{ id: string }>(
          `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [`par_${tag}_${i}@example.com`])).rows[0]!.id;
        userIds.push(uid);
        await admin.query(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1, $2, 'admin')`, [tenantId, uid]);
      }
      await admin.query(`SET ROLE service_role`);
      const bot = (await admin.query<{ id: string }>(
        `INSERT INTO public.bots (tenant_id, name) VALUES ($1, 'Empfang') RETURNING id`, [tenantId])).rows[0]!.id;
      const conv = (await admin.query<{ id: string }>(
        `INSERT INTO public.bot_conversations (tenant_id, bot_id, channel) VALUES ($1, $2, 'form') RETURNING id`,
        [tenantId, bot])).rows[0]!.id;
      await admin.query(`RESET ROLE`);

      const results = await Promise.all(userIds.map(async (uid) => {
        const c = new Client({ connectionString: url });
        await c.connect();
        try {
          await c.query(`SELECT set_config('request.jwt.claims', $1, false)`,
            [JSON.stringify({ sub: uid, role: 'authenticated' })]);
          await c.query(`SET ROLE authenticated`);
          return (await c.query<{ r: string }>(`SELECT public.inbox_take_over($1) AS r`, [conv])).rows[0]!.r;
        } finally { await c.end(); }
      }));

      expect(results.filter((r) => r === 'ok')).toHaveLength(1);
      expect(results.filter((r) => r === 'conflict')).toHaveLength(19);
      const events = (await admin.query(
        `SELECT count(*)::int AS n FROM public.bot_conversation_events WHERE conversation_id = $1`, [conv])).rows[0]!.n;
      expect(events).toBe(1);
    } finally {
      await admin.query(`RESET ROLE`).catch(() => undefined);
      if (tenantId) await admin.query(`DELETE FROM public.tenants WHERE id = $1`, [tenantId]);
      if (userIds.length) await admin.query(`DELETE FROM auth.users WHERE id = ANY($1::uuid[])`, [userIds]);
      await admin.end();
    }
  });
});
