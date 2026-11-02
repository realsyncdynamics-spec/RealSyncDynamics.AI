/**
 * PR C, Schritt 1: Seite ↔ Posteingang (E9 = A).
 * Migration 20261102220000_site_inbox_bindings.sql.
 *
 * Geprüft
 *   B1  Owner legt Binding an; site_ref serverseitig erzeugt (24 Zeichen
 *       base64url), created_by = Aufrufer; Client kann site_ref nicht setzen
 *   B2  Cross-Tenant: fremder Bot, fremde Seite, fremde tenant_id → 42501
 *       (gleicher Code → keine Existenz-Leckage)
 *   B3  site_ref/tenant_id unveränderlich (auch für service_role), kein DELETE,
 *       eine Seite = ein Binding, Bot mit Binding nicht löschbar
 *   B4  Rollen: editor liest, darf aber weder anlegen noch ändern;
 *       anderer Mandant sieht nichts; anon hat keinen Zugriff
 *   B5  resolve_site_inbox fail-closed: nur aktiv + Seite live + Bot aktiv;
 *       für authenticated nicht ausführbar
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

interface PgError extends Error { code?: string }
const SERVER = { role: 'service_role' } as const;

async function sqlState(p: Promise<unknown>): Promise<string> {
  try { await p; return 'OK'; } catch (e) { return (e as PgError).code ?? (e as Error).message; }
}

/** Bot + live-Seite im Mandanten (bots_enforce_quota verlangt Plan mit Bot-Recht). */
async function fixtures(ctx: DbCtx, tenantId: string): Promise<{ bot: string; page: string; draftPage: string }> {
  return ctx.withClaims(SERVER, async () => {
    await ctx.client.query(
      `INSERT INTO public.subscriptions (tenant_id, plan_key, status) VALUES ($1, 'growth', 'active')
       ON CONFLICT (tenant_id) DO UPDATE SET plan_key = 'growth', status = 'active',
         stripe_price_id = NULL, past_due_since = NULL, updated_at = now()`,
      [tenantId],
    );
    const bot = (await ctx.client.query<{ id: string }>(
      `INSERT INTO public.bots (tenant_id, name) VALUES ($1, 'Empfang') RETURNING id`, [tenantId],
    )).rows[0]!.id;
    const page = (await ctx.client.query<{ id: string }>(
      `INSERT INTO public.website_projects (tenant_id, name, industry, status)
       VALUES ($1, 'Seite', 'handwerker', 'live') RETURNING id`, [tenantId],
    )).rows[0]!.id;
    const draftPage = (await ctx.client.query<{ id: string }>(
      `INSERT INTO public.website_projects (tenant_id, name, industry, status)
       VALUES ($1, 'Entwurf', 'handwerker', 'draft') RETURNING id`, [tenantId],
    )).rows[0]!.id;
    return { bot, page, draftPage };
  });
}

function asUser<T>(ctx: DbCtx, sub: string, fn: () => Promise<T>): Promise<T> {
  return ctx.withClaims({ sub, role: 'authenticated' }, fn);
}

function insertBinding(ctx: DbCtx, tenantId: string, page: string, bot: string, enabled = true) {
  return ctx.client.query<{ id: string; site_ref: string; created_by: string }>(
    `INSERT INTO public.site_inbox_bindings (tenant_id, website_project_id, bot_id, enabled)
     VALUES ($1, $2, $3, $4) RETURNING id, site_ref, created_by`,
    [tenantId, page, bot, enabled],
  );
}

async function resolve(ctx: DbCtx, ref: string): Promise<number> {
  return ctx.withClaims(SERVER, async () => (await ctx.client.query(
    `SELECT * FROM public.resolve_site_inbox($1)`, [ref],
  )).rowCount ?? 0);
}

d('site_inbox_bindings', () => {
  let ctx: DbCtx;
  let a: { tenantId: string; userId: string };
  let b: { tenantId: string; userId: string };
  let fa: { bot: string; page: string; draftPage: string };
  let fb: { bot: string; page: string; draftPage: string };

  beforeEach(async () => {
    ctx = await openDb();
    a = await createTenantWithMember(ctx);
    b = await createTenantWithMember(ctx);
    fa = await fixtures(ctx, a.tenantId);
    fb = await fixtures(ctx, b.tenantId);
  });
  afterEach(async () => { await closeDb(ctx); });

  it('B1: Owner legt an, site_ref serverseitig, Client-Wert unmöglich', async () => {
    const row = await asUser(ctx, a.userId, async () =>
      (await insertBinding(ctx, a.tenantId, fa.page, fa.bot)).rows[0]!);
    expect(row.site_ref).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(row.created_by).toBe(a.userId);

    const state = await sqlState(asUser(ctx, a.userId, () => ctx.client.query(
      `INSERT INTO public.site_inbox_bindings (tenant_id, website_project_id, bot_id, site_ref)
       VALUES ($1, $2, $3, 'AAAAAAAAAAAAAAAAAAAAAAAA')`, [a.tenantId, fa.draftPage, fa.bot],
    )));
    expect(state).toBe('42501');
  });

  it('B2: Cross-Tenant immer 42501', async () => {
    expect(await sqlState(asUser(ctx, a.userId, () => insertBinding(ctx, a.tenantId, fa.page, fb.bot)))).toBe('42501');
    expect(await sqlState(asUser(ctx, a.userId, () => insertBinding(ctx, a.tenantId, fb.page, fa.bot)))).toBe('42501');
    expect(await sqlState(asUser(ctx, a.userId, () => insertBinding(ctx, b.tenantId, fb.page, fb.bot)))).toBe('42501');
    expect(await sqlState(asUser(ctx, a.userId, () =>
      insertBinding(ctx, a.tenantId, '00000000-0000-0000-0000-00000000dead', fa.bot)))).toBe('42501');

    await asUser(ctx, a.userId, () => insertBinding(ctx, a.tenantId, fa.page, fa.bot));
    expect(await sqlState(asUser(ctx, a.userId, () => ctx.client.query(
      `UPDATE public.site_inbox_bindings SET bot_id = $1`, [fb.bot],
    )))).toBe('42501');
  });

  it('B3: unveränderlich, kein DELETE, eine Seite = ein Binding, Bot RESTRICT', async () => {
    await asUser(ctx, a.userId, () => insertBinding(ctx, a.tenantId, fa.page, fa.bot));
    expect(await sqlState(asUser(ctx, a.userId, () => ctx.client.query(
      `UPDATE public.site_inbox_bindings SET site_ref = 'BBBBBBBBBBBBBBBBBBBBBBBB'`)))).toBe('42501');
    expect(await sqlState(ctx.withClaims(SERVER, () => ctx.client.query(
      `UPDATE public.site_inbox_bindings SET site_ref = 'CCCCCCCCCCCCCCCCCCCCCCCC'`)))).toBe('42501');
    expect(await sqlState(ctx.withClaims(SERVER, () => ctx.client.query(
      `UPDATE public.site_inbox_bindings SET tenant_id = $1`, [b.tenantId])))).toBe('42501');
    expect(await sqlState(asUser(ctx, a.userId, () => ctx.client.query(
      `DELETE FROM public.site_inbox_bindings`)))).toBe('42501');
    expect(await sqlState(asUser(ctx, a.userId, () => insertBinding(ctx, a.tenantId, fa.page, fa.bot)))).toBe('23505');
    expect(await sqlState(ctx.withClaims(SERVER, () => ctx.client.query(
      `DELETE FROM public.bots WHERE id = $1`, [fa.bot])))).toBe('23503');
  });

  it('B3b: Abschalten setzt disabled_at, Einschalten löscht es', async () => {
    await asUser(ctx, a.userId, () => insertBinding(ctx, a.tenantId, fa.page, fa.bot));
    const off = await asUser(ctx, a.userId, async () => (await ctx.client.query(
      `UPDATE public.site_inbox_bindings SET enabled = false RETURNING disabled_at`)).rows[0]);
    expect(off.disabled_at).not.toBeNull();
    const on = await asUser(ctx, a.userId, async () => (await ctx.client.query(
      `UPDATE public.site_inbox_bindings SET enabled = true RETURNING disabled_at`)).rows[0]);
    expect(on.disabled_at).toBeNull();
  });

  it('B4: editor liest nur, fremder Mandant sieht nichts, anon gesperrt', async () => {
    await asUser(ctx, a.userId, () => insertBinding(ctx, a.tenantId, fa.page, fa.bot));
    const editor = (await ctx.client.query<{ id: string }>(
      `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
      [`editor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`],
    )).rows[0]!.id;
    await ctx.client.query(
      `INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1, $2, 'editor')`, [a.tenantId, editor]);

    const seen = await asUser(ctx, editor, async () =>
      (await ctx.client.query(`SELECT id FROM public.site_inbox_bindings`)).rowCount);
    expect(seen).toBe(1);
    expect(await sqlState(asUser(ctx, editor, () => insertBinding(ctx, a.tenantId, fa.draftPage, fa.bot)))).toBe('42501');
    const edited = await asUser(ctx, editor, async () =>
      (await ctx.client.query(`UPDATE public.site_inbox_bindings SET enabled = false`)).rowCount);
    expect(edited).toBe(0);

    const foreign = await asUser(ctx, b.userId, async () =>
      (await ctx.client.query(`SELECT id FROM public.site_inbox_bindings`)).rowCount);
    expect(foreign).toBe(0);

    expect(await sqlState(ctx.withClaims({ role: 'anon' }, () => ctx.client.query(
      `SET LOCAL ROLE anon; SELECT 1 FROM public.site_inbox_bindings`)))).toBe('42501');
  });

  it('B5: resolve_site_inbox fail-closed und nur service_role', async () => {
    const ref = (await asUser(ctx, a.userId, () => insertBinding(ctx, a.tenantId, fa.page, fa.bot))).rows[0]!.site_ref;
    expect(await resolve(ctx, ref)).toBe(1);
    expect(await resolve(ctx, 'ZZZZZZZZZZZZZZZZZZZZZZZZ')).toBe(0);
    expect(await resolve(ctx, "' OR 1=1 --")).toBe(0);

    await ctx.withClaims(SERVER, () => ctx.client.query(
      `UPDATE public.website_projects SET status = 'preview' WHERE id = $1`, [fa.page]));
    expect(await resolve(ctx, ref)).toBe(0);
    await ctx.withClaims(SERVER, () => ctx.client.query(
      `UPDATE public.website_projects SET status = 'live' WHERE id = $1`, [fa.page]));

    await ctx.withClaims(SERVER, () => ctx.client.query(`UPDATE public.bots SET enabled = false WHERE id = $1`, [fa.bot]));
    expect(await resolve(ctx, ref)).toBe(0);
    await ctx.withClaims(SERVER, () => ctx.client.query(`UPDATE public.bots SET enabled = true WHERE id = $1`, [fa.bot]));

    await ctx.withClaims(SERVER, () => ctx.client.query(`UPDATE public.site_inbox_bindings SET enabled = false`));
    expect(await resolve(ctx, ref)).toBe(0);

    expect(await sqlState(asUser(ctx, a.userId, () => ctx.client.query(
      `SELECT * FROM public.resolve_site_inbox($1)`, [ref])))).toBe('42501');
  });
});
