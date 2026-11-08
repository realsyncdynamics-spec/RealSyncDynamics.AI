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
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
});
