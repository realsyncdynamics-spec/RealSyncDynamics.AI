/**
 * Schreibrechte auf public.bots — nur Owner/Admin (Migration 20261109113141).
 *
 * ## Matrix
 *
 *   owner, admin               → anlegen, ändern (inkl. enabled), löschen: OK
 *   editor, dpo, viewer_auditor→ anlegen 42501, ändern/löschen wirkungslos
 *                                (RLS filtert, 0 Zeilen), Lesen weiterhin OK
 *   Owner von A                → Bot nicht in Mandant B verschieben
 *   Policy-Bestand             → keine schreibende Policy mehr mit
 *                                is_tenant_member
 *
 * Fixtures laufen mit service_role-Claims (siehe bots-quota.db.test.ts).
 * Ohne TEST_DB_URL wird übersprungen.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { createTenantWithMember, closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

interface PgError extends Error { code?: string; detail?: string }
const SERVER = { role: 'service_role' } as const;

async function planSetzen(client: Client, tenantId: string, planKey: string): Promise<void> {
  await client.query(
    `INSERT INTO public.subscriptions (tenant_id, plan_key, status)
     VALUES ($1, $2, 'active')
     ON CONFLICT (tenant_id) DO UPDATE
       SET plan_key = EXCLUDED.plan_key, status = 'active',
           stripe_price_id = NULL, past_due_since = NULL, updated_at = now()`,
    [tenantId, planKey],
  );
}

/** Weiteres Mitglied mit Rolle anlegen. */
async function mitgliedAnlegen(client: Client, tenantId: string, role: string): Promise<string> {
  const email = `r_${role}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`;
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [email],
  );
  const userId = rows[0]!.id;
  await client.query(
    `INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1, $2, $3)`,
    [tenantId, userId, role],
  );
  return userId;
}

async function botAnlegenAlsServer(ctx: DbCtx, tenantId: string, name: string): Promise<string> {
  return ctx.withClaims(SERVER, async () => {
    const { rows } = await ctx.client.query<{ id: string }>(
      `INSERT INTO public.bots (tenant_id, name, enabled) VALUES ($1, $2, false) RETURNING id`,
      [tenantId, name],
    );
    return rows[0]!.id;
  });
}

async function code(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'OK';
  } catch (e) {
    const err = e as PgError;
    return err.code || err.detail || err.message;
  }
}

d('bots — Schreibrechte nur Owner/Admin', () => {
  let ctx: DbCtx;

  beforeEach(async () => {
    ctx = await openDb();
  });

  afterEach(async () => {
    await closeDb(ctx);
  });

  it('keine schreibende Policy prüft nur die Mitgliedschaft', async () => {
    const { rows } = await ctx.client.query<{ policyname: string; cmd: string; expr: string }>(
      `SELECT policyname, cmd, coalesce(qual, '') || ' ' || coalesce(with_check, '') AS expr
         FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'bots'
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')`,
    );
    expect(rows.map((r) => r.cmd).sort()).toEqual(['DELETE', 'INSERT', 'UPDATE']);
    for (const r of rows) {
      expect(r.expr, r.policyname).toContain('is_tenant_owner_or_admin');
      expect(r.expr, r.policyname).not.toContain('is_tenant_member');
    }
  });

  it.each(['owner', 'admin'])('%s darf anlegen, aktivieren und löschen', async (role) => {
    const { tenantId, userId: ownerId } = await createTenantWithMember(ctx);
    await planSetzen(ctx.client, tenantId, 'growth');
    const userId = role === 'owner' ? ownerId : await mitgliedAnlegen(ctx.client, tenantId, role);

    const ergebnis = await code(() => ctx.withClaims({ sub: userId }, async () => {
      const { rows } = await ctx.client.query<{ id: string }>(
        `INSERT INTO public.bots (tenant_id, name, enabled) VALUES ($1, 'b', false) RETURNING id`, [tenantId],
      );
      const id = rows[0]!.id;
      const upd = await ctx.client.query(`UPDATE public.bots SET enabled = true WHERE id = $1`, [id]);
      expect(upd.rowCount).toBe(1);
      const del = await ctx.client.query(`DELETE FROM public.bots WHERE id = $1`, [id]);
      expect(del.rowCount).toBe(1);
    }));
    expect(ergebnis).toBe('OK');
  });

  it.each(['editor', 'dpo', 'viewer_auditor'])('%s darf nicht schreiben, aber lesen', async (role) => {
    const { tenantId } = await createTenantWithMember(ctx);
    await planSetzen(ctx.client, tenantId, 'growth');
    const userId = await mitgliedAnlegen(ctx.client, tenantId, role);
    const botId = await botAnlegenAlsServer(ctx, tenantId, 'bestand');

    // Anlegen: Trigger und Policy lehnen gleich ab, kein Plan-/Quota-Code.
    expect(await code(() => ctx.withClaims({ sub: userId }, () =>
      ctx.client.query(`INSERT INTO public.bots (tenant_id, name) VALUES ($1, 'neu')`, [tenantId]),
    ))).toBe('42501');

    // Ändern/Löschen: RLS filtert die Zeile, nichts passiert.
    const { upd, del, sel } = await ctx.withClaims({ sub: userId }, async () => ({
      upd: (await ctx.client.query(`UPDATE public.bots SET enabled = true, persona = 'x' WHERE id = $1`, [botId])).rowCount,
      del: (await ctx.client.query(`DELETE FROM public.bots WHERE id = $1`, [botId])).rowCount,
      sel: (await ctx.client.query(`SELECT id FROM public.bots WHERE id = $1`, [botId])).rowCount,
    }));
    expect(upd, 'UPDATE wirkungslos').toBe(0);
    expect(del, 'DELETE wirkungslos').toBe(0);
    expect(sel, 'Lesen bleibt erlaubt').toBe(1);

    const { rows } = await ctx.client.query<{ enabled: boolean; persona: string | null }>(
      `SELECT enabled, persona FROM public.bots WHERE id = $1`, [botId],
    );
    expect(rows[0]).toEqual({ enabled: false, persona: null });
  });

  it('Owner von A kann einen Bot nicht in Mandant B verschieben', async () => {
    const a = await createTenantWithMember(ctx);
    const b = await createTenantWithMember(ctx);
    await planSetzen(ctx.client, a.tenantId, 'growth');
    await mitgliedAnlegen(ctx.client, b.tenantId, 'viewer_auditor');
    const botId = await botAnlegenAlsServer(ctx, a.tenantId, 'a-bot');

    expect(await code(() => ctx.withClaims({ sub: a.userId }, () =>
      ctx.client.query(`UPDATE public.bots SET tenant_id = $1 WHERE id = $2`, [b.tenantId, botId]),
    ))).toBe('42501');
  });
});
