/**
 * PR C, Schritt 3: Schema-Annahmen von supabase/functions/inbox-form-submit/repo.ts
 * gegen die echte Datenbank (service_role-Pfad, kein PostgREST nötig).
 *
 * Geprüft
 *   S1  resolve_site_inbox: aktives Binding + live + Bot an → Zeile; nach
 *       enabled = false keine Zeile; anon/authenticated ohne EXECUTE
 *   S2  Idempotenz: zweiter INSERT mit gleichem (bot_id, external_ref) → 23505
 *       (uq_bot_conversations_bot_ref); andere nonce → zweite Zeile
 *   S3  Intake mit fremder tenant_id → 42501; passend → ok; Nachricht ok;
 *       Mitglied liest Intake und Nachricht, fremder Mandant nicht
 *   S4  Kompensation: DELETE der Konversation entfernt Intake und Nachricht
 *   S5  Rate-Limit-Zählung über metadata @> {ip_hash} je Mandant
 *   S6  RPC inbox_form_submit_intake: received → alle drei Datensätze in einer
 *       Transaktion; duplicate nur für vollständig gespeicherte Anfrage; not_found
 *       für unbekannte/abgeschaltete site_ref ohne Schreibzugriff; rate_limited
 *       je ip_hash und je Binding; nur service_role darf sie ausführen
 *   S7  Parallel: 5 gleichzeitige Anfragen bei 9 vorhandenen → genau 1 received
 *       (Codex-Review P2b); 5 gleichzeitige mit gleicher nonce → 1 received,
 *       4 duplicate, eine Konversation
 *   S8  FK-Anonymisierung (Codex-Review P1): Konto löschen, nachdem die Person
 *       übernommen hat und ein Binding anlegte → actor_id/created_by NULL,
 *       Events und Binding bleiben; jede andere UPDATE bleibt 42501
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { closeDb, createTenantWithMember, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

interface PgError extends Error { code?: string }
const asServer = <T>(ctx: DbCtx, fn: () => Promise<T>) => ctx.withClaims({ role: 'service_role' }, fn);
const asUser = <T>(ctx: DbCtx, sub: string, fn: () => Promise<T>) => ctx.withClaims({ sub, role: 'authenticated' }, fn);

async function sqlState(p: Promise<unknown>): Promise<string> {
  try { await p; return 'OK'; } catch (e) { return (e as PgError).code ?? (e as Error).message; }
}

async function fixtures(ctx: DbCtx) {
  const { tenantId, userId } = await createTenantWithMember(ctx);
  return asServer(ctx, async () => {
    await ctx.client.query(
      `INSERT INTO public.subscriptions (tenant_id, plan_key, status) VALUES ($1, 'growth', 'active')
       ON CONFLICT (tenant_id) DO UPDATE SET plan_key = 'growth', status = 'active',
         stripe_price_id = NULL, past_due_since = NULL, updated_at = now()`, [tenantId]);
    const bot = (await ctx.client.query<{ id: string }>(
      `INSERT INTO public.bots (tenant_id, name) VALUES ($1, 'Empfang') RETURNING id`, [tenantId])).rows[0]!.id;
    const project = (await ctx.client.query<{ id: string }>(
      `INSERT INTO public.website_projects (tenant_id, name, industry, status) VALUES ($1, 'Seite', 'handwerker', 'live') RETURNING id`,
      [tenantId])).rows[0]!.id;
    const binding = (await ctx.client.query<{ id: string; site_ref: string }>(
      `INSERT INTO public.site_inbox_bindings (tenant_id, website_project_id, bot_id, enabled)
       VALUES ($1, $2, $3, true) RETURNING id, site_ref`, [tenantId, project, bot])).rows[0]!;
    return { tenantId, userId, bot, project, bindingId: binding.id, siteRef: binding.site_ref };
  });
}

/** Entspricht repo.ts insertConversation (ohne 23505-Behandlung). */
function insertConversation(ctx: DbCtx, f: { tenantId: string; bot: string }, externalRef: string, ipHash = 'h1') {
  return asServer(ctx, async () => (await ctx.client.query<{ id: string }>(
    `INSERT INTO public.bot_conversations (tenant_id, bot_id, channel, status, external_ref, contact_label, metadata, last_message_at)
     VALUES ($1, $2, 'form', 'open', $3, 'Max', $4::jsonb, now()) RETURNING id`,
    [f.tenantId, f.bot, externalRef, JSON.stringify({ source: 'site_form', ip_hash: ipHash })])).rows[0]!.id);
}

d('inbox-form-submit schema', () => {
  let ctx: DbCtx;
  let a: Awaited<ReturnType<typeof fixtures>>;
  let b: Awaited<ReturnType<typeof fixtures>>;

  beforeEach(async () => {
    ctx = await openDb();
    a = await fixtures(ctx);
    b = await fixtures(ctx);
  });
  afterEach(async () => { await closeDb(ctx); });

  it('S1: resolve_site_inbox fail-closed und nur für service_role', async () => {
    const row = await asServer(ctx, async () => (await ctx.client.query(
      `SELECT * FROM public.resolve_site_inbox($1)`, [a.siteRef])).rows[0]);
    expect(row).toMatchObject({ binding_id: a.bindingId, tenant_id: a.tenantId, bot_id: a.bot, website_project_id: a.project });

    await asServer(ctx, () => ctx.client.query(`UPDATE public.site_inbox_bindings SET enabled = false WHERE id = $1`, [a.bindingId]));
    const none = await asServer(ctx, async () => (await ctx.client.query(
      `SELECT * FROM public.resolve_site_inbox($1)`, [a.siteRef])).rows);
    expect(none).toHaveLength(0);

    // Echte anon-Rolle (nicht nur Claim): withClaims setzt sonst authenticated.
    expect(await sqlState(ctx.withClaims({ role: 'anon' }, async () => {
      await ctx.client.query(`SET LOCAL ROLE anon`);
      return ctx.client.query(`SELECT * FROM public.resolve_site_inbox($1)`, [a.siteRef]);
    }))).toBe('42501');
    expect(await sqlState(asUser(ctx, a.userId, () =>
      ctx.client.query(`SELECT * FROM public.resolve_site_inbox($1)`, [a.siteRef])))).toBe('42501');
  });

  it('S2: (bot_id, external_ref) ist eindeutig → Doppel-Submit erzeugt 23505', async () => {
    const ref = `form:${a.siteRef}:nonce-0123456789abcdef`;
    const id1 = await insertConversation(ctx, a, ref);
    expect(await sqlState(insertConversation(ctx, a, ref))).toBe('23505');
    const existing = await asServer(ctx, async () => (await ctx.client.query<{ id: string }>(
      `SELECT id FROM public.bot_conversations WHERE bot_id = $1 AND external_ref = $2`, [a.bot, ref])).rows);
    expect(existing).toEqual([{ id: id1 }]);
    const id2 = await insertConversation(ctx, a, `form:${a.siteRef}:nonce-fedcba9876543210`);
    expect(id2).not.toBe(id1);
  });

  it('S3: Intake-Mandant geprüft; Intake + Nachricht schreibbar; Mitglied liest, fremder Mandant nicht', async () => {
    const id = await insertConversation(ctx, a, `form:${a.siteRef}:n1`);
    expect(await sqlState(asServer(ctx, () => ctx.client.query(
      `INSERT INTO public.bot_conversation_intake (conversation_id, tenant_id, anliegen, kontakt_email, quelle, einwilligung_at)
       VALUES ($1, $2, 'x', 'a@example.com', 'form', now())`, [id, b.tenantId])))).toBe('42501');
    expect(await sqlState(asServer(ctx, () => ctx.client.query(
      `INSERT INTO public.bot_conversation_intake (conversation_id, tenant_id, anliegen, kontakt_telefon, terminwunsch, quelle, einwilligung_at)
       VALUES ($1, $2, 'Heizung tropft', '0171 1234567', 'Dienstag', 'form', now())`, [id, a.tenantId])))).toBe('OK');
    expect(await sqlState(asServer(ctx, () => ctx.client.query(
      `INSERT INTO public.bot_messages (tenant_id, conversation_id, bot_id, role, content, metadata)
       VALUES ($1, $2, $3, 'user', 'Heizung tropft', '{"source":"site_form"}')`, [a.tenantId, id, a.bot])))).toBe('OK');

    const mine = await asUser(ctx, a.userId, async () => ({
      conv: (await ctx.client.query(`SELECT status, channel FROM public.bot_conversations WHERE id = $1`, [id])).rows,
      intake: (await ctx.client.query(`SELECT anliegen FROM public.bot_conversation_intake WHERE conversation_id = $1`, [id])).rows,
      msg: (await ctx.client.query(`SELECT content FROM public.bot_messages WHERE conversation_id = $1`, [id])).rows,
    }));
    expect(mine.conv).toEqual([{ status: 'open', channel: 'form' }]);
    expect(mine.intake).toEqual([{ anliegen: 'Heizung tropft' }]);
    expect(mine.msg).toEqual([{ content: 'Heizung tropft' }]);

    const foreign = await asUser(ctx, b.userId, async () => ({
      conv: (await ctx.client.query(`SELECT id FROM public.bot_conversations WHERE id = $1`, [id])).rows,
      intake: (await ctx.client.query(`SELECT anliegen FROM public.bot_conversation_intake WHERE conversation_id = $1`, [id])).rows,
      msg: (await ctx.client.query(`SELECT content FROM public.bot_messages WHERE conversation_id = $1`, [id])).rows,
    }));
    expect(foreign).toEqual({ conv: [], intake: [], msg: [] });
  });

  it('S4: Kompensation — DELETE der Konversation räumt Intake und Nachricht ab', async () => {
    const id = await insertConversation(ctx, a, `form:${a.siteRef}:n2`);
    await asServer(ctx, async () => {
      await ctx.client.query(
        `INSERT INTO public.bot_conversation_intake (conversation_id, tenant_id, anliegen, kontakt_email, quelle)
         VALUES ($1, $2, 'x', 'a@example.com', 'form')`, [id, a.tenantId]);
      await ctx.client.query(
        `INSERT INTO public.bot_messages (tenant_id, conversation_id, bot_id, role, content) VALUES ($1, $2, $3, 'user', 'x')`,
        [a.tenantId, id, a.bot]);
      await ctx.client.query(`DELETE FROM public.bot_conversations WHERE id = $1`, [id]);
    });
    const left = await asServer(ctx, async () => ({
      intake: (await ctx.client.query(`SELECT 1 FROM public.bot_conversation_intake WHERE conversation_id = $1`, [id])).rowCount,
      msg: (await ctx.client.query(`SELECT 1 FROM public.bot_messages WHERE conversation_id = $1`, [id])).rowCount,
    }));
    expect(left).toEqual({ intake: 0, msg: 0 });
  });

  it('S5: Zählung je ip_hash und Mandant über metadata', async () => {
    await insertConversation(ctx, a, `form:${a.siteRef}:c1`, 'hash-A');
    await insertConversation(ctx, a, `form:${a.siteRef}:c2`, 'hash-A');
    await insertConversation(ctx, a, `form:${a.siteRef}:c3`, 'hash-B');
    await insertConversation(ctx, b, `form:${b.siteRef}:c4`, 'hash-A');
    const count = async (tenant: string, hash: string) => Number((await asServer(ctx, async () => (await ctx.client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM public.bot_conversations
        WHERE tenant_id = $1 AND channel = 'form' AND metadata @> $2::jsonb AND created_at >= now() - interval '1 hour'`,
      [tenant, JSON.stringify({ ip_hash: hash })])).rows[0]!.n)));
    expect(await count(a.tenantId, 'hash-A')).toBe(2);
    expect(await count(a.tenantId, 'hash-B')).toBe(1);
    expect(await count(b.tenantId, 'hash-A')).toBe(1);
  });
  const HASH_A = 'a'.repeat(64);
  const HASH_B = 'b'.repeat(64);
  function submit(ctx: DbCtx, args: { siteRef: string; nonce: string; ipHash?: string; anliegen?: string; ipLimit?: number; siteLimit?: number }) {
    return asServer(ctx, async () => (await ctx.client.query<{ status: string; conversation_id: string | null }>(
      `SELECT * FROM public.inbox_form_submit_intake($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [args.siteRef, args.nonce, args.ipHash ?? HASH_A, args.anliegen ?? 'Heizung tropft, bitte Rückruf.',
       'Max Muster', '+49 171 1234567', 'max@example.com', 'Dienstag', 'Max Muster', args.ipLimit ?? 10, args.siteLimit ?? 60])).rows[0]!);
  }

  it('S6: atomare RPC — received/duplicate/not_found/rate_limited, nur service_role', async () => {
    const r1 = await submit(ctx, { siteRef: a.siteRef, nonce: 'nonce-0123456789abcdef' });
    expect(r1.status).toBe('received');
    const rows = await asServer(ctx, async () => ({
      conv: (await ctx.client.query(`SELECT status, channel, external_ref, metadata FROM public.bot_conversations WHERE id = $1`, [r1.conversation_id])).rows,
      intake: (await ctx.client.query(`SELECT anliegen, quelle, einwilligung_at FROM public.bot_conversation_intake WHERE conversation_id = $1`, [r1.conversation_id])).rows,
      msg: (await ctx.client.query(`SELECT role, content FROM public.bot_messages WHERE conversation_id = $1`, [r1.conversation_id])).rows,
    }));
    expect(rows.conv[0]).toMatchObject({ status: 'open', channel: 'form', external_ref: `form:${a.siteRef}:nonce-0123456789abcdef` });
    expect((rows.conv[0] as { metadata: Record<string, unknown> }).metadata).toMatchObject({ source: 'site_form', binding_id: a.bindingId, ip_hash: HASH_A });
    expect(rows.intake).toHaveLength(1);
    expect(rows.intake[0]).toMatchObject({ anliegen: 'Heizung tropft, bitte Rückruf.', quelle: 'form' });
    expect((rows.intake[0] as { einwilligung_at: unknown }).einwilligung_at).not.toBeNull();
    expect(rows.msg).toEqual([{ role: 'user', content: 'Heizung tropft, bitte Rückruf.' }]);

    const r2 = await submit(ctx, { siteRef: a.siteRef, nonce: 'nonce-0123456789abcdef', anliegen: 'anderer Text' });
    expect(r2).toEqual({ status: 'duplicate', conversation_id: r1.conversation_id });
    const n = await asServer(ctx, async () => (await ctx.client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM public.bot_conversations WHERE tenant_id = $1`, [a.tenantId])).rows[0]!.n);
    expect(Number(n)).toBe(1);

    // unbekannt / abgeschaltet → not_found, nichts geschrieben
    expect((await submit(ctx, { siteRef: 'ZyXwVuTsRqPoNmLkJiHgFeDc', nonce: 'nonce-unknown-site-0000' })).status).toBe('not_found');
    await asServer(ctx, () => ctx.client.query(`UPDATE public.site_inbox_bindings SET enabled = false WHERE id = $1`, [b.bindingId]));
    expect((await submit(ctx, { siteRef: b.siteRef, nonce: 'nonce-disabled-site-000' })).status).toBe('not_found');
    const nb = await asServer(ctx, async () => (await ctx.client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM public.bot_conversations WHERE tenant_id = $1`, [b.tenantId])).rows[0]!.n);
    expect(Number(nb)).toBe(0);

    // Kontingent je ip_hash (Limit 2) und je Binding (Limit 3), Mandant a hat bereits 1
    expect((await submit(ctx, { siteRef: a.siteRef, nonce: 'nonce-ip-000000000000002', ipLimit: 2 })).status).toBe('received');
    expect((await submit(ctx, { siteRef: a.siteRef, nonce: 'nonce-ip-000000000000003', ipLimit: 2 })).status).toBe('rate_limited');
    expect((await submit(ctx, { siteRef: a.siteRef, nonce: 'nonce-ip-000000000000004', ipHash: HASH_B, siteLimit: 3 })).status).toBe('received');
    expect((await submit(ctx, { siteRef: a.siteRef, nonce: 'nonce-ip-000000000000005', ipHash: HASH_B, siteLimit: 3 })).status).toBe('rate_limited');

    // Nur service_role
    for (const role of ['anon', 'authenticated'] as const) {
      expect(await sqlState(ctx.withClaims({ sub: a.userId, role }, async () => {
        await ctx.client.query(`SET LOCAL ROLE ${role}`);
        return ctx.client.query(`SELECT * FROM public.inbox_form_submit_intake($1,$2,$3,$4,NULL,NULL,'a@example.com',NULL,'x',10,60)`,
          [a.siteRef, 'nonce-role-check-000000', HASH_A, 'Anliegen']);
      }))).toBe('42501');
    }
  });

  it('S8: FK-Anonymisierung — Kontolöschung nach Übernahme und Binding-Anlage funktioniert', async () => {
    const r = await submit(ctx, { siteRef: a.siteRef, nonce: 'nonce-anonymise-000000' });
    // Owner übernimmt → Event mit actor_id
    expect(await asUser(ctx, a.userId, async () => (await ctx.client.query<{ r: string }>(
      `SELECT public.inbox_take_over($1) AS r`, [r.conversation_id])).rows[0]!.r)).toBe('ok');
    const before = await asServer(ctx, async () => (await ctx.client.query(
      `SELECT actor_id FROM public.bot_conversation_events WHERE conversation_id = $1`, [r.conversation_id])).rows[0]);
    expect(before).toEqual({ actor_id: a.userId });

    // Zweites Binding als eingeloggter Owner anlegen → created_by = auth.uid()
    // (fixtures() legt als service_role an, dort bleibt created_by NULL).
    const project2 = await asServer(ctx, async () => (await ctx.client.query<{ id: string }>(
      `INSERT INTO public.website_projects (tenant_id, name, industry, status) VALUES ($1, 'Seite 2', 'handwerker', 'live') RETURNING id`,
      [a.tenantId])).rows[0]!.id);
    const ownedBinding = await asUser(ctx, a.userId, async () => (await ctx.client.query<{ id: string; created_by: string | null }>(
      `INSERT INTO public.site_inbox_bindings (tenant_id, website_project_id, bot_id, enabled) VALUES ($1, $2, $3, true) RETURNING id, created_by`,
      [a.tenantId, project2, a.bot])).rows[0]!);
    expect(ownedBinding.created_by).toBe(a.userId);
    // created_by darf nicht auf einen anderen Wert gesetzt werden
    expect(await sqlState(asServer(ctx, () => ctx.client.query(
      `UPDATE public.site_inbox_bindings SET created_by = $2 WHERE id = $1`, [ownedBinding.id, b.userId])))).toBe('42501');

    // Andere UPDATEs bleiben verboten (append-only)
    expect(await sqlState(asServer(ctx, () => ctx.client.query(
      `UPDATE public.bot_conversation_events SET to_status = 'erledigt' WHERE conversation_id = $1`, [r.conversation_id])))).toBe('42501');
    expect(await sqlState(asServer(ctx, () => ctx.client.query(
      `UPDATE public.bot_conversation_events SET actor_id = $2 WHERE conversation_id = $1`, [r.conversation_id, b.userId])))).toBe('42501');

    // Kontolöschung (wie gdpr-delete → auth.admin.deleteUser, das GoTrue als
    // Schema-Eigentümer ausführt; service_role darf in auth.* nicht schreiben,
    // daher hier ohne SET ROLE wie in H6). Die FK-Aktionen ON DELETE SET NULL
    // müssen durch beide Guards kommen.
    expect(await sqlState(ctx.client.query(`DELETE FROM auth.users WHERE id = $1`, [a.userId]))).toBe('OK');
    const after = await asServer(ctx, async () => ({
      ev: (await ctx.client.query(`SELECT actor_id, event, to_status FROM public.bot_conversation_events WHERE conversation_id = $1`, [r.conversation_id])).rows,
      binding: (await ctx.client.query(`SELECT created_by, enabled FROM public.site_inbox_bindings WHERE id = $1`, [ownedBinding.id])).rows,
      conv: (await ctx.client.query(`SELECT assigned_to, status FROM public.bot_conversations WHERE id = $1`, [r.conversation_id])).rows,
    }));
    expect(after.ev).toEqual([{ actor_id: null, event: 'taken_over', to_status: 'in_bearbeitung' }]);
    expect(after.binding).toEqual([{ created_by: null, enabled: true }]);
    expect(after.conv).toEqual([{ assigned_to: null, status: 'in_bearbeitung' }]);
  });
});

d('S7 parallel: Kontingent und Duplikat unter Last (echte Verbindungen)', () => {
  it('5 gleichzeitige Anfragen bei 9 vorhandenen → genau 1 received; gleiche nonce → genau 1 Konversation', async () => {
    const url = getDbUrl()!;
    const admin = new Client({ connectionString: url });
    await admin.connect();
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let tenantId: string | null = null;
    try {
      await admin.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ role: 'service_role' })]);
      tenantId = (await admin.query<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [`form_${tag}`])).rows[0]!.id;
      await admin.query(
        `INSERT INTO public.subscriptions (tenant_id, plan_key, status) VALUES ($1, 'growth', 'active')
         ON CONFLICT (tenant_id) DO UPDATE SET plan_key = 'growth', status = 'active', stripe_price_id = NULL, past_due_since = NULL, updated_at = now()`, [tenantId]);
      await admin.query(`SET ROLE service_role`);
      const bot = (await admin.query<{ id: string }>(`INSERT INTO public.bots (tenant_id, name) VALUES ($1, 'Empfang') RETURNING id`, [tenantId])).rows[0]!.id;
      const project = (await admin.query<{ id: string }>(
        `INSERT INTO public.website_projects (tenant_id, name, industry, status) VALUES ($1, 'Seite', 'handwerker', 'live') RETURNING id`, [tenantId])).rows[0]!.id;
      const siteRef = (await admin.query<{ site_ref: string }>(
        `INSERT INTO public.site_inbox_bindings (tenant_id, website_project_id, bot_id, enabled) VALUES ($1, $2, $3, true) RETURNING site_ref`,
        [tenantId, project, bot])).rows[0]!.site_ref;
      const hash = 'c'.repeat(64);
      const call = (c: Client, nonce: string) => c.query<{ status: string }>(
        `SELECT status FROM public.inbox_form_submit_intake($1,$2,$3,'Anliegen Text',NULL,NULL,'a@example.com',NULL,'x',10,60)`,
        [siteRef, nonce, hash]).then((r) => r.rows[0]!.status);
      for (let i = 0; i < 9; i++) expect(await call(admin, `nonce-seed-${String(i).padStart(12, '0')}`)).toBe('received');

      const parallel = async (nonces: string[]) => Promise.all(nonces.map(async (n) => {
        const c = new Client({ connectionString: url });
        await c.connect();
        try {
          await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ role: 'service_role' })]);
          await c.query(`SET ROLE service_role`);
          return await call(c, n);
        } finally { await c.end(); }
      }));

      // P2b: Kontingent 10 je ip_hash, 9 vorhanden, 5 gleichzeitig → genau 1 received
      const r1 = await parallel(['nonce-par-000000000001', 'nonce-par-000000000002', 'nonce-par-000000000003', 'nonce-par-000000000004', 'nonce-par-000000000005']);
      expect(r1.filter((s) => s === 'received')).toHaveLength(1);
      expect(r1.filter((s) => s === 'rate_limited')).toHaveLength(4);
      const total = (await admin.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.bot_conversations WHERE tenant_id = $1`, [tenantId])).rows[0]!.n;
      expect(Number(total)).toBe(10);

      // P2a: gleiche nonce gleichzeitig (anderer ip_hash, Limit noch frei) → 1 received, Rest duplicate, eine Zeile mit Intake
      const call2 = (c: Client) => c.query<{ status: string }>(
        `SELECT status FROM public.inbox_form_submit_intake($1,$2,$3,'Anliegen Text',NULL,NULL,'a@example.com',NULL,'x',10,60)`,
        [siteRef, 'nonce-same-000000000000', 'd'.repeat(64)]).then((r) => r.rows[0]!.status);
      const r2 = await Promise.all([1, 2, 3, 4, 5].map(async () => {
        const c = new Client({ connectionString: url });
        await c.connect();
        try {
          await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ role: 'service_role' })]);
          await c.query(`SET ROLE service_role`);
          return await call2(c);
        } finally { await c.end(); }
      }));
      expect(r2.filter((s) => s === 'received')).toHaveLength(1);
      expect(r2.filter((s) => s === 'duplicate')).toHaveLength(4);
      const dup = (await admin.query<{ n: string; i: string }>(
        `SELECT count(*)::text AS n, (SELECT count(*) FROM public.bot_conversation_intake i JOIN public.bot_conversations c2 ON c2.id = i.conversation_id WHERE c2.external_ref = $2)::text AS i
           FROM public.bot_conversations WHERE tenant_id = $1 AND external_ref = $2`, [tenantId, `form:${siteRef}:nonce-same-000000000000`])).rows[0]!;
      expect(dup).toEqual({ n: '1', i: '1' });
    } finally {
      await admin.query(`RESET ROLE`).catch(() => undefined);
      if (tenantId) await admin.query(`DELETE FROM public.tenants WHERE id = $1`, [tenantId]);
      await admin.end();
    }
  });
});
