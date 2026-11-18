/**
 * Workspace Guide: echte SQL/RLS-Integrationstests.
 * Migration und Testdaten werden in closeDb() per ROLLBACK verworfen.
 * Ohne Testdatenbank wird der Block übersprungen; REQUIRE_DB_TESTS=1 erzwingt ihn.
 */
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyMigration, closeDb, createTenantWithMember, openDb,
  requireDbOrFail, type DbCtx,
} from './db-helpers';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'supabase', 'migrations');
const MIGRATION = '20261118150000_workspace_onboarding_state.sql';
const d = requireDbOrFail('workspace-onboarding RLS') ? describe : describe.skip;

interface Fixture { tenantId: string; userId: string }

d('Workspace Guide – RLS pro Mandant UND Benutzer', () => {
  let ctx: DbCtx;
  let a: Fixture;
  let b: Fixture;

  beforeEach(async () => {
    ctx = await openDb();
    // CI spielt sämtliche Migrationen bereits vor den DB-Tests ein.
    // Nur im minimalen Test-Harnisch fehlt diese Tabelle noch; dort
    // wenden wir die Migration INNERHALB der Testtransaktion an.
    const existing = await ctx.client.query<{ name: string | null }>(
      "select to_regclass('public.workspace_onboarding_state')::text as name",
    );
    if (!existing.rows[0]?.name) {
      await applyMigration(ctx, MIGRATIONS_DIR, MIGRATION);
    }
    a = await createTenantWithMember(ctx, { tenantName: 'onboarding-a' });
    b = await createTenantWithMember(ctx, { tenantName: 'onboarding-b' });
  });

  afterEach(async () => { await closeDb(ctx); });

  it('Mitglied kann eigenen Fortschritt lesen und aktualisieren, Fremder nicht', async () => {
    await ctx.withClaims({ sub: a.userId }, async () => {
      const created = await ctx.client.query(
        "insert into public.workspace_onboarding_state (tenant_id,user_id,focus,completed_steps) values ($1,$2,'governance',array['profile']::text[]) returning focus",
        [a.tenantId, a.userId],
      );
      expect(created.rows[0]!.focus).toBe('governance');
      const updated = await ctx.client.query(
        "update public.workspace_onboarding_state set focus='voice', completed_steps=array['profile','focus']::text[] where tenant_id=$1 and user_id=$2 returning focus",
        [a.tenantId, a.userId],
      );
      expect(updated.rows[0]!.focus).toBe('voice');
    });
    await ctx.withClaims({ sub: b.userId }, async () => {
      const forbiddenRead = await ctx.client.query(
        'select * from public.workspace_onboarding_state where tenant_id=$1', [a.tenantId],
      );
      expect(forbiddenRead.rowCount).toBe(0);
      const forbiddenUpdate = await ctx.client.query(
        "update public.workspace_onboarding_state set focus='builder' where tenant_id=$1 returning tenant_id",
        [a.tenantId],
      );
      expect(forbiddenUpdate.rowCount).toBe(0);
    });
    await ctx.withClaims({ sub: a.userId }, async () => {
      const own = await ctx.client.query(
        'select focus,completed_steps from public.workspace_onboarding_state where tenant_id=$1 and user_id=$2',
        [a.tenantId, a.userId],
      );
      expect(own.rows).toEqual([{ focus: 'voice', completed_steps: ['profile', 'focus'] }]);
    });
  });

  it('Fremder kann weder fremden Tenant noch fremde Benutzer-ID beanspruchen', async () => {
    await expect(ctx.withClaims({ sub: b.userId }, () =>
      ctx.client.query('insert into public.workspace_onboarding_state(tenant_id,user_id) values ($1,$2)',
        [a.tenantId, b.userId]),
    )).rejects.toThrow();

    await expect(ctx.withClaims({ sub: b.userId }, () =>
      ctx.client.query('insert into public.workspace_onboarding_state(tenant_id,user_id) values ($1,$2)',
        [b.tenantId, a.userId]),
    )).rejects.toThrow();

    const { rows } = await ctx.client.query('select count(*)::int as n from public.workspace_onboarding_state');
    expect(rows[0]!.n).toBe(0);
  });

  it('Besitzer kann user_id und tenant_id nicht auf einen Fremden umschreiben', async () => {
    await ctx.withClaims({ sub: a.userId }, () =>
      ctx.client.query('insert into public.workspace_onboarding_state(tenant_id,user_id) values ($1,$2)',
        [a.tenantId, a.userId]),
    );
    await expect(ctx.withClaims({ sub: a.userId }, () =>
      ctx.client.query('update public.workspace_onboarding_state set user_id=$1 where tenant_id=$2 and user_id=$3',
        [b.userId, a.tenantId, a.userId]),
    )).rejects.toThrow();
    await expect(ctx.withClaims({ sub: a.userId }, () =>
      ctx.client.query('update public.workspace_onboarding_state set tenant_id=$1 where tenant_id=$2 and user_id=$3',
        [b.tenantId, a.tenantId, a.userId]),
    )).rejects.toThrow();
  });

  it('unerlaubte Statuswerte werden in Postgres zurückgewiesen', async () => {
    await expect(ctx.withClaims({ sub: a.userId }, () =>
      ctx.client.query("insert into public.workspace_onboarding_state(tenant_id,user_id,focus) values ($1,$2,'published')",
        [a.tenantId, a.userId]),
    )).rejects.toThrow();
    await expect(ctx.withClaims({ sub: a.userId }, () =>
      ctx.client.query("insert into public.workspace_onboarding_state(tenant_id,user_id,completed_steps) values ($1,$2,array['production-approved']::text[])",
        [a.tenantId, a.userId]),
    )).rejects.toThrow();
  });

  it('ein Kunde kann mangels DELETE-Policy keinen Status löschen', async () => {
    await ctx.withClaims({ sub: a.userId }, () =>
      ctx.client.query('insert into public.workspace_onboarding_state(tenant_id,user_id) values ($1,$2)',
        [a.tenantId, a.userId]),
    );
    await ctx.withClaims({ sub: a.userId }, async () => {
      const result = await ctx.client.query(
        'delete from public.workspace_onboarding_state where tenant_id=$1 and user_id=$2 returning tenant_id',
        [a.tenantId, a.userId],
      );
      expect(result.rowCount).toBe(0);
    });
  });
});
