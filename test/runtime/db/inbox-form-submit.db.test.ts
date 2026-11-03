/**
 * PR C, Schritt 3: Schreibpfad von inbox-form-submit gegen echtes Postgres.
 *
 * Die echte Logik (`resolveInbox`, `submitFormRequest` aus
 * supabase/functions/inbox-form-submit/logic.ts) läuft über einen pg-Adapter
 * als service_role — so wie die Function mit dem Service-Role-Client.
 *
 * Geprüft
 *   S1  Aktive, live geschaltete Seite → Konversation (form, open) + Intake im
 *       Mandanten des Bindings; Guard-Trigger lässt service_role durch
 *   S2  Gleiche Nonce zweimal → genau eine Konversation, ein Intake
 *       (eindeutiger Index bot_id/external_ref liefert 23505)
 *   S3  Abgebrochener erster Versuch (Konversation ohne Intake) → Wiederholung
 *       ergänzt den Intake
 *   S4  Deaktiviertes Binding / Seite nicht live / unbekannte site_ref →
 *       keine Auflösung, nichts geschrieben
 *   S5  Andere Nonce → zweite Konversation; Mandant B sieht nichts von A
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, getDbUrl, openDb, type DbCtx } from './db-helpers';
import {
  resolveInbox,
  submitFormRequest,
  validateFormBody,
  type FormInput,
  type InboxDbClient,
} from '../../../supabase/functions/inbox-form-submit/logic';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

interface PgError extends Error { code?: string }
const SERVER = { role: 'service_role' } as const;

const IDENT = /^[a-z_]+$/;

/** pg-Adapter mit der Form von supabase-js, die logic.ts benutzt. Läuft als service_role. */
function pgInboxClient(ctx: DbCtx): InboxDbClient {
  const run = async (sql: string, params: unknown[]) => {
    try {
      const res = await ctx.withClaims(SERVER, () => ctx.client.query(sql, params));
      return { rows: res.rows, error: null };
    } catch (e) {
      return { rows: [], error: { code: (e as PgError).code, message: (e as Error).message } };
    }
  };
  const insertSql = (table: string, row: Record<string, unknown>, returning: string | null) => {
    const cols = Object.keys(row);
    if (!IDENT.test(table) || !cols.every((c) => IDENT.test(c))) throw new Error('bad identifier');
    const vals = cols.map((c) => {
      const v = row[c];
      return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
    });
    const sql = `INSERT INTO public.${table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`
      + (returning ? ` RETURNING ${returning}` : '');
    return { sql, vals };
  };
  return {
    rpc: async (fn, args) => {
      if (fn !== 'resolve_site_inbox') throw new Error(`unexpected rpc ${fn}`);
      const r = await run(`SELECT * FROM public.resolve_site_inbox($1)`, [args.p_site_ref]);
      return { data: r.error ? null : r.rows, error: r.error };
    },
    from: (table) => ({
      insert: (row) => {
        const plain = (async () => {
          const { sql, vals } = insertSql(table, row, null);
          return { error: (await run(sql, vals)).error };
        })();
        return Object.assign(plain, {
          select: (cols: string) => ({
            single: async () => {
              if (!IDENT.test(cols)) throw new Error('bad identifier');
              const { sql, vals } = insertSql(table, row, cols);
              const r = await run(sql, vals);
              return { data: r.rows[0] ?? null, error: r.error };
            },
          }),
        });
      },
      select: (cols) => ({
        eq: (c1, v1) => ({
          eq: (c2, v2) => ({
            maybeSingle: async () => {
              if (![table, cols, c1, c2].every((s) => IDENT.test(s))) throw new Error('bad identifier');
              const r = await run(`SELECT ${cols} FROM public.${table} WHERE ${c1} = $1 AND ${c2} = $2`, [v1, v2]);
              return { data: r.rows[0] ?? null, error: r.error };
            },
          }),
        }),
      }),
    }),
  } as InboxDbClient;
}

async function fixtures(ctx: DbCtx, tenantId: string, opts: { enabled?: boolean; pageStatus?: string } = {}) {
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
       VALUES ($1, 'Seite', 'handwerker', $2) RETURNING id`, [tenantId, opts.pageStatus ?? 'live'],
    )).rows[0]!.id;
    const siteRef = (await ctx.client.query<{ site_ref: string }>(
      `INSERT INTO public.site_inbox_bindings (tenant_id, website_project_id, bot_id, enabled)
       VALUES ($1, $2, $3, $4) RETURNING site_ref`, [tenantId, page, bot, opts.enabled ?? true],
    )).rows[0]!.site_ref;
    return { bot, page, siteRef };
  });
}

function formInput(siteRef: string, nonce: string): FormInput {
  const v = validateFormBody({
    site_ref: siteRef,
    nonce,
    anliegen: 'Wasserhahn tropft.',
    kontakt_name: 'Max Muster',
    kontakt_telefon: '030 123456',
    terminwunsch: 'Freitag',
  });
  if (!v.ok) throw new Error(`fixture invalid: ${v.field}`);
  return v.input;
}

async function counts(ctx: DbCtx, tenantId: string) {
  return ctx.withClaims(SERVER, async () => {
    const c = await ctx.client.query<{ n: string }>(
      `SELECT count(*) AS n FROM public.bot_conversations WHERE tenant_id = $1`, [tenantId]);
    const i = await ctx.client.query<{ n: string }>(
      `SELECT count(*) AS n FROM public.bot_conversation_intake WHERE tenant_id = $1`, [tenantId]);
    return { conversations: Number(c.rows[0]!.n), intakes: Number(i.rows[0]!.n) };
  });
}

const NONCE = 'nonce-0123456789abcdef';

d('inbox-form-submit write path', () => {
  let ctx: DbCtx;
  let a: { tenantId: string; userId: string };
  let b: { tenantId: string; userId: string };

  beforeEach(async () => {
    ctx = await openDb();
    a = await createTenantWithMember(ctx);
    b = await createTenantWithMember(ctx);
  });
  afterEach(async () => { await closeDb(ctx); });

  it('S1 creates an open form conversation with intake in the binding tenant', async () => {
    const f = await fixtures(ctx, a.tenantId);
    const db = pgInboxClient(ctx);
    const resolved = await resolveInbox(db, f.siteRef);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.inbox).toMatchObject({ tenantId: a.tenantId, botId: f.bot, websiteProjectId: f.page });

    expect(await submitFormRequest(db, resolved.inbox, formInput(f.siteRef, NONCE), new Date()))
      .toEqual({ ok: true, duplicate: false });

    const row = await ctx.withClaims(SERVER, async () => (await ctx.client.query(
      `SELECT c.channel, c.status, c.external_ref, c.assigned_to, i.quelle, i.anliegen, i.terminwunsch, i.einwilligung_at
         FROM public.bot_conversations c JOIN public.bot_conversation_intake i ON i.conversation_id = c.id
        WHERE c.tenant_id = $1`, [a.tenantId],
    )).rows);
    expect(row).toEqual([{
      channel: 'form', status: 'open', external_ref: `form:${NONCE}`, assigned_to: null,
      quelle: 'form', anliegen: 'Wasserhahn tropft.', terminwunsch: 'Freitag', einwilligung_at: null,
    }]);
  });

  it('S2 same nonce twice → exactly one conversation and one intake', async () => {
    const f = await fixtures(ctx, a.tenantId);
    const db = pgInboxClient(ctx);
    const resolved = await resolveInbox(db, f.siteRef);
    if (!resolved.ok) throw new Error('not resolved');
    const input = formInput(f.siteRef, NONCE);

    expect(await submitFormRequest(db, resolved.inbox, input, new Date())).toEqual({ ok: true, duplicate: false });
    expect(await submitFormRequest(db, resolved.inbox, input, new Date())).toEqual({ ok: true, duplicate: true });
    expect(await counts(ctx, a.tenantId)).toEqual({ conversations: 1, intakes: 1 });
  });

  it('S3 retry after an aborted first attempt adds the missing intake', async () => {
    const f = await fixtures(ctx, a.tenantId);
    await ctx.withClaims(SERVER, () => ctx.client.query(
      `INSERT INTO public.bot_conversations (tenant_id, bot_id, channel, status, external_ref)
       VALUES ($1, $2, 'form', 'open', $3)`, [a.tenantId, f.bot, `form:${NONCE}`],
    ));
    expect(await counts(ctx, a.tenantId)).toEqual({ conversations: 1, intakes: 0 });

    const db = pgInboxClient(ctx);
    const resolved = await resolveInbox(db, f.siteRef);
    if (!resolved.ok) throw new Error('not resolved');
    expect(await submitFormRequest(db, resolved.inbox, formInput(f.siteRef, NONCE), new Date()))
      .toEqual({ ok: true, duplicate: true });
    expect(await counts(ctx, a.tenantId)).toEqual({ conversations: 1, intakes: 1 });
  });

  it('S4 disabled binding, draft page and unknown site_ref do not resolve', async () => {
    const off = await fixtures(ctx, a.tenantId, { enabled: false });
    const draft = await fixtures(ctx, b.tenantId, { pageStatus: 'draft' });
    const db = pgInboxClient(ctx);
    expect(await resolveInbox(db, off.siteRef)).toEqual({ ok: false, reason: 'not_found' });
    expect(await resolveInbox(db, draft.siteRef)).toEqual({ ok: false, reason: 'not_found' });
    expect(await resolveInbox(db, 'AAAAAAAAAAAAAAAAAAAAAAAA')).toEqual({ ok: false, reason: 'not_found' });
    expect(await counts(ctx, a.tenantId)).toEqual({ conversations: 0, intakes: 0 });
    expect(await counts(ctx, b.tenantId)).toEqual({ conversations: 0, intakes: 0 });
  });

  it('S5 different nonces create separate requests; other tenant sees none', async () => {
    const f = await fixtures(ctx, a.tenantId);
    const db = pgInboxClient(ctx);
    const resolved = await resolveInbox(db, f.siteRef);
    if (!resolved.ok) throw new Error('not resolved');
    await submitFormRequest(db, resolved.inbox, formInput(f.siteRef, NONCE), new Date());
    await submitFormRequest(db, resolved.inbox, formInput(f.siteRef, 'nonce-fedcba9876543210'), new Date());
    expect(await counts(ctx, a.tenantId)).toEqual({ conversations: 2, intakes: 2 });

    const seenByB = await ctx.withClaims({ sub: b.userId, role: 'authenticated' }, async () => ({
      conversations: (await ctx.client.query(`SELECT 1 FROM public.bot_conversations`)).rowCount,
      intakes: (await ctx.client.query(`SELECT 1 FROM public.bot_conversation_intake`)).rowCount,
    }));
    expect(seenByB).toEqual({ conversations: 0, intakes: 0 });
  });
});
